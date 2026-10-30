using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.Middlewares;
using System.Security.Claims;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdenTrabajoChecklistItemsController : ControllerBase
{
    private readonly OrdenTrabajoChecklistItemService _service;
    private readonly MantenimientoDbContext _db;

    public OrdenTrabajoChecklistItemsController(OrdenTrabajoChecklistItemService service, MantenimientoDbContext db)
    {
        _service = service;
        _db = db;
    }

    /// <summary>
    /// Obtiene todos los ítems del checklist asignados a una orden de trabajo específica
    /// </summary>
    [HttpGet("orden-trabajo/{ordenTrabajoId}")]
    public async Task<IActionResult> GetAllByOrdenTrabajoId(int ordenTrabajoId)
    {
        var items = await _service.GetAllByOrdenTrabajoIdAsync(ordenTrabajoId);
        return Ok(ApiResponse<List<OrdenTrabajoChecklistItemDto>>.Ok(items));
    }

    /// <summary>
    /// Crea una nueva asignación de ítem del checklist a una orden de trabajo
    /// </summary>
    [HttpPost]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Lider", "Tecnico")]
    public async Task<IActionResult> Create([FromBody] CreateOrdenTrabajoChecklistItemRequest request)
    {
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var item = await _service.CreateAsync(request);
            if (item == null)
                return NotFound(ApiResponse<string>.Error("Orden de trabajo o ítem del checklist no encontrado"));

            return CreatedAtAction(nameof(GetAllByOrdenTrabajoId), new { ordenTrabajoId = item.OrdenTrabajoId }, 
                ApiResponse<OrdenTrabajoChecklistItemDto>.Ok(item));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    /// <summary>
    /// Actualiza el estado o notas de un ítem del checklist en una orden de trabajo
    /// </summary>
    [HttpPut("{id}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Lider", "Tecnico")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateOrdenTrabajoChecklistItemRequest request)
    {
        var success = await _service.UpdateAsync(id, request);
        if (!success)
            return NotFound(ApiResponse<string>.Error("Asignación de ítem del checklist no encontrada"));

        return Ok(ApiResponse<string>.Ok("Asignación actualizada correctamente"));
    }

    /// <summary>
    /// Elimina una asignación de ítem del checklist a una orden de trabajo
    /// </summary>
    [HttpDelete("{id}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Lider")]
    public async Task<IActionResult> Delete(int id)
    {
        var success = await _service.DeleteAsync(id);
        if (!success)
            return NotFound(ApiResponse<string>.Error("Asignación de ítem del checklist no encontrada"));

        return Ok(ApiResponse<string>.Ok("Asignación eliminada correctamente"));
    }

    /// <summary>
    /// Asigna múltiples ítems del checklist a una orden de trabajo
    /// </summary>
    [HttpPost("asignar-multiples")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Lider", "Tecnico")]
    public async Task<IActionResult> AsignarMultiplesItems([FromBody] AsignarChecklistItemsRequest request)
    {
        try
        {
            var items = await _service.AsignarMultiplesItemsAsync(request);
            return Ok(ApiResponse<List<OrdenTrabajoChecklistItemDto>>.Ok(items));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    /// <summary>
    /// Obtiene los ítems del checklist más parecidos al nombre del vehículo
    /// </summary>
    [HttpGet("similares-por-vehiculo/{nombreVehiculo}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Lider", "Tecnico")]
    public async Task<IActionResult> GetSimilaresPorVehiculo(string nombreVehiculo)
    {
        var items = await _service.GetChecklistItemsSimilaresPorVehiculoAsync(nombreVehiculo);
        return Ok(ApiResponse<List<ChecklistItemDto>>.Ok(items));
    }

    /// <summary>
    /// Obtiene los ítems del checklist asignados a una orden de trabajo específica
    /// </summary>
    [HttpGet("por-orden/{ordenTrabajoId}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Lider", "Tecnico")]
    public async Task<IActionResult> GetPorOrden(int ordenTrabajoId)
    {
        // Verificar que la orden de trabajo exista y pertenezca al usuario o área correspondiente
        var orden = await _db.OrdenesTrabajo.FindAsync(ordenTrabajoId);
        if (orden == null)
            return NotFound(ApiResponse<string>.Error("Orden de trabajo no encontrada"));

        var items = await _service.GetAllByOrdenTrabajoIdAsync(ordenTrabajoId);
        return Ok(ApiResponse<List<OrdenTrabajoChecklistItemDto>>.Ok(items));
    }
}
