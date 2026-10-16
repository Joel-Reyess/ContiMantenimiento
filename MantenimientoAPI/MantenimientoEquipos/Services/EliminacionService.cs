using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

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

    // ===== Resto de registros creados por usuarios ("Estandarización de procesos de eliminación") =====
    // Devuelven el mensaje para el usuario, o null si el registro no existe.

    private static string Moneda(decimal monto) => monto.ToString("C2", System.Globalization.CultureInfo.GetCultureInfo("es-MX"));

    /// <summary>
    /// Elimina un pago. Si ya está en una orden de compra no se permite (el total de la OC quedaría mal):
    /// primero hay que eliminar la orden de compra, que libera sus pagos.
    /// </summary>
    public async Task<string?> EliminarPagoAsync(int id, int? usuarioId, string? nombreUsuario)
    {
        var pago = await _db.RegistrosPago
            .Where(p => p.Id == id)
            .Select(p => new { p.Id, p.MontoTotal, p.Estado, p.OrdenCompraId, Tecnico = p.Tecnico.NombreCompleto, Orden = p.OrdenTrabajo.Folio })
            .FirstOrDefaultAsync();
        if (pago == null) return null;

        if (pago.OrdenCompraId.HasValue)
        {
            var folioOc = await _db.OrdenesCompra.Where(o => o.Id == pago.OrdenCompraId).Select(o => o.Folio).FirstOrDefaultAsync();
            throw new InvalidOperationException(
                $"El pago está en la orden de compra {folioOc ?? $"#{pago.OrdenCompraId}"}. Elimina primero esa orden de compra (sus pagos vuelven a quedar aprobados).");
        }

        await _db.RegistrosPago.Where(p => p.Id == id).ExecuteDeleteAsync();
        Registrar(usuarioId, nombreUsuario, "RegistroPago", id,
            $"Pago de {pago.Tecnico} por {Moneda(pago.MontoTotal)} de la orden {pago.Orden} (estaba {pago.Estado})");
        await _db.SaveChangesAsync();
        return $"Pago de {pago.Tecnico} por {Moneda(pago.MontoTotal)} eliminado";
    }

    /// <summary>Elimina una orden de compra; sus pagos quedan sin OC y vuelven de "Pagado" a "Aprobado".</summary>
    public async Task<string?> EliminarOrdenCompraAsync(int id, int? usuarioId, string? nombreUsuario)
    {
        var oc = await _db.OrdenesCompra
            .Where(o => o.Id == id)
            .Select(o => new { o.Id, o.Folio, o.Total, Proveedor = o.Proveedor.NombreCompleto })
            .FirstOrDefaultAsync();
        if (oc == null) return null;

        using var tx = await _db.Database.BeginTransactionAsync();
        var liberados = await _db.RegistrosPago
            .Where(p => p.OrdenCompraId == id)
            .ExecuteUpdateAsync(s => s
                .SetProperty(p => p.OrdenCompraId, (int?)null)
                .SetProperty(p => p.Estado, p => p.Estado == EstadoPagoEnum.Pagado ? EstadoPagoEnum.Aprobado : p.Estado)
                .SetProperty(p => p.FechaPago, p => p.Estado == EstadoPagoEnum.Pagado ? null : p.FechaPago));
        await _db.OrdenesCompra.Where(o => o.Id == id).ExecuteDeleteAsync();
        Registrar(usuarioId, nombreUsuario, "OrdenCompra", id,
            $"Orden de compra {oc.Folio} de {oc.Proveedor} por {Moneda(oc.Total)}; {liberados} pago(s) volvieron a Aprobado");
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return $"Orden de compra {oc.Folio} eliminada" + liberados switch
        {
            0 => "",
            1 => "; su pago volvió a quedar aprobado, sin orden de compra",
            _ => $"; sus {liberados} pagos volvieron a quedar aprobados, sin orden de compra"
        };
    }

    public async Task<string?> EliminarSolicitudRefaccionAsync(int id, int? usuarioId, string? nombreUsuario)
    {
        var s = await _db.SolicitudesRefaccion
            .Where(x => x.Id == id)
            .Select(x => new { x.NombreRefaccion, x.Cantidad, x.Estado, Orden = x.OrdenTrabajo.Folio })
            .FirstOrDefaultAsync();
        if (s == null) return null;

        await _db.SolicitudesRefaccion.Where(x => x.Id == id).ExecuteDeleteAsync();
        Registrar(usuarioId, nombreUsuario, "SolicitudRefaccion", id,
            $"Solicitud de refacción {s.NombreRefaccion} x{s.Cantidad} de la orden {s.Orden} (estaba {s.Estado})");
        await _db.SaveChangesAsync();
        return $"Solicitud de {s.NombreRefaccion} eliminada";
    }

    public async Task<string?> EliminarActividadAdicionalAsync(int id, int? usuarioId, string? nombreUsuario)
    {
        var s = await _db.SolicitudesActividadAdicional
            .Where(x => x.Id == id)
            .Select(x => new { x.Descripcion, x.Estado, Orden = x.OrdenTrabajo.Folio })
            .FirstOrDefaultAsync();
        if (s == null) return null;

        await _db.SolicitudesActividadAdicional.Where(x => x.Id == id).ExecuteDeleteAsync();
        Registrar(usuarioId, nombreUsuario, "SolicitudActividadAdicional", id,
            $"Actividad adicional \"{s.Descripcion}\" de la orden {s.Orden} (estaba {s.Estado})");
        await _db.SaveChangesAsync();
        return "Actividad adicional eliminada";
    }

    public async Task<string?> EliminarSolicitudCambioAsync(int id, int? usuarioId, string? nombreUsuario)
    {
        var s = await _db.SolicitudesCambio
            .Where(x => x.Id == id)
            .Select(x => new { x.Descripcion, Vehiculo = x.Vehiculo.Codigo })
            .FirstOrDefaultAsync();
        if (s == null) return null;

        await _db.SolicitudesCambio.Where(x => x.Id == id).ExecuteDeleteAsync();
        Registrar(usuarioId, nombreUsuario, "SolicitudCambio", id,
            $"Solicitud de cambio del vehículo {s.Vehiculo}: {s.Descripcion}");
        await _db.SaveChangesAsync();
        return "Solicitud de cambio eliminada";
    }

    /// <summary>
    /// Elimina un tipo de vehículo (antes solo se marcaba inactivo y seguía en la lista). Si tiene
    /// vehículos no se permite. Se van con él sus prefijos, su asignación de líderes, sus puntos en la
    /// imagen de fallas y su checklist (si el checklist ya se usó en reportes u órdenes solo se retira).
    /// </summary>
    public async Task<string?> EliminarTipoVehiculoAsync(int id, int? usuarioId, string? nombreUsuario)
    {
        var tipo = await _db.TiposVehiculo.Where(t => t.Id == id).Select(t => new { t.Id, t.Nombre }).FirstOrDefaultAsync();
        if (tipo == null) return null;

        var tipoEnum = (TipoVehiculoEnum)id;
        var vehiculos = await _db.Vehiculos.CountAsync(v => v.Tipo == tipoEnum);
        if (vehiculos > 0)
            throw new InvalidOperationException(
                $"No se puede eliminar el tipo {tipo.Nombre}: tiene {vehiculos} vehículo(s). Cámbialos de tipo o elimínalos primero.");

        using var tx = await _db.Database.BeginTransactionAsync();

        var prefijos = await _db.VehiculoPrefijoConfigs.Where(p => p.TipoVehiculoId == id).ExecuteDeleteAsync();
        await _db.LiderTipoVehiculoAsignaciones.Where(l => l.TipoVehiculo == tipoEnum).ExecuteDeleteAsync();

        // Puntos de la imagen de fallas del tipo; los reportes que los usaron conservan la falla sin el punto
        var imageKey = $"tipo_{id}";
        var puntoIds = await _db.VehicleImagePoints.Where(p => p.ImageKey == imageKey).Select(p => p.Id).ToListAsync();
        if (puntoIds.Count > 0)
        {
            await _db.ReportImageFaults
                .Where(f => f.VehicleImagePointId.HasValue && puntoIds.Contains(f.VehicleImagePointId.Value))
                .ExecuteUpdateAsync(s => s.SetProperty(f => f.VehicleImagePointId, (int?)null));
            await _db.VehicleImagePoints.Where(p => puntoIds.Contains(p.Id)).ExecuteDeleteAsync();
        }

        // Checklist del tipo: se borra, salvo que sus ítems ya se hayan usado (entonces se retira)
        var plantillas = await _db.ChecklistTemplates.Where(t => t.TipoVehiculo == tipoEnum).Select(t => t.Id).ToListAsync();
        foreach (var plantillaId in plantillas)
        {
            var itemIds = await _db.ChecklistItems.Where(i => i.ChecklistTemplateId == plantillaId).Select(i => i.Id).ToListAsync();
            var usada = await _db.ReportesFallaChecklistItems.AnyAsync(x => itemIds.Contains(x.ChecklistItemId))
                || await _db.OrdenesTrabajoChecklistItems.AnyAsync(x => itemIds.Contains(x.ChecklistItemId))
                || await _db.ChecklistRespuestas.AnyAsync(x => itemIds.Contains(x.ChecklistItemId));
            await _db.VehiculoChecklistAsignaciones.Where(a => a.ChecklistTemplateId == plantillaId).ExecuteDeleteAsync();
            if (usada)
            {
                await _db.ChecklistTemplates.Where(t => t.Id == plantillaId)
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.Activo, false));
            }
            else
            {
                await _db.ChecklistItems.Where(i => i.ChecklistTemplateId == plantillaId).ExecuteDeleteAsync();
                await _db.ChecklistTemplates.Where(t => t.Id == plantillaId).ExecuteDeleteAsync();
            }
        }

        await _db.TiposVehiculo.Where(t => t.Id == id).ExecuteDeleteAsync();

        var detalle = new List<string>();
        if (prefijos > 0) detalle.Add($"{prefijos} prefijo(s)");
        if (plantillas.Count > 0) detalle.Add("su checklist");
        if (puntoIds.Count > 0) detalle.Add($"{puntoIds.Count} punto(s) de la imagen de fallas");
        var con = detalle.Count > 0 ? $", con {string.Join(", ", detalle)}" : "";

        Registrar(usuarioId, nombreUsuario, "TipoVehiculo", id, $"Tipo de vehículo {tipo.Nombre}{con}");
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return $"Tipo {tipo.Nombre} eliminado{con}";
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
