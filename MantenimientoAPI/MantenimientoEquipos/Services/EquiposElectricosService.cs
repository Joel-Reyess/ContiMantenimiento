using System.Data;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.Utils;

namespace MantenimientoEquipos.Services;

/// <summary>
/// Flujo de mantenimiento para equipos eléctricos (montacargas, tuggers y traspaletas). Documento preliminar del
/// cliente del 19-nov-2026 (EQE-01 a EQE-12). Coexiste con el flujo de contenedores sin modificarlo:
///  * El flujo lo define el tipo de vehículo (TiposVehiculo.FlujoMantenimiento) y el prefijo detecta el tipo.
///  * Proveedor único (Empresas.ProveedorElectrico): sin Zona de Transición ni selección de empresa; tope de órdenes
///    activas por empresa (mismo parámetro que contenedores) con avisos al 80 % y 100 %.
///  * Correctivo: REPORTE (Líder o Técnico, con horómetro; la orden nace sola) › ACEPTACIÓN y traslado al taller ›
///    INSPECCIÓN PREVIA › REPARACIÓN e inventario › PRUEBAS (si fallan, regresa a reparación) › TRASLADO al área ›
///    ENTREGA (aprobación del Líder en el sistema y documento firmado) › DISPONIBLE (orden de pago).
///  * Preventivo: cada N días o N horas (lo que ocurra primero), ventana de 7 días; solo un Técnico lo inicia;
///    checklist jerárquico (Buen estado / Mal estado) › cierre técnico › traslado › entrega › COMPLETADO.
/// Estado del equipo: Operativo / Fuera de servicio (Pendiente de ingreso, En reparación, En mantenimiento).
/// </summary>
public class EquiposElectricosService
{
    public const string Electrico = "Electrico";
    public const string Contenedor = "Contenedor";
    public const string ClaveHorasAvisoDocumento = "Electrico.HorasAvisoDocumento";
    private const int VentanaDias = 7;
    private const int PeriodicidadPorDefecto = 30;
    private static readonly string[] ExtensionesDocumento = { ".jpg", ".jpeg", ".png", ".pdf" };
    private const long MaxBytesDocumento = 10 * 1024 * 1024;

    private static readonly EstadoOrdenTrabajoEnum[] Cerradas =
        { EstadoOrdenTrabajoEnum.Validada, EstadoOrdenTrabajoEnum.Entregado, EstadoOrdenTrabajoEnum.Cancelada };

    private readonly MantenimientoDbContext _db;
    private readonly OrdenTrabajoService _ordenes;
    private readonly MaterialesOrdenService _materiales;
    private readonly OrdenPagoService _pagos;
    private readonly PresupuestoService _presupuesto;
    private readonly SeleccionService _seleccion;
    private readonly ElectricoAvisos _avisos;
    private readonly IWebHostEnvironment _env;

    public EquiposElectricosService(MantenimientoDbContext db, OrdenTrabajoService ordenes, MaterialesOrdenService materiales,
        OrdenPagoService pagos, PresupuestoService presupuesto, SeleccionService seleccion, ElectricoAvisos avisos, IWebHostEnvironment env)
    {
        _db = db;
        _ordenes = ordenes;
        _materiales = materiales;
        _pagos = pagos;
        _presupuesto = presupuesto;
        _seleccion = seleccion;
        _avisos = avisos;
        _env = env;
    }

    public static bool EsElectrico(OrdenTrabajo o) => o.Flujo == Electrico;
    private static bool Abierta(OrdenTrabajo o) => !Cerradas.Contains(o.Estado);

    public Task<List<int>> TiposElectricosAsync() =>
        _db.TiposVehiculo.Where(t => t.FlujoMantenimiento == Electrico).Select(t => t.Id).ToListAsync();

    public Task<bool> TipoEsElectricoAsync(int tipoId) =>
        _db.TiposVehiculo.AnyAsync(t => t.Id == tipoId && t.FlujoMantenimiento == Electrico);

    public Task<Empresa?> ProveedorAsync() =>
        _db.Empresas.Where(e => e.ProveedorElectrico).OrderByDescending(e => e.Activo).ThenBy(e => e.Id).FirstOrDefaultAsync();

    private void Registrar(int? reporteId, int ordenId, string etapa, string accion, UsuarioFlujo? u, string? detalle, object? datos = null) =>
        FlujoHistorial.Agregar(_db, reporteId, ordenId, etapa, accion, u?.Id, u?.Nombre ?? "Sistema",
            u == null ? "Sistema" : FlujoHistorial.NombreRol(FlujoHistorial.RolPrincipal(u.Roles)), detalle, datos);

    private static string? Limpio(string? t) => string.IsNullOrWhiteSpace(t) ? null : t.Trim();
    private static string? Recortar(string? t, int max) => t == null || t.Length <= max ? t : t[..max];

    // ===================== Estado del equipo y del preventivo =====================

    public static (string Estado, string? Subestado) EstadoEquipo(OrdenTrabajo? abierta)
    {
        if (abierta == null) return ("Operativo", null);
        if (abierta.FechaIngresoTaller == null) return ("Fuera de servicio", "Pendiente de ingreso");
        return ("Fuera de servicio", abierta.TipoMantenimiento == "Preventivo" ? "En mantenimiento" : "En reparación");
    }

    private static bool HorasAlcanzadas(decimal? horometro, decimal? base_, int? horas) =>
        horas is > 0 && horometro.HasValue && base_.HasValue && horometro.Value - base_.Value >= horas.Value;

    /// <summary>Programado, Pendiente (ventana de 7 días u horas alcanzadas), En proceso o Vencido</summary>
    public static (string Estado, int? Dias) EstadoPreventivo(Vehiculo v, int? horasTipo, bool preventivoAbierto, DateTime hoy)
    {
        if (preventivoAbierto) return ("En proceso", null);
        int? dias = v.ProximoMantenimiento.HasValue ? (v.ProximoMantenimiento.Value.Date - hoy.Date).Days : null;
        if (dias < 0) return ("Vencido", dias);
        if (dias <= VentanaDias || HorasAlcanzadas(v.Horometro, v.HorometroUltimoPreventivo, horasTipo)) return ("Pendiente", dias);
        return ("Programado", dias);
    }

    // ===================== Reporte correctivo =====================

    /// <summary>
    /// Antes de crear el reporte: si el vehículo es eléctrico valida quién reporta (el Operador no), el horómetro y que
    /// el equipo no esté ya fuera de servicio. Devuelve false si el vehículo es de contenedores (sigue su flujo).
    /// </summary>
    public async Task<bool> ValidarReporteAsync(string codigoVehiculo, decimal? horometro, UsuarioFlujo u)
    {
        var codigo = (codigoVehiculo ?? "").Trim();
        var v = await _db.Vehiculos.AsNoTracking().FirstOrDefaultAsync(x => x.Codigo == codigo);
        if (v == null || !await TipoEsElectricoAsync((int)v.Tipo)) return false;
        if (!u.EsAdmin && !u.Es("Lider", "Tecnico"))
            throw new FlujoException("En los equipos eléctricos el Operador no crea reportes: avisa al Líder de tu área para que lo reporte.", 403, "OperadorElectrico");
        if (horometro is null or <= 0)
            throw new FlujoException("Captura el horómetro actual del equipo.", 400, "HorometroObligatorio");
        if (v.Horometro.HasValue && horometro < v.Horometro)
            throw new FlujoException($"El horómetro no puede ser menor al último registrado ({v.Horometro:0.#} h).", 400, "HorometroMenor");
        var abierta = await _db.OrdenesTrabajo.Where(o => o.VehiculoId == v.Id && !Cerradas.Contains(o.Estado))
            .Select(o => o.Folio).FirstOrDefaultAsync();
        if (abierta != null)
            throw new FlujoException($"El equipo ya está fuera de servicio con la orden {abierta}: no puede recibir otro reporte hasta que se entregue.", 409, "EquipoFueraDeServicio");
        return true;
    }

    /// <summary>
    /// Reporte de un equipo eléctrico recién creado: sin inspección de planta, la orden de trabajo nace sola y queda
    /// asociada al proveedor eléctrico, en espera de que un técnico la acepte. El equipo queda Fuera de servicio,
    /// Pendiente de ingreso.
    /// </summary>
    public async Task<OrdenTrabajo> ActivarCorrectivoAsync(int reporteId, decimal horometro, UsuarioFlujo u)
    {
        var r = await _db.ReportesFalla.Include(x => x.Vehiculo).FirstAsync(x => x.Id == reporteId);
        r.EstadoInspeccion = EstadoInspeccionEnum.Validado;
        r.InspeccionadoPorId = u.Id;
        r.FechaInspeccion = DateTime.UtcNow;
        r.TipoMantenimiento = "Correctivo";
        r.PuedeOperar = false;
        r.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var creada = await _ordenes.CreateAsync(new OrdenTrabajoCreateRequest
        {
            ReporteFallaId = r.Id, VehiculoId = r.VehiculoId, Prioridad = r.Prioridad, TipoMantenimiento = "Correctivo", Descripcion = r.Descripcion
        }, u.Id);
        var proveedor = await ProveedorAsync();
        var o = await _db.OrdenesTrabajo.Include(x => x.Vehiculo).FirstAsync(x => x.Id == creada.Id);
        o.Flujo = Electrico;
        o.EmpresaId = proveedor?.Id;
        o.FechaSeleccion = proveedor != null ? DateTime.UtcNow : null;
        o.Horometro = horometro;
        o.TecnicoAsignadoId = null;
        o.Estado = EstadoOrdenTrabajoEnum.Pendiente;
        o.UpdatedAt = DateTime.UtcNow;
        o.Vehiculo.Estado = EstadoVehiculoEnum.FueraDeServicio;
        o.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Piso;
        o.Vehiculo.Horometro = horometro;
        o.Vehiculo.UpdatedAt = DateTime.UtcNow;
        Registrar(r.Id, o.Id, "REPORTE", "Creado", u, $"Reporte {r.Folio} del equipo; horómetro {horometro:0.#} h. Orden {o.Folio} asociada a {proveedor?.Nombre ?? "(sin proveedor eléctrico configurado)"}.");
        await _db.SaveChangesAsync();
        await _avisos.ReporteCreadoAsync(o.Id, u.Id);
        return o;
    }

