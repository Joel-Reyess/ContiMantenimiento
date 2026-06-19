using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Services;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReporteFallaChecklistItemsController : ControllerBase
{
    private readonly ReporteFallaChecklistItemService _service;
    private readonly ILogger<ReporteFallaChecklistItemsController> _logger;

    public ReporteFallaChecklistItemsController(ReporteFallaChecklistItemService service, ILogger<ReporteFallaChecklistItemsController> logger)
    {
        _service = service;
        _logger = logger;
    }

    [HttpGet("reporte/{reporteFallaId}")]
    public async Task<ActionResult<List<ReporteFallaChecklistItemDto>>> GetByReporteFallaId(int reporteFallaId)
    {
        try
        {
            var items = await _service.GetByReporteFallaIdAsync(reporteFallaId);
            return Ok(items);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo ítems del checklist para reporte de falla {ReporteFallaId}", reporteFallaId);
            return StatusCode(500, new { message = "Error obteniendo los ítems del checklist" });
        }
    }

    [HttpPost]
    public async Task<ActionResult<ReporteFallaChecklistItem>> Create(int reporteFallaId, [FromBody] ReporteFallaChecklistItemCreateRequest request)
    {
        try
        {
            var item = await _service.CreateAsync(reporteFallaId, request);
            return CreatedAtAction(nameof(GetByReporteFallaId), new { reporteFallaId = item.ReporteFallaId }, item);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creando ítem del checklist para reporte de falla {ReporteFallaId}", reporteFallaId);
            return StatusCode(500, new { message = "Error creando el ítem del checklist" });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] ReporteFallaChecklistItemUpdateRequest request)
    {
        try
        {
            var result = await _service.UpdateAsync(id, request);
            if (!result)
                return NotFound(new { message = "Ítem del checklist no encontrado" });

            return Ok(new { message = "Ítem del checklist actualizado correctamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error actualizando ítem del checklist {Id}", id);
            return StatusCode(500, new { message = "Error actualizando el ítem del checklist" });
        }
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        try
        {
            var result = await _service.DeleteAsync(id);
            if (!result)
                return NotFound(new { message = "Ítem del checklist no encontrado" });

            return Ok(new { message = "Ítem del checklist eliminado correctamente" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error eliminando ítem del checklist {Id}", id);
            return StatusCode(500, new { message = "Error eliminando el ítem del checklist" });
        }
    }
}
