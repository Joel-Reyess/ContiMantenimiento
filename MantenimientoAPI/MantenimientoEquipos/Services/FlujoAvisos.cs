using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Services;

/// <summary>
/// Notificaciones por etapa del flujo de 7 etapas (PDF 23-oct-2026, textos tal cual del documento).
/// Destinatarios: el Líder asignado al tipo de vehículo (o todos si nadie lo tiene asignado), quien levantó el
/// reporte ("Operador"), el técnico asignado (o todos los técnicos si aún no hay) y el Gerente de Mantenimiento
/// (rol Supervisor). A quien hace la acción no se le avisa. Si una notificación falla, la acción no se pierde.
/// </summary>
public class FlujoAvisos
{
    private readonly MantenimientoDbContext _db;
    private readonly NotificacionService _notificaciones;
    private readonly ILogger<FlujoAvisos> _logger;

    public FlujoAvisos(MantenimientoDbContext db, NotificacionService notificaciones, ILogger<FlujoAvisos> logger)
    {
        _db = db;
        _notificaciones = notificaciones;
        _logger = logger;
    }

    private record Unidad(int VehiculoId, string Codigo, string Tipo, TipoVehiculoEnum TipoEnum, int? ReporteId, int? ReportadoPorId,
        int? OrdenId, int? TecnicoId);

    private async Task<Unidad?> DeOrdenAsync(int ordenId) => await _db.OrdenesTrabajo.AsNoTracking()
        .Where(o => o.Id == ordenId)
        .Select(o => new Unidad(o.VehiculoId, o.Vehiculo.Codigo,
            _db.TiposVehiculo.Where(t => t.Id == (int)o.Vehiculo.Tipo).Select(t => t.Nombre).FirstOrDefault() ?? o.Vehiculo.Tipo.ToString(),
            o.Vehiculo.Tipo, o.ReporteFallaId, o.ReporteFalla != null ? o.ReporteFalla.ReportadoPorId : null, o.Id, o.TecnicoAsignadoId))
        .FirstOrDefaultAsync();

    private async Task<Unidad?> DeReporteAsync(int reporteId) => await _db.ReportesFalla.AsNoTracking()
        .Where(r => r.Id == reporteId)
        .Select(r => new Unidad(r.VehiculoId, r.Vehiculo.Codigo,
            _db.TiposVehiculo.Where(t => t.Id == (int)r.Vehiculo.Tipo).Select(t => t.Nombre).FirstOrDefault() ?? r.Vehiculo.Tipo.ToString(),
            r.Vehiculo.Tipo, r.Id, r.ReportadoPorId, null, null))
        .FirstOrDefaultAsync();

    private Task<List<int>> ActivosConRol(string rol) => _db.Users
        .Where(u => u.Status == UserStatusEnum.Activo && u.Roles.Any(r => r.Nombre == rol))
        .Select(u => u.Id).ToListAsync();

    private async Task<List<int>> LideresAsync(Unidad u)
    {
        var asignados = await _db.LiderTipoVehiculoAsignaciones
            .Where(a => a.TipoVehiculo == u.TipoEnum && a.Usuario.Status == UserStatusEnum.Activo && a.Usuario.Roles.Any(r => r.Nombre == "Lider"))
            .Select(a => a.UsuarioId).ToListAsync();
        if (asignados.Count > 0) return asignados;
        var lideres = await ActivosConRol("Lider");
        return lideres.Count > 0 ? lideres : await GerentesAsync(); // sin Líderes, que no se pierda el aviso
    }

    private static List<int> Operador(Unidad u) => u.ReportadoPorId.HasValue ? new List<int> { u.ReportadoPorId.Value } : new List<int>();
    private Task<List<int>> GerentesAsync() => ActivosConRol("Supervisor");
    private async Task<List<int>> TecnicosAsync(Unidad u) =>
        u.TecnicoId.HasValue ? new List<int> { u.TecnicoId.Value } : await ActivosConRol("Tecnico");

    private static string Frase(Unidad u) => $"la unidad {u.Codigo} de tipo {u.Tipo}";
    private static string FraseMayus(Unidad u) => $"La unidad {u.Codigo} de tipo {u.Tipo}";

