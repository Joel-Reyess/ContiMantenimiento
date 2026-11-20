using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Services;

/// <summary>
/// Etapa SELECCIÓN del flujo (Reporte 6, OT-28 a OT-34): en cuanto la unidad se entrega en la Zona de Transición
/// (dañados), el sistema asigna la orden a la siguiente empresa elegible por turnos (A → B → C → A) y a uno de sus
/// técnicos. Elegible = empresa activa, con técnicos activos, saldo ≥ mínimo configurado (y mayor a $0) y menos
/// órdenes activas que la capacidad máxima. Órdenes activas = aceptadas por el taller y aún no DISPONIBLES.
/// Si ninguna es elegible, la orden se queda en SELECCIÓN "Sin disponibilidad" y se reintenta sola cuando se
/// asigna presupuesto, se activa una empresa o se libera capacidad. La reasignación manual (Administrador y Gerente)
/// solo se permite antes de que el taller acepte la orden y siempre queda en el historial con su motivo.
/// </summary>
public class SeleccionService
{
    /// <summary>Una sola selección a la vez: el turno de la rotación no se debe repetir</summary>
    private static readonly SemaphoreSlim Candado = new(1, 1);

    /// <summary>Aceptadas y aún no liberadas (DISPONIBLE)</summary>
    public static readonly EstadoOrdenTrabajoEnum[] EstadosActivos =
    {
        EstadoOrdenTrabajoEnum.Asignada, EstadoOrdenTrabajoEnum.EnProceso, EstadoOrdenTrabajoEnum.EsperandoRefacciones, EstadoOrdenTrabajoEnum.Completada
    };

    private static readonly EstadoOrdenTrabajoEnum[] Cerradas =
    {
        EstadoOrdenTrabajoEnum.Validada, EstadoOrdenTrabajoEnum.Entregado, EstadoOrdenTrabajoEnum.Cancelada
    };

    private readonly MantenimientoDbContext _db;
    private readonly PresupuestoService _presupuesto;
    private readonly FlujoAvisos _avisos;
    private readonly OrdenPagoService _pagos;

    public SeleccionService(MantenimientoDbContext db, PresupuestoService presupuesto, FlujoAvisos avisos, OrdenPagoService pagos)
    {
        _db = db;
        _presupuesto = presupuesto;
        _avisos = avisos;
        _pagos = pagos;
    }

    // ===================== Consultas =====================

    /// <summary>Órdenes activas de la empresa: aceptadas por el taller y aún no DISPONIBLES</summary>
    public IQueryable<OrdenTrabajo> ActivasDe(int empresaId) => _db.OrdenesTrabajo
        .Where(o => o.EmpresaId == empresaId && o.FechaAceptacion != null && EstadosActivos.Contains(o.Estado));

    /// <summary>Esperan empresa: entregadas en la zona de dañados, sin empresa y sin aceptar</summary>
    public IQueryable<OrdenTrabajo> EsperandoEmpresa() => _db.OrdenesTrabajo
        .Where(o => o.FechaTrasladoIngreso != null && o.FechaAceptacion == null && o.EmpresaId == null
                    && (o.Estado == EstadoOrdenTrabajoEnum.Pendiente || o.Estado == EstadoOrdenTrabajoEnum.Asignada));

    public static string Semaforo(int activas, int capacidad)
    {
        // PDF: 0-6 verde, 7-9 amarillo, 10 rojo (sobre 10; se escala si la capacidad es otra)
        if (activas >= capacidad) return "rojo";
        return activas >= Math.Max(1, (int)Math.Round(capacidad * 0.7, MidpointRounding.AwayFromZero)) ? "amarillo" : "verde";
    }

