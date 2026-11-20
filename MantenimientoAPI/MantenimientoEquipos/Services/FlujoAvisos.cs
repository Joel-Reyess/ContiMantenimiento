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
    // USR-03 (Reporte 7): el Gerente de Mantenimiento es ahora el Administrador
    private Task<List<int>> GerentesAsync() => _db.Users
        .Where(u => u.Status == UserStatusEnum.Activo && u.Roles.Any(r => r.Nombre == "Administrador" || r.Nombre == "Supervisor" || r.Nombre == "SuperUsuario"))
        .Select(u => u.Id).ToListAsync();
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

    // ===== Inventario y pagos (PDF 29-oct, 5.1 y 6.1) =====

    /// <summary>Un artículo llegó (o quedó por debajo de) su stock mínimo: aviso al Gerente de Mantenimiento</summary>
    public Task StockMinimoAsync(IEnumerable<(int Id, string Nombre)> articulos, int? actor) => SeguroAsync("stock mínimo", async () =>
    {
        var lista = articulos.ToList();
        if (lista.Count == 0) return;
        var ids = (await GerentesAsync()).Where(id => id != actor).ToList();
        if (ids.Count == 0) ids = await ActivosConRol("Administrador");
        foreach (var (id, nombre) in lista)
            await _notificaciones.CrearParaUsuariosAsync(ids, TipoNotificacionEnum.SistemaGeneral, "Stock mínimo",
                $"La refacción {nombre} ha alcanzado el nivel mínimo de inventario configurado. Se recomienda programar una reposición.",
                id, "Consumible", "/materiales");
    });

    /// <summary>Nueva orden de pago generada al validar la reparación: aviso al Gerente de Mantenimiento</summary>
    public Task OrdenPagoGeneradaAsync(int pagoId, string ordenFolio, int? actor) => SeguroAsync("orden de pago", async () =>
    {
        var ids = (await GerentesAsync()).Where(id => id != actor).ToList();
        if (ids.Count == 0) return;
        await _notificaciones.CrearParaUsuariosAsync(ids, TipoNotificacionEnum.SistemaGeneral, "Nueva orden de pago",
            $"Se ha generado una nueva orden de pago asociada a la Orden de Trabajo {ordenFolio}. La documentación se encuentra disponible para revisión y autorización.",
            pagoId, "RegistroPago", "/pagos");
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

    // ===== SELECCIÓN de empresa proveedora, capacidad y presupuesto (Reporte 6) =====

    private Task<List<int>> AdministradoresAsync() => _db.Users
        .Where(u => u.Status == UserStatusEnum.Activo && u.Roles.Any(r => r.Nombre == "Administrador" || r.Nombre == "SuperUsuario"))
        .Select(u => u.Id).ToListAsync();

    /// <summary>Gerentes de Mantenimiento; si no hay, administradores (que el aviso no se pierda)</summary>
    private async Task<List<int>> GerentesOAdminAsync()
    {
        var g = await GerentesAsync();
        return g.Count > 0 ? g : await AdministradoresAsync();
    }

    private Task<List<int>> TecnicosDeEmpresaAsync(int empresaId) => _db.Users
        .Where(u => u.EmpresaId == empresaId && u.Status == UserStatusEnum.Activo && u.Roles.Any(r => r.Nombre == "Tecnico"))
        .Select(u => u.Id).ToListAsync();

    private Task<string?> FolioAsync(int ordenId) => _db.OrdenesTrabajo.Where(o => o.Id == ordenId).Select(o => o.Folio).FirstOrDefaultAsync();

    private async Task EnviarSimpleAsync(IEnumerable<int> destinatarios, int? actor, string titulo, string mensaje, string url, int? refId = null, string? refTipo = null)
    {
        var ids = destinatarios.Where(id => id != actor).Distinct().ToList();
        if (ids.Count == 0) return;
        await _notificaciones.CrearParaUsuariosAsync(ids, TipoNotificacionEnum.SistemaGeneral, titulo, mensaje, refId, refTipo, url);
    }

    /// <summary>La orden quedó asignada (automática o reasignada): aviso al técnico asignado</summary>
    public Task OrdenAsignadaAEmpresaAsync(int ordenId, string empresa, int? actor) => SeguroAsync("orden asignada a empresa", async () =>
    {
        var u = await DeOrdenAsync(ordenId); if (u?.TecnicoId == null) return;
        var folio = await FolioAsync(ordenId);
        await EnviarAsync(new[] { u.TecnicoId.Value }, actor, TipoNotificacionEnum.OrdenAsignada, "Orden de trabajo asignada",
            $"La orden de trabajo {folio} de {Frase(u)} fue asignada a {empresa} y está a tu cargo. La unidad se encuentra en Zona de Transición, disponible para ser aceptada.", u);
    });

    /// <summary>Al técnico que tenía la orden antes de una reasignación</summary>
    public Task OrdenReasignadaAsync(int ordenId, int tecnicoAnteriorId, int? actor) => SeguroAsync("orden reasignada", async () =>
    {
        var u = await DeOrdenAsync(ordenId); if (u == null) return;
        var folio = await FolioAsync(ordenId);
        await EnviarAsync(new[] { tecnicoAnteriorId }, actor, TipoNotificacionEnum.OrdenActualizada, "Orden de trabajo reasignada",
            $"La orden de trabajo {folio} de {Frase(u)} fue reasignada; ya no está a tu cargo.", u);
    });

    /// <summary>Ninguna empresa es elegible: aviso al Gerente de Mantenimiento (texto del Reporte 6)</summary>
    public Task SinProveedorAsync(int ordenId, string folio, int? actor) => SeguroAsync("sin proveedor", async () =>
    {
        var u = await DeOrdenAsync(ordenId); if (u == null) return;
        await EnviarAsync(await GerentesOAdminAsync(), null, TipoNotificacionEnum.SistemaGeneral, "Orden sin empresa proveedora",
            $"No fue posible asignar la Orden de Trabajo {folio}, debido a que actualmente no existen empresas proveedoras disponibles.", u);
    });

    public Task AceptacionBloqueadaAsync(int ordenId, string empresa, int activas, int capacidad, int? actor) => SeguroAsync("aceptación bloqueada", async () =>
    {
        var u = await DeOrdenAsync(ordenId); if (u == null) return;
        var folio = await FolioAsync(ordenId);
        if (u.TecnicoId.HasValue)
            await EnviarAsync(new[] { u.TecnicoId.Value }, null, TipoNotificacionEnum.SistemaGeneral, "Capacidad máxima alcanzada",
                $"No es posible aceptar la orden {folio}: {empresa} tiene {activas} de {capacidad} órdenes activas. La orden permanece en espera hasta liberar capacidad.", u);
        await EnviarAsync(await GerentesOAdminAsync(), actor, TipoNotificacionEnum.SistemaGeneral, "Aceptación bloqueada por capacidad",
            $"La orden {folio} de {Frase(u)} no pudo ser aceptada: {empresa} tiene {activas} de {capacidad} órdenes activas. Permanece en espera hasta liberar capacidad.", u);
    });

    public Task CapacidadLiberadaAsync(int ordenId, int? actor) => SeguroAsync("capacidad liberada", async () =>
    {
        var u = await DeOrdenAsync(ordenId); if (u?.TecnicoId == null) return;
        var folio = await FolioAsync(ordenId);
        await EnviarAsync(new[] { u.TecnicoId.Value }, actor, TipoNotificacionEnum.SistemaGeneral, "Capacidad liberada",
            $"Se liberó capacidad en tu empresa: ya puedes aceptar la orden {folio} de {Frase(u)}.", u);
    });

    /// <summary>80 % de la capacidad (p. ej. 8 de 10): aviso al Gerente</summary>
    public Task CapacidadPreventivaEmpresaAsync(int empresaId, string empresa, int activas, int capacidad, int? actor) => SeguroAsync("capacidad 80%", async () =>
    {
        var pct = capacidad > 0 ? (int)Math.Round(activas * 100m / capacidad) : 100;
        await EnviarSimpleAsync(await GerentesOAdminAsync(), actor, "Capacidad de empresa al " + pct + "%",
            $"La empresa {empresa} ha alcanzado el {pct}% de su capacidad operativa disponible ({activas} de {capacidad} órdenes activas).",
            "/presupuesto-empresas", empresaId, "Empresa");
    });

    /// <summary>Capacidad máxima: aviso a los técnicos de la empresa y al Gerente (textos del Reporte 6)</summary>
    public Task CapacidadMaximaEmpresaAsync(int empresaId, string empresa, int activas, int capacidad, int? actor) => SeguroAsync("capacidad máxima", async () =>
    {
        await EnviarSimpleAsync(await TecnicosDeEmpresaAsync(empresaId), null, "Capacidad máxima alcanzada",
            $"Has alcanzado tu capacidad máxima de {capacidad} órdenes activas y dejarás de recibir asignaciones automáticas hasta liberar capacidad.",
            "/mis-ordenes", empresaId, "Empresa");
        await EnviarSimpleAsync(await GerentesOAdminAsync(), actor, "Empresa en capacidad máxima",
            $"La empresa {empresa} ha alcanzado su capacidad máxima de {capacidad} órdenes activas y dejará de recibir asignaciones automáticas hasta liberar capacidad.",
            "/presupuesto-empresas", empresaId, "Empresa");
    });

    private Task<string?> NombreEmpresaAsync(int empresaId) => _db.Empresas.Where(e => e.Id == empresaId).Select(e => e.Nombre).FirstOrDefaultAsync();

    public Task PresupuestoPreventivoAsync(int empresaId, int? actor) => SeguroAsync("presupuesto preventivo", async () =>
    {
        var nombre = await NombreEmpresaAsync(empresaId) ?? "La empresa";
        await EnviarSimpleAsync(await GerentesOAdminAsync(), actor, "Presupuesto por agotarse",
            $"La empresa {nombre} está próxima a agotar su presupuesto disponible.", "/presupuesto-empresas", empresaId, "Empresa");
    });

    public Task PresupuestoAgotadoAsync(int empresaId, int? actor) => SeguroAsync("presupuesto agotado", async () =>
    {
        var nombre = await NombreEmpresaAsync(empresaId) ?? "La empresa";
        await EnviarSimpleAsync(await GerentesOAdminAsync(), actor, "Presupuesto agotado",
            $"La empresa {nombre} ha agotado su presupuesto disponible y no podrá recibir nuevas órdenes de trabajo.", "/presupuesto-empresas", empresaId, "Empresa");
    });

    /// <summary>Importe devuelto al presupuesto por una orden eliminada o una orden de pago cancelada: Gerente y Administrador</summary>
    public Task PresupuestoRestituidoAsync(List<ReversionPresupuesto> reversiones, int? actor) => SeguroAsync("presupuesto restituido", async () =>
    {
        if (reversiones.Count == 0) return;
        var destinatarios = (await GerentesAsync()).Concat(await AdministradoresAsync()).ToList();
        foreach (var r in reversiones)
        {
            var mensaje = r.OrdenEliminada
                ? $"La Orden de Trabajo {r.FolioOrden} fue cancelada o eliminada. El importe asociado ({PresupuestoService.Moneda(r.Monto)}) ha sido restituido al presupuesto de la empresa {r.Empresa}."
                : $"La orden de pago {r.FolioPago} de la Orden de Trabajo {r.FolioOrden} fue cancelada o eliminada. El importe asociado ({PresupuestoService.Moneda(r.Monto)}) ha sido restituido al presupuesto de la empresa {r.Empresa}.";
            await EnviarSimpleAsync(destinatarios, actor, "Presupuesto restituido", mensaje, "/presupuesto-empresas", r.EmpresaId, "Empresa");
        }
    });
}

/// <summary>
/// Fotografía de las filas de espera (en orden): las que no caben por su lugar y las primeras que sí caben
/// </summary>
public record FilasBloqueadas(
    List<int> FilaIngreso, HashSet<int> BloqueadasIngreso, HashSet<int> PuedenIngresar, int OcupadosDanados, int CapacidadDanados,
    List<int> FilaRetorno, HashSet<int> BloqueadasRetorno, HashSet<int> PuedenRetornar, int OcupadosReparados, int CapacidadReparados);