    private async Task EnviarAsync(IEnumerable<int> destinatarios, int? actor, TipoNotificacionEnum tipo, string titulo, string mensaje, Unidad u)
    {
        var ids = destinatarios.Where(id => id != actor).Distinct().ToList();
        if (ids.Count == 0) return;
        var (refId, refTipo, url) = u.OrdenId.HasValue
            ? (u.OrdenId, "OrdenTrabajo", $"/ordenes/{u.OrdenId}")
            : (u.ReporteId, "ReporteFalla", $"/reportes/{u.ReporteId}");
        await _notificaciones.CrearParaUsuariosAsync(ids, tipo, titulo, mensaje, refId, refTipo, url);
    }

    /// <summary>Ejecuta el aviso sin que un error de notificación eche abajo la acción ya guardada</summary>
    private async Task SeguroAsync(string evento, Func<Task> aviso)
    {
        try { await aviso(); }
        catch (Exception ex) { _logger.LogError(ex, "No se pudo notificar {Evento}", evento); }
    }

    // ===== REPORTE e INSPECCIÓN =====

    public Task NuevoReporteAsync(int reporteId, int? actor) => SeguroAsync("nuevo reporte", async () =>
    {
        var u = await DeReporteAsync(reporteId); if (u == null) return;
        await EnviarAsync(await LideresAsync(u), actor, TipoNotificacionEnum.NuevoReporte, "Nuevo reporte de falla",
            $"Se ha generado un nuevo reporte de falla para {Frase(u)}. Se requiere realizar la inspección y validación inicial para continuar con el proceso.", u);
    });

    public Task ReporteValidadoAsync(int reporteId, int ordenId, int? actor) => SeguroAsync("reporte validado", async () =>
    {
        var u = await DeOrdenAsync(ordenId); if (u == null) return;
        await EnviarAsync(Operador(u).Concat(await LideresAsync(u)), actor, TipoNotificacionEnum.OrdenActualizada, "Reporte validado",
            $"El reporte de falla de {Frase(u)} ha sido validado correctamente. La unidad puede ser trasladada a Zona de Transición.", u);
        await EnviarAsync(await TecnicosAsync(u), actor, TipoNotificacionEnum.OrdenActualizada, "Unidad aprobada para mantenimiento",
            $"{FraseMayus(u)} ha sido aprobada para mantenimiento y será trasladada a Zona de Transición. Mantente atento a su recepción.", u);
    });

    public Task ReporteRechazadoAsync(int reporteId, int? actor) => SeguroAsync("reporte rechazado", async () =>
    {
        var u = await DeReporteAsync(reporteId); if (u == null) return;
        await EnviarAsync(Operador(u).Concat(await LideresAsync(u)), actor, TipoNotificacionEnum.OrdenActualizada, "Reporte con correcciones",
            $"El reporte de falla de {Frase(u)} requiere correcciones antes de continuar.", u);
    });

    // ===== TRASLADO y TALLER =====

    public Task TrasladoConfirmadoAsync(int ordenId, int? actor) => SeguroAsync("traslado", async () =>
    {
        var u = await DeOrdenAsync(ordenId); if (u == null) return;
        await EnviarAsync(await TecnicosAsync(u), actor, TipoNotificacionEnum.OrdenActualizada, "Unidad en Zona de Transición",
            $"{FraseMayus(u)} ha sido entregada en Zona de Transición. La orden de trabajo se encuentra disponible para ser atendida.", u);
    });

    public Task ReparacionEnProcesoAsync(int ordenId, int? actor) => SeguroAsync("reparación en proceso", async () =>
    {
        var u = await DeOrdenAsync(ordenId); if (u == null) return;
        await EnviarAsync((await LideresAsync(u)).Concat(Operador(u)), actor, TipoNotificacionEnum.OrdenActualizada, "Reparación en proceso",
            $"La orden de trabajo de {Frase(u)} ha sido revisada y aceptada por el área de mantenimiento. La reparación se encuentra en proceso.", u);
    });

