using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.Utils;

namespace MantenimientoEquipos.Services;

/// <summary>Usuario que hace la acción, tomado del token</summary>
public record UsuarioFlujo(int Id, string Nombre, IReadOnlyCollection<string> Roles)
{
    public bool Es(params string[] roles) => roles.Any(Roles.Contains);
    public bool EsAdmin => Es("SuperUsuario", "Administrador");
}

/// <summary>Regla del flujo que no se cumple: se responde con el mensaje tal cual (400/403/404/409)</summary>
public class FlujoException : Exception
{
    public int Status { get; }
    public string? Codigo { get; }

    public FlujoException(string mensaje, int status = 409, string? codigo = null) : base(mensaje)
    {
        Status = status;
        Codigo = codigo;
    }
}

/// <summary>
/// Historial del flujo. Estático para que también lo use OrdenTrabajoService sin dependencias circulares.
/// </summary>
public static class FlujoHistorial
{
    private static readonly string[] PrioridadRoles = { "SuperUsuario", "Administrador", "Supervisor", "Lider", "Tecnico", "Operador" };

    public static string NombreRol(string? rol) => rol switch
    {
        "SuperUsuario" or "Administrador" => "Administrador",
        "Supervisor" => "Supervisor",
        "Lider" => "Líder",
        "Tecnico" => "Técnico",
        "Operador" => "Operador",
        _ => rol ?? string.Empty
    };

    public static string? RolPrincipal(IEnumerable<string> roles)
    {
        var lista = roles.ToList();
        return PrioridadRoles.FirstOrDefault(lista.Contains) ?? lista.FirstOrDefault();
    }

    public static void Agregar(MantenimientoDbContext db, int? reporteId, int? ordenId, string etapa, string accion,
        int? usuarioId, string? nombre, string? rol, string? detalle, object? datos = null)
    {
        db.HistorialFlujo.Add(new HistorialFlujo
        {
            ReporteFallaId = reporteId,
            OrdenTrabajoId = ordenId,
            Etapa = etapa,
            Accion = accion,
            UsuarioId = usuarioId,
            NombreUsuario = nombre,
            RolUsuario = rol,
            Detalle = detalle?.Length > 2000 ? detalle[..2000] : detalle,
            DatosJson = datos == null ? null : JsonSerializer.Serialize(datos),
            Fecha = DateTime.UtcNow
        });
    }

    /// <summary>Igual que Agregar, pero busca el nombre y el rol del usuario</summary>
    public static async Task AgregarAsync(MantenimientoDbContext db, int? reporteId, int? ordenId, string etapa, string accion,
        int? usuarioId, string? detalle, object? datos = null)
    {
        var u = usuarioId.HasValue
            ? await db.Users.Where(x => x.Id == usuarioId).Select(x => new { x.NombreCompleto, Roles = x.Roles.Select(r => r.Nombre).ToList() }).FirstOrDefaultAsync()
            : null;
        Agregar(db, reporteId, ordenId, etapa, accion, usuarioId, u?.NombreCompleto, NombreRol(u == null ? null : RolPrincipal(u.Roles)), detalle, datos);
    }
}

/// <summary>
/// Flujo de 7 etapas y control de capacidad de la Zona de Transición (PDF 23-oct-2026):
/// REPORTE › INSPECCIÓN › TRASLADO › TALLER › TRASLADO › VALIDACIÓN › DISPONIBLE
/// </summary>
public class FlujoService
{
    public const string ClaveCapacidadDanados = "ZonaTransicion.CapacidadDanados";
    public const string ClaveCapacidadReparados = "ZonaTransicion.CapacidadReparados";
    private const int CapacidadPorDefecto = 15;

    private static readonly EstadoOrdenTrabajoEnum[] AntesDeTaller = { EstadoOrdenTrabajoEnum.Pendiente, EstadoOrdenTrabajoEnum.Asignada };
    private static readonly EstadoOrdenTrabajoEnum[] EnTaller = { EstadoOrdenTrabajoEnum.Asignada, EstadoOrdenTrabajoEnum.EnProceso, EstadoOrdenTrabajoEnum.EsperandoRefacciones };
    private static readonly EstadoOrdenTrabajoEnum[] Liberada = { EstadoOrdenTrabajoEnum.Validada, EstadoOrdenTrabajoEnum.Entregado };

    private readonly MantenimientoDbContext _db;
    private readonly OrdenTrabajoService _ordenes;
    private readonly FlujoAvisos _avisos;
    private readonly EliminacionService _eliminacion;

    public FlujoService(MantenimientoDbContext db, OrdenTrabajoService ordenes, FlujoAvisos avisos, EliminacionService eliminacion)
    {
        _db = db;
        _ordenes = ordenes;
        _avisos = avisos;
        _eliminacion = eliminacion;
    }

    /// <summary>Qué órdenes de cada fila no caben hoy; se compara antes y después de un movimiento para avisar</summary>
    public async Task<FilasBloqueadas> FilasBloqueadasAsync()
    {
        var (capD, capR) = await LeerCapacidadesAsync();
        var ocD = await EnZonaDanados().CountAsync();
        var ocR = await EnZonaReparados().CountAsync();
        var filaD = await IdsFilaIngresoAsync();
        var filaR = await IdsFilaRetornoAsync();
        // Bloqueadas = las que por su lugar en la fila no caben; pueden pasar = las primeras que sí caben
        var libresD = Math.Max(0, capD - ocD);
        var libresR = Math.Max(0, capR - ocR);
        return new FilasBloqueadas(
            filaD, filaD.Skip(libresD).ToHashSet(), filaD.Take(libresD).ToHashSet(), ocD, capD,
            filaR, filaR.Skip(libresR).ToHashSet(), filaR.Take(libresR).ToHashSet(), ocR, capR);
    }

    /// <summary>Avisos de capacidad tras un movimiento hecho fuera de este servicio (p. ej. terminar la reparación)</summary>
    public async Task AvisarCambiosEnFilasAsync(FilasBloqueadas antes, int? actor) =>
        await _avisos.CambiosEnFilasAsync(antes, await FilasBloqueadasAsync(), actor);

    // ===================== Zonas y filas de espera =====================

    /// <summary>Validadas, esperando que el Operador/Líder las lleve a la zona de dañados (fila de espera)</summary>
    private IQueryable<OrdenTrabajo> FilaIngreso() => _db.OrdenesTrabajo
        .Where(o => o.FechaTrasladoIngreso == null && o.FechaAceptacion == null && AntesDeTaller.Contains(o.Estado));

    /// <summary>Físicamente en la zona de dañados: entregadas y aún no aceptadas por el taller</summary>
    private IQueryable<OrdenTrabajo> EnZonaDanados() => _db.OrdenesTrabajo
        .Where(o => o.FechaTrasladoIngreso != null && o.FechaAceptacion == null && AntesDeTaller.Contains(o.Estado));

    /// <summary>Reparadas, esperando que el técnico las entregue en la zona de reparados (fila de espera)</summary>
    private IQueryable<OrdenTrabajo> FilaRetorno() => _db.OrdenesTrabajo
        .Where(o => o.Estado == EstadoOrdenTrabajoEnum.Completada && o.FechaTrasladoRetorno == null);

    /// <summary>Físicamente en la zona de reparados: entregadas y pendientes de validación</summary>
    private IQueryable<OrdenTrabajo> EnZonaReparados() => _db.OrdenesTrabajo
        .Where(o => o.Estado == EstadoOrdenTrabajoEnum.Completada && o.FechaTrasladoRetorno != null);

    private Task<List<int>> IdsFilaIngresoAsync() =>
        FilaIngreso().OrderBy(o => o.FechaCreacion).ThenBy(o => o.Id).Select(o => o.Id).ToListAsync();

    private Task<List<int>> IdsFilaRetornoAsync() =>
        FilaRetorno().OrderBy(o => o.FechaFinalizacion).ThenBy(o => o.Id).Select(o => o.Id).ToListAsync();

    public async Task<(int Danados, int Reparados)> LeerCapacidadesAsync()
    {
        var conf = await _db.ConfiguracionSistema
            .Where(c => c.Clave == ClaveCapacidadDanados || c.Clave == ClaveCapacidadReparados)
            .ToListAsync();
        int Leer(string clave) =>
            int.TryParse(conf.FirstOrDefault(c => c.Clave == clave)?.Valor, out var n) && n > 0 ? n : CapacidadPorDefecto;
        return (Leer(ClaveCapacidadDanados), Leer(ClaveCapacidadReparados));
    }

