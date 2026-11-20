using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Services;

/// <summary>
/// Notificaciones del flujo de equipos eléctricos (EQE-11), con el formato del documento:
/// "El equipo [Tipo de vehículo] [Número económico] …". Destinatarios: los técnicos del proveedor eléctrico, el Líder
/// (el que reportó, o los asignados al tipo, o todos) y el Administrador. A quien hace la acción no se le avisa.
/// </summary>
public class ElectricoAvisos
{
    private readonly MantenimientoDbContext _db;
    private readonly NotificacionService _notificaciones;
    private readonly ILogger<ElectricoAvisos> _logger;

    public ElectricoAvisos(MantenimientoDbContext db, NotificacionService notificaciones, ILogger<ElectricoAvisos> logger)
    {
        _db = db;
        _notificaciones = notificaciones;
        _logger = logger;
    }

    public record Equipo(int VehiculoId, string Nombre, TipoVehiculoEnum Tipo, int? OrdenId, string? Folio, int? TecnicoId, int? ReportoId, int? EmpresaId);

    private async Task SeguroAsync(string evento, Func<Task> aviso)
    {
        try { await aviso(); }
        catch (Exception ex) { _logger.LogError(ex, "No se pudo notificar {Evento}", evento); }
    }

    private static string Nombre(string? tipo, string? numeroEconomico, string codigo) =>
        $"{tipo ?? "equipo"} {(string.IsNullOrWhiteSpace(numeroEconomico) ? codigo : numeroEconomico)}".Trim();

    public async Task<Equipo?> DeOrdenAsync(int ordenId)
    {
        var o = await _db.OrdenesTrabajo.AsNoTracking()
            .Where(x => x.Id == ordenId)
            .Select(x => new
            {
                x.VehiculoId, x.Vehiculo.Codigo, x.Vehiculo.NumeroEconomico, x.Vehiculo.Tipo, x.Id, x.Folio, x.TecnicoAsignadoId, x.EmpresaId,
                Reporto = x.ReporteFalla != null ? (int?)x.ReporteFalla.ReportadoPorId : null,
                TipoNombre = _db.TiposVehiculo.Where(t => t.Id == (int)x.Vehiculo.Tipo).Select(t => t.Nombre).FirstOrDefault()
            })
            .FirstOrDefaultAsync();
        return o == null ? null
            : new Equipo(o.VehiculoId, Nombre(o.TipoNombre, o.NumeroEconomico, o.Codigo), o.Tipo, o.Id, o.Folio, o.TecnicoAsignadoId, o.Reporto, o.EmpresaId);
    }

    public async Task<Equipo?> DeVehiculoAsync(int vehiculoId)
    {
        var v = await _db.Vehiculos.AsNoTracking()
            .Where(x => x.Id == vehiculoId)
            .Select(x => new { x.Id, x.Codigo, x.NumeroEconomico, x.Tipo, TipoNombre = _db.TiposVehiculo.Where(t => t.Id == (int)x.Tipo).Select(t => t.Nombre).FirstOrDefault() })
            .FirstOrDefaultAsync();
        return v == null ? null : new Equipo(v.Id, Nombre(v.TipoNombre, v.NumeroEconomico, v.Codigo), v.Tipo, null, null, null, null, null);
    }

    private Task<List<int>> ConRol(params string[] roles) => _db.Users
        .Where(u => u.Status == UserStatusEnum.Activo && u.Roles.Any(r => roles.Contains(r.Nombre)))
        .Select(u => u.Id).ToListAsync();

    private Task<List<int>> AdministradoresAsync() => ConRol("Administrador", "Supervisor", "SuperUsuario");

    /// <summary>Técnicos activos del proveedor eléctrico (o de la empresa de la orden)</summary>
    private async Task<List<int>> TecnicosAsync(int? empresaId)
    {
        empresaId ??= await _db.Empresas.Where(e => e.ProveedorElectrico && e.Activo).Select(e => (int?)e.Id).FirstOrDefaultAsync();
        if (empresaId == null) return new List<int>();
        return await _db.Users
            .Where(u => u.EmpresaId == empresaId && u.Status == UserStatusEnum.Activo && u.Roles.Any(r => r.Nombre == "Tecnico"))
            .Select(u => u.Id).ToListAsync();
    }

