using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.DTOs;
using System.Security.Claims;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SuperUsuario,Administrador,Supervisor,Lider")] // El Técnico no valida ni libera reparaciones
public class EntregaController : ControllerBase
{
    private readonly MantenimientoDbContext _db;
    private readonly ChecklistService _checklistService;
    private readonly NotificacionService _notificacionService;

    public EntregaController(MantenimientoDbContext db, ChecklistService checklistService, NotificacionService notificacionService)
    {
        _db = db;
        _checklistService = checklistService;
        _notificacionService = notificacionService;
    }

    private int? GetUserId() => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    [HttpPost("{ordenId}/entrega")]
    public IActionResult RegistrarEntrega(int ordenId) =>
        // Flujo de 7 etapas: una sola validación (Líder o Gerente) con la unidad ya entregada en la zona de reparados
        StatusCode(410, ApiResponse<string>.Error("La entrega ahora se valida en Validación y Aprobaciones (una sola validación del Líder o del Gerente de Mantenimiento)."));

    [HttpPost("{ordenId}/firma-lider")]
    [Authorize(Roles = "Lider")]
    public IActionResult RegistrarFirmaLider(int ordenId) =>
        // Flujo de 7 etapas: una sola validación (Líder o Gerente) con la unidad ya entregada en la zona de reparados
        StatusCode(410, ApiResponse<string>.Error("La entrega ahora se valida en Validación y Aprobaciones (una sola validación del Líder o del Gerente de Mantenimiento)."));

    [HttpPost("{ordenId}/firma-supervisor")]
    [Authorize(Roles = "SuperUsuario,Administrador,Supervisor")]
    public IActionResult RegistrarFirmaSupervisor(int ordenId) =>
        // Flujo de 7 etapas: una sola validación (Líder o Gerente) con la unidad ya entregada en la zona de reparados
        StatusCode(410, ApiResponse<string>.Error("La entrega ahora se valida en Validación y Aprobaciones (una sola validación del Líder o del Gerente de Mantenimiento)."));

    [HttpPost("{ordenId}/firma")]
    public async Task<IActionResult> RegistrarFirma(int ordenId, [FromBody] FirmaRequest req)
    {
        var orden = await _db.OrdenesTrabajo.FirstOrDefaultAsync(o => o.Id == ordenId);
        if (orden == null) return NotFound(ApiResponse<string>.Error("Orden no encontrada"));

        // Guardamos la firma como evidencia (imagen base64 o URL)
        var firma = new EvidenciaFotografica
        {
            OrdenTrabajoId = ordenId,
            UrlImagen = req.FirmaBase64 ?? string.Empty,
            Descripcion = $"Firma de conformidad por {req.FirmadoPor}",
            SubidoPorId = GetUserId(),
            FechaCaptura = DateTime.UtcNow
        };
        _db.EvidenciasFotograficas.Add(firma);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(true));
    }
}

public class EntregaRequest
{
    public string? Observaciones { get; set; }
    public List<RespuestaItemRequest>? RespuestasChecklist { get; set; }
    public string? FirmaLider { get; set; }
    public string? FirmaLiderNombre { get; set; }
    public string? FirmaSupervisor { get; set; }
    public string? FirmaSupervisorNombre { get; set; }
}

public class FirmaUnicaRequest
{
    public string? Firma { get; set; }
    public string? Nombre { get; set; }
    public string? Observaciones { get; set; }
}

public class FirmaRequest
{
    public string? FirmaBase64 { get; set; }
    public string? FirmadoPor { get; set; }
}