    public async Task GuardarCapacidadesAsync(int danados, int reparados, int? userId)
    {
        if (danados < 1 || reparados < 1 || danados > 500 || reparados > 500)
            throw new FlujoException("La capacidad de cada zona debe estar entre 1 y 500 vehículos.", 400);
        foreach (var (clave, valor, descripcion) in new[]
                 {
                     (ClaveCapacidadDanados, danados, "Vehículos dañados pendientes de reparación que caben en la Zona de Transición"),
                     (ClaveCapacidadReparados, reparados, "Vehículos reparados pendientes de validación que caben en la Zona de Transición")
                 })
        {
            var c = await _db.ConfiguracionSistema.FirstOrDefaultAsync(x => x.Clave == clave);
            if (c == null)
            {
                c = new ConfiguracionSistema { Clave = clave, Descripcion = descripcion, TipoDato = "int" };
                _db.ConfiguracionSistema.Add(c);
            }
            c.Valor = valor.ToString();
            c.UpdatedAt = DateTime.UtcNow;
            c.UpdatedBy = userId;
        }
        await _db.SaveChangesAsync();
    }

    /// <summary>Umbral escalado a la capacidad (los del PDF son sobre 15)</summary>
    private static int Umbral(int capacidad, int de15) =>
        Math.Max(1, (int)Math.Round(capacidad * de15 / 15.0, MidpointRounding.AwayFromZero));

    private static ZonaCapacidadDto Zona(string clave, string nombre, int ocupados, int capacidad, int enFila) => new()
    {
        Zona = clave,
        Nombre = nombre,
        Ocupados = ocupados,
        Capacidad = capacidad,
        Disponibles = Math.Max(0, capacidad - ocupados),
        Semaforo = ocupados >= Umbral(capacidad, 13) ? "rojo" : ocupados >= Umbral(capacidad, 9) ? "amarillo" : "verde",
        AlertaDesde = Umbral(capacidad, 12),
        EnFila = enFila
    };

    public async Task<CapacidadZonasDto> GetCapacidadAsync()
    {
        var (capD, capR) = await LeerCapacidadesAsync();
        return new CapacidadZonasDto
        {
            Danados = Zona("danados", "Vehículos dañados", await EnZonaDanados().CountAsync(), capD, await FilaIngreso().CountAsync()),
            Reparados = Zona("reparados", "Vehículos reparados", await EnZonaReparados().CountAsync(), capR, await FilaRetorno().CountAsync())
        };
    }

    private static AlertaCapacidadDto? Alerta(string zona, int ocupados, int capacidad)
    {
        var unidades = zona == "danados" ? "unidades dañadas" : "unidades reparadas";
        if (ocupados >= capacidad)
            return new AlertaCapacidadDto
            {
                Zona = zona, Nivel = "saturada", Ocupados = ocupados, Capacidad = capacidad,
                Mensaje = $"Zona de Transición saturada ({ocupados}/{capacidad} {unidades}). No es posible recibir más vehículos hasta liberar espacio disponible."
            };
        if (ocupados >= Umbral(capacidad, 12))
            return new AlertaCapacidadDto
            {
                Zona = zona, Nivel = "preventiva", Ocupados = ocupados, Capacidad = capacidad,
                Mensaje = $"La Zona de Transición está próxima a alcanzar su capacidad máxima ({ocupados}/{capacidad} {unidades})."
            };
        return null;
    }

    // ===================== Vista del flujo (las 7 etapas) =====================

    public async Task<FlujoDto> GetFlujoOrdenAsync(int ordenId, UsuarioFlujo u)
    {
        var o = await CargarOrden().FirstOrDefaultAsync(x => x.Id == ordenId)
                ?? throw new FlujoException("Orden de trabajo no encontrada", 404);
        var r = o.ReporteFallaId.HasValue ? await CargarReporte().FirstOrDefaultAsync(x => x.Id == o.ReporteFallaId) : null;
        return await ConstruirAsync(r, o, u);
    }

    public async Task<FlujoDto> GetFlujoReporteAsync(int reporteId, UsuarioFlujo u)
    {
        var r = await CargarReporte().FirstOrDefaultAsync(x => x.Id == reporteId)
                ?? throw new FlujoException("Reporte no encontrado", 404);
        var o = await CargarOrden().FirstOrDefaultAsync(x => x.ReporteFallaId == reporteId);
        return await ConstruirAsync(r, o, u);
    }

    private IQueryable<OrdenTrabajo> CargarOrden() => _db.OrdenesTrabajo
        .AsNoTracking()
        .Include(o => o.Vehiculo)
        .Include(o => o.ItemsChecklist).ThenInclude(i => i.ChecklistItem);

    private IQueryable<ReporteFalla> CargarReporte() => _db.ReportesFalla
        .AsNoTracking()
        .Include(r => r.Vehiculo)
        .Include(r => r.ItemsChecklist).ThenInclude(i => i.ChecklistItem)
        .Include(r => r.ImageFaults).ThenInclude(f => f.ImageFault);

    private static string? Corto(string? nombre)
    {
        if (string.IsNullOrWhiteSpace(nombre)) return null;
        var partes = nombre.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return string.Join(' ', partes.Take(2));
    }

    private static HistorialFlujoDto AHistorialDto(HistorialFlujo h)
    {
        var motivos = new List<string>();
        if (!string.IsNullOrEmpty(h.DatosJson))
        {
            try
            {
                using var doc = JsonDocument.Parse(h.DatosJson);
                if (doc.RootElement.TryGetProperty("motivos", out var m) && m.ValueKind == JsonValueKind.Array)
                    motivos = m.EnumerateArray().Select(x => x.GetString() ?? string.Empty).Where(x => x != string.Empty).ToList();
            }
            catch (JsonException) { }
        }
        return new HistorialFlujoDto
        {
            Fecha = h.Fecha, Etapa = h.Etapa, Accion = h.Accion, Usuario = h.NombreUsuario, Rol = h.RolUsuario,
            Detalle = h.Detalle, Motivos = motivos
        };
    }

