using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using System.Security.Claims;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SuperUsuario,Administrador,Supervisor")]
public class AprobacionesController : ControllerBase
{
    private readonly MantenimientoDbContext _db;

    public AprobacionesController(MantenimientoDbContext db)
    {
        _db = db;
    }

    private int? GetUserId() => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    [HttpGet("pendientes")]
    public async Task<IActionResult> GetPendientes()
    {
        // Usamos SolicitudesRefaccion como bandeja (daños extra y refacciones)
        var items = await _db.SolicitudesRefaccion
            .Include(s => s.OrdenTrabajo)
            .Where(s => s.Estado == "Pendiente" || s.Estado == "EnRevision")
            .OrderBy(s => s.FechaSolicitud)
            .Select(s => new
            {
                s.Id,
                s.NombreRefaccion,
                s.Justificacion,
                s.Cantidad,
                s.Estado,
                s.FechaSolicitud,
                OrdenTrabajoId = s.OrdenTrabajoId,
                OrdenFolio = s.OrdenTrabajo != null ? s.OrdenTrabajo.Folio : null
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(items));
    }

    [HttpPost("{id}/aprobar")]
    public async Task<IActionResult> Aprobar(int id)
    {
        var userId = GetUserId() ?? 0;
        var sol = await _db.SolicitudesRefaccion.FirstOrDefaultAsync(s => s.Id == id);
        if (sol == null) return NotFound(ApiResponse<string>.Error("Solicitud no encontrada"));

        sol.Estado = "Aprobada";
        sol.AprobadoPorId = userId;
        sol.FechaAprobacion = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Ok(true));
    }

    [HttpPost("{id}/entregar")]
    public async Task<IActionResult> Entregar(int id, [FromBody] CostoRealRequest? req = null)
    {
        var userId = GetUserId() ?? 0;
        var sol = await _db.SolicitudesRefaccion.FirstOrDefaultAsync(s => s.Id == id);
        if (sol == null) return NotFound(ApiResponse<string>.Error("Solicitud no encontrada"));

        sol.Estado = "Entregada";
        sol.AprobadoPorId = sol.AprobadoPorId ?? userId;
        sol.FechaAprobacion = sol.FechaAprobacion ?? DateTime.UtcNow;
        sol.FechaEntrega = DateTime.UtcNow;
        if (req?.CostoReal.HasValue == true)
            sol.CostoReal = req.CostoReal;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Ok(true));
    }

    [HttpPost("{id}/rechazar")]
    public async Task<IActionResult> Rechazar(int id, [FromBody] MotivoRequest req)
    {
        var userId = GetUserId() ?? 0;
        var sol = await _db.SolicitudesRefaccion.FirstOrDefaultAsync(s => s.Id == id);
        if (sol == null) return NotFound(ApiResponse<string>.Error("Solicitud no encontrada"));

        sol.Estado = "Rechazada";
        sol.AprobadoPorId = userId;
        sol.FechaAprobacion = DateTime.UtcNow;
        sol.Justificacion = $"{sol.Justificacion}\n[Rechazo] {req.Motivo}";
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Ok(true));
    }

    [HttpPost("{id}/cambios")]
    public async Task<IActionResult> SolicitarCambios(int id, [FromBody] MotivoRequest req)
    {
        var userId = GetUserId() ?? 0;
        var sol = await _db.SolicitudesRefaccion.FirstOrDefaultAsync(s => s.Id == id);
        if (sol == null) return NotFound(ApiResponse<string>.Error("Solicitud no encontrada"));

        sol.Estado = "EnRevision";
        sol.AprobadoPorId = userId;
        sol.FechaAprobacion = DateTime.UtcNow;
        sol.Justificacion = $"{sol.Justificacion}\n[Cambios solicitados] {req.Motivo}";
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Ok(true));
    }
}

public class MotivoRequest
{
    public string Motivo { get; set; } = string.Empty;
}

public class CostoRealRequest
{
    public decimal? CostoReal { get; set; }
}
