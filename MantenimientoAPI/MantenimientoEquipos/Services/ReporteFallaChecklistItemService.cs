using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.DTOs;

namespace MantenimientoEquipos.Services;

public class ReporteFallaChecklistItemService
{
    private readonly MantenimientoDbContext _db;

    public ReporteFallaChecklistItemService(MantenimientoDbContext db)
    {
        _db = db;
    }

    public async Task<List<ReporteFallaChecklistItemDto>> GetByReporteFallaIdAsync(int reporteFallaId)
    {
        return await _db.ReportesFallaChecklistItems
            .Include(ic => ic.ChecklistItem)
            .Where(ic => ic.ReporteFallaId == reporteFallaId)
            .Select(ic => new ReporteFallaChecklistItemDto
            {
                Id = ic.Id,
                ReporteFallaId = ic.ReporteFallaId,
                ChecklistItemId = ic.ChecklistItemId,
                ChecklistItemPregunta = ic.ChecklistItem.Pregunta,
                Estado = ic.Estado,
                Cantidad = ic.Cantidad,
                Notas = ic.Notas,
                FechaAsignacion = ic.FechaAsignacion
            })
            .ToListAsync();
    }

    public async Task<ReporteFallaChecklistItem> CreateAsync(int reporteFallaId, ReporteFallaChecklistItemCreateRequest request)
    {
        // Verificar que el reporte de falla exista
        var reporteFalla = await _db.ReportesFalla.FindAsync(reporteFallaId);
        if (reporteFalla == null)
            throw new ArgumentException("Reporte de falla no encontrado");

        // Verificar que el ítem del checklist exista
        var checklistItem = await _db.ChecklistItems.FindAsync(request.ChecklistItemId);
        if (checklistItem == null)
            throw new ArgumentException("Ítem del checklist no encontrado");

        var item = new ReporteFallaChecklistItem
        {
            ReporteFallaId = reporteFallaId,
            ChecklistItemId = request.ChecklistItemId,
            Estado = "Pendiente",
            Cantidad = request.Cantidad,
            Notas = request.Notas,
            FechaAsignacion = DateTime.UtcNow
        };

        _db.ReportesFallaChecklistItems.Add(item);
        await _db.SaveChangesAsync();
        return item;
    }

    public async Task<bool> UpdateAsync(int id, ReporteFallaChecklistItemUpdateRequest request)
    {
        var item = await _db.ReportesFallaChecklistItems.FindAsync(id);
        if (item == null)
            return false;

        if (!string.IsNullOrEmpty(request.Estado))
            item.Estado = request.Estado;
        
        if (request.Notas != null)
            item.Notas = request.Notas;

        if (request.Cantidad.HasValue)
            item.Cantidad = request.Cantidad.Value;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var item = await _db.ReportesFallaChecklistItems.FindAsync(id);
        if (item == null)
            return false;

        _db.ReportesFallaChecklistItems.Remove(item);
        await _db.SaveChangesAsync();
        return true;
    }
}