    private async Task<FlujoDto> ConstruirAsync(ReporteFalla? r, OrdenTrabajo? o, UsuarioFlujo u)
    {
        var ids = new[] { r?.ReportadoPorId, r?.InspeccionadoPorId, r?.ReenviadoPorId, o?.CreadoPorId, o?.TrasladoIngresoPorId,
                          o?.TecnicoAsignadoId, o?.TrasladoRetornoPorId, o?.ValidadoPorId }
            .Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        var usuarios = await _db.Users.Where(x => ids.Contains(x.Id))
            .Select(x => new { x.Id, x.NombreCompleto, Roles = x.Roles.Select(rr => rr.Nombre).ToList() })
            .ToDictionaryAsync(x => x.Id);
        string? Nombre(int? id) => id.HasValue && usuarios.TryGetValue(id.Value, out var x) ? x.NombreCompleto : null;
        string? Rol(int? id) => id.HasValue && usuarios.TryGetValue(id.Value, out var x)
            ? FlujoHistorial.NombreRol(FlujoHistorial.RolPrincipal(x.Roles)) : null;

        int? rid = r?.Id, oid = o?.Id;
        var historial = await _db.HistorialFlujo.AsNoTracking()
            .Where(h => (rid != null && h.ReporteFallaId == rid) || (oid != null && h.OrdenTrabajoId == oid))
            .OrderBy(h => h.Fecha).ThenBy(h => h.Id)
            .ToListAsync();

        var vehiculo = o?.Vehiculo ?? r?.Vehiculo;
        var tipoNombre = vehiculo == null ? null : await _db.TiposVehiculo
            .Where(t => t.Id == (int)vehiculo.Tipo).Select(t => t.Nombre).FirstOrDefaultAsync();

        var dto = new FlujoDto
        {
            ReporteId = r?.Id, ReporteFolio = r?.Folio, OrdenId = o?.Id, OrdenFolio = o?.Folio,
            VehiculoId = vehiculo?.Id, VehiculoCodigo = vehiculo?.Codigo, VehiculoTipo = tipoNombre ?? vehiculo?.Tipo.ToString(),
            Cancelada = o?.Estado == EstadoOrdenTrabajoEnum.Cancelada,
            ReportadoPorNombre = Nombre(r?.ReportadoPorId),
            ReporteDescripcion = r?.Descripcion, ReportePrioridad = r?.Prioridad, ReportePuedeOperar = r?.PuedeOperar,
            Historial = historial.Select(AHistorialDto).ToList()
        };
        var unidad = $"{vehiculo?.Codigo} de tipo {dto.VehiculoTipo}";

        // ---- Filas de espera (para "Sin espacio") ----
        var (capD, capR) = await LeerCapacidadesAsync();
        bool pendienteIngreso = o != null && o.FechaTrasladoIngreso == null && o.FechaAceptacion == null && AntesDeTaller.Contains(o.Estado);
        bool pendienteRetorno = o != null && o.Estado == EstadoOrdenTrabajoEnum.Completada && o.FechaTrasladoRetorno == null;
        int posIngreso = 0, ocupadosD = 0, posRetorno = 0, ocupadosR = 0;
        if (pendienteIngreso)
        {
            ocupadosD = await EnZonaDanados().CountAsync();
            posIngreso = (await IdsFilaIngresoAsync()).IndexOf(o!.Id) + 1;
        }
        if (pendienteRetorno)
        {
            ocupadosR = await EnZonaReparados().CountAsync();
            posRetorno = (await IdsFilaRetornoAsync()).IndexOf(o!.Id) + 1;
        }
        bool sinEspacioIngreso = pendienteIngreso && posIngreso > Math.Max(0, capD - ocupadosD);
        bool sinEspacioRetorno = pendienteRetorno && posRetorno > Math.Max(0, capR - ocupadosR);

        var ultimaValidacion = historial.LastOrDefault(h => h.Etapa == "VALIDACION");
        bool validacionRechazada = o != null && ultimaValidacion?.Accion == "Rechazado"
                                   && o.FechaTrasladoRetorno == null && !Liberada.Contains(o.Estado)
                                   && o.Estado != EstadoOrdenTrabajoEnum.Cancelada;
        var etapas = dto.Etapas;

        // 1. REPORTE
        if (r != null)
        {
            var creador = r.ReenviadoPorId ?? r.ReportadoPorId;
            etapas.Add(new EtapaFlujoDto
            {
                Clave = "REPORTE", Nombre = "REPORTE", Estado = "completada",
                Etiqueta = Rol(creador), Responsable = Nombre(creador), Fecha = r.FechaReenvio ?? r.FechaReporte,
                Mensaje = r.ReenviadoPorId.HasValue
                    ? $"Reporte {r.Folio} corregido y reenviado por {Nombre(creador)}."
                    : $"Reporte {r.Folio} creado por {Nombre(creador)}."
            });
        }
        else
        {
            etapas.Add(new EtapaFlujoDto
            {
                Clave = "REPORTE", Nombre = "REPORTE", Estado = "completada",
                Etiqueta = o!.TipoMantenimiento == "Preventivo" ? "Preventivo" : Rol(o.CreadoPorId),
                Responsable = Nombre(o.CreadoPorId), Fecha = o.FechaCreacion,
                Mensaje = "Orden creada sin reporte de falla."
            });
        }

        // 2. INSPECCIÓN
        if (r == null)
        {
            etapas.Add(new EtapaFlujoDto { Clave = "INSPECCION", Nombre = "INSPECCIÓN", Estado = "completada", Etiqueta = "No aplica",
                Mensaje = "La orden no viene de un reporte de falla." });
        }
        else if (r.EstadoInspeccion == EstadoInspeccionEnum.Pendiente)
        {
            etapas.Add(new EtapaFlujoDto { Clave = "INSPECCION", Nombre = "INSPECCIÓN", Estado = "pendiente", Etiqueta = "En validación",
                Responsable = "Líder", Mensaje = "Pendiente de que un Líder verifique la falla y valide el reporte para continuar." });
        }
        else if (r.EstadoInspeccion == EstadoInspeccionEnum.Rechazado)
        {
            etapas.Add(new EtapaFlujoDto { Clave = "INSPECCION", Nombre = "INSPECCIÓN", Estado = "rechazada", Etiqueta = "Rechazada",
                Responsable = Nombre(r.InspeccionadoPorId), Fecha = r.FechaInspeccion,
                Mensaje = $"El reporte de la unidad {unidad} requiere correcciones antes de continuar." });
        }
        else
        {
            etapas.Add(new EtapaFlujoDto { Clave = "INSPECCION", Nombre = "INSPECCIÓN", Estado = "completada",
                Etiqueta = Corto(Nombre(r.InspeccionadoPorId)) ?? "Validado", Responsable = Nombre(r.InspeccionadoPorId),
                Fecha = r.FechaInspeccion,
                Mensaje = "Reporte validado" + (string.IsNullOrWhiteSpace(r.ObservacionesInspeccion) ? "." : $": {r.ObservacionesInspeccion}") });
        }

        // 3. TRASLADO a zona de dañados
        if (o == null || (o.FechaTrasladoIngreso == null && !pendienteIngreso))
        {
            etapas.Add(new EtapaFlujoDto { Clave = "TRASLADO", Nombre = "TRASLADO", Estado = "inactiva", Etiqueta = "Operador" });
        }
        else if (o.FechaTrasladoIngreso != null)
        {
            etapas.Add(new EtapaFlujoDto { Clave = "TRASLADO", Nombre = "TRASLADO", Estado = "completada",
                Etiqueta = Corto(Nombre(o.TrasladoIngresoPorId)) ?? "Entregado", Responsable = Nombre(o.TrasladoIngresoPorId),
                Fecha = o.FechaTrasladoIngreso, Mensaje = "Unidad entregada en la Zona de Transición (dañados)." });
        }
        else if (sinEspacioIngreso)
        {
            etapas.Add(new EtapaFlujoDto { Clave = "TRASLADO", Nombre = "TRASLADO", Estado = "bloqueada", Etiqueta = "Sin espacio",
                Responsable = "Operador o Líder",
                Mensaje = ocupadosD >= capD
                    ? $"La zona de dañados está llena ({ocupadosD}/{capD}). La unidad está en el lugar {posIngreso} de la fila de espera."
                    : $"Los {capD - ocupadosD} lugar(es) libre(s) son para las unidades que llegaron antes; esta está en el lugar {posIngreso} de la fila de espera." });
        }
        else
        {
            etapas.Add(new EtapaFlujoDto { Clave = "TRASLADO", Nombre = "TRASLADO", Estado = "pendiente", Etiqueta = "En espera",
                Responsable = "Operador o Líder",
                Mensaje = "La unidad puede trasladarse a la Zona de Transición; falta confirmar su entrega física." });
        }

        // 4. TALLER
        var tecnico = Nombre(o?.TecnicoAsignadoId);
        if (o == null || o.FechaTrasladoIngreso == null)
            etapas.Add(new EtapaFlujoDto { Clave = "TALLER", Nombre = "TALLER", Estado = "inactiva", Etiqueta = "Técnico" });
        else if (o.Estado == EstadoOrdenTrabajoEnum.Completada || Liberada.Contains(o.Estado))
            etapas.Add(new EtapaFlujoDto { Clave = "TALLER", Nombre = "TALLER", Estado = "completada", Etiqueta = "Completado",
                Responsable = tecnico, Fecha = o.FechaFinalizacion, Mensaje = $"Reparación concluida por {tecnico ?? "el taller"}." });
        else if (o.Estado == EstadoOrdenTrabajoEnum.Cancelada)
            etapas.Add(new EtapaFlujoDto { Clave = "TALLER", Nombre = "TALLER", Estado = "inactiva", Etiqueta = "Cancelada" });
        else if (o.FechaAceptacion == null)
            etapas.Add(new EtapaFlujoDto { Clave = "TALLER", Nombre = "TALLER", Estado = "pendiente", Etiqueta = "En espera",
                Responsable = tecnico ?? "Técnico",
                Mensaje = tecnico != null ? $"Asignada a {tecnico}; pendiente de que la acepte." : "Disponible para que un técnico la acepte." });
        else if (o.Estado == EstadoOrdenTrabajoEnum.Asignada)
            etapas.Add(new EtapaFlujoDto { Clave = "TALLER", Nombre = "TALLER", Estado = "pendiente", Etiqueta = "En revisión",
                Responsable = tecnico, Fecha = o.FechaAceptacion,
                Mensaje = "Revisión técnica de recepción: confirmar las fallas y registrar hallazgos." });
        else
            etapas.Add(new EtapaFlujoDto { Clave = "TALLER", Nombre = "TALLER", Estado = "pendiente", Etiqueta = "En proceso",
                Responsable = tecnico, Fecha = o.FechaInicio,
                Mensaje = o.Estado == EstadoOrdenTrabajoEnum.EsperandoRefacciones ? "Reparación en espera de refacciones."
                    : validacionRechazada ? "Corrigiendo lo observado en la validación." : "Reparación en proceso." });

        // 5. TRASLADO a zona de reparados
        if (o == null || !(o.Estado == EstadoOrdenTrabajoEnum.Completada || Liberada.Contains(o.Estado)))
            etapas.Add(new EtapaFlujoDto { Clave = "TRASLADO_RETORNO", Nombre = "TRASLADO", Estado = "inactiva", Etiqueta = "Taller" });
        else if (o.FechaTrasladoRetorno != null || Liberada.Contains(o.Estado))
            etapas.Add(new EtapaFlujoDto { Clave = "TRASLADO_RETORNO", Nombre = "TRASLADO", Estado = "completada", Etiqueta = "Entregado",
                Responsable = Nombre(o.TrasladoRetornoPorId), Fecha = o.FechaTrasladoRetorno,
                Mensaje = "Unidad entregada en la Zona de Transición (reparados)." });
        else if (sinEspacioRetorno)
            etapas.Add(new EtapaFlujoDto { Clave = "TRASLADO_RETORNO", Nombre = "TRASLADO", Estado = "bloqueada", Etiqueta = "Sin espacio",
                Responsable = tecnico ?? "Taller",
                Mensaje = ocupadosR >= capR
                    ? $"La zona de reparados está llena ({ocupadosR}/{capR}); la unidad sigue bajo responsabilidad del Taller (lugar {posRetorno} en la fila)."
                    : $"Los {capR - ocupadosR} lugar(es) libre(s) son para las unidades que terminaron antes; esta sigue en el Taller (lugar {posRetorno} en la fila)." });
        else
            etapas.Add(new EtapaFlujoDto { Clave = "TRASLADO_RETORNO", Nombre = "TRASLADO", Estado = "pendiente", Etiqueta = "En espera",
                Responsable = tecnico ?? "Taller",
                Mensaje = "Reparación concluida; falta que el técnico entregue la unidad en la Zona de Transición." });

        // 6. VALIDACIÓN
        if (o != null && Liberada.Contains(o.Estado))
            etapas.Add(new EtapaFlujoDto { Clave = "VALIDACION", Nombre = "VALIDACIÓN", Estado = "completada",
                Etiqueta = Corto(Nombre(o.ValidadoPorId)) ?? "Validada", Responsable = Nombre(o.ValidadoPorId), Fecha = o.FechaValidacion,
                Mensaje = "Reparación validada." });
        else if (o != null && o.Estado == EstadoOrdenTrabajoEnum.Completada && o.FechaTrasladoRetorno != null)
            etapas.Add(new EtapaFlujoDto { Clave = "VALIDACION", Nombre = "VALIDACIÓN", Estado = "pendiente", Etiqueta = "Pendiente",
                Responsable = "Líder o Gerente de Mantenimiento",
                Mensaje = "Inspección final: revisar el trabajo, confirmar que la falla se corrigió y aprobar la liberación." });
        else if (validacionRechazada)
            etapas.Add(new EtapaFlujoDto { Clave = "VALIDACION", Nombre = "VALIDACIÓN", Estado = "rechazada", Etiqueta = "Rechazada",
                Responsable = ultimaValidacion!.NombreUsuario, Fecha = ultimaValidacion.Fecha,
                Mensaje = "La validación final fue rechazada; la orden regresó al taller para correcciones." });
        else
            etapas.Add(new EtapaFlujoDto { Clave = "VALIDACION", Nombre = "VALIDACIÓN", Estado = "inactiva", Etiqueta = "Líder" });

        // 7. DISPONIBLE
        if (o != null && Liberada.Contains(o.Estado))
            etapas.Add(new EtapaFlujoDto { Clave = "DISPONIBLE", Nombre = "DISPONIBLE", Estado = "completada", Etiqueta = "Disponible",
                Fecha = o.FechaValidacion, Mensaje = "La unidad está lista para regresar a operación." });
        else
            etapas.Add(new EtapaFlujoDto { Clave = "DISPONIBLE", Nombre = "DISPONIBLE", Estado = "inactiva", Etiqueta = "Entrega" });

        if (dto.Cancelada)
            foreach (var e in etapas.Where(e => e.Estado != "completada"))
            {
                e.Estado = "inactiva";
                e.Mensaje = "Orden cancelada.";
            }

        // ---- Trabajos: los del reporte y los hallazgos del taller ----
        if (o != null)
            dto.Items.AddRange(o.ItemsChecklist.OrderBy(i => i.Id).Select(i => new ItemFlujoDto
            {
                Tipo = "checklist", Id = i.Id, ChecklistItemId = i.ChecklistItemId, Nombre = i.ChecklistItem?.Pregunta ?? $"Trabajo #{i.ChecklistItemId}",
                Cantidad = i.Cantidad, Notas = i.Notas, ReportadoPorTaller = i.ReportadoPorTaller
            }));
        else if (r != null)
            dto.Items.AddRange(r.ItemsChecklist.OrderBy(i => i.Id).Select(i => new ItemFlujoDto
            {
                Tipo = "checklist", Id = i.Id, ChecklistItemId = i.ChecklistItemId, Nombre = i.ChecklistItem?.Pregunta ?? $"Trabajo #{i.ChecklistItemId}",
                Cantidad = i.Cantidad, Notas = i.Notas
            }));
        if (r != null)
            dto.Items.AddRange(r.ImageFaults.OrderBy(f => f.Id).Select(f => new ItemFlujoDto
            {
                Tipo = "componente", Id = f.Id, Nombre = f.ImageFault?.Name ?? $"Componente #{f.ImageFaultId}"
            }));

        // ---- Último rechazo vigente ----
        if (r != null && r.EstadoInspeccion == EstadoInspeccionEnum.Rechazado)
        {
            var h = historial.LastOrDefault(x => x.Etapa == "INSPECCION" && x.Accion == "Rechazado");
            if (h != null) dto.UltimoRechazo = AHistorialDto(h);
        }
        else if (validacionRechazada)
            dto.UltimoRechazo = AHistorialDto(ultimaValidacion!);

        // ---- Lo que puede hacer el usuario ahora ----
        var acciones = dto.Acciones;
        bool admin = u.EsAdmin;
        if (r != null && o == null)
        {
            bool lider = u.Es("Lider") || admin;
            if (lider && r.EstadoInspeccion == EstadoInspeccionEnum.Pendiente)
                acciones.AddRange(new[] { "validarReporte", "rechazarReporte", "corregirReporte" });
            if (lider && r.EstadoInspeccion == EstadoInspeccionEnum.Rechazado)
                acciones.Add("corregirReporte");
        }
        if (o != null && !dto.Cancelada)
        {
            if (pendienteIngreso && (u.Es("Operador", "Lider") || admin))
            {
                if (sinEspacioIngreso) dto.Bloqueo = etapas.First(e => e.Clave == "TRASLADO").Mensaje;
                else acciones.Add("confirmarTraslado");
            }
            if (o.FechaTrasladoIngreso != null && o.FechaAceptacion == null && AntesDeTaller.Contains(o.Estado)
                && ((u.Es("Tecnico") && (o.TecnicoAsignadoId == null || o.TecnicoAsignadoId == u.Id)) || (admin && o.TecnicoAsignadoId != null)))
                acciones.Add("aceptarOrden");
            bool trabaja = (u.Es("Tecnico") && o.TecnicoAsignadoId == u.Id) || u.Es("Supervisor") || admin;
            if (trabaja && o.FechaAceptacion != null && o.Estado == EstadoOrdenTrabajoEnum.Asignada)
                acciones.Add("iniciarReparacion");
            if (trabaja && o.FechaAceptacion != null && EnTaller.Contains(o.Estado))
                acciones.Add("agregarHallazgo");
            if (trabaja && o.FechaAceptacion != null && (o.Estado == EstadoOrdenTrabajoEnum.EnProceso || o.Estado == EstadoOrdenTrabajoEnum.EsperandoRefacciones))
                acciones.Add("terminarReparacion");
            if (pendienteRetorno && trabaja)
            {
                if (sinEspacioRetorno) dto.Bloqueo = etapas.First(e => e.Clave == "TRASLADO_RETORNO").Mensaje;
                else acciones.Add("confirmarRetorno");
            }
            if (o.Estado == EstadoOrdenTrabajoEnum.Completada && o.FechaTrasladoRetorno != null && (u.Es("Lider", "Supervisor") || admin))
                acciones.Add("validarReparacion");
        }
        return dto;
    }

