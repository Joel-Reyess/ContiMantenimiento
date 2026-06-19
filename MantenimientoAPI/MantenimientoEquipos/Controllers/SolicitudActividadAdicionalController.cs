using Microsoft.AspNetCore.Mvc;
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

    public SolicitudActividadAdicionalController(SolicitudActividadAdicionalService service)
    {
        _service = service;
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
    public async Task<IActionResult> Responder(int id, [FromBody] ResponderSolicitudActividadDto request)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _service.ResponderAsync(id, userId, request.Aprobado, request.Comentarios);

        if (!result)
            return BadRequest(ApiResponse<string>.Error("No se pudo procesar la respuesta a la solicitud"));

        return Ok(ApiResponse<string>.Ok("Solicitud procesada exitosamente"));
    }
}
