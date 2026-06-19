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
public class RefaccionesController : ControllerBase
{
    private readonly SolicitudRefaccionService _refaccionService;

    public RefaccionesController(SolicitudRefaccionService refaccionService)
    {
        _refaccionService = refaccionService;
    }

    /// <summary>
    /// Obtiene todas las solicitudes de refacción
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? estado = null, [FromQuery] int? ordenTrabajoId = null)
    {
        var solicitudes = await _refaccionService.GetAllAsync(estado, ordenTrabajoId);
        return Ok(ApiResponse<List<SolicitudRefaccionDto>>.Ok(solicitudes));
    }

    /// <summary>
    /// Obtiene las solicitudes pendientes de aprobación
    /// </summary>
    [HttpGet("pendientes")]
    public async Task<IActionResult> GetPendientes()
    {
        var solicitudes = await _refaccionService.GetAllAsync("Pendiente");
        return Ok(ApiResponse<List<SolicitudRefaccionDto>>.Ok(solicitudes));
    }

    /// <summary>
    /// Obtiene una solicitud por su ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var solicitud = await _refaccionService.GetByIdAsync(id);
        if (solicitud == null)
            return NotFound(ApiResponse<string>.Error("Solicitud no encontrada"));

        return Ok(ApiResponse<SolicitudRefaccionDto>.Ok(solicitud));
    }

    /// <summary>
    /// Crea una nueva solicitud de refacción
    /// </summary>
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SolicitudRefaccionCreateRequest request)
    {
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var solicitud = await _refaccionService.CreateAsync(request, userId);

            return CreatedAtAction(nameof(GetById), new { id = solicitud.Id },
                ApiResponse<object>.Ok(new { solicitud.Id }, "Solicitud creada exitosamente"));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    /// <summary>
    /// Crea múltiples solicitudes de refacción en un solo pedido
    /// </summary>
    [HttpPost("lote")]
    public async Task<IActionResult> CreateBatch([FromBody] SolicitudRefaccionBatchRequest request)
    {
        if (request.Solicitudes == null || request.Solicitudes.Count == 0)
            return BadRequest(ApiResponse<string>.Error("Envía al menos una solicitud"));

        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var ids = await _refaccionService.CreateBatchAsync(request.Solicitudes, userId);
            return Ok(ApiResponse<object>.Ok(new { ids }, "Solicitudes creadas"));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    /// <summary>
    /// Aprueba una solicitud de refacción
    /// </summary>
    [HttpPost("{id}/aprobar")]
    public async Task<IActionResult> Aprobar(int id, [FromBody] AprobarRefaccionRequest? request = null)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _refaccionService.AprobarAsync(id, userId, request?.CostoReal);

        if (!result)
            return BadRequest(ApiResponse<string>.Error("No se pudo aprobar la solicitud"));

        return Ok(ApiResponse<string>.Ok("Solicitud aprobada exitosamente"));
    }

    /// <summary>
    /// Rechaza una solicitud de refacción
    /// </summary>
    [HttpPost("{id}/rechazar")]
    public async Task<IActionResult> Rechazar(int id, [FromBody] RechazarRefaccionRequest request)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _refaccionService.RechazarAsync(id, userId, request.MotivoRechazo);

        if (!result)
            return BadRequest(ApiResponse<string>.Error("No se pudo rechazar la solicitud"));

        return Ok(ApiResponse<string>.Ok("Solicitud rechazada"));
    }

    /// <summary>
    /// Marca una solicitud como entregada
    /// </summary>
    [HttpPost("{id}/entregar")]
    public async Task<IActionResult> MarcarEntregada(int id)
    {
        var result = await _refaccionService.MarcarEntregadaAsync(id);

        if (!result)
            return BadRequest(ApiResponse<string>.Error("No se pudo marcar como entregada"));

        return Ok(ApiResponse<string>.Ok("Refacción marcada como entregada"));
    }

    /// <summary>
    /// Obtiene el conteo de solicitudes pendientes
    /// </summary>
    [HttpGet("conteo-pendientes")]
    public async Task<IActionResult> ConteoPendientes()
    {
        var count = await _refaccionService.ContarPendientesAsync();
        return Ok(ApiResponse<object>.Ok(new { count }));
    }
}