    public Task ReparacionConcluidaAsync(int ordenId, int? actor) => SeguroAsync("reparación concluida", async () =>
    {
        var u = await DeOrdenAsync(ordenId); if (u == null) return;
        await EnviarAsync((await LideresAsync(u)).Concat(Operador(u)), actor, TipoNotificacionEnum.OrdenActualizada, "Reparación concluida",
            $"La reparación de {Frase(u)} ha sido concluida. La unidad se encuentra pendiente de entrega en Zona de Transición para su validación final.", u);
    });

    // ===== TRASLADO de retorno, VALIDACIÓN y DISPONIBLE =====

    public Task RetornoConfirmadoAsync(int ordenId, int? actor) => SeguroAsync("retorno", async () =>
    {
        var u = await DeOrdenAsync(ordenId); if (u == null) return;
        await EnviarAsync((await LideresAsync(u)).Concat(Operador(u)).Concat(await GerentesAsync()), actor, TipoNotificacionEnum.OrdenActualizada,
            "Validación final pendiente",
            $"{FraseMayus(u)} ha sido entregada en Zona de Transición. Se requiere realizar la validación final de la reparación.", u);
    });

    public Task ValidacionRechazadaAsync(int ordenId, int? actor) => SeguroAsync("validación rechazada", async () =>
    {
        var u = await DeOrdenAsync(ordenId); if (u == null) return;
        await EnviarAsync(await TecnicosAsync(u), actor, TipoNotificacionEnum.OrdenActualizada, "Reparación no aprobada",
            $"La reparación de {Frase(u)} no ha sido aprobada durante la validación final. Consulta las observaciones registradas y continúa con las correcciones necesarias.", u);
        await EnviarAsync((await LideresAsync(u)).Concat(await GerentesAsync()), actor, TipoNotificacionEnum.OrdenActualizada, "Validación rechazada",
            $"La validación final de {Frase(u)} ha sido rechazada. La orden de trabajo regresó al área de mantenimiento para correcciones adicionales.", u);
    });

    public Task UnidadDisponibleAsync(int ordenId, int? actor) => SeguroAsync("unidad disponible", async () =>
    {
        var u = await DeOrdenAsync(ordenId); if (u == null) return;
        await EnviarAsync((await LideresAsync(u)).Concat(await TecnicosAsync(u)).Concat(Operador(u)), actor, TipoNotificacionEnum.OrdenActualizada,
            "Unidad disponible",
            $"La reparación de {Frase(u)} ha sido validada satisfactoriamente. La unidad está lista para regresar a operación.", u);
    });

    // ===== Capacidad: unidades que se quedan sin espacio o que ya pueden pasar =====