    /// <summary>Situación de todas las empresas (activas e inactivas) para la asignación</summary>
    public async Task<List<EmpresaSeleccionDto>> EvaluarAsync(ConfigSeleccionDto? config = null)
    {
        config ??= await _presupuesto.LeerConfigAsync();
        var empresas = await _db.Empresas.AsNoTracking().OrderBy(e => e.Id)
            .Select(e => new { e.Id, e.Nombre, e.Identificador, e.Activo, e.ProveedorElectrico }).ToListAsync();
        var saldos = await _presupuesto.SaldosAsync();
        var activas = await _db.OrdenesTrabajo.AsNoTracking()
            .Where(o => o.EmpresaId != null && o.FechaAceptacion != null && EstadosActivos.Contains(o.Estado))
            .GroupBy(o => o.EmpresaId!.Value).Select(g => new { g.Key, N = g.Count() })
            .ToDictionaryAsync(x => x.Key, x => x.N);
        var tecnicos = await _db.Users.AsNoTracking()
            .Where(u => u.EmpresaId != null && u.Status == UserStatusEnum.Activo && u.Roles.Any(r => r.Nombre == "Tecnico"))
            .Select(u => new
            {
                u.Id, u.NombreCompleto, EmpresaId = u.EmpresaId!.Value,
                Ordenes = _db.OrdenesTrabajo.Count(o => o.TecnicoAsignadoId == u.Id && !Cerradas.Contains(o.Estado))
            })
            .ToListAsync();

        var lista = new List<EmpresaSeleccionDto>();
        foreach (var e in empresas)
        {
            var s = saldos.TryGetValue(e.Id, out var x) ? x : new SaldoEmpresa(0, 0, false);
            var n = activas.GetValueOrDefault(e.Id);
            var tecs = tecnicos.Where(t => t.EmpresaId == e.Id)
                .Select(t => new TecnicoSeleccionDto { Id = t.Id, Nombre = t.NombreCompleto, Ordenes = t.Ordenes })
                .OrderBy(t => t.Ordenes).ThenBy(t => t.Id).ToList();
            string? motivo = null;
            string disponibilidad = "Disponible";
            if (!e.Activo) { motivo = "Empresa inactiva"; disponibilidad = "Inactiva"; }
            // El proveedor de equipos eléctricos no entra a la rotación de contenedores (tiene su propio flujo)
            else if (e.ProveedorElectrico) { motivo = "Proveedor de equipos eléctricos (no recibe contenedores)"; disponibilidad = "Equipos eléctricos"; }
            else if (!s.TienePresupuesto) { motivo = "Sin presupuesto asignado"; disponibilidad = "Sin presupuesto"; }
            else if (s.Saldo <= 0 || s.Saldo < config.SaldoMinimo)
            {
                motivo = s.Saldo <= 0
                    ? $"Presupuesto agotado (saldo {PresupuestoService.Moneda(s.Saldo)})"
                    : $"Saldo {PresupuestoService.Moneda(s.Saldo)} menor al mínimo de {PresupuestoService.Moneda(config.SaldoMinimo)}";
                disponibilidad = "Sin presupuesto";
            }
            else if (n >= config.CapacidadMaxima) { motivo = $"Capacidad máxima alcanzada ({n} de {config.CapacidadMaxima} órdenes activas)"; disponibilidad = "Capacidad máxima"; }
            else if (tecs.Count == 0) { motivo = "Sin técnicos activos"; disponibilidad = "Sin técnicos"; }

            lista.Add(new EmpresaSeleccionDto
            {
                Id = e.Id, Nombre = e.Nombre, Identificador = e.Identificador, Activa = e.Activo,
                TienePresupuesto = s.TienePresupuesto, Asignado = s.Asignado, Utilizado = s.Utilizado, Saldo = s.Saldo,
                EstadoFinanciero = PresupuestoService.EstadoFinanciero(s, config.UmbralPreventivo),
                Activas = n, Capacidad = config.CapacidadMaxima, SemaforoCapacidad = Semaforo(n, config.CapacidadMaxima),
                Elegible = motivo == null, Motivo = motivo, Disponibilidad = disponibilidad, Tecnicos = tecs
            });
        }
        return lista;
    }