    // ===================== Zona de Transición =====================

    public async Task<ZonaTransicionDto> GetZonaAsync(UsuarioFlujo u)
    {
        var capacidad = await GetCapacidadAsync();
        bool admin = u.EsAdmin;

        var reportes = _db.ReportesFalla.AsNoTracking()
            .Where(r => !r.TieneOrdenTrabajo && r.EstadoInspeccion != EstadoInspeccionEnum.Validado
                        && !_db.OrdenesTrabajo.Any(o => o.ReporteFallaId == r.Id));
        // Mismo alcance que la lista de reportes: el Operador ve los suyos; el Líder, los de sus tipos asignados
        if (u.Es("Operador") && !u.Es("SuperUsuario", "Administrador", "Supervisor", "Tecnico", "Lider"))
            reportes = reportes.Where(r => r.ReportadoPorId == u.Id);
        else if (u.Es("Lider") && !admin)
        {
            var tipos = await _db.LiderTipoVehiculoAsignaciones.Where(a => a.UsuarioId == u.Id).Select(a => a.TipoVehiculo).ToListAsync();
            if (tipos.Count > 0) reportes = reportes.Where(r => tipos.Contains(r.Vehiculo.Tipo));
        }
        var porInspeccionar = await reportes
            .OrderBy(r => r.FechaReporte)
            .Select(r => new ReportePorInspeccionarDto
            {
                ReporteId = r.Id, Folio = r.Folio, VehiculoCodigo = r.Vehiculo.Codigo,
                VehiculoTipo = _db.TiposVehiculo.Where(t => t.Id == (int)r.Vehiculo.Tipo).Select(t => t.Nombre).FirstOrDefault(),
                Descripcion = r.Descripcion, ReportadoPor = r.ReportadoPor.NombreCompleto,
                Fecha = r.FechaReenvio ?? r.FechaReporte, Estado = r.EstadoInspeccion
            })
            .ToListAsync();

        async Task<List<UnidadZonaDto>> Unidades(IQueryable<OrdenTrabajo> q, Func<DateTime?, DateTime?, DateTime?, DateTime?, DateTime> desde)
        {
            var datos = await q.AsNoTracking().Select(o => new
            {
                o.Id, o.Folio, o.ReporteFallaId, ReporteFolio = o.ReporteFalla != null ? o.ReporteFalla.Folio : null,
                o.VehiculoId, o.Vehiculo.Codigo,
                Tipo = _db.TiposVehiculo.Where(t => t.Id == (int)o.Vehiculo.Tipo).Select(t => t.Nombre).FirstOrDefault(),
                o.Descripcion, Tecnico = o.TecnicoAsignado != null ? o.TecnicoAsignado.NombreCompleto : null, o.TecnicoAsignadoId,
                o.Prioridad, o.FechaCreacion, o.FechaTrasladoIngreso, o.FechaFinalizacion, o.FechaTrasladoRetorno
            }).ToListAsync();
            return datos.Select(d => new UnidadZonaDto
            {
                OrdenId = d.Id, OrdenFolio = d.Folio, ReporteId = d.ReporteFallaId, ReporteFolio = d.ReporteFolio,
                VehiculoId = d.VehiculoId, VehiculoCodigo = d.Codigo, VehiculoTipo = d.Tipo, Descripcion = d.Descripcion,
                Tecnico = d.Tecnico, Prioridad = d.Prioridad,
                Desde = desde(d.FechaCreacion, d.FechaTrasladoIngreso, d.FechaFinalizacion, d.FechaTrasladoRetorno),
                // el técnico asignado se usa abajo para las acciones
                Acciones = d.TecnicoAsignadoId.HasValue ? new List<string> { $"tecnico:{d.TecnicoAsignadoId}" } : new List<string>()
            }).OrderBy(x => x.Desde).ThenBy(x => x.OrdenId).ToList();
        }

        var dto = new ZonaTransicionDto
        {
            Capacidad = capacidad,
            PorInspeccionar = porInspeccionar,
            PorTrasladar = await Unidades(FilaIngreso(), (c, _, _, _) => c ?? DateTime.UtcNow),
            EnZonaDanados = await Unidades(EnZonaDanados(), (c, i, _, _) => i ?? c ?? DateTime.UtcNow),
            PorEntregar = await Unidades(FilaRetorno(), (c, _, f, _) => f ?? c ?? DateTime.UtcNow),
            EnZonaReparados = await Unidades(EnZonaReparados(), (c, _, f, rr) => rr ?? f ?? c ?? DateTime.UtcNow)
        };

        int? TecnicoDe(UnidadZonaDto x)
        {
            var t = x.Acciones.FirstOrDefault(a => a.StartsWith("tecnico:"));
            x.Acciones.Clear();
            return t == null ? null : int.Parse(t["tecnico:".Length..]);
        }

        var libresD = capacidad.Danados.Disponibles;
        for (var i = 0; i < dto.PorTrasladar.Count; i++)
        {
            var x = dto.PorTrasladar[i];
            TecnicoDe(x);
            x.PosicionFila = i + 1;
            x.SinEspacio = i + 1 > libresD;
            if (!x.SinEspacio && (u.Es("Operador", "Lider") || admin)) x.Acciones.Add("confirmarTraslado");
        }
        foreach (var x in dto.EnZonaDanados)
        {
            var t = TecnicoDe(x);
            if ((u.Es("Tecnico") && (t == null || t == u.Id)) || (admin && t != null)) x.Acciones.Add("aceptarOrden");
        }
        var libresR = capacidad.Reparados.Disponibles;
        for (var i = 0; i < dto.PorEntregar.Count; i++)
        {
            var x = dto.PorEntregar[i];
            var t = TecnicoDe(x);
            x.PosicionFila = i + 1;
            x.SinEspacio = i + 1 > libresR;
            if (!x.SinEspacio && ((u.Es("Tecnico") && t == u.Id) || u.Es("Supervisor") || admin)) x.Acciones.Add("confirmarRetorno");
        }
        foreach (var x in dto.EnZonaReparados)
        {
            TecnicoDe(x);
            if (u.Es("Lider", "Supervisor") || admin) x.Acciones.Add("validarReparacion");
        }
        return dto;
    }