    /// <summary>
    /// Compara las filas de espera antes y después de un movimiento: avisa a las unidades que quedaron sin
    /// espacio (y una vez al Gerente) y a las que ya pueden trasladarse porque se liberó un lugar.
    /// </summary>
    public Task CambiosEnFilasAsync(FilasBloqueadas antes, FilasBloqueadas despues, int? actor) => SeguroAsync("capacidad", async () =>
    {
        // ---- Zona de dañados ----
        bool llenaD = despues.OcupadosDanados >= despues.CapacidadDanados;
        // Cuando la zona se llena con unidades esperando, a todas se les avisa (aunque ya supieran que estaban en fila)
        bool saturadaAntesD = antes.OcupadosDanados >= antes.CapacidadDanados && antes.BloqueadasIngreso.Count > 0;
        bool recienSaturadaD = llenaD && despues.BloqueadasIngreso.Count > 0 && !saturadaAntesD;
        foreach (var id in recienSaturadaD ? despues.BloqueadasIngreso : despues.BloqueadasIngreso.Except(antes.BloqueadasIngreso))
        {
            var u = await DeOrdenAsync(id); if (u == null) continue;
            var lugar = despues.FilaIngreso.IndexOf(id) + 1;
            await EnviarAsync(Operador(u).Concat(await LideresAsync(u)), actor, TipoNotificacionEnum.SistemaGeneral,
                llenaD ? "Zona de Transición sin espacio" : "Unidad en fila de espera",
                llenaD
                    ? $"La Zona de Transición para unidades dañadas ha alcanzado su capacidad máxima ({despues.OcupadosDanados}/{despues.CapacidadDanados}). {FraseMayus(u)} permanece pendiente de traslado."
                    : $"{FraseMayus(u)} está en el lugar {lugar} de la fila de espera de la Zona de Transición; se podrá trasladar cuando le toque.", u);
        }
        foreach (var id in antes.BloqueadasIngreso.Where(despues.PuedenIngresar.Contains))
        {
            var u = await DeOrdenAsync(id); if (u == null) continue;
            await EnviarAsync(Operador(u).Concat(await LideresAsync(u)), actor, TipoNotificacionEnum.SistemaGeneral, "Espacio liberado en Zona de Transición",
                $"Se ha liberado espacio en la Zona de Transición. {FraseMayus(u)} puede ser trasladada y continuar con su proceso.", u);
        }
        // Al Gerente, una vez cada vez que la zona se satura con unidades esperando
        if (recienSaturadaD)
        {
            var u = await DeOrdenAsync(despues.BloqueadasIngreso.First());
            if (u != null)
                await EnviarAsync(await GerentesAsync(), actor, TipoNotificacionEnum.SistemaGeneral, "Zona de Transición saturada",
                    "La capacidad máxima de la Zona de Transición para unidades dañadas ha sido alcanzada. Existen vehículos pendientes de ingreso.", u);
        }

        // ---- Zona de reparados ----
        bool llenaR = despues.OcupadosReparados >= despues.CapacidadReparados;
        bool saturadaAntesR = antes.OcupadosReparados >= antes.CapacidadReparados && antes.BloqueadasRetorno.Count > 0;
        bool recienSaturadaR = llenaR && despues.BloqueadasRetorno.Count > 0 && !saturadaAntesR;
        foreach (var id in recienSaturadaR ? despues.BloqueadasRetorno : despues.BloqueadasRetorno.Except(antes.BloqueadasRetorno))
        {
            var u = await DeOrdenAsync(id); if (u == null) continue;
            var lugar = despues.FilaRetorno.IndexOf(id) + 1;
            await EnviarAsync(await TecnicosAsync(u), actor, TipoNotificacionEnum.SistemaGeneral,
                llenaR ? "Zona de Transición sin espacio" : "Unidad en fila de espera",
                llenaR
                    ? $"{FraseMayus(u)} no puede ser trasladada debido a que la Zona de Transición para unidades reparadas se encuentra en su capacidad máxima."
                    : $"{FraseMayus(u)} está en el lugar {lugar} de la fila de espera para entregarse en la Zona de Transición; se podrá trasladar cuando le toque.", u);
            if (llenaR)
                await EnviarAsync(await LideresAsync(u), actor, TipoNotificacionEnum.SistemaGeneral, "Unidad reparada sin espacio",
                    $"{FraseMayus(u)} ha concluido su reparación, pero no existe espacio disponible para su recepción en Zona de Transición.", u);
        }
        foreach (var id in antes.BloqueadasRetorno.Where(despues.PuedenRetornar.Contains))
        {
            var u = await DeOrdenAsync(id); if (u == null) continue;
            await EnviarAsync(await TecnicosAsync(u), actor, TipoNotificacionEnum.SistemaGeneral, "Espacio liberado en Zona de Transición",
                $"Se ha liberado espacio en la Zona de Transición. {FraseMayus(u)} puede ser trasladada y continuar con su proceso.", u);
        }
        if (recienSaturadaR)
        {
            var u = await DeOrdenAsync(despues.BloqueadasRetorno.First());
            if (u != null)
                await EnviarAsync(await GerentesAsync(), actor, TipoNotificacionEnum.SistemaGeneral, "Zona de Transición saturada",
                    "La capacidad máxima de la Zona de Transición para unidades reparadas ha sido alcanzada. Existen unidades terminadas pendientes de entrega.", u);
        }
    });
}

/// <summary>
/// Fotografía de las filas de espera (en orden): las que no caben por su lugar y las primeras que sí caben
/// </summary>
public record FilasBloqueadas(
    List<int> FilaIngreso, HashSet<int> BloqueadasIngreso, HashSet<int> PuedenIngresar, int OcupadosDanados, int CapacidadDanados,
    List<int> FilaRetorno, HashSet<int> BloqueadasRetorno, HashSet<int> PuedenRetornar, int OcupadosReparados, int CapacidadReparados);
