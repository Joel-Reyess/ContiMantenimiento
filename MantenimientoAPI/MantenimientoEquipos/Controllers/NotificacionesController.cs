using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.Models;
using System.Security.Claims;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificacionesController : ControllerBase
{
    private readonly NotificacionService _notificacionService;

    public NotificacionesController(NotificacionService notificacionService)
    {
        _notificacionService = notificacionService;
    }

    /// <summary>
    /// Obtiene el resumen de notificaciones (no leidas + recientes)
    /// </summary>
    [HttpGet("resumen")]
    public async Task<IActionResult> GetResumen()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var resumen = await _notificacionService.GetResumenAsync(userId);
        return Ok(ApiResponse<NotificacionesResumenDto>.Ok(resumen));
    }

    /// <summary>
    /// Obtiene todas las notificaciones del usuario
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool? soloNoLeidas = null)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var notificaciones = await _notificacionService.GetAllAsync(userId, soloNoLeidas);
        return Ok(ApiResponse<List<NotificacionDto>>.Ok(notificaciones));
    }

    /// <summary>
    /// Marca notificaciones específicas como leidas
    /// </summary>
    [HttpPost("marcar-leidas")]
    public async Task<IActionResult> MarcarLeidas([FromBody] MarcarLeidaRequest request)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        await _notificacionService.MarcarComoLeidasAsync(userId, request.NotificacionIds);
        return Ok(ApiResponse<string>.Ok("Notificaciones marcadas como leidas"));
    }

    /// <summary>
    /// Marca todas las notificaciones como leidas
    /// </summary>
    [HttpPost("marcar-todas-leidas")]
    public async Task<IActionResult> MarcarTodasLeidas()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        await _notificacionService.MarcarTodasComoLeidasAsync(userId);
        return Ok(ApiResponse<string>.Ok("Todas las notificaciones marcadas como leidas"));
    }

    /// <summary>
    /// Elimina una notificacion del usuario
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> Eliminar(int id)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        await _notificacionService.EliminarAsync(userId, id);
        return Ok(ApiResponse<string>.Ok("Notificacion eliminada"));
    }
}