    // ===================== Acciones =====================

    private void Registrar(int? reporteId, int? ordenId, string etapa, string accion, UsuarioFlujo u, string? detalle, object? datos = null) =>
        FlujoHistorial.Agregar(_db, reporteId, ordenId, etapa, accion, u.Id, u.Nombre,
            FlujoHistorial.NombreRol(FlujoHistorial.RolPrincipal(u.Roles)), detalle, datos);

    private static string? Limpio(string? texto) => string.IsNullOrWhiteSpace(texto) ? null : texto.Trim();
    private static string? Recortar(string? texto, int max) => texto == null || texto.Length <= max ? texto : texto[..max];

    /// <summary>Traduce los renglones marcados a sus nombres y exige al menos uno (o una observación si no hay renglones)</summary>
    private static List<string> ResolverMotivos(List<MotivoRechazoRequest> marcados, Dictionary<int, string> checklist,
        Dictionary<int, string> componentes, string? observacion)
    {
        var nombres = new List<string>();
        foreach (var m in marcados)
        {
            var origen = m.Tipo == "componente" ? componentes : checklist;
            if (!origen.TryGetValue(m.Id, out var nombre))
                throw new FlujoException("Uno de los puntos marcados ya no existe; actualiza la pantalla e inténtalo de nuevo.", 400);
            if (!nombres.Contains(nombre)) nombres.Add(nombre);
        }
        bool hayRenglones = checklist.Count > 0 || componentes.Count > 0;
        if (hayRenglones && nombres.Count == 0)
            throw new FlujoException("Marca en la lista qué hay que corregir.", 400, "MotivoObligatorio");
        if (!hayRenglones && observacion == null)
            throw new FlujoException("Escribe qué hay que corregir.", 400, "MotivoObligatorio");
        return nombres;
    }