    /// <summary>El Líder que reportó; si no fue un Líder, los asignados al tipo o todos los Líderes</summary>
    private async Task<List<int>> LideresAsync(Equipo e)
    {
        if (e.ReportoId.HasValue && await _db.Users.AnyAsync(u => u.Id == e.ReportoId && u.Roles.Any(r => r.Nombre == "Lider")))
            return new List<int> { e.ReportoId.Value };
        var asignados = await _db.LiderTipoVehiculoAsignaciones
            .Where(a => a.TipoVehiculo == e.Tipo && a.Usuario.Status == UserStatusEnum.Activo && a.Usuario.Roles.Any(r => r.Nombre == "Lider"))
            .Select(a => a.UsuarioId).ToListAsync();
        return asignados.Count > 0 ? asignados : await ConRol("Lider");
    }

    private async Task EnviarAsync(IEnumerable<int> ids, int? actor, string titulo, string mensaje, Equipo e)
    {
        var lista = ids.Where(id => id != actor).Distinct().ToList();
        if (lista.Count == 0) return;
        var (refId, refTipo, url) = e.OrdenId.HasValue
            ? (e.OrdenId, "OrdenTrabajo", $"/ordenes/{e.OrdenId}")
            : ((int?)e.VehiculoId, "Vehiculo", "/equipos-electricos");
        await _notificaciones.CrearParaUsuariosAsync(lista, TipoNotificacionEnum.OrdenActualizada, titulo, mensaje, refId, refTipo, url);
    }

    // ===== Correctivo =====

    public Task ReporteCreadoAsync(int ordenId, int? actor) => SeguroAsync("reporte eléctrico", async () =>
    {
        var e = await DeOrdenAsync(ordenId); if (e == null) return;
        await EnviarAsync((await TecnicosAsync(e.EmpresaId)).Concat(await AdministradoresAsync()), actor, "Equipo reportado con falla",
            $"El equipo {e.Nombre} fue reportado con falla y requiere atención.", e);
        // Confirmación al Líder que reportó (a él sí, aunque sea quien hizo la acción)
        if (e.ReportoId.HasValue && await _db.Users.AnyAsync(u => u.Id == e.ReportoId && u.Roles.Any(r => r.Nombre == "Lider")))
            await EnviarAsync(new[] { e.ReportoId.Value }, null, "Reporte registrado",
                $"Se registró el reporte del equipo {e.Nombre}; quedará fuera de servicio al ingresar al taller.", e);
    });

    public Task OrdenAceptadaAsync(int ordenId, string tecnico, int? actor) => SeguroAsync("orden eléctrica aceptada", async () =>
    {
        var e = await DeOrdenAsync(ordenId); if (e == null) return;
        await EnviarAsync((await LideresAsync(e)).Concat(await AdministradoresAsync()), actor, "Orden aceptada",
            $"El equipo {e.Nombre} fue aceptado por {tecnico} y pasará al taller.", e);
    });

    public Task IngresoTallerAsync(int ordenId, bool preventivo, int? actor) => SeguroAsync("ingreso al taller", async () =>
    {
        var e = await DeOrdenAsync(ordenId); if (e == null) return;
        if (preventivo)
            await EnviarAsync(await LideresAsync(e), actor, "Preventivo iniciado", $"El equipo {e.Nombre} ingresó a mantenimiento preventivo.", e);
        else
            await EnviarAsync((await LideresAsync(e)).Concat(await AdministradoresAsync()), actor, "Equipo en el taller",
                $"El equipo {e.Nombre} ingresó al taller y está fuera de servicio (en reparación).", e);
    });

    public Task ListoParaEntregaAsync(int ordenId, int? actor) => SeguroAsync("listo para entrega", async () =>
    {
        var e = await DeOrdenAsync(ordenId); if (e == null) return;
        await EnviarAsync(await LideresAsync(e), actor, "Equipo listo",
            $"El equipo {e.Nombre} está listo y será llevado a su área para entrega.", e);
    });

    public Task EnAreaAsync(int ordenId, int? actor) => SeguroAsync("equipo en el área", async () =>
    {
        var e = await DeOrdenAsync(ordenId); if (e == null) return;
        await EnviarAsync(await LideresAsync(e), actor, "Aprobación de entrega pendiente",
            $"El equipo {e.Nombre} está en su área; se requiere su aprobación de entrega en el sistema.", e);
    });

    public Task EntregaAprobadaAsync(int ordenId, int? actor) => SeguroAsync("entrega aprobada", async () =>
    {
        var e = await DeOrdenAsync(ordenId); if (e == null) return;
        var tecnico = e.TecnicoId.HasValue ? new List<int> { e.TecnicoId.Value } : new List<int>();
        await EnviarAsync(tecnico.Concat(await AdministradoresAsync()), actor, "Entrega aprobada",
            $"El Líder aprobó la entrega del equipo {e.Nombre}; suba el documento firmado.", e);
    });