    // ===================== Acciones de la orden =====================

    private async Task<OrdenTrabajo> CargarAsync(int ordenId)
    {
        var o = await _db.OrdenesTrabajo.Include(x => x.Vehiculo).Include(x => x.TecnicoAsignado)
                    .FirstOrDefaultAsync(x => x.Id == ordenId)
                ?? throw new FlujoException("Orden de trabajo no encontrada", 404);
        if (!EsElectrico(o)) throw new FlujoException("Esta orden no es del flujo de equipos eléctricos.", 400);
        if (o.Estado == EstadoOrdenTrabajoEnum.Cancelada) throw new FlujoException("La orden está cancelada.");
        return o;
    }

    private static void ExigirTecnico(OrdenTrabajo o, UsuarioFlujo u)
    {
        if (u.EsAdmin) return;
        if (u.Es("Tecnico") && o.TecnicoAsignadoId == u.Id) return;
        throw new FlujoException("Solo el técnico responsable de la orden puede hacer esto.", 403);
    }

    private static ResultadoFlujoDto Resultado(OrdenTrabajo o, string mensaje) => new() { Mensaje = mensaje, OrdenId = o.Id, OrdenFolio = o.Folio };

    /// <summary>Un técnico del proveedor acepta la orden (tope de órdenes activas): queda como responsable</summary>
    public async Task<ResultadoFlujoDto> AceptarAsync(int ordenId, UsuarioFlujo u)
    {
        await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var o = await CargarAsync(ordenId);
        if (o.FechaAceptacion != null) throw new FlujoException($"La orden ya la aceptó {o.TecnicoAsignado?.NombreCompleto ?? "otro técnico"}.");
        if (!u.Es("Tecnico")) throw new FlujoException("La orden la acepta un técnico del proveedor de equipos eléctricos.", 403);
        if (o.EmpresaId == null)
        {
            var proveedor = await ProveedorAsync()
                ?? throw new FlujoException("No hay un proveedor de equipos eléctricos configurado (Empresas Proveedoras).");
            o.EmpresaId = proveedor.Id;
        }
        var empresaUsuario = await _db.Users.Where(x => x.Id == u.Id).Select(x => x.EmpresaId).FirstOrDefaultAsync();
        if (empresaUsuario != o.EmpresaId)
        {
            var nombre = await _db.Empresas.Where(e => e.Id == o.EmpresaId).Select(e => e.Nombre).FirstOrDefaultAsync();
            throw new FlujoException($"La orden es del proveedor {nombre}; solo sus técnicos pueden aceptarla.", 403);
        }
        var (activas, capacidad) = await _seleccion.CapacidadAsync(o.EmpresaId.Value);
        if (activas >= capacidad)
        {
            var nombre = await _db.Empresas.Where(e => e.Id == o.EmpresaId).Select(e => e.Nombre).FirstOrDefaultAsync();
            await tx.RollbackAsync();
            _db.ChangeTracker.Clear();
            await _seleccion.AceptacionBloqueadaAsync(ordenId, activas, capacidad, u.Id);
            throw new FlujoException($"{nombre} tiene {activas} de {capacidad} órdenes activas (tope): no se pueden aceptar nuevas hasta liberar capacidad.", 409, "CapacidadEmpresa");
        }
        o.TecnicoAsignadoId = u.Id;
        o.FechaAceptacion = DateTime.UtcNow;
        o.FechaAsignacion ??= DateTime.UtcNow;
        o.FechaAceptacionBloqueada = null;
        o.Estado = EstadoOrdenTrabajoEnum.Asignada;
        o.UpdatedAt = DateTime.UtcNow;
        Registrar(o.ReporteFallaId, o.Id, "ACEPTACION", "Aceptada", u, "Orden aceptada; el técnico recoge el equipo en el área");
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        await _seleccion.AvisarCapacidadAsync(o.EmpresaId.Value, u.Id);
        var nombreTecnico = await _db.Users.Where(x => x.Id == u.Id).Select(x => x.NombreCompleto).FirstOrDefaultAsync() ?? u.Nombre;
        await _avisos.OrdenAceptadaAsync(o.Id, nombreTecnico, u.Id);
        return Resultado(o, $"Orden {o.Folio} aceptada. Recoge el equipo y confirma cuando ya esté en el taller.");
    }

    /// <summary>"Ya está en taller": el equipo pasa a Fuera de servicio, En reparación / En mantenimiento</summary>
    public async Task<ResultadoFlujoDto> ConfirmarIngresoTallerAsync(int ordenId, UsuarioFlujo u)
    {
        var o = await CargarAsync(ordenId);
        ExigirTecnico(o, u);
        if (o.FechaAceptacion == null) throw new FlujoException("Primero acepta la orden.");
        if (o.FechaIngresoTaller != null) throw new FlujoException("Ya se confirmó que el equipo está en el taller.");
        var preventivo = o.TipoMantenimiento == "Preventivo";
        o.FechaIngresoTaller = DateTime.UtcNow;
        if (preventivo)
        {
            o.Estado = EstadoOrdenTrabajoEnum.EnProceso;
            o.FechaInicio ??= DateTime.UtcNow;
        }
        o.UpdatedAt = DateTime.UtcNow;
        o.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Taller;
        o.Vehiculo.Estado = EstadoVehiculoEnum.FueraDeServicio;
        o.Vehiculo.UpdatedAt = DateTime.UtcNow;
        Registrar(o.ReporteFallaId, o.Id, preventivo ? "TRASLADO_TALLER" : "ACEPTACION", "IngresoTaller", u, "El equipo está en el taller");
        await _db.SaveChangesAsync();
        await _avisos.IngresoTallerAsync(o.Id, preventivo, u.Id);
        return Resultado(o, preventivo
            ? $"Equipo {o.Vehiculo.Codigo} en el taller: en mantenimiento. Llena el checklist del preventivo."
            : $"Equipo {o.Vehiculo.Codigo} en el taller: en reparación. Registra la inspección previa.");
    }

    /// <summary>Correctivo: diagnóstico de la falla y trabajo a realizar (después ya no se cancela)</summary>
    public async Task<ResultadoFlujoDto> InspeccionPreviaAsync(int ordenId, InspeccionPreviaRequest req, UsuarioFlujo u)
    {
        var o = await CargarAsync(ordenId);
        ExigirTecnico(o, u);
        if (o.TipoMantenimiento == "Preventivo") throw new FlujoException("El preventivo no lleva inspección previa: se llena su checklist.");
        if (o.FechaIngresoTaller == null) throw new FlujoException("Primero confirma que el equipo ya está en el taller.");
        if (o.FechaInspeccionPrevia != null) throw new FlujoException("La inspección previa ya se registró.");
        var diag = Limpio(req.Diagnostico) ?? throw new FlujoException("Escribe el diagnóstico de la falla y el trabajo a realizar.", 400, "DiagnosticoObligatorio");
        o.Diagnostico = Recortar(diag, 1000);
        o.FechaInspeccionPrevia = DateTime.UtcNow;
        o.Estado = EstadoOrdenTrabajoEnum.EnProceso;
        o.FechaInicio ??= DateTime.UtcNow;
        o.UpdatedAt = DateTime.UtcNow;
        Registrar(o.ReporteFallaId, o.Id, "INSPECCION_PREVIA", "Diagnostico", u, o.Diagnostico);
        await _db.SaveChangesAsync();
        return Resultado(o, "Inspección previa registrada. La orden pasa a reparación.");
    }

