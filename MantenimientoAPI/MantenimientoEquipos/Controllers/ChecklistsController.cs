using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Utils;
using System.Security.Claims;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChecklistsController : ControllerBase
{
    private readonly ChecklistService _checklistService;

    public ChecklistsController(ChecklistService checklistService)
    {
        _checklistService = checklistService;
    }

    // ===== TEMPLATES =====

    /// <summary>
    /// Obtiene todas las plantillas de checklist
    /// </summary>
    [HttpGet("templates")]
    public async Task<IActionResult> GetAllTemplates(
        [FromQuery] TipoVehiculoEnum? tipoVehiculo = null,
        [FromQuery] string? tipoMantenimiento = null)
    {
        var templates = await _checklistService.GetAllTemplatesAsync(tipoVehiculo, tipoMantenimiento);
        return Ok(ApiResponse<List<ChecklistTemplateDto>>.Ok(templates));
    }

    /// <summary>
    /// Obtiene una plantilla por su ID
    /// </summary>
    [HttpGet("templates/{id}")]
    public async Task<IActionResult> GetTemplateById(int id)
    {
        var template = await _checklistService.GetTemplateByIdAsync(id);
        if (template == null)
            return NotFound(ApiResponse<string>.Error("Plantilla no encontrada"));

        return Ok(ApiResponse<ChecklistTemplateDto>.Ok(template));
    }

    /// <summary>
    /// Checklist que usan los vehículos del tipo indicado (12.3: se asigna solo por tipo).
    /// data = null si el tipo todavía no tiene checklist.
    /// </summary>
    [HttpGet("templates/por-tipo/{tipoId:int}")]
    public async Task<IActionResult> GetPorTipo(int tipoId)
    {
        var template = await _checklistService.GetVigentePorTipoAsync(tipoId);
        return Ok(ApiResponse<ChecklistTemplateDto?>.Ok(template, template == null ? "El tipo de vehículo no tiene checklist configurado" : ""));
    }

    /// <summary>Checklist del tipo del vehículo indicado. data = null si no tiene.</summary>
    [HttpGet("templates/por-vehiculo/{vehiculoId:int}")]
    public async Task<IActionResult> GetPorVehiculo(int vehiculoId)
    {
        var template = await _checklistService.GetVigentePorVehiculoAsync(vehiculoId);
        return Ok(ApiResponse<ChecklistTemplateDto?>.Ok(template, template == null ? "El tipo de este vehículo no tiene checklist configurado" : ""));
    }

    /// <summary>
    /// Crea el checklist de un tipo de vehículo (uno por tipo)
    /// </summary>
    [HttpPost("templates")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> CreateTemplate([FromBody] ChecklistTemplateCreateRequest request)
    {
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var template = await _checklistService.CreateTemplateAsync(request, userId);

            return CreatedAtAction(nameof(GetTemplateById), new { id = template.Id },
                ApiResponse<object>.Ok(new { template.Id, template.Nombre }, $"Checklist de {template.Nombre} creado"));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<string>.Error(ex.Message, "DuplicateChecklist"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    /// <summary>
    /// Elimina el checklist. Si ya se usó en reportes u órdenes se retira pero se conserva para el historial.
    /// </summary>
    [HttpDelete("templates/{id:int}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> DeleteTemplate(int id)
    {
        var r = await _checklistService.EliminarTemplateAsync(id, User.UsuarioId(), User.NombreUsuario());
        if (r == null)
            return NotFound(ApiResponse<string>.Error("Checklist no encontrado"));

        var mensaje = r.ConservadoEnHistorial
            ? $"Checklist de {r.Nombre} eliminado. Como ya se usó en reportes u órdenes, esos registros conservan sus ítems."
            : $"Checklist de {r.Nombre} eliminado";
        return Ok(ApiResponse<ChecklistEliminadoDto>.Ok(r, mensaje));
    }

    /// <summary>
    /// Actualiza una plantilla de checklist
    /// </summary>
    [HttpPut("templates/{id}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> UpdateTemplate(int id, [FromBody] ChecklistTemplateUpdateRequest request)
    {
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var template = await _checklistService.UpdateTemplateAsync(id, request, userId);

            if (template == null)
                return NotFound(ApiResponse<string>.Error("Checklist no encontrado"));

            return Ok(ApiResponse<object>.Ok(new { template.Id, template.Nombre }, $"Checklist de {template.Nombre} actualizado"));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<string>.Error(ex.Message, "DuplicateChecklist"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    // ===== RESPUESTAS =====

    /// <summary>
    /// Obtiene las respuestas de checklist para una orden de trabajo
    /// </summary>
    [HttpGet("respuestas/{ordenTrabajoId}")]
    public async Task<IActionResult> GetRespuestasByOrden(int ordenTrabajoId)
    {
        var respuestas = await _checklistService.GetRespuestasByOrdenAsync(ordenTrabajoId);
        return Ok(ApiResponse<List<ChecklistRespuestaDto>>.Ok(respuestas));
    }

    /// <summary>
    /// Guarda las respuestas de un checklist
    /// </summary>
    [HttpPost("respuestas")]
    public async Task<IActionResult> GuardarRespuestas([FromBody] GuardarRespuestasChecklistRequest request)
    {
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            await _checklistService.GuardarRespuestasAsync(request, userId);

            return Ok(ApiResponse<string>.Ok("Checklist guardado exitosamente"));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    /// <summary>
    /// Crea una inspección rápida de vehículo (crea orden y guarda respuestas)
    /// </summary>
    [HttpPost("inspeccion-rapida")]
    public async Task<IActionResult> InspeccionRapida([FromBody] InspeccionRapidaRequest request)
    {
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var ordenId = await _checklistService.CrearInspeccionRapidaAsync(
                request.VehiculoId,
                request.ChecklistTemplateId,
                request.Respuestas,
                userId);

            return Ok(ApiResponse<object>.Ok(new { ordenId }, "Inspección registrada exitosamente"));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    // ===== ASIGNACIONES POR VEHICULO =====

    [HttpGet("asignaciones")]
    public async Task<IActionResult> GetAsignaciones([FromQuery] int? vehiculoId = null)
    {
        var asignaciones = await _checklistService.GetAsignacionesAsync(vehiculoId);
        return Ok(ApiResponse<List<ChecklistAsignacionDto>>.Ok(asignaciones));
    }

    [HttpPost("asignaciones")]
    public async Task<IActionResult> AsignarChecklistVehiculo([FromBody] AsignarChecklistVehiculoRequest request)
    {
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var asignacion = await _checklistService.AsignarChecklistVehiculoAsync(request.VehiculoId, request.ChecklistTemplateId, userId);
            return Ok(ApiResponse<object>.Ok(asignacion, "Asignacion guardada"));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }
}

public class InspeccionRapidaRequest
{
    public int VehiculoId { get; set; }
    public int ChecklistTemplateId { get; set; }
    public List<RespuestaItemRequest> Respuestas { get; set; } = new();
}