    // ===================== Asignación automática =====================

    /// <summary>
    /// Asigna empresa y técnico a la orden si está esperando empresa. Devuelve true si quedó asignada.
    /// Si ninguna empresa es elegible la deja "Sin disponibilidad" (avisa al Gerente la primera vez).
    /// </summary>
    public async Task<bool> SeleccionarAsync(int ordenId, int? actor)
    {
        await Candado.WaitAsync();
        try
        {
            return await SeleccionarSinCandadoAsync(ordenId, actor, await EvaluarAsync());
        }
        finally
        {
            Candado.Release();
        }
    }

    private async Task<bool> SeleccionarSinCandadoAsync(int ordenId, int? actor, List<EmpresaSeleccionDto> empresas)
    {
        var o = await _db.OrdenesTrabajo.FirstOrDefaultAsync(x => x.Id == ordenId);
        if (o == null || o.EmpresaId != null || o.FechaAceptacion != null || o.FechaTrasladoIngreso == null
            || !(o.Estado == EstadoOrdenTrabajoEnum.Pendiente || o.Estado == EstadoOrdenTrabajoEnum.Asignada))
            return false;

        var ultima = await _db.ConfiguracionSistema.AsNoTracking()
            .Where(c => c.Clave == PresupuestoService.ClaveUltimaEmpresa).Select(c => c.Valor).FirstOrDefaultAsync();
        var puntero = int.TryParse(ultima, out var p) ? p : 0;
        // Turno: la siguiente empresa después de la última que recibió orden (A → B → C → A)
        var turno = empresas.Where(e => e.Id > puntero).Concat(empresas.Where(e => e.Id <= puntero)).ToList();
        var elegida = turno.FirstOrDefault(e => e.Elegible);

        if (elegida == null)
        {
            if (o.FechaSinProveedor == null)
            {
                o.FechaSinProveedor = DateTime.UtcNow;
                o.UpdatedAt = DateTime.UtcNow;
                var razones = empresas.Count == 0 ? "No hay empresas proveedoras registradas."
                    : string.Join("; ", empresas.Select(e => $"{e.Nombre}: {e.Motivo}"));
                FlujoHistorial.Agregar(_db, o.ReporteFallaId, o.Id, "SELECCION", "SinDisponibilidad", null, "Sistema", "Sistema",
                    $"No hay empresas proveedoras disponibles. {razones}");
                await _db.SaveChangesAsync();
                await _avisos.SinProveedorAsync(o.Id, o.Folio, actor);
            }
            return false;
        }

        var tecnico = elegida.Tecnicos.First();
        Asignar(o, elegida.Id, tecnico.Id);
        await _presupuesto.GuardarValorAsync(PresupuestoService.ClaveUltimaEmpresa, elegida.Id.ToString(), "int",
            "Última empresa que recibió una orden en la asignación por turnos", actor);
        FlujoHistorial.Agregar(_db, o.ReporteFallaId, o.Id, "SELECCION", "Asignada", null, "Sistema", "Sistema",
            $"Asignación automática por turno: {elegida.Nombre} · técnico {tecnico.Nombre}",
            new { empresaId = elegida.Id, empresa = elegida.Nombre, tecnicoId = tecnico.Id, tecnico = tecnico.Nombre });
        await _db.SaveChangesAsync();
        await _avisos.OrdenAsignadaAEmpresaAsync(o.Id, elegida.Nombre, actor);
        return true;
    }