    public async Task<ResultadoFlujoDto> ValidarReporteAsync(int reporteId, ValidarReporteRequest req, UsuarioFlujo u)
    {
        var r = await _db.ReportesFalla.Include(x => x.Vehiculo).FirstOrDefaultAsync(x => x.Id == reporteId)
                ?? throw new FlujoException("Reporte no encontrado", 404);
        if (r.EstadoInspeccion == EstadoInspeccionEnum.Validado || r.TieneOrdenTrabajo)
            throw new FlujoException("Este reporte ya fue validado.");
        if (r.EstadoInspeccion == EstadoInspeccionEnum.Rechazado)
            throw new FlujoException("El reporte fue rechazado: corrígelo y reenvíalo antes de validarlo.");

        var obs = Limpio(req.Observaciones);
        r.EstadoInspeccion = EstadoInspeccionEnum.Validado;
        r.InspeccionadoPorId = u.Id;
        r.FechaInspeccion = DateTime.UtcNow;
        r.ObservacionesInspeccion = obs;
        r.UpdatedAt = DateTime.UtcNow;
        Registrar(r.Id, null, "INSPECCION", "Validado", u, obs ?? "Reporte validado");

        var filasAntes = await FilasBloqueadasAsync();
        OrdenTrabajo orden;
        try
        {
            // Al validarse, el reporte genera su orden de trabajo y queda en espera del traslado
            orden = await _ordenes.CreateAsync(new OrdenTrabajoCreateRequest
            {
                ReporteFallaId = r.Id,
                VehiculoId = r.VehiculoId,
                Prioridad = r.Prioridad,
                TipoMantenimiento = r.TipoMantenimiento,
                Descripcion = r.Descripcion
            }, u.Id);
        }
        catch (DuplicateActiveOrderException ex)
        {
            throw new FlujoException($"El vehículo {r.Vehiculo.Codigo} ya tiene la orden activa {ex.ExistingOrderFolio}; termínala o cancélala antes de validar este reporte.");
        }
        catch (InvalidOperationException ex)
        {
            throw new FlujoException(ex.Message);
        }

        await _avisos.ReporteValidadoAsync(r.Id, orden.Id, u.Id);
        await AvisarCambiosEnFilasAsync(filasAntes, u.Id);
        var cap = await GetCapacidadAsync();
        return new ResultadoFlujoDto
        {
            Mensaje = $"Reporte validado. Se generó la orden {orden.Folio}; la unidad puede trasladarse a la Zona de Transición.",
            OrdenId = orden.Id,
            OrdenFolio = orden.Folio,
            Alerta = Alerta("danados", cap.Danados.Ocupados, cap.Danados.Capacidad)
        };
    }

    public async Task<ResultadoFlujoDto> RechazarReporteAsync(int reporteId, RechazoRequest req, UsuarioFlujo u)
    {
        var r = await _db.ReportesFalla
                    .Include(x => x.ItemsChecklist).ThenInclude(i => i.ChecklistItem)
                    .Include(x => x.ImageFaults).ThenInclude(f => f.ImageFault)
                    .FirstOrDefaultAsync(x => x.Id == reporteId)
                ?? throw new FlujoException("Reporte no encontrado", 404);
        if (r.EstadoInspeccion != EstadoInspeccionEnum.Pendiente || r.TieneOrdenTrabajo)
            throw new FlujoException("Solo se puede rechazar un reporte que está pendiente de inspección.");

        var obs = Limpio(req.Observacion);
        var motivos = ResolverMotivos(req.Motivos,
            r.ItemsChecklist.ToDictionary(i => i.Id, i => i.ChecklistItem?.Pregunta ?? $"Trabajo #{i.ChecklistItemId}"),
            r.ImageFaults.ToDictionary(f => f.Id, f => f.ImageFault?.Name ?? $"Componente #{f.ImageFaultId}"), obs);

        r.EstadoInspeccion = EstadoInspeccionEnum.Rechazado;
        r.InspeccionadoPorId = u.Id;
        r.FechaInspeccion = DateTime.UtcNow;
        r.ObservacionesInspeccion = obs;
        r.UpdatedAt = DateTime.UtcNow;
        Registrar(r.Id, null, "INSPECCION", "Rechazado", u, obs, new { motivos, observacion = obs });
        await _db.SaveChangesAsync();
        await _avisos.ReporteRechazadoAsync(r.Id, u.Id);
        return new ResultadoFlujoDto { Mensaje = $"Reporte {r.Folio} rechazado. Corrígelo y reenvíalo para continuar." };
    }

    public async Task<ResultadoFlujoDto> CorregirReporteAsync(int reporteId, CorregirReporteRequest req, UsuarioFlujo u)
    {
        var r = await _db.ReportesFalla
                    .Include(x => x.ItemsChecklist).ThenInclude(i => i.ChecklistItem)
                    .FirstOrDefaultAsync(x => x.Id == reporteId)
                ?? throw new FlujoException("Reporte no encontrado", 404);
        if (r.EstadoInspeccion == EstadoInspeccionEnum.Validado || r.TieneOrdenTrabajo)
            throw new FlujoException("El reporte ya fue validado; ya no se puede corregir.");

        var anterior = new
        {
            r.Descripcion,
            Prioridad = r.Prioridad.ToString(),
            r.PuedeOperar,
            Items = r.ItemsChecklist.Select(i => new { i.ChecklistItemId, Nombre = i.ChecklistItem?.Pregunta, i.Cantidad, i.Notas }).ToList()
        };

        if (req.Descripcion != null)
        {
            var d = req.Descripcion.Trim();
            if (d.Length == 0) throw new FlujoException("La descripción no puede quedar vacía.", 400);
            r.Descripcion = d;
        }
        if (req.Prioridad.HasValue) r.Prioridad = req.Prioridad.Value;
        if (req.PuedeOperar.HasValue) r.PuedeOperar = req.PuedeOperar.Value;
        if (req.Items != null)
        {
            var ids = req.Items.Select(i => i.ChecklistItemId).Distinct().ToList();
            var existentes = await _db.ChecklistItems.Where(i => ids.Contains(i.Id)).Select(i => i.Id).ToListAsync();
            if (existentes.Count != ids.Count)
                throw new FlujoException("Uno de los trabajos elegidos ya no existe; actualiza la pantalla.", 400);
            _db.ReportesFallaChecklistItems.RemoveRange(r.ItemsChecklist);
            foreach (var i in req.Items.GroupBy(x => x.ChecklistItemId).Select(g => g.First()))
                _db.ReportesFallaChecklistItems.Add(new ReporteFallaChecklistItem
                {
                    ReporteFallaId = r.Id, ChecklistItemId = i.ChecklistItemId, Cantidad = i.Cantidad, Notas = Limpio(i.Notas),
                    FechaAsignacion = DateTime.UtcNow
                });
        }

        var reenviado = r.EstadoInspeccion == EstadoInspeccionEnum.Rechazado;
        if (reenviado)
        {
            // El flujo se reinicia en REPORTE con el Líder como responsable; el rechazo queda en el historial
            r.EstadoInspeccion = EstadoInspeccionEnum.Pendiente;
            r.ReenviadoPorId = u.Id;
            r.FechaReenvio = DateTime.UtcNow;
            r.InspeccionadoPorId = null;
            r.FechaInspeccion = null;
            r.ObservacionesInspeccion = null;
        }
        r.UpdatedAt = DateTime.UtcNow;
        Registrar(r.Id, null, "REPORTE", reenviado ? "Reenviado" : "Corregido", u, Limpio(req.Observaciones), new { anterior });
        await _db.SaveChangesAsync();
        return new ResultadoFlujoDto
        {
            Mensaje = reenviado ? $"Reporte {r.Folio} corregido y reenviado; queda pendiente de inspección." : $"Reporte {r.Folio} corregido."
        };
    }