    /// <summary>Correctivo: pruebas operativas. Aprobadas: reparación terminada (se descuenta el inventario); si no, regresa a reparación</summary>
    public async Task<ResultadoFlujoDto> RegistrarPruebasAsync(int ordenId, PruebasRequest req, UsuarioFlujo u)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();
        var o = await CargarAsync(ordenId);
        ExigirTecnico(o, u);
        if (o.TipoMantenimiento == "Preventivo") throw new FlujoException("El preventivo se cierra al terminar su checklist.");
        if (o.FechaInspeccionPrevia == null) throw new FlujoException("Primero registra la inspección previa.");
        if (o.Estado != EstadoOrdenTrabajoEnum.EnProceso && o.Estado != EstadoOrdenTrabajoEnum.EsperandoRefacciones)
            throw new FlujoException("Las pruebas se registran durante la reparación.");
        var obs = Recortar(Limpio(req.Observaciones), 1000);
        if (!req.Aprobadas)
        {
            if (obs == null) throw new FlujoException("Escribe qué falló en las pruebas.", 400, "ObservacionObligatoria");
            o.ResultadoPruebas = obs;
            o.UpdatedAt = DateTime.UtcNow;
            Registrar(o.ReporteFallaId, o.Id, "PRUEBAS", "NoAprobadas", u, obs);
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            return Resultado(o, "Pruebas no aprobadas: la orden sigue en reparación.");
        }
        o.ResultadoPruebas = obs;
        o.FechaPruebas = DateTime.UtcNow;
        o.Estado = EstadoOrdenTrabajoEnum.Completada;
        o.FechaFinalizacion = DateTime.UtcNow;
        o.TrabajoRealizado ??= o.Diagnostico;
        o.UpdatedAt = DateTime.UtcNow;
        var minimos = await _materiales.DescontarAsync(o, u.Id);
        Registrar(o.ReporteFallaId, o.Id, "PRUEBAS", "Aprobadas", u, obs ?? "Pruebas operativas aprobadas");
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        if (minimos.Count > 0) await _materiales.AvisarStockMinimoAsync(minimos, u.Id);
        await _avisos.ListoParaEntregaAsync(o.Id, u.Id);
        return Resultado(o, "Pruebas aprobadas. Lleva el equipo a su área para la entrega.");
    }

    /// <summary>Preventivo: guarda los resultados del checklist; con terminar=true exige todo y cierra la parte técnica</summary>
    public async Task<ResultadoFlujoDto> GuardarChecklistAsync(int ordenId, ChecklistPreventivoRequest req, bool terminar, UsuarioFlujo u)
    {
        await using var tx = await _db.Database.BeginTransactionAsync();
        var o = await CargarAsync(ordenId);
        ExigirTecnico(o, u);
        if (o.TipoMantenimiento != "Preventivo") throw new FlujoException("Esta orden no es un preventivo.");
        if (o.FechaIngresoTaller == null) throw new FlujoException("Primero confirma que el equipo ya está en el taller.");
        if (o.Estado != EstadoOrdenTrabajoEnum.EnProceso) throw new FlujoException("El checklist ya se terminó.");

        var filas = await _db.PreventivoResultados.Where(x => x.OrdenTrabajoId == o.Id).ToListAsync();
        foreach (var r in req.Resultados)
        {
            var f = filas.FirstOrDefault(x => x.Id == r.Id);
            if (f == null) continue;
            var res = Limpio(r.Resultado);
            if (res != null && res != "Bueno" && res != "Malo")
                throw new FlujoException("El resultado de cada actividad es Buen estado o Mal estado.", 400);
            f.Resultado = res;
            f.Observacion = Recortar(Limpio(r.Observacion), 500);
        }
        if (Limpio(req.TipoRevision) is { } tipoRev) o.TipoRevision = Recortar(tipoRev, 20);
        o.CodigoFallaEncontrado = req.CodigoFallaEncontrado;
        o.CodigoFalla = req.CodigoFallaEncontrado == true ? Recortar(Limpio(req.CodigoFalla), 60) : null;
        o.CodigoFallaResuelto = req.CodigoFallaEncontrado == true ? req.CodigoFallaResuelto : null;
        o.TrabajoRealizado = Recortar(Limpio(req.Notas), 1000);
        o.UpdatedAt = DateTime.UtcNow;

        if (!terminar)
        {
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            var hechas = filas.Count(x => x.Resultado != null);
            return Resultado(o, $"Checklist guardado ({hechas} de {filas.Count} actividades).");
        }

        var faltan = filas.Count(x => x.Resultado == null);
        if (faltan > 0) throw new FlujoException($"Faltan {faltan} actividad(es) por revisar: la orden no se puede finalizar hasta que todas tengan resultado.", 400, "ChecklistIncompleto");
        var sinObs = filas.Where(x => x.Resultado == "Malo" && x.Observacion == null).Select(x => x.Numero).ToList();
        if (sinObs.Count > 0) throw new FlujoException($"Escribe la observación de las actividades en mal estado ({string.Join(", ", sinObs)}).", 400, "ObservacionObligatoria");
        if (o.CodigoFallaEncontrado == null) throw new FlujoException("Indica si se encontró código de falla.", 400, "CodigoFalla");
        if (o.CodigoFallaEncontrado == true && (o.CodigoFalla == null || o.CodigoFallaResuelto == null))
            throw new FlujoException("Escribe el código de falla e indica si quedó resuelto.", 400, "CodigoFalla");

        o.Estado = EstadoOrdenTrabajoEnum.Completada;
        o.FechaFinalizacion = DateTime.UtcNow;
        var minimos = await _materiales.DescontarAsync(o, u.Id);
        var malos = filas.Count(x => x.Resultado == "Malo");
        Registrar(o.ReporteFallaId, o.Id, "CHECKLIST", "Terminado", u,
            malos == 0 ? "Checklist completo: todo en buen estado" : $"Checklist completo con {malos} actividad(es) en mal estado",
            new { motivos = filas.Where(x => x.Resultado == "Malo").Select(x => $"{x.Numero} {x.Descripcion}").ToList() });
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        if (minimos.Count > 0) await _materiales.AvisarStockMinimoAsync(minimos, u.Id);
        await _avisos.ListoParaEntregaAsync(o.Id, u.Id);
        if (malos > 0) await _avisos.MalEstadoAsync(o.Id, malos, u.Id);
        return Resultado(o, malos == 0
            ? "Checklist terminado. Lleva el equipo a su área para la entrega."
            : $"Checklist terminado con {malos} actividad(es) en mal estado. Puedes generar un reporte correctivo. Lleva el equipo a su área para la entrega.");
    }

    public async Task<ResultadoFlujoDto> ConfirmarTrasladoAreaAsync(int ordenId, UsuarioFlujo u)
    {
        var o = await CargarAsync(ordenId);
        ExigirTecnico(o, u);
        if (o.Estado != EstadoOrdenTrabajoEnum.Completada)
            throw new FlujoException(o.TipoMantenimiento == "Preventivo" ? "Primero termina el checklist." : "Primero aprueba las pruebas operativas.");
        if (o.FechaTrasladoArea != null) throw new FlujoException("Ya se confirmó que el equipo está en su área.");
        o.FechaTrasladoArea = DateTime.UtcNow;
        o.UltimoAvisoEntrega = DateTime.UtcNow;
        o.UpdatedAt = DateTime.UtcNow;
        o.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Piso;
        o.Vehiculo.UpdatedAt = DateTime.UtcNow;
        Registrar(o.ReporteFallaId, o.Id, "TRASLADO_AREA", "Confirmado", u, "Equipo en su área; pendiente de la aprobación del Líder");
        await _db.SaveChangesAsync();
        await _avisos.EnAreaAsync(o.Id, u.Id);
        return Resultado(o, "Equipo en su área. El Líder debe aprobar la entrega en el sistema.");
    }

    /// <summary>El Líder (o el Administrador) aprueba la entrega en el sistema; sin esto el equipo no se queda en el área</summary>
    public async Task<ResultadoFlujoDto> AprobarEntregaAsync(int ordenId, UsuarioFlujo u)
    {
        var o = await CargarAsync(ordenId);
        if (!u.EsAdmin && !u.Es("Lider")) throw new FlujoException("La entrega la aprueba el Líder del área.", 403);
        if (o.FechaTrasladoArea == null) throw new FlujoException("El equipo todavía no está en el área.");
        if (o.FechaAprobacionEntrega != null) throw new FlujoException("La entrega ya fue aprobada.");
        o.FechaAprobacionEntrega = DateTime.UtcNow;
        o.AprobacionEntregaPorId = u.Id;
        o.UltimoAvisoEntrega = DateTime.UtcNow;
        o.UpdatedAt = DateTime.UtcNow;
        Registrar(o.ReporteFallaId, o.Id, "ENTREGA", "Aprobada", u, "Entrega aprobada en el sistema; falta el documento firmado");
        await _db.SaveChangesAsync();
        await _avisos.EntregaAprobadaAsync(o.Id, u.Id);
        return Resultado(o, "Entrega aprobada. Firma el formato de entrega; el taller subirá el documento firmado.");
    }

    /// <summary>
    /// El taller sube el documento de entrega firmado (después de la aprobación; JPG/PNG/PDF, hasta 3 de 10 MB). Queda
    /// bloqueado y cierra la orden: equipo Operativo, se libera el lugar del tope, orden de pago y, en preventivos, la
    /// siguiente fecha y el conteo de horas.
    /// </summary>
    public async Task<ResultadoFlujoDto> SubirDocumentoAsync(int ordenId, IReadOnlyList<IFormFile> archivos, UsuarioFlujo u)
    {
        var validos = archivos.Where(a => a != null && a.Length > 0).ToList();
        if (validos.Count == 0) throw new FlujoException("Elige el documento de entrega firmado.", 400, "DocumentoObligatorio");
        if (validos.Count > 3) throw new FlujoException("Puedes subir máximo 3 archivos.", 400);
        foreach (var a in validos)
        {
            var ext = Path.GetExtension(a.FileName).ToLowerInvariant();
            if (!ExtensionesDocumento.Contains(ext)) throw new FlujoException($"{a.FileName}: solo se aceptan JPG, PNG o PDF.", 400);
            if (a.Length > MaxBytesDocumento) throw new FlujoException($"{a.FileName} pasa de 10 MB.", 400);
        }

        await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var o = await CargarAsync(ordenId);
        ExigirTecnico(o, u);
        if (o.FechaAprobacionEntrega == null)
            throw new FlujoException("El documento se sube después de que el Líder apruebe la entrega en el sistema.", 409, "SinAprobacion");
        if (o.FechaDocumentoEntrega != null) throw new FlujoException("El documento ya se cargó y no se puede modificar.", 409);

        var carpeta = Path.Combine(_env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot"), "uploads", "entregas", o.Id.ToString());
        Directory.CreateDirectory(carpeta);
        foreach (var a in validos)
        {
            var ext = Path.GetExtension(a.FileName).ToLowerInvariant();
            var nombre = $"{Guid.NewGuid():N}{ext}";
            await using (var fs = File.Create(Path.Combine(carpeta, nombre)))
                await a.CopyToAsync(fs);
            _db.DocumentosEntrega.Add(new DocumentoEntrega
            {
                OrdenTrabajoId = o.Id, Url = $"/uploads/entregas/{o.Id}/{nombre}", NombreArchivo = Recortar(Path.GetFileName(a.FileName), 200)!,
                TipoContenido = Recortar(a.ContentType, 100), Tamano = a.Length, SubidoPorId = u.Id, SubidoPorNombre = Recortar(u.Nombre, 150), Fecha = DateTime.UtcNow
            });
        }

        var ahora = DateTime.UtcNow;
        var preventivo = o.TipoMantenimiento == "Preventivo";
        o.FechaDocumentoEntrega = ahora;
        o.DocumentoEntregaPorId = u.Id;
        o.Estado = EstadoOrdenTrabajoEnum.Validada;
        o.FechaValidacion = ahora;
        o.ValidadoPorId = o.AprobacionEntregaPorId;
        o.UpdatedAt = ahora;
        var v = o.Vehiculo;
        v.Estado = EstadoVehiculoEnum.Operativo;
        v.Ubicacion = UbicacionVehiculoEnum.Piso;
        v.UltimoMantenimiento = ahora;
        DateTime? proximo = null;
        if (preventivo)
        {
            var dias = await _db.TiposVehiculo.Where(t => t.Id == (int)v.Tipo).Select(t => t.FrecuenciaMantenimientoDias).FirstOrDefaultAsync() ?? PeriodicidadPorDefecto;
            proximo = HoraLocal.DeUtc(ahora).Date.AddDays(dias);
            v.ProximoMantenimiento = proximo;
            v.HorometroUltimoPreventivo = o.Horometro ?? v.Horometro;
            v.UltimoAvisoPreventivo = null;
            v.UltimoAvisoPreventivoTipo = null;
        }
        v.UpdatedAt = ahora;
        Registrar(o.ReporteFallaId, o.Id, "ENTREGA", "DocumentoCargado", u, $"Documento firmado cargado ({validos.Count} archivo(s)); el equipo está operativo");
        Registrar(o.ReporteFallaId, o.Id, preventivo ? "COMPLETADO" : "DISPONIBLE", "Liberada", u, preventivo
            ? $"Preventivo completado; próximo: {proximo:dd/MM/yyyy}" : "Equipo operativo");
        var pago = await _pagos.GenerarAsync(o, u.Nombre);
        await _db.SaveChangesAsync();
        CambioSaldo? cambio = null;
        if (pago != null)
        {
            cambio = await _presupuesto.DescontarAsync(pago, o.Folio, v.Id, v.Codigo, new ContextoPresupuesto(u.Id, u.Nombre, null));
            await _db.SaveChangesAsync();
        }
        await tx.CommitAsync();

        await _avisos.EntregaCompletadaAsync(o.Id, preventivo, proximo, u.Id);
        if (pago != null) await _avisos.OrdenPagoAsync(o.Id, pago.Id, u.Id);
        if (cambio != null) await _presupuesto.AvisarUmbralesAsync(new[] { cambio }, u.Id);
        await _seleccion.CapacidadLiberadaAsync(o.EmpresaId, u.Id);
        return Resultado(o, preventivo
            ? $"Preventivo completado. El equipo {v.Codigo} está operativo; próximo preventivo: {proximo:dd/MM/yyyy}."
            : $"Entrega completada. El equipo {v.Codigo} está operativo nuevamente.");
    }

    /// <summary>Correctivo: se cancela solo antes de la inspección previa (Administrador o Líder)</summary>
    public async Task<ResultadoFlujoDto> CancelarAsync(int ordenId, string? motivo, UsuarioFlujo u)
    {
        var m = Limpio(motivo) ?? throw new FlujoException("Escribe el motivo de la cancelación.", 400, "MotivoObligatorio");
        var o = await CargarAsync(ordenId);
        if (!u.EsAdmin && !u.Es("Lider")) throw new FlujoException("La orden la cancela el Líder o el Administrador.", 403);
        if (o.TipoMantenimiento == "Preventivo") throw new FlujoException("Un preventivo iniciado no se cancela: termina su checklist.");
        if (o.FechaInspeccionPrevia != null) throw new FlujoException("La orden ya pasó la inspección previa: ya no se puede cancelar.");
        var aceptada = o.FechaAceptacion != null;
        o.Estado = EstadoOrdenTrabajoEnum.Cancelada;
        o.Notas = string.IsNullOrWhiteSpace(o.Notas) ? $"Cancelada: {m}" : $"{o.Notas}\nCancelada: {m}";
        o.UpdatedAt = DateTime.UtcNow;
        o.Vehiculo.Estado = EstadoVehiculoEnum.Operativo;
        o.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Piso;
        o.Vehiculo.UpdatedAt = DateTime.UtcNow;
        Registrar(o.ReporteFallaId, o.Id, "ORDEN", "Cancelada", u, m);
        await _db.SaveChangesAsync();
        await _db.MaterialesOrdenTrabajo.Where(x => x.OrdenTrabajoId == o.Id && !x.Descontado).ExecuteDeleteAsync();
        if (aceptada) await _seleccion.CapacidadLiberadaAsync(o.EmpresaId, u.Id);
        return Resultado(o, $"Orden {o.Folio} cancelada. El equipo regresa a Operativo.");
    }

    // ===================== Preventivo programado =====================

    /// <summary>Solo un Técnico del proveedor inicia el preventivo (ventana abierta, vencido u horas alcanzadas) y lo acepta</summary>
    public async Task<ResultadoFlujoDto> IniciarPreventivoAsync(IniciarPreventivoRequest req, UsuarioFlujo u)
    {
        if (!u.Es("Tecnico")) throw new FlujoException("El preventivo solo lo inicia un técnico del proveedor de equipos eléctricos.", 403);
        await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var v = await _db.Vehiculos.FirstOrDefaultAsync(x => x.Id == req.VehiculoId) ?? throw new FlujoException("Equipo no encontrado.", 404);
        var tipo = await _db.TiposVehiculo.FirstOrDefaultAsync(t => t.Id == (int)v.Tipo);
        if (tipo == null || tipo.FlujoMantenimiento != Electrico) throw new FlujoException("El preventivo programado es para equipos eléctricos.", 400);
        var proveedor = await ProveedorAsync() ?? throw new FlujoException("No hay un proveedor de equipos eléctricos configurado (Empresas Proveedoras).");
        var empresaUsuario = await _db.Users.Where(x => x.Id == u.Id).Select(x => x.EmpresaId).FirstOrDefaultAsync();
        if (empresaUsuario != proveedor.Id) throw new FlujoException($"Solo los técnicos de {proveedor.Nombre} inician preventivos.", 403);

        var abierta = await _db.OrdenesTrabajo.Where(o => o.VehiculoId == v.Id && !Cerradas.Contains(o.Estado)).Select(o => o.Folio).FirstOrDefaultAsync();
        if (abierta != null) throw new FlujoException($"El equipo tiene la orden {abierta} abierta: el preventivo se inicia cuando se entregue.");
        var h = req.Horometro;
        if (h is null or <= 0) throw new FlujoException("Captura el horómetro actual del equipo.", 400, "HorometroObligatorio");
        if (v.Horometro.HasValue && h < v.Horometro) throw new FlujoException($"El horómetro no puede ser menor al último registrado ({v.Horometro:0.#} h).", 400, "HorometroMenor");

        var hoy = HoraLocal.Ahora.Date;
        var porHoras = HorasAlcanzadas(h, v.HorometroUltimoPreventivo, tipo.HorasPreventivo);
        var (estado, _) = EstadoPreventivo(v, tipo.HorasPreventivo, false, hoy);
        if (estado == "Programado" && !porHoras)
            throw new FlujoException(
                $"El preventivo de este equipo está programado para el {v.ProximoMantenimiento:dd/MM/yyyy}: se habilita {VentanaDias} días antes" +
                (tipo.HorasPreventivo is > 0 ? $" o al llegar a {tipo.HorasPreventivo} horas desde el último." : "."), 409, "PreventivoProgramado");

        var (activas, capacidad) = await _seleccion.CapacidadAsync(proveedor.Id);
        if (activas >= capacidad)
            throw new FlujoException($"{proveedor.Nombre} tiene {activas} de {capacidad} órdenes activas (tope): no se pueden iniciar nuevas hasta liberar capacidad.", 409, "CapacidadEmpresa");

        var plantilla = await _db.ChecklistPreventivoCategorias.AsNoTracking()
            .Where(c => c.TipoVehiculoId == tipo.Id && c.Activo)
            .OrderBy(c => c.Numero)
            .Select(c => new { c.Numero, c.Nombre, Actividades = c.Actividades.Where(a => a.Activo).OrderBy(a => a.Orden).Select(a => new { a.Id, a.Numero, a.Descripcion }).ToList() })
            .ToListAsync();
        if (plantilla.Sum(c => c.Actividades.Count) == 0)
            throw new FlujoException($"El tipo {tipo.Nombre} no tiene checklist preventivo configurado (Configuración → Checklist preventivo).");

        var ahora = DateTime.UtcNow;
        var revision = porHoras && estado == "Programado" ? $"{tipo.HorasPreventivo} horas" : "Mensual";
        var o = new OrdenTrabajo
        {
            Folio = await FolioGenerator.SiguienteAsync(_db.OrdenesTrabajo.Select(x => x.Folio), "OT"),
            VehiculoId = v.Id, CreadoPorId = u.Id, TecnicoAsignadoId = u.Id, EmpresaId = proveedor.Id,
            Estado = EstadoOrdenTrabajoEnum.Asignada, Prioridad = PrioridadEnum.Media, TipoMantenimiento = "Preventivo",
            Descripcion = $"Mantenimiento preventivo ({revision}) - {tipo.Nombre}",
            Flujo = Electrico, Horometro = h, TipoRevision = revision,
            FechaCreacion = ahora, FechaAsignacion = ahora, FechaAceptacion = ahora, FechaSeleccion = ahora, CreatedAt = ahora
        };
        _db.OrdenesTrabajo.Add(o);
        await _db.SaveChangesAsync();
        var orden = 0;
        foreach (var c in plantilla)
            foreach (var a in c.Actividades)
                _db.PreventivoResultados.Add(new PreventivoResultado
                {
                    OrdenTrabajoId = o.Id, ActividadId = a.Id, CategoriaNumero = c.Numero, Categoria = c.Nombre, Numero = a.Numero,
                    Descripcion = a.Descripcion, Orden = ++orden
                });
        v.Horometro = h;
        v.Estado = EstadoVehiculoEnum.FueraDeServicio;
        v.UpdatedAt = ahora;
        Registrar(null, o.Id, "INICIO", "Iniciado", u, $"Preventivo {revision} iniciado y aceptado; horómetro {h:0.#} h" + (estado == "Vencido" ? " (estaba vencido)" : ""));
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        await _seleccion.AvisarCapacidadAsync(proveedor.Id, u.Id);
        return new ResultadoFlujoDto { Mensaje = $"Preventivo {o.Folio} iniciado. Recoge el equipo y confirma cuando ya esté en el taller.", OrdenId = o.Id, OrdenFolio = o.Folio };
    }

    /// <summary>El Administrador ajusta la fecha del próximo preventivo</summary>
    public async Task<EquipoElectricoDto> AjustarProximoAsync(int vehiculoId, DateTime fecha, UsuarioFlujo u)
    {
        if (!u.EsAdmin) throw new FlujoException("Solo el Administrador ajusta las fechas de los preventivos.", 403);
        var v = await _db.Vehiculos.FirstOrDefaultAsync(x => x.Id == vehiculoId) ?? throw new FlujoException("Equipo no encontrado.", 404);
        if (!await TipoEsElectricoAsync((int)v.Tipo)) throw new FlujoException("El preventivo programado es para equipos eléctricos.", 400);
        var dia = HoraLocal.EsSoloFecha(fecha) ? fecha.Date : HoraLocal.DeUtc(fecha).Date;
        if (dia < HoraLocal.Ahora.Date.AddYears(-1) || dia > HoraLocal.Ahora.Date.AddYears(3)) throw new FlujoException("La fecha no es válida.", 400);
        var antes = v.ProximoMantenimiento;
        v.ProximoMantenimiento = DateTime.SpecifyKind(dia, DateTimeKind.Unspecified);
        v.UltimoAvisoPreventivo = null;
        v.UltimoAvisoPreventivoTipo = null;
        v.UpdatedAt = DateTime.UtcNow;
        _db.LogAcciones.Add(new LogAccion
        {
            UsuarioId = u.Id, NombreUsuario = u.Nombre, Accion = "AjustarPreventivo", Entidad = "Vehiculo", EntidadId = v.Id,
            Descripcion = $"Próximo preventivo de {v.Codigo}: {antes:dd/MM/yyyy} → {dia:dd/MM/yyyy}", Fecha = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
        return (await ListarAsync(u, v.Id)).Equipos.First();
    }

    // ===================== Consultas =====================

    public async Task<EquiposElectricosDto> ListarAsync(UsuarioFlujo u, int? soloVehiculoId = null)
    {
        var tipos = await _db.TiposVehiculo.AsNoTracking().Where(t => t.FlujoMantenimiento == Electrico)
            .ToDictionaryAsync(t => t.Id, t => new { t.Nombre, t.FrecuenciaMantenimientoDias, t.HorasPreventivo });
        var tipoIds = tipos.Keys.ToList();
        var q = _db.Vehiculos.AsNoTracking().Include(v => v.Area).Where(v => v.Activo && tipoIds.Contains((int)v.Tipo));
        if (soloVehiculoId.HasValue) q = q.Where(v => v.Id == soloVehiculoId);
        var vehiculos = await q.OrderBy(v => v.Codigo).ToListAsync();
        var ids = vehiculos.Select(v => v.Id).ToList();
        var abiertas = await _db.OrdenesTrabajo.AsNoTracking()
            .Where(o => ids.Contains(o.VehiculoId) && !Cerradas.Contains(o.Estado))
            .ToListAsync();
        var ultimos = await _db.OrdenesTrabajo.AsNoTracking()
            .Where(o => ids.Contains(o.VehiculoId) && o.Flujo == Electrico && o.TipoMantenimiento == "Preventivo" && o.Estado == EstadoOrdenTrabajoEnum.Validada)
            .GroupBy(o => o.VehiculoId).Select(g => new { g.Key, Fecha = g.Max(o => o.FechaValidacion) })
            .ToDictionaryAsync(x => x.Key, x => x.Fecha);
        var proveedor = await ProveedorAsync();
        var (activas, capacidad) = proveedor != null ? await _seleccion.CapacidadAsync(proveedor.Id) : (0, (await _presupuesto.LeerConfigAsync()).CapacidadMaxima);
        var empresaUsuario = u.Es("Tecnico") ? await _db.Users.Where(x => x.Id == u.Id).Select(x => x.EmpresaId).FirstOrDefaultAsync() : null;
        var tecnicoProveedor = u.Es("Tecnico") && proveedor != null && empresaUsuario == proveedor.Id;
        var hoy = HoraLocal.Ahora.Date;

        var dto = new EquiposElectricosDto { Proveedor = proveedor?.Nombre, ProveedorId = proveedor?.Id, Activas = activas, Capacidad = capacidad };
        foreach (var v in vehiculos)
        {
            var t = tipos[(int)v.Tipo];
            var abierta = abiertas.Where(o => o.VehiculoId == v.Id).OrderByDescending(o => o.Id).FirstOrDefault();
            var (estado, sub) = EstadoEquipo(abierta);
            var (estadoPrev, dias) = EstadoPreventivo(v, t.HorasPreventivo, abierta?.TipoMantenimiento == "Preventivo", hoy);
            var item = new EquipoElectricoDto
            {
                VehiculoId = v.Id, Codigo = v.Codigo, NumeroEconomico = v.NumeroEconomico, TipoId = (int)v.Tipo, Tipo = t.Nombre,
                Area = v.Area?.Nombre, Marca = v.Marca, Modelo = v.Modelo, NumeroSerie = v.NumeroSerie,
                EstadoEquipo = estado, SubestadoEquipo = sub, OrdenId = abierta?.Id, OrdenFolio = abierta?.Folio, OrdenTipo = abierta?.TipoMantenimiento,
                UltimoPreventivo = ultimos.GetValueOrDefault(v.Id), ProximoPreventivo = v.ProximoMantenimiento, EstadoPreventivo = estadoPrev,
                DiasParaVencer = dias, Horometro = v.Horometro,
                HorasDesdePreventivo = v.Horometro.HasValue && v.HorometroUltimoPreventivo.HasValue ? v.Horometro - v.HorometroUltimoPreventivo : null,
                HorasPreventivo = t.HorasPreventivo, PeriodicidadDias = t.FrecuenciaMantenimientoDias ?? PeriodicidadPorDefecto
            };
            if (abierta == null && (u.EsAdmin || u.Es("Lider", "Tecnico"))) item.Acciones.Add("reportar");
            if (abierta == null && tecnicoProveedor) item.Acciones.Add("iniciarPreventivo");
            if (u.EsAdmin) item.Acciones.Add("ajustarFecha");
            dto.Equipos.Add(item);
        }
        return dto;
    }

    // ===================== Seguimiento de la orden (etapas y acciones) =====================

    public async Task<FlujoDto> ConstruirFlujoAsync(OrdenTrabajo o, ReporteFalla? r, UsuarioFlujo u)
    {
        var preventivo = o.TipoMantenimiento == "Preventivo";
        var ids = new[] { r?.ReportadoPorId, o.CreadoPorId, o.TecnicoAsignadoId, o.AprobacionEntregaPorId, o.DocumentoEntregaPorId }
            .Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        var usuarios = await _db.Users.Where(x => ids.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.NombreCompleto);
        string? Nombre(int? id) => id.HasValue && usuarios.TryGetValue(id.Value, out var n) ? n : null;
        string? Corto(string? n) => n == null ? null : string.Join(' ', n.Split(' ', StringSplitOptions.RemoveEmptyEntries).Take(2));

        var vehiculo = o.Vehiculo ?? await _db.Vehiculos.AsNoTracking().FirstAsync(x => x.Id == o.VehiculoId);
        var tipoNombre = await _db.TiposVehiculo.Where(t => t.Id == (int)vehiculo.Tipo).Select(t => t.Nombre).FirstOrDefaultAsync();
        var empresa = o.EmpresaId == null ? null : await _db.Empresas.Where(e => e.Id == o.EmpresaId).Select(e => e.Nombre).FirstOrDefaultAsync();
        var historial = await _db.HistorialFlujo.AsNoTracking()
            .Where(h => h.OrdenTrabajoId == o.Id || (r != null && h.ReporteFallaId == r.Id))
            .OrderBy(h => h.Fecha).ThenBy(h => h.Id).ToListAsync();
        var (activas, capacidad) = o.EmpresaId.HasValue ? await _seleccion.CapacidadAsync(o.EmpresaId.Value) : (0, 0);
        var llena = o.FechaAceptacion == null && o.EmpresaId.HasValue && activas >= capacidad;
        var cancelada = o.Estado == EstadoOrdenTrabajoEnum.Cancelada;
        var cerrada = o.Estado == EstadoOrdenTrabajoEnum.Validada || o.Estado == EstadoOrdenTrabajoEnum.Entregado;
        var tecnico = Nombre(o.TecnicoAsignadoId);
        var pruebasFallidas = historial.LastOrDefault(h => h.Etapa == "PRUEBAS");
        var (estadoEq, subEq) = EstadoEquipo(cerrada || cancelada ? null : o);

        var dto = new FlujoDto
        {
            Flujo = Electrico,
            ReporteId = r?.Id, ReporteFolio = r?.Folio, OrdenId = o.Id, OrdenFolio = o.Folio,
            VehiculoId = vehiculo.Id, VehiculoCodigo = vehiculo.Codigo, VehiculoTipo = tipoNombre,
            Cancelada = cancelada, ReportadoPorNombre = Nombre(r?.ReportadoPorId),
            ReporteDescripcion = r?.Descripcion, ReportePrioridad = r?.Prioridad, ReporteTipoMantenimiento = o.TipoMantenimiento,
            Historial = historial.Where(h => h.Accion != "Liberada").Select(h => new HistorialFlujoDto
            {
                Fecha = h.Fecha, Etapa = h.Etapa, Accion = h.Accion, Usuario = h.NombreUsuario, Rol = h.RolUsuario, Detalle = h.Detalle
            }).ToList()
        };
        var e = dto.Etapas;
        void Etapa(string clave, string nombre, string estado, string? etiqueta, string? responsable = null, string? mensaje = null, DateTime? fecha = null) =>
            e.Add(new EtapaFlujoDto { Clave = clave, Nombre = nombre, Estado = estado, Etiqueta = etiqueta, Responsable = responsable, Mensaje = mensaje, Fecha = fecha });

        string Entrega()
        {
            if (cerrada || o.FechaDocumentoEntrega != null) return "completada";
            return o.FechaTrasladoArea == null ? "inactiva" : "pendiente";
        }
        var entregaEtiqueta = o.FechaDocumentoEntrega != null ? "Firmado" : o.FechaAprobacionEntrega != null ? "Documento" : o.FechaTrasladoArea != null ? "Aprobación" : "Líder";
        var entregaMensaje = o.FechaDocumentoEntrega != null ? "Documento de entrega firmado cargado."
            : o.FechaAprobacionEntrega != null ? $"El Líder aprobó la entrega ({Nombre(o.AprobacionEntregaPorId)}); falta que el taller suba el documento firmado."
            : o.FechaTrasladoArea != null ? "El equipo está en su área: el Líder debe aprobar la entrega en el sistema; sin esa aprobación no puede quedarse en el área." : null;

        if (!preventivo)
        {
            Etapa("REPORTE", "REPORTE", "completada", Corto(Nombre(r?.ReportadoPorId ?? o.CreadoPorId)), Nombre(r?.ReportadoPorId ?? o.CreadoPorId),
                $"Reporte {r?.Folio} con horómetro {o.Horometro:0.#} h.", r?.FechaReporte ?? o.FechaCreacion);
            if (o.FechaAceptacion == null)
                Etapa("ACEPTACION", "ACEPTACIÓN", llena ? "bloqueada" : "pendiente", llena ? "Tope lleno" : "En espera", $"Técnico de {empresa ?? "el proveedor"}",
                    llena ? $"{empresa} tiene {activas} de {capacidad} órdenes activas: la orden queda en espera hasta liberar capacidad."
                          : "Pendiente de que un técnico del proveedor la acepte y recoja el equipo.");
            else if (o.FechaIngresoTaller == null)
                Etapa("ACEPTACION", "ACEPTACIÓN", "pendiente", "Por recoger", tecnico, $"Aceptada por {tecnico}; falta confirmar que el equipo ya está en el taller.", o.FechaAceptacion);
            else Etapa("ACEPTACION", "ACEPTACIÓN", "completada", Corto(tecnico), tecnico, "Equipo en el taller.", o.FechaIngresoTaller);

            if (o.FechaIngresoTaller == null) Etapa("INSPECCION_PREVIA", "INSPECCIÓN", "inactiva", "Técnico");
            else if (o.FechaInspeccionPrevia == null) Etapa("INSPECCION_PREVIA", "INSPECCIÓN", "pendiente", "Diagnóstico", tecnico, "Diagnóstico de la falla y definición del trabajo a realizar.");
            else Etapa("INSPECCION_PREVIA", "INSPECCIÓN", "completada", "Diagnóstico", tecnico, o.Diagnostico, o.FechaInspeccionPrevia);

            var reparando = o.FechaInspeccionPrevia != null && o.FechaPruebas == null && !cerrada;
            if (o.FechaInspeccionPrevia == null) Etapa("REPARACION", "REPARACIÓN", "inactiva", "Técnico");
            else if (reparando) Etapa("REPARACION", "REPARACIÓN", "pendiente", "En proceso", tecnico,
                pruebasFallidas?.Accion == "NoAprobadas" ? $"Las pruebas no se aprobaron: {pruebasFallidas.Detalle}" : "Reparación en proceso; registra las refacciones utilizadas.");
            else Etapa("REPARACION", "REPARACIÓN", "completada", "Terminada", tecnico, null, o.FechaPruebas);

            if (o.FechaPruebas != null) Etapa("PRUEBAS", "PRUEBAS", "completada", "Aprobadas", tecnico, o.ResultadoPruebas, o.FechaPruebas);
            else if (pruebasFallidas?.Accion == "NoAprobadas") Etapa("PRUEBAS", "PRUEBAS", "rechazada", "No aprobadas", tecnico, pruebasFallidas.Detalle, pruebasFallidas.Fecha);
            else Etapa("PRUEBAS", "PRUEBAS", "inactiva", "Técnico");
        }
        else
        {
            Etapa("INICIO", "INICIO", "completada", Corto(tecnico), tecnico, $"Preventivo {o.TipoRevision} iniciado; horómetro {o.Horometro:0.#} h.", o.FechaCreacion);
            if (o.FechaIngresoTaller == null) Etapa("TRASLADO_TALLER", "TALLER", "pendiente", "Por recoger", tecnico, "Falta confirmar que el equipo ya está en el taller.");
            else Etapa("TRASLADO_TALLER", "TALLER", "completada", "En taller", tecnico, null, o.FechaIngresoTaller);
            var filas = await _db.PreventivoResultados.CountAsync(x => x.OrdenTrabajoId == o.Id);
            var hechas = await _db.PreventivoResultados.CountAsync(x => x.OrdenTrabajoId == o.Id && x.Resultado != null);
            if (o.FechaIngresoTaller == null) Etapa("CHECKLIST", "CHECKLIST", "inactiva", "Técnico");
            else if (o.Estado == EstadoOrdenTrabajoEnum.EnProceso) Etapa("CHECKLIST", "CHECKLIST", "pendiente", $"{hechas} de {filas}", tecnico, "Revisa cada actividad: Buen estado o Mal estado.");
            else Etapa("CHECKLIST", "CHECKLIST", "completada", $"{filas} de {filas}", tecnico, null, o.FechaFinalizacion);
        }
        if (o.Estado != EstadoOrdenTrabajoEnum.Completada && o.FechaTrasladoArea == null)
            Etapa("TRASLADO_AREA", "TRASLADO", "inactiva", "Técnico");
        else if (o.FechaTrasladoArea == null)
            Etapa("TRASLADO_AREA", "TRASLADO", "pendiente", "Llevar al área", tecnico, "Lleva el equipo a su área de origen.");
        else Etapa("TRASLADO_AREA", "TRASLADO", "completada", "En el área", tecnico, null, o.FechaTrasladoArea);
        Etapa("ENTREGA", "ENTREGA", Entrega(), entregaEtiqueta, o.FechaAprobacionEntrega == null ? "Líder" : tecnico, entregaMensaje, o.FechaDocumentoEntrega ?? o.FechaAprobacionEntrega);
        Etapa(preventivo ? "COMPLETADO" : "DISPONIBLE", preventivo ? "COMPLETADO" : "DISPONIBLE", cerrada ? "completada" : "inactiva",
            cerrada ? "Operativo" : "Entrega", null, cerrada ? "El equipo está operativo." : null, o.FechaValidacion);
        if (cancelada)
            foreach (var x in e.Where(x => x.Estado != "completada")) { x.Estado = "inactiva"; x.Mensaje = "Orden cancelada."; }

        // Datos propios del flujo
        var docs = await _db.DocumentosEntrega.AsNoTracking().Where(d => d.OrdenTrabajoId == o.Id).OrderBy(d => d.Id)
            .Select(d => new DocumentoEntregaDto { Id = d.Id, Url = d.Url, NombreArchivo = d.NombreArchivo, TipoContenido = d.TipoContenido, Tamano = d.Tamano, SubidoPor = d.SubidoPorNombre, Fecha = d.Fecha })
            .ToListAsync();
        var info = new ElectricoInfoDto
        {
            EsPreventivo = preventivo, EstadoEquipo = estadoEq, SubestadoEquipo = subEq, NumeroEconomico = vehiculo.NumeroEconomico,
            Horometro = o.Horometro, Empresa = empresa, Tecnico = tecnico, Diagnostico = o.Diagnostico, ResultadoPruebas = o.ResultadoPruebas,
            TrabajoRealizado = o.TrabajoRealizado, TipoRevision = o.TipoRevision, CodigoFallaEncontrado = o.CodigoFallaEncontrado,
            CodigoFalla = o.CodigoFalla, CodigoFallaResuelto = o.CodigoFallaResuelto, FechaAprobacionEntrega = o.FechaAprobacionEntrega,
            AproboEntrega = Nombre(o.AprobacionEntregaPorId), FechaDocumentoEntrega = o.FechaDocumentoEntrega, Documentos = docs,
            Activas = activas, Capacidad = capacidad
        };
        if (preventivo)
        {
            var filas = await _db.PreventivoResultados.AsNoTracking().Where(x => x.OrdenTrabajoId == o.Id).OrderBy(x => x.Orden).ToListAsync();
            info.Checklist = filas.GroupBy(x => new { x.CategoriaNumero, x.Categoria }).OrderBy(g => g.Key.CategoriaNumero)
                .Select(g => new CategoriaResultadoDto
                {
                    Numero = g.Key.CategoriaNumero, Nombre = g.Key.Categoria,
                    Actividades = g.Select(x => new ActividadResultadoDto { Id = x.Id, Numero = x.Numero, Descripcion = x.Descripcion, Resultado = x.Resultado, Observacion = x.Observacion }).ToList()
                }).ToList();
        }
        dto.Electrico = info;

        // Trabajos del reporte (si el reporte trae actividades del checklist)
        dto.Items.AddRange(await _db.OrdenesTrabajoChecklistItems.AsNoTracking().Where(i => i.OrdenTrabajoId == o.Id).OrderBy(i => i.Id)
            .Select(i => new ItemFlujoDto { Tipo = "checklist", Id = i.Id, ChecklistItemId = i.ChecklistItemId, Nombre = i.ChecklistItem.Pregunta, Cantidad = i.Cantidad, Notas = i.Notas, ReportadoPorTaller = i.ReportadoPorTaller })
            .ToListAsync());

        // Acciones
        if (!cancelada && !cerrada)
        {
            var a = dto.Acciones;
            var trabaja = u.EsAdmin || (u.Es("Tecnico") && o.TecnicoAsignadoId == u.Id);
            if (o.FechaAceptacion == null && u.Es("Tecnico"))
            {
                var empresaUsuario = await _db.Users.Where(x => x.Id == u.Id).Select(x => x.EmpresaId).FirstOrDefaultAsync();
                if (empresaUsuario != null && empresaUsuario == o.EmpresaId)
                {
                    if (llena) dto.Bloqueo = e.First(x => x.Clave == "ACEPTACION").Mensaje;
                    else a.Add("aceptarElectrico");
                }
            }
            if (!preventivo && o.FechaInspeccionPrevia == null && (u.EsAdmin || u.Es("Lider"))) a.Add("cancelarElectrico");
            if (trabaja && o.FechaAceptacion != null && o.FechaIngresoTaller == null) a.Add("confirmarIngresoTaller");
            if (trabaja && !preventivo && o.FechaIngresoTaller != null && o.FechaInspeccionPrevia == null) a.Add("inspeccionPrevia");
            if (trabaja && !preventivo && o.FechaInspeccionPrevia != null && (o.Estado == EstadoOrdenTrabajoEnum.EnProceso || o.Estado == EstadoOrdenTrabajoEnum.EsperandoRefacciones))
                a.Add("registrarPruebas");
            if (trabaja && preventivo && o.FechaIngresoTaller != null && o.Estado == EstadoOrdenTrabajoEnum.EnProceso) a.Add("checklistPreventivo");
            if (trabaja && o.Estado == EstadoOrdenTrabajoEnum.Completada && o.FechaTrasladoArea == null) a.Add("confirmarTrasladoArea");
            if ((u.EsAdmin || u.Es("Lider")) && o.FechaTrasladoArea != null && o.FechaAprobacionEntrega == null) a.Add("aprobarEntrega");
            if (trabaja && o.FechaAprobacionEntrega != null && o.FechaDocumentoEntrega == null) a.Add("subirDocumentoEntrega");
            if (o.FechaTrasladoArea != null && (u.EsAdmin || u.Es("Lider", "Tecnico"))) a.Add("imprimirFormatoEntrega");
        }
        if (cerrada && (u.EsAdmin || u.Es("Lider", "Tecnico"))) dto.Acciones.Add("imprimirFormatoEntrega");
        return dto;
    }

    // ===================== Checklist preventivo (configuración) =====================

    public async Task<ChecklistPreventivoTipoDto> ChecklistTipoAsync(int tipoId)
    {
        var tipo = await _db.TiposVehiculo.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tipoId) ?? throw new FlujoException("Tipo de vehículo no encontrado.", 404);
        var cats = await _db.ChecklistPreventivoCategorias.AsNoTracking().Where(c => c.TipoVehiculoId == tipoId && c.Activo).OrderBy(c => c.Numero)
            .Select(c => new CategoriaChecklistDto
            {
                Id = c.Id, Numero = c.Numero, Nombre = c.Nombre,
                Actividades = c.Actividades.Where(a => a.Activo).OrderBy(a => a.Orden).Select(a => new ActividadChecklistDto { Id = a.Id, Numero = a.Numero, Descripcion = a.Descripcion }).ToList()
            }).ToListAsync();
        return new ChecklistPreventivoTipoDto { TipoVehiculoId = tipo.Id, Tipo = tipo.Nombre, Categorias = cats };
    }

    /// <summary>Reemplaza el checklist del tipo (las órdenes ya iniciadas conservan su copia). Numera categorías y actividades.</summary>
    public async Task<ChecklistPreventivoTipoDto> GuardarChecklistTipoAsync(int tipoId, ChecklistPreventivoTipoDto req, UsuarioFlujo u)
    {
        if (!u.EsAdmin) throw new FlujoException("El checklist lo configura el Administrador.", 403);
        if (!await _db.TiposVehiculo.AnyAsync(t => t.Id == tipoId)) throw new FlujoException("Tipo de vehículo no encontrado.", 404);
        var categorias = req.Categorias.Where(c => !string.IsNullOrWhiteSpace(c.Nombre)).ToList();
        foreach (var c in categorias)
        {
            if (c.Nombre.Trim().Length > 150) throw new FlujoException($"El nombre de la categoría \"{c.Nombre[..40]}…\" pasa de 150 caracteres.", 400);
            if (c.Actividades.Count(a => !string.IsNullOrWhiteSpace(a.Descripcion)) == 0)
                throw new FlujoException($"La categoría {c.Nombre.Trim()} no tiene actividades.", 400);
            foreach (var a in c.Actividades.Where(a => a.Descripcion?.Trim().Length > 300))
                throw new FlujoException($"Una actividad de {c.Nombre.Trim()} pasa de 300 caracteres.", 400);
        }
        await using var tx = await _db.Database.BeginTransactionAsync();
        await _db.ChecklistPreventivoCategorias.Where(c => c.TipoVehiculoId == tipoId).ExecuteDeleteAsync();
        var n = 0;
        foreach (var c in categorias)
        {
            n++;
            var cat = new ChecklistPreventivoCategoria { TipoVehiculoId = tipoId, Numero = n, Nombre = c.Nombre.Trim().ToUpperInvariant() };
            var m = 0;
            foreach (var a in c.Actividades.Where(a => !string.IsNullOrWhiteSpace(a.Descripcion)))
                cat.Actividades.Add(new ChecklistPreventivoActividad { Numero = $"{n}.{++m}", Descripcion = a.Descripcion.Trim(), Orden = m });
            _db.ChecklistPreventivoCategorias.Add(cat);
        }
        _db.LogAcciones.Add(new LogAccion
        {
            UsuarioId = u.Id, NombreUsuario = u.Nombre, Accion = "Editar", Entidad = "ChecklistPreventivo", EntidadId = tipoId,
            Descripcion = $"Checklist preventivo del tipo {tipoId}: {categorias.Count} categorías, {categorias.Sum(c => c.Actividades.Count(a => !string.IsNullOrWhiteSpace(a.Descripcion)))} actividades",
            Fecha = DateTime.UtcNow
        });
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        return await ChecklistTipoAsync(tipoId);
    }

    // ===================== Dashboard =====================

    public async Task<IndicadoresElectricosDto> IndicadoresAsync()
    {
        var tipos = await _db.TiposVehiculo.AsNoTracking().Where(t => t.FlujoMantenimiento == Electrico).ToDictionaryAsync(t => t.Id, t => new { t.Nombre, t.HorasPreventivo });
        var ids = tipos.Keys.ToList();
        var vehiculos = await _db.Vehiculos.AsNoTracking().Where(v => v.Activo && ids.Contains((int)v.Tipo)).ToListAsync();
        var vIds = vehiculos.Select(v => v.Id).ToList();
        var abiertas = await _db.OrdenesTrabajo.AsNoTracking().Where(o => vIds.Contains(o.VehiculoId) && !Cerradas.Contains(o.Estado)).ToListAsync();
        var hoy = HoraLocal.Ahora.Date;
        var dto = new IndicadoresElectricosDto { TotalEquipos = vehiculos.Count };
        foreach (var v in vehiculos)
        {
            var abierta = abiertas.FirstOrDefault(o => o.VehiculoId == v.Id);
            var (estadoPrev, dias) = EstadoPreventivo(v, tipos[(int)v.Tipo].HorasPreventivo, abierta?.TipoMantenimiento == "Preventivo", hoy);
            if (abierta == null) dto.Operativos++;
            else
            {
                dto.FueraDeServicio++;
                var tipo = tipos[(int)v.Tipo].Nombre;
                var fila = dto.FueraPorTipo.FirstOrDefault(x => x.Tipo == tipo);
                if (fila == null) dto.FueraPorTipo.Add(fila = new FueraServicioTipoDto { Tipo = tipo });
                if (abierta.TipoMantenimiento == "Preventivo") fila.Preventivo++; else fila.Correctivo++;
            }
            if (estadoPrev == "Vencido") dto.PreventivosVencidos++;
            else
            {
                dto.PreventivosAlDia++;
                if (dias is >= 0 and <= VentanaDias) dto.PreventivosProximos++;
            }
        }
        dto.CumplimientoPreventivos = vehiculos.Count == 0 ? 100 : Math.Round(dto.PreventivosAlDia * 100.0 / vehiculos.Count, 1);
        var desde = DateTime.UtcNow.AddDays(-90);
        var cerradas = await _db.OrdenesTrabajo.AsNoTracking()
            .Where(o => o.Flujo == Electrico && o.Estado == EstadoOrdenTrabajoEnum.Validada && o.FechaValidacion >= desde)
            .Select(o => new { o.FechaCreacion, o.FechaValidacion }).ToListAsync();
        dto.HorasPromedioFueraServicio = cerradas.Count == 0 ? null : Math.Round(cerradas.Average(x => (x.FechaValidacion!.Value - x.FechaCreacion).TotalHours), 1);
        var proveedor = await ProveedorAsync();
        if (proveedor != null)
        {
            (dto.Activas, dto.Capacidad) = await _seleccion.CapacidadAsync(proveedor.Id);
            dto.Proveedor = proveedor.Nombre;
        }
        else dto.Capacidad = (await _presupuesto.LeerConfigAsync()).CapacidadMaxima;
        var desde180 = DateTime.UtcNow.AddDays(-180);
        dto.FallasRecurrentes = (await _db.OrdenesTrabajo.AsNoTracking()
                .Where(o => o.Flujo == Electrico && o.TipoMantenimiento != "Preventivo" && o.Estado != EstadoOrdenTrabajoEnum.Cancelada && o.FechaCreacion >= desde180)
                .GroupBy(o => o.VehiculoId).Select(g => new { g.Key, N = g.Count() }).OrderByDescending(x => x.N).Take(10).ToListAsync())
            .Select(x =>
            {
                var v = vehiculos.FirstOrDefault(y => y.Id == x.Key);
                return new FallasEquipoDto
                {
                    VehiculoId = x.Key, Equipo = v == null ? $"#{x.Key}" : (v.NumeroEconomico ?? v.Codigo),
                    Tipo = v == null ? null : tipos.GetValueOrDefault((int)v.Tipo)?.Nombre, Correctivos = x.N
                };
            }).ToList();
        return dto;
    }

    // ===================== Recordatorios (proceso en segundo plano) =====================

    /// <summary>Recordatorios de preventivo (7, 3 y 1 día; vencidos cada 3 días) y de entregas sin aprobar o sin documento</summary>
    public async Task<int> EjecutarAvisosAsync()
    {
        var enviados = 0;
        var ahora = DateTime.UtcNow;
        var hoy = HoraLocal.Ahora.Date;
        var tipos = await TiposElectricosAsync();
        var vehiculos = await _db.Vehiculos.Where(v => v.Activo && tipos.Contains((int)v.Tipo) && v.ProximoMantenimiento != null).ToListAsync();
        var conOrden = await _db.OrdenesTrabajo.Where(o => !Cerradas.Contains(o.Estado)).Select(o => o.VehiculoId).Distinct().ToListAsync();
        foreach (var v in vehiculos.Where(v => !conOrden.Contains(v.Id)))
        {
            var dias = (v.ProximoMantenimiento!.Value.Date - hoy).Days;
            string? tipo = dias < 0 ? "Vencido" : dias == 0 ? "Hoy" : dias == 1 ? "1Dia" : dias <= 3 ? "3Dias" : dias <= VentanaDias ? "Ventana" : null;
            if (tipo == null) continue;
            var repetir = tipo == "Vencido" && v.UltimoAvisoPreventivoTipo == "Vencido" && v.UltimoAvisoPreventivo <= ahora.AddDays(-3);
            if (v.UltimoAvisoPreventivoTipo == tipo && !repetir) continue;
            v.UltimoAvisoPreventivo = ahora;
            v.UltimoAvisoPreventivoTipo = tipo;
            await _db.SaveChangesAsync();
            await _avisos.RecordatorioPreventivoAsync(v.Id, tipo);
            enviados++;
        }

        var horasDoc = int.TryParse(await _db.ConfiguracionSistema.Where(c => c.Clave == ClaveHorasAvisoDocumento).Select(c => c.Valor).FirstOrDefaultAsync(), out var hd) && hd > 0 ? hd : 24;
        var pendientes = await _db.OrdenesTrabajo
            .Where(o => o.Flujo == Electrico && !Cerradas.Contains(o.Estado) && o.FechaTrasladoArea != null && o.FechaDocumentoEntrega == null)
            .ToListAsync();
        foreach (var o in pendientes)
        {
            var desde = o.UltimoAvisoEntrega ?? o.FechaAprobacionEntrega ?? o.FechaTrasladoArea!.Value;
            if (o.FechaAprobacionEntrega == null && desde <= ahora.AddHours(-2))
            {
                o.UltimoAvisoEntrega = ahora;
                await _db.SaveChangesAsync();
                await _avisos.EntregaSinAprobarAsync(o.Id);
                enviados++;
            }
            else if (o.FechaAprobacionEntrega != null && desde <= ahora.AddHours(-horasDoc))
            {
                o.UltimoAvisoEntrega = ahora;
                await _db.SaveChangesAsync();
                await _avisos.DocumentoPendienteAsync(o.Id, horasDoc);
                enviados++;
            }
        }
        return enviados;
    }
}

/// <summary>Corre los recordatorios del flujo eléctrico cada 10 minutos</summary>
public class AvisosElectricosHostedService : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<AvisosElectricosHostedService> _logger;

    public AvisosElectricosHostedService(IServiceScopeFactory scopes, ILogger<AvisosElectricosHostedService> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var servicio = scope.ServiceProvider.GetRequiredService<EquiposElectricosService>();
                await servicio.EjecutarAvisosAsync();
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "No se pudieron revisar los recordatorios del flujo eléctrico");
            }
            await Task.Delay(TimeSpan.FromMinutes(10), stoppingToken);
        }
    }
}