    private static void Asignar(OrdenTrabajo o, int empresaId, int tecnicoId)
    {
        o.EmpresaId = empresaId;
        o.TecnicoAsignadoId = tecnicoId;
        if (o.Estado == EstadoOrdenTrabajoEnum.Pendiente) o.Estado = EstadoOrdenTrabajoEnum.Asignada;
        o.FechaAsignacion = DateTime.UtcNow;
        o.FechaSeleccion = DateTime.UtcNow;
        o.FechaSinProveedor = null;
        o.FechaAceptacionBloqueada = null;
        o.UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Reintenta la asignación de todas las órdenes que esperan empresa, en el orden en que llegaron a la zona.
    /// Se llama al asignar presupuesto, activar una empresa o un técnico, liberar capacidad o con el botón del Gerente.
    /// </summary>
    public async Task<int> ReintentarAsync(int? actor)
    {
        var ids = await EsperandoEmpresa().OrderBy(o => o.FechaTrasladoIngreso).ThenBy(o => o.Id).Select(o => o.Id).ToListAsync();
        if (ids.Count == 0) return 0;
        await Candado.WaitAsync();
        try
        {
            var asignadas = 0;
            var empresas = await EvaluarAsync();
            foreach (var id in ids)
            {
                if (!await SeleccionarSinCandadoAsync(id, actor, empresas)) break; // si una no cupo, las siguientes tampoco
                asignadas++;
                // La rotación avanza y los conteos cambian: volver a evaluar antes de la siguiente
                empresas = await EvaluarAsync();
            }
            return asignadas;
        }
        finally
        {
            Candado.Release();
        }
    }

    /// <summary>
    /// Se liberó capacidad (una orden llegó a DISPONIBLE, se eliminó o se canceló): avisa a los técnicos que tenían una
    /// aceptación bloqueada en esa empresa y reintenta las órdenes que esperan empresa.
    /// </summary>
    public async Task CapacidadLiberadaAsync(int? empresaId, int? actor)
    {
        if (empresaId.HasValue)
        {
            var config = await _presupuesto.LeerConfigAsync();
            var activas = await ActivasDe(empresaId.Value).CountAsync();
            if (activas < config.CapacidadMaxima)
            {
                var bloqueadas = await _db.OrdenesTrabajo
                    .Where(o => o.EmpresaId == empresaId && o.FechaAceptacion == null && o.FechaAceptacionBloqueada != null
                                && !Cerradas.Contains(o.Estado))
                    .ToListAsync();
                foreach (var o in bloqueadas) o.FechaAceptacionBloqueada = null;
                if (bloqueadas.Count > 0)
                {
                    await _db.SaveChangesAsync();
                    foreach (var o in bloqueadas) await _avisos.CapacidadLiberadaAsync(o.Id, actor);
                }
            }
        }
        await ReintentarAsync(actor);
    }

    // ===================== Capacidad al aceptar =====================

    /// <summary>Órdenes activas de la empresa y su capacidad máxima</summary>
    public async Task<(int Activas, int Capacidad)> CapacidadAsync(int empresaId) =>
        (await ActivasDe(empresaId).CountAsync(), (await _presupuesto.LeerConfigAsync()).CapacidadMaxima);

    /// <summary>Intento de aceptar con la empresa llena: lo deja registrado y avisa (solo la primera vez por orden)</summary>
    public async Task AceptacionBloqueadaAsync(int ordenId, int activas, int capacidad, int? actor)
    {
        var o = await _db.OrdenesTrabajo.Include(x => x.Empresa).FirstOrDefaultAsync(x => x.Id == ordenId);
        if (o == null || o.FechaAceptacionBloqueada != null) return;
        o.FechaAceptacionBloqueada = DateTime.UtcNow;
        await FlujoHistorial.AgregarAsync(_db, o.ReporteFallaId, o.Id, "TALLER", "AceptacionBloqueada", actor,
            $"{o.Empresa?.Nombre} tiene {activas} de {capacidad} órdenes activas: la orden permanece en espera hasta liberar capacidad");
        await _db.SaveChangesAsync();
        await _avisos.AceptacionBloqueadaAsync(o.Id, o.Empresa?.Nombre ?? "La empresa", activas, capacidad, actor);
    }

    /// <summary>Después de aceptar: aviso al 80 % (Gerente) y al 100 % (técnicos y Gerente)</summary>
    public async Task AvisarCapacidadAsync(int empresaId, int? actor)
    {
        var (activas, capacidad) = await CapacidadAsync(empresaId);
        var nombre = await _db.Empresas.Where(e => e.Id == empresaId).Select(e => e.Nombre).FirstOrDefaultAsync() ?? "La empresa";
        var ochenta = Math.Max(1, (int)Math.Ceiling(capacidad * 0.8m));
        if (activas >= capacidad)
            await _avisos.CapacidadMaximaEmpresaAsync(empresaId, nombre, activas, capacidad, actor);
        else if (activas == ochenta)
            await _avisos.CapacidadPreventivaEmpresaAsync(empresaId, nombre, activas, capacidad, actor);
    }

    // ===================== Vista previa y reasignación =====================

    public async Task<SeleccionOrdenDto> DetalleAsync(int ordenId)
    {
        var o = await _db.OrdenesTrabajo.AsNoTracking()
                    .Include(x => x.Vehiculo).Include(x => x.TecnicoAsignado)
                    .FirstOrDefaultAsync(x => x.Id == ordenId)
                ?? throw new FlujoException("Orden de trabajo no encontrada", 404);
        var empresas = await EvaluarAsync();
        var cancelada = o.Estado == EstadoOrdenTrabajoEnum.Cancelada;
        var estado = o.FechaAceptacion != null || Cerradas.Contains(o.Estado) ? "aceptada"
            : o.FechaTrasladoIngreso == null ? "pendiente"
            : o.EmpresaId == null ? "sinDisponibilidad"
            : "asignada";
        var historial = await _db.HistorialFlujo.AsNoTracking()
            .Where(h => h.OrdenTrabajoId == ordenId && h.Etapa == "SELECCION")
            .OrderBy(h => h.Fecha).ThenBy(h => h.Id)
            .ToListAsync();
        var dto = new SeleccionOrdenDto
        {
            OrdenId = o.Id, OrdenFolio = o.Folio, VehiculoCodigo = o.Vehiculo?.Codigo, Estado = estado,
            Empresa = o.EmpresaId == null ? null : empresas.FirstOrDefault(e => e.Id == o.EmpresaId),
            TecnicoId = o.TecnicoAsignadoId, Tecnico = o.TecnicoAsignado?.NombreCompleto,
            FechaSeleccion = o.FechaSeleccion, FechaSinProveedor = o.FechaSinProveedor,
            PuedeReasignar = !cancelada && o.FechaTrasladoIngreso != null && o.FechaAceptacion == null
                             && (o.Estado == EstadoOrdenTrabajoEnum.Pendiente || o.Estado == EstadoOrdenTrabajoEnum.Asignada),
            Empresas = empresas,
            Historial = historial.Select(h => new HistorialFlujoDto
            {
                Fecha = h.Fecha, Etapa = h.Etapa, Accion = h.Accion, Usuario = h.NombreUsuario, Rol = h.RolUsuario, Detalle = h.Detalle
            }).ToList()
        };
        if (o.EmpresaId != null)
        {
            dto.CostosAplicables = await _pagos.ActividadesAsync(o.Id, o.EmpresaId);
            dto.CostoEstimado = dto.CostosAplicables.Sum(a => a.Subtotal);
        }
        return dto;
    }

    /// <summary>Reasignación manual del Administrador o el Gerente: solo antes de que el taller acepte la orden</summary>
    public async Task<ResultadoFlujoDto> ReasignarAsync(int ordenId, ReasignarProveedorRequest req, UsuarioFlujo u)
    {
        var motivo = string.IsNullOrWhiteSpace(req.Motivo) ? null : req.Motivo.Trim();
        if (motivo == null) throw new FlujoException("Escribe el motivo de la reasignación.", 400, "MotivoObligatorio");
        if (motivo.Length > 500) motivo = motivo[..500];

        await Candado.WaitAsync();
        try
        {
            var o = await _db.OrdenesTrabajo.Include(x => x.Empresa).Include(x => x.TecnicoAsignado).Include(x => x.Vehiculo)
                        .FirstOrDefaultAsync(x => x.Id == ordenId)
                    ?? throw new FlujoException("Orden de trabajo no encontrada", 404);
            if (o.Estado == EstadoOrdenTrabajoEnum.Cancelada) throw new FlujoException("La orden está cancelada.");
            if (o.FechaAceptacion != null || !(o.Estado == EstadoOrdenTrabajoEnum.Pendiente || o.Estado == EstadoOrdenTrabajoEnum.Asignada))
                throw new FlujoException("El taller ya aceptó la orden: la empresa y el técnico ya no se pueden cambiar.");
            if (o.FechaTrasladoIngreso == null)
                throw new FlujoException("La empresa se asigna cuando la unidad se entrega en la Zona de Transición (etapa SELECCIÓN).");

            var empresas = await EvaluarAsync();
            var destino = empresas.FirstOrDefault(e => e.Id == req.EmpresaId) ?? throw new FlujoException("Empresa no encontrada.", 404);
            if (!destino.Activa) throw new FlujoException($"{destino.Nombre} está inactiva. Actívala primero en Empresas Proveedoras.");
            if (destino.Tecnicos.Count == 0) throw new FlujoException($"{destino.Nombre} no tiene técnicos activos.");
            TecnicoSeleccionDto tecnico;
            if (req.TecnicoId.HasValue)
                tecnico = destino.Tecnicos.FirstOrDefault(t => t.Id == req.TecnicoId)
                          ?? throw new FlujoException($"El técnico elegido no es un técnico activo de {destino.Nombre}.", 400);
            else tecnico = destino.Tecnicos.First();
            if (o.EmpresaId == destino.Id && o.TecnicoAsignadoId == tecnico.Id)
                throw new FlujoException($"La orden ya está asignada a {destino.Nombre} con {tecnico.Nombre}.", 400);

            var anterior = o.EmpresaId == null ? "sin empresa" : $"{o.Empresa?.Nombre}" + (o.TecnicoAsignado != null ? $" · técnico {o.TecnicoAsignado.NombreCompleto}" : "");
            var datos = new
            {
                empresaAnteriorId = o.EmpresaId, empresaAnterior = o.Empresa?.Nombre,
                tecnicoAnteriorId = o.TecnicoAsignadoId, tecnicoAnterior = o.TecnicoAsignado?.NombreCompleto,
                empresaId = destino.Id, empresa = destino.Nombre, tecnicoId = tecnico.Id, tecnico = tecnico.Nombre, motivo
            };
            var tecnicoAnterior = o.TecnicoAsignadoId;
            Asignar(o, destino.Id, tecnico.Id);
            FlujoHistorial.Agregar(_db, o.ReporteFallaId, o.Id, "SELECCION", "Reasignada", u.Id, u.Nombre,
                FlujoHistorial.NombreRol(FlujoHistorial.RolPrincipal(u.Roles)),
                $"De {anterior} a {destino.Nombre} · técnico {tecnico.Nombre}. Motivo: {motivo}", datos);
            await _db.SaveChangesAsync();

            await _avisos.OrdenAsignadaAEmpresaAsync(o.Id, destino.Nombre, u.Id);
            if (tecnicoAnterior.HasValue && tecnicoAnterior != tecnico.Id)
                await _avisos.OrdenReasignadaAsync(o.Id, tecnicoAnterior.Value, u.Id);

            var avisos = new List<string>();
            if (!destino.Elegible && destino.Motivo != null) avisos.Add(destino.Motivo);
            return new ResultadoFlujoDto
            {
                Mensaje = $"Orden {o.Folio} reasignada a {destino.Nombre} (técnico {tecnico.Nombre})."
                          + (avisos.Count > 0 ? $" Atención: {string.Join("; ", avisos)}." : ""),
                OrdenId = o.Id, OrdenFolio = o.Folio
            };
        }
        finally
        {
            Candado.Release();
        }
    }
    // ===================== Dashboard (DSH-03) =====================

    /// <summary>Indicadores operativos y financieros por empresa proveedora</summary>
    public async Task<IndicadoresProveedoresDto> IndicadoresAsync()
    {
        var config = await _presupuesto.LeerConfigAsync();
        var empresas = await EvaluarAsync(config);
        var ordenes = await _db.OrdenesTrabajo.AsNoTracking()
            .Where(o => o.EmpresaId != null && o.Estado != EstadoOrdenTrabajoEnum.Cancelada)
            .GroupBy(o => o.EmpresaId!.Value)
            .Select(g => new
            {
                g.Key,
                Total = g.Count(),
                Concluidas = g.Count(o => o.Estado == EstadoOrdenTrabajoEnum.Validada || o.Estado == EstadoOrdenTrabajoEnum.Entregado)
            })
            .ToDictionaryAsync(x => x.Key);
        // Costos: los de las órdenes de pago vigentes (no canceladas), con la empresa con la que se generaron
        var pagos = await _db.RegistrosPago.AsNoTracking()
            .Where(p => p.EmpresaId != null && p.Estado != EstadoPagoEnum.Rechazado)
            .Select(p => new { EmpresaId = p.EmpresaId!.Value, p.MontoTotal, TipoId = (int)p.OrdenTrabajo.Vehiculo.Tipo })
            .ToListAsync();
        var tipos = await _db.TiposVehiculo.AsNoTracking().ToDictionaryAsync(t => t.Id, t => t.Nombre);

        var dto = new IndicadoresProveedoresDto
        {
            OrdenesSinProveedor = await EsperandoEmpresa().CountAsync(),
            CapacidadMaxima = config.CapacidadMaxima
        };
        foreach (var e in empresas)
        {
            var o = ordenes.GetValueOrDefault(e.Id);
            var deEmpresa = pagos.Where(p => p.EmpresaId == e.Id).ToList();
            dto.Empresas.Add(new IndicadorEmpresaDto
            {
                EmpresaId = e.Id, Empresa = e.Nombre, Disponibilidad = e.Disponibilidad, Motivo = e.Motivo,
                OrdenesAtendidas = o?.Total ?? 0,
                ReparacionesConcluidas = o?.Concluidas ?? 0,
                ReparacionesPendientes = (o?.Total ?? 0) - (o?.Concluidas ?? 0),
                Activas = e.Activas, Capacidad = e.Capacidad, SemaforoCapacidad = e.SemaforoCapacidad,
                TienePresupuesto = e.TienePresupuesto, Asignado = e.Asignado, Utilizado = e.Utilizado, Saldo = e.Saldo,
                EstadoFinanciero = e.EstadoFinanciero,
                CostoPromedio = deEmpresa.Count > 0 ? Math.Round(deEmpresa.Average(p => p.MontoTotal), 2) : 0,
                GastoPorTipo = deEmpresa.GroupBy(p => p.TipoId)
                    .Select(g => new GastoTipoVehiculoDto { Tipo = tipos.GetValueOrDefault(g.Key, $"Tipo {g.Key}"), Reparaciones = g.Count(), Total = g.Sum(x => x.MontoTotal) })
                    .OrderByDescending(g => g.Total).ToList()
            });
        }
        // Las activas primero; las inactivas sin historial no aportan al tablero
        dto.Empresas = dto.Empresas.Where(x => x.Disponibilidad != "Inactiva" || x.OrdenesAtendidas > 0 || x.TienePresupuesto).ToList();
        return dto;
    }
}
