using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Utils;
using Microsoft.AspNetCore.Authorization;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Services;
using System.Security.Claims;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SolicitudActividadAdicionalController : ControllerBase
{
    private readonly SolicitudActividadAdicionalService _service;
    private readonly EliminacionService _eliminacion;

    public SolicitudActividadAdicionalController(SolicitudActividadAdicionalService service, EliminacionService eliminacion)
    {
        _service = service;
        _eliminacion = eliminacion;
    }

    /// <summary>Elimina una solicitud de actividad adicional. Solo administradores; queda en la bitácora.</summary>
    [HttpDelete("{id:int}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> Delete(int id)
    {
        var mensaje = await _eliminacion.EliminarActividadAdicionalAsync(id, User.UsuarioId(), User.NombreUsuario());
        if (mensaje == null) return NotFound(ApiResponse<string>.Error("Solicitud no encontrada"));
        return Ok(ApiResponse<string>.Ok(mensaje, mensaje));
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? estado = null, [FromQuery] int? ordenTrabajoId = null)
    {
        var solicitudes = await _service.GetAllAsync(estado, ordenTrabajoId);
        return Ok(ApiResponse<List<SolicitudActividadAdicionalDto>>.Ok(solicitudes));
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var solicitud = await _service.GetByIdAsync(id);
        if (solicitud == null)
            return NotFound(ApiResponse<string>.Error("Solicitud no encontrada"));

        return Ok(ApiResponse<SolicitudActividadAdicionalDto>.Ok(solicitud));
    }

    [HttpPost]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico")]
    public async Task<IActionResult> Create([FromBody] CreateSolicitudActividadAdicionalDto request)
    {
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var solicitud = await _service.CreateAsync(request, userId);

            return CreatedAtAction(nameof(GetById), new { id = solicitud.Id },
                ApiResponse<object>.Ok(new { solicitud.Id }, "Solicitud creada exitosamente"));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    [HttpPost("{id}/responder")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")] // Antes cualquiera con sesión (incluso el técnico) podía aprobar
    public async Task<IActionResult> Responder(int id, [FromBody] ResponderSolicitudActividadDto request)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _service.ResponderAsync(id, userId, request.Aprobado, request.Comentarios);

        if (!result)
            return BadRequest(ApiResponse<string>.Error("No se pudo procesar la respuesta a la solicitud"));

        return Ok(ApiResponse<string>.Ok("Solicitud procesada exitosamente"));
    }
}