    public async Task<ResultadoFlujoDto> ConfirmarTrasladoIngresoAsync(int ordenId, UsuarioFlujo u)
    {
        var filasAntes = await FilasBloqueadasAsync();
        await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var o = await _db.OrdenesTrabajo.Include(x => x.Vehiculo).FirstOrDefaultAsync(x => x.Id == ordenId)
                ?? throw new FlujoException("Orden de trabajo no encontrada", 404);
        if (o.Estado == EstadoOrdenTrabajoEnum.Cancelada) throw new FlujoException("La orden está cancelada.");
        if (o.FechaTrasladoIngreso != null) throw new FlujoException("La entrega de esta unidad en la Zona de Transición ya fue confirmada.");
        if (o.FechaAceptacion != null || !AntesDeTaller.Contains(o.Estado)) throw new FlujoException("Esta orden ya no está en espera de traslado.");

        var (capD, _) = await LeerCapacidadesAsync();
        var ocupados = await EnZonaDanados().CountAsync();
        var posicion = (await IdsFilaIngresoAsync()).IndexOf(o.Id) + 1;
        var libres = Math.Max(0, capD - ocupados);
        if (posicion > libres)
            throw new FlujoException(libres == 0
                ? $"La Zona de Transición para unidades dañadas ha alcanzado su capacidad máxima ({ocupados}/{capD}). La unidad {o.Vehiculo.Codigo} permanece pendiente de traslado (lugar {posicion} en la fila de espera)."
                : $"Solo hay {libres} lugar(es) libre(s) y la unidad {o.Vehiculo.Codigo} está en el lugar {posicion} de la fila de espera: primero entran las que llegaron antes.",
                409, "SinEspacio");

        o.FechaTrasladoIngreso = DateTime.UtcNow;
        o.TrasladoIngresoPorId = u.Id;
        o.UpdatedAt = DateTime.UtcNow;
        o.Vehiculo.Ubicacion = UbicacionVehiculoEnum.TransicionPorReparar;
        o.Vehiculo.UpdatedAt = DateTime.UtcNow;
        Registrar(o.ReporteFallaId, o.Id, "TRASLADO", "Confirmado", u, "Unidad entregada en la zona de dañados");
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        await _avisos.TrasladoConfirmadoAsync(o.Id, u.Id);
        await AvisarCambiosEnFilasAsync(filasAntes, u.Id);
        return new ResultadoFlujoDto
        {
            Mensaje = $"Entrega de {o.Vehiculo.Codigo} confirmada en la Zona de Transición. La orden {o.Folio} queda disponible para el taller.",
            OrdenId = o.Id, OrdenFolio = o.Folio,
            Alerta = Alerta("danados", ocupados + 1, capD)
        };
    }

    public async Task<ResultadoFlujoDto> AceptarOrdenAsync(int ordenId, UsuarioFlujo u)
    {
        var filasAntes = await FilasBloqueadasAsync();
        // Dos técnicos aceptando a la vez: uno gana y al otro se le explica (ver FlujoController)
        await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var o = await _db.OrdenesTrabajo.Include(x => x.Vehiculo).Include(x => x.TecnicoAsignado)
                    .FirstOrDefaultAsync(x => x.Id == ordenId)
                ?? throw new FlujoException("Orden de trabajo no encontrada", 404);
        if (o.Estado == EstadoOrdenTrabajoEnum.Cancelada) throw new FlujoException("La orden está cancelada.");
        if (o.FechaTrasladoIngreso == null) throw new FlujoException("La unidad aún no se entrega en la Zona de Transición.");
        if (o.FechaAceptacion != null || !AntesDeTaller.Contains(o.Estado)) throw new FlujoException("La orden ya fue aceptada.");
        if (u.Es("Tecnico") && !u.EsAdmin)
        {
            if (o.TecnicoAsignadoId.HasValue && o.TecnicoAsignadoId != u.Id)
                throw new FlujoException($"La orden está asignada a {o.TecnicoAsignado?.NombreCompleto ?? "otro técnico"}.", 403);
            o.TecnicoAsignadoId = u.Id;
        }
        else if (!o.TecnicoAsignadoId.HasValue)
            throw new FlujoException("Asigna un técnico antes de aceptar la orden.", 400);

        o.FechaAceptacion = DateTime.UtcNow;
        o.FechaAsignacion ??= DateTime.UtcNow;
        o.Estado = EstadoOrdenTrabajoEnum.Asignada;
        o.UpdatedAt = DateTime.UtcNow;
        // La unidad sale de la zona de dañados al taller: libera un lugar
        o.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Taller;
        o.Vehiculo.Estado = EstadoVehiculoEnum.EnReparacion;
        o.Vehiculo.UpdatedAt = DateTime.UtcNow;
        Registrar(o.ReporteFallaId, o.Id, "TALLER", "Aceptada", u, "Orden aceptada; inicia la revisión técnica de recepción");
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        await AvisarCambiosEnFilasAsync(filasAntes, u.Id);
        return new ResultadoFlujoDto { Mensaje = $"Orden {o.Folio} aceptada. La unidad pasa al taller para su revisión.", OrdenId = o.Id, OrdenFolio = o.Folio };
    }

    private static void ExigirQueTrabaja(OrdenTrabajo o, UsuarioFlujo u)
    {
        if (u.EsAdmin || u.Es("Supervisor")) return;
        if (u.Es("Tecnico") && o.TecnicoAsignadoId == u.Id) return;
        throw new FlujoException("Solo el técnico asignado a la orden puede hacer esto.", 403);
    }

    public async Task<ResultadoFlujoDto> AgregarHallazgosAsync(int ordenId, HallazgosRequest req, UsuarioFlujo u)
    {
        var o = await _db.OrdenesTrabajo.Include(x => x.ItemsChecklist).FirstOrDefaultAsync(x => x.Id == ordenId)
                ?? throw new FlujoException("Orden de trabajo no encontrada", 404);
        ExigirQueTrabaja(o, u);
        if (o.FechaAceptacion == null || !EnTaller.Contains(o.Estado))
            throw new FlujoException("Los hallazgos se registran durante la revisión o la reparación.");
        if (req.Items.Count == 0) throw new FlujoException("Elige al menos un trabajo.", 400);

        var ids = req.Items.Select(i => i.ChecklistItemId).Distinct().ToList();
        var nombres = await _db.ChecklistItems.Where(i => ids.Contains(i.Id)).ToDictionaryAsync(i => i.Id, i => i.Pregunta);
        if (nombres.Count != ids.Count) throw new FlujoException("Uno de los trabajos elegidos ya no existe; actualiza la pantalla.", 400);

        var yaEnOrden = o.ItemsChecklist.Select(i => i.ChecklistItemId).ToHashSet();
        var agregados = new List<string>();
        foreach (var i in req.Items.GroupBy(x => x.ChecklistItemId).Select(g => g.First()))
        {
            if (yaEnOrden.Contains(i.ChecklistItemId)) continue;
            _db.OrdenesTrabajoChecklistItems.Add(new OrdenTrabajoChecklistItem
            {
                OrdenTrabajoId = o.Id, ChecklistItemId = i.ChecklistItemId, Cantidad = i.Cantidad, Notas = Limpio(i.Notas),
                Estado = "Pendiente", FechaAsignacion = DateTime.UtcNow, ReportadoPorTaller = true
            });
            agregados.Add(nombres[i.ChecklistItemId]);
        }
        if (agregados.Count == 0) throw new FlujoException("Esos trabajos ya están en la orden.", 400);
        Registrar(o.ReporteFallaId, o.Id, "TALLER", "Hallazgo", u, "Reportado por Taller: " + string.Join(", ", agregados), new { motivos = agregados });
        await _db.SaveChangesAsync();
        return new ResultadoFlujoDto { Mensaje = agregados.Count == 1 ? "Hallazgo agregado a la orden." : $"{agregados.Count} hallazgos agregados a la orden.", OrdenId = o.Id };
    }

