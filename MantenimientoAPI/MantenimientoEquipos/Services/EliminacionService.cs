using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;

namespace MantenimientoEquipos.Services;

/// <summary>
/// Eliminación definitiva de reportes de falla y órdenes de trabajo con todo lo que depende de ellos
/// (evidencias, checklist, componentes, refacciones, actividades, pagos, historial). Varias llaves foráneas
/// de la BD son NO ACTION, por eso se borra en orden a mano. Lo usan Reportes, Órdenes y Flota.
/// Los movimientos de inventario se conservan: solo se desvinculan de la orden/reporte.
/// </summary>
public class EliminacionService
{
    private readonly MantenimientoDbContext _db;

    public EliminacionService(MantenimientoDbContext db)
    {
        _db = db;
    }

    /// <summary>Borra las órdenes; sus reportes (si no se borran también) vuelven a quedar "sin orden".</summary>
    public async Task<int> EliminarOrdenesAsync(IReadOnlyCollection<int> ordenIds)
    {
        var ids = ordenIds.Distinct().ToList();
        if (ids.Count == 0) return 0;

        var reportesAfectados = await _db.OrdenesTrabajo
            .Where(o => ids.Contains(o.Id) && o.ReporteFallaId.HasValue)
            .Select(o => o.ReporteFallaId!.Value)
            .ToListAsync();

        await _db.EvidenciasFotograficas
            .Where(e => e.OrdenTrabajoId.HasValue && ids.Contains(e.OrdenTrabajoId.Value))
            .ExecuteDeleteAsync();
        await _db.OrdenesTrabajoChecklistItems.Where(i => ids.Contains(i.OrdenTrabajoId)).ExecuteDeleteAsync();
        await _db.ChecklistRespuestas.Where(r => ids.Contains(r.OrdenTrabajoId)).ExecuteDeleteAsync();
        await _db.SolicitudesRefaccion.Where(s => ids.Contains(s.OrdenTrabajoId)).ExecuteDeleteAsync();
        await _db.SolicitudesActividadAdicional.Where(s => ids.Contains(s.OrdenTrabajoId)).ExecuteDeleteAsync();
        await _db.RegistrosPago.Where(p => ids.Contains(p.OrdenTrabajoId)).ExecuteDeleteAsync();
        await _db.ConsumosConsumibles
            .Where(c => c.OrdenTrabajoId.HasValue && ids.Contains(c.OrdenTrabajoId.Value))
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.OrdenTrabajoId, (int?)null));
        await _db.HistorialMantenimiento
            .Where(h => h.OrdenTrabajoId.HasValue && ids.Contains(h.OrdenTrabajoId.Value))
            .ExecuteDeleteAsync();

        var eliminadas = await _db.OrdenesTrabajo.Where(o => ids.Contains(o.Id)).ExecuteDeleteAsync();

        if (reportesAfectados.Count > 0)
        {
            await _db.ReportesFalla
                .Where(r => reportesAfectados.Contains(r.Id))
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.TieneOrdenTrabajo, false));
        }

        return eliminadas;
    }

    /// <summary>Borra los reportes y, si tienen, sus órdenes de trabajo.</summary>
    public async Task<(int Reportes, int Ordenes)> EliminarReportesAsync(IReadOnlyCollection<int> reporteIds)
    {
        var ids = reporteIds.Distinct().ToList();
        if (ids.Count == 0) return (0, 0);

        var ordenIds = await _db.OrdenesTrabajo
            .Where(o => o.ReporteFallaId.HasValue && ids.Contains(o.ReporteFallaId.Value))
            .Select(o => o.Id)
            .ToListAsync();
        var ordenes = await EliminarOrdenesAsync(ordenIds);

        await _db.EvidenciasFotograficas
            .Where(e => e.ReporteFallaId.HasValue && ids.Contains(e.ReporteFallaId.Value))
            .ExecuteDeleteAsync();
        await _db.ReportesFallaChecklistItems.Where(i => ids.Contains(i.ReporteFallaId)).ExecuteDeleteAsync();
        await _db.ReportImageFaults.Where(f => ids.Contains(f.ReporteFallaId)).ExecuteDeleteAsync();
        await _db.ConsumosConsumibles
            .Where(c => c.ReporteId.HasValue && ids.Contains(c.ReporteId.Value))
            .ExecuteUpdateAsync(s => s.SetProperty(c => c.ReporteId, (int?)null));

        var reportes = await _db.ReportesFalla.Where(r => ids.Contains(r.Id)).ExecuteDeleteAsync();
        return (reportes, ordenes);
    }

    /// <summary>Elimina reportes (y sus órdenes) en una transacción y lo deja en la bitácora con folios.</summary>
    public async Task<EliminacionResultadoDto> EliminarReportesConRegistroAsync(IReadOnlyCollection<int> reporteIds, int? usuarioId, string? nombreUsuario)
    {
        var ids = reporteIds.Distinct().ToList();
        var reportes = await _db.ReportesFalla
            .Where(r => ids.Contains(r.Id))
            .Select(r => new { r.Id, r.Folio, Vehiculo = r.Vehiculo.Codigo })
            .ToListAsync();
        if (reportes.Count == 0) return new EliminacionResultadoDto();

        var idsExistentes = reportes.Select(r => r.Id).ToList();
        var ordenes = await _db.OrdenesTrabajo
            .Where(o => o.ReporteFallaId.HasValue && idsExistentes.Contains(o.ReporteFallaId.Value))
            .Select(o => new { ReporteId = o.ReporteFallaId!.Value, o.Folio })
            .ToListAsync();

        using var tx = await _db.Database.BeginTransactionAsync();
        var (nReportes, nOrdenes) = await EliminarReportesAsync(idsExistentes);
        foreach (var r in reportes)
        {
            var folioOrdenes = ordenes.Where(o => o.ReporteId == r.Id).Select(o => o.Folio).ToList();
            Registrar(usuarioId, nombreUsuario, "ReporteFalla", r.Id,
                $"Reporte {r.Folio} del vehículo {r.Vehiculo}" +
                (folioOrdenes.Count > 0 ? $" (con su orden de trabajo {string.Join(", ", folioOrdenes)})" : ""));
        }
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return new EliminacionResultadoDto { Reportes = nReportes, Ordenes = nOrdenes, Folios = reportes.Select(r => r.Folio).ToList() };
    }

    /// <summary>Elimina una orden de trabajo en una transacción y lo deja en la bitácora.</summary>
    public async Task<EliminacionResultadoDto> EliminarOrdenConRegistroAsync(int ordenId, int? usuarioId, string? nombreUsuario)
    {
        var orden = await _db.OrdenesTrabajo
            .Where(o => o.Id == ordenId)
            .Select(o => new { o.Id, o.Folio, Vehiculo = o.Vehiculo.Codigo, Reporte = o.ReporteFalla != null ? o.ReporteFalla.Folio : null })
            .FirstOrDefaultAsync();
        if (orden == null) return new EliminacionResultadoDto();

        using var tx = await _db.Database.BeginTransactionAsync();
        var n = await EliminarOrdenesAsync(new[] { orden.Id });
        Registrar(usuarioId, nombreUsuario, "OrdenTrabajo", orden.Id,
            $"Orden {orden.Folio} del vehículo {orden.Vehiculo}" + (orden.Reporte != null ? $" (el reporte {orden.Reporte} quedó sin orden)" : ""));
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return new EliminacionResultadoDto { Ordenes = n, Folios = new List<string> { orden.Folio } };
    }

    /// <summary>
    /// Deja constancia de quién eliminó qué y cuándo (requerimiento 9.3). Se guarda también el nombre,
    /// por si después se elimina el usuario.
    /// </summary>
    public void Registrar(int? usuarioId, string? nombreUsuario, string entidad, int? entidadId, string descripcion, string accion = "Eliminar")
    {
        _db.LogAcciones.Add(new LogAccion
        {
            UsuarioId = usuarioId,
            NombreUsuario = nombreUsuario,
            Accion = accion,
            Entidad = entidad,
            EntidadId = entidadId,
            Descripcion = descripcion.Length > 1000 ? descripcion[..1000] : descripcion,
            Fecha = DateTime.UtcNow
        });
    }
}