    public Task EntregaCompletadaAsync(int ordenId, bool preventivo, DateTime? proximo, int? actor) => SeguroAsync("entrega completada", async () =>
    {
        var e = await DeOrdenAsync(ordenId); if (e == null) return;
        var destinos = (await LideresAsync(e)).Concat(await AdministradoresAsync());
        if (preventivo)
            await EnviarAsync(destinos, actor, "Preventivo completado",
                $"El equipo {e.Nombre} completó su mantenimiento y está operativo; próximo: {(proximo.HasValue ? proximo.Value.ToString("dd/MM/yyyy") : "por definir")}.", e);
        else
            await EnviarAsync(destinos, actor, "Equipo operativo", $"El equipo {e.Nombre} está operativo nuevamente.", e);
    });

    public Task MalEstadoAsync(int ordenId, int n, int? actor) => SeguroAsync("mal estado", async () =>
    {
        var e = await DeOrdenAsync(ordenId); if (e == null || n == 0) return;
        await EnviarAsync((await AdministradoresAsync()).Concat(await LideresAsync(e)), actor, "Preventivo con ítems en mal estado",
            $"El preventivo del equipo {e.Nombre} se completó con {n} ítem(s) en mal estado.", e);
    });

    public Task OrdenPagoAsync(int ordenId, int pagoId, int? actor) => SeguroAsync("orden de pago eléctrica", async () =>
    {
        var e = await DeOrdenAsync(ordenId); if (e == null) return;
        var ids = (await AdministradoresAsync()).Where(id => id != actor).ToList();
        if (ids.Count == 0) return;
        await _notificaciones.CrearParaUsuariosAsync(ids, TipoNotificacionEnum.SistemaGeneral, "Nueva orden de pago",
            $"Se generó la orden de pago de la orden {e.Folio} del equipo {e.Nombre}.", pagoId, "RegistroPago", "/pagos");
    });

    // ===== Recordatorios (los manda el proceso en segundo plano) =====

    public Task EntregaSinAprobarAsync(int ordenId) => SeguroAsync("entrega sin aprobar", async () =>
    {
        var e = await DeOrdenAsync(ordenId); if (e == null) return;
        await EnviarAsync((await LideresAsync(e)).Concat(await AdministradoresAsync()), null, "Entrega sin aprobar",
            $"La entrega del equipo {e.Nombre} sigue pendiente de aprobación del Líder.", e);
    });

    public Task DocumentoPendienteAsync(int ordenId, int horas) => SeguroAsync("documento pendiente", async () =>
    {
        var e = await DeOrdenAsync(ordenId); if (e == null) return;
        var tecnico = e.TecnicoId.HasValue ? new List<int> { e.TecnicoId.Value } : new List<int>();
        await EnviarAsync(tecnico.Concat(await AdministradoresAsync()), null, "Falta el documento firmado",
            $"El equipo {e.Nombre} tiene la entrega aprobada y falta subir el documento firmado (más de {horas} horas).", e);
    });

    /// <summary>Recordatorio de preventivo: Ventana (7 días antes), 3Dias, 1Dia o Vencido (cada 3 días)</summary>
    public Task RecordatorioPreventivoAsync(int vehiculoId, string tipo) => SeguroAsync("recordatorio preventivo", async () =>
    {
        var e = await DeVehiculoAsync(vehiculoId); if (e == null) return;
        var tecnicos = await TecnicosAsync(null);
        switch (tipo)
        {
            case "Ventana":
                await EnviarAsync(tecnicos.Concat(await AdministradoresAsync()), null, "Preventivo disponible",
                    $"El equipo {e.Nombre} ya puede recibir su mantenimiento preventivo.", e);
                break;
            case "3Dias":
                await EnviarAsync(tecnicos.Concat(await LideresAsync(e)), null, "Preventivo por vencer",
                    $"El preventivo del equipo {e.Nombre} vence en 3 días.", e);
                break;
            case "1Dia":
                await EnviarAsync(tecnicos.Concat(await LideresAsync(e)).Concat(await AdministradoresAsync()), null, "Preventivo vence mañana",
                    $"El preventivo del equipo {e.Nombre} vence mañana.", e);
                break;
            case "Hoy":
                await EnviarAsync(tecnicos.Concat(await LideresAsync(e)).Concat(await AdministradoresAsync()), null, "Preventivo vence hoy",
                    $"El preventivo del equipo {e.Nombre} vence hoy.", e);
                break;
            case "Vencido":
                await EnviarAsync(tecnicos.Concat(await LideresAsync(e)).Concat(await AdministradoresAsync()), null, "Preventivo vencido",
                    $"El preventivo del equipo {e.Nombre} está vencido.", e);
                break;
        }
    });
}