    public async Task<ResultadoFlujoDto> ConfirmarTrasladoRetornoAsync(int ordenId, UsuarioFlujo u)
    {
        var filasAntes = await FilasBloqueadasAsync();
        await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var o = await _db.OrdenesTrabajo.Include(x => x.Vehiculo).FirstOrDefaultAsync(x => x.Id == ordenId)
                ?? throw new FlujoException("Orden de trabajo no encontrada", 404);
        ExigirQueTrabaja(o, u);
        if (o.Estado != EstadoOrdenTrabajoEnum.Completada) throw new FlujoException("Primero termina la reparación.");
        if (o.FechaTrasladoRetorno != null) throw new FlujoException("La entrega de esta unidad en la Zona de Transición ya fue confirmada.");

        var (_, capR) = await LeerCapacidadesAsync();
        var ocupados = await EnZonaReparados().CountAsync();
        var posicion = (await IdsFilaRetornoAsync()).IndexOf(o.Id) + 1;
        var libres = Math.Max(0, capR - ocupados);
        if (posicion > libres)
            throw new FlujoException(libres == 0
                ? $"La unidad {o.Vehiculo.Codigo} no puede ser trasladada: la Zona de Transición para unidades reparadas está en su capacidad máxima ({ocupados}/{capR}). La unidad sigue bajo responsabilidad del Taller (lugar {posicion} en la fila de espera)."
                : $"Solo hay {libres} lugar(es) libre(s) y la unidad {o.Vehiculo.Codigo} está en el lugar {posicion} de la fila de espera: primero entran las que terminaron antes.",
                409, "SinEspacio");

        o.FechaTrasladoRetorno = DateTime.UtcNow;
        o.TrasladoRetornoPorId = u.Id;
        o.UpdatedAt = DateTime.UtcNow;
        o.Vehiculo.Ubicacion = UbicacionVehiculoEnum.TransicionReparado;
        o.Vehiculo.UpdatedAt = DateTime.UtcNow;
        Registrar(o.ReporteFallaId, o.Id, "TRASLADO_RETORNO", "Confirmado", u, "Unidad reparada entregada en la zona de reparados");
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        await _avisos.RetornoConfirmadoAsync(o.Id, u.Id);
        await AvisarCambiosEnFilasAsync(filasAntes, u.Id);
        return new ResultadoFlujoDto
        {
            Mensaje = $"Entrega de {o.Vehiculo.Codigo} confirmada en la Zona de Transición; queda pendiente de la validación final.",
            OrdenId = o.Id, OrdenFolio = o.Folio,
            Alerta = Alerta("reparados", ocupados + 1, capR)
        };
    }

    public async Task<ResultadoFlujoDto> ValidarReparacionAsync(int ordenId, ValidarReparacionRequest req, UsuarioFlujo u)
    {
        var filasAntes = await FilasBloqueadasAsync();
        // Aprobar y rechazar a la vez no puede dejar la orden a medias: transacción serializable
        await using var tx = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable);
        var o = await _db.OrdenesTrabajo
                    .Include(x => x.Vehiculo)
                    .Include(x => x.ItemsChecklist).ThenInclude(i => i.ChecklistItem)
                    .FirstOrDefaultAsync(x => x.Id == ordenId)
                ?? throw new FlujoException("Orden de trabajo no encontrada", 404);
        if (Liberada.Contains(o.Estado)) throw new FlujoException("La reparación ya fue validada.");
        if (o.Estado != EstadoOrdenTrabajoEnum.Completada) throw new FlujoException("La reparación aún no se termina.");
        if (o.FechaTrasladoRetorno == null)
            throw new FlujoException("Primero el técnico debe entregar la unidad en la Zona de Transición.");

        var obs = Limpio(req.Observacion);
        // Firma con el rol real: el Líder firma como Líder; Supervisor y administración como Supervisor
        var firmaLider = u.Es("Lider") && !u.Es("Supervisor") && !u.EsAdmin;
        var ahora = DateTime.UtcNow;
        var estadoFirma = req.Aprobado ? EstadoAprobacionEnum.Aprobado : EstadoAprobacionEnum.Rechazado;
        if (firmaLider)
        {
            o.EstadoAprobacionLider = estadoFirma;
            o.ComentariosAprobacionLider = Recortar(obs, 500);
            o.FirmaLider = req.Aprobado ? "Aprobado digitalmente" : "Rechazado";
            o.FirmaLiderNombre = u.Nombre;
            o.FirmaLiderFecha = ahora;
        }
        else
        {
            o.EstadoAprobacionSupervisor = estadoFirma;
            o.ComentariosAprobacionSupervisor = Recortar(obs, 500);
            o.FirmaSupervisor = req.Aprobado ? "Aprobado digitalmente" : "Rechazado";
            o.FirmaSupervisorNombre = u.Nombre;
            o.FirmaSupervisorFecha = ahora;
        }

        if (req.Aprobado)
        {
            o.Estado = EstadoOrdenTrabajoEnum.Validada;
            o.FechaValidacion = ahora;
            o.ValidadoPorId = u.Id;
            o.UpdatedAt = ahora;
            // DISPONIBLE: la unidad regresa a operación y libera su lugar en la zona de reparados
            o.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Piso;
            o.Vehiculo.Estado = EstadoVehiculoEnum.Operativo;
            o.Vehiculo.UpdatedAt = ahora;
            Registrar(o.ReporteFallaId, o.Id, "VALIDACION", "Validado", u, obs ?? "Reparación validada");
            Registrar(o.ReporteFallaId, o.Id, "DISPONIBLE", "Liberada", u, "Unidad lista para regresar a operación");
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
            await _avisos.UnidadDisponibleAsync(o.Id, u.Id);
            await AvisarCambiosEnFilasAsync(filasAntes, u.Id);
            return new ResultadoFlujoDto { Mensaje = $"Reparación validada. La unidad {o.Vehiculo.Codigo} está disponible para operar.", OrdenId = o.Id, OrdenFolio = o.Folio };
        }

        var motivos = ResolverMotivos(req.Motivos,
            o.ItemsChecklist.ToDictionary(i => i.Id, i => i.ChecklistItem?.Pregunta ?? $"Trabajo #{i.ChecklistItemId}"),
            o.ReporteFallaId.HasValue
                ? await _db.ReportImageFaults.Where(f => f.ReporteFallaId == o.ReporteFallaId)
                    .Select(f => new { f.Id, f.ImageFault.Name })
                    .ToDictionaryAsync(f => f.Id, f => f.Name)
                : new Dictionary<int, string>(),
            obs);

        // Regresa a TALLER "En proceso" con las observaciones; la unidad sale de la zona de reparados
        o.Estado = EstadoOrdenTrabajoEnum.EnProceso;
        o.FechaFinalizacion = null;
        o.FechaTrasladoRetorno = null;
        o.TrasladoRetornoPorId = null;
        o.UpdatedAt = ahora;
        o.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Taller;
        o.Vehiculo.Estado = EstadoVehiculoEnum.EnReparacion;
        o.Vehiculo.UpdatedAt = ahora;
        Registrar(o.ReporteFallaId, o.Id, "VALIDACION", "Rechazado", u, obs, new { motivos, observacion = obs });
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        await _avisos.ValidacionRechazadaAsync(o.Id, u.Id);
        await AvisarCambiosEnFilasAsync(filasAntes, u.Id);
        return new ResultadoFlujoDto { Mensaje = $"Validación rechazada. La orden {o.Folio} regresó al taller con las observaciones.", OrdenId = o.Id, OrdenFolio = o.Folio };
    }

    /// <summary>
    /// Cancela una orden que aún no se valida: sale de la Zona de Transición (libera su lugar), el vehículo
    /// regresa a piso si no le queda nada abierto y el reporte queda atendido (un problema nuevo es un reporte nuevo)
    /// </summary>
    public async Task<ResultadoFlujoDto> CancelarOrdenAsync(int ordenId, string? motivo, UsuarioFlujo u)
    {
        var m = Limpio(motivo) ?? throw new FlujoException("Escribe el motivo de la cancelación.", 400, "MotivoObligatorio");
        var o = await _db.OrdenesTrabajo.Include(x => x.Vehiculo).FirstOrDefaultAsync(x => x.Id == ordenId)
                ?? throw new FlujoException("Orden de trabajo no encontrada", 404);
        if (o.Estado == EstadoOrdenTrabajoEnum.Cancelada) throw new FlujoException("La orden ya está cancelada.");
        if (Liberada.Contains(o.Estado)) throw new FlujoException("La orden ya se validó; no se puede cancelar.");

        var filasAntes = await FilasBloqueadasAsync();
        o.Estado = EstadoOrdenTrabajoEnum.Cancelada;
        o.Notas = string.IsNullOrWhiteSpace(o.Notas) ? $"Cancelada: {m}" : $"{o.Notas}\nCancelada: {m}";
        o.UpdatedAt = DateTime.UtcNow;
        Registrar(o.ReporteFallaId, o.Id, "ORDEN", "Cancelada", u, m);
        await _db.SaveChangesAsync();
        await _eliminacion.RegresarAlPisoAsync(new[] { o.VehiculoId });
        await AvisarCambiosEnFilasAsync(filasAntes, u.Id);
        return new ResultadoFlujoDto { Mensaje = $"Orden {o.Folio} cancelada.", OrdenId = o.Id, OrdenFolio = o.Folio };
    }

}
