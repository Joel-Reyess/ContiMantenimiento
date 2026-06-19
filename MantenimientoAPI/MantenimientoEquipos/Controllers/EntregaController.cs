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
[Authorize(Roles = "SuperUsuario,Administrador,Supervisor,Tecnico,Lider")]
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
    public async Task<IActionResult> RegistrarEntrega(int ordenId, [FromBody] EntregaRequest req)
    {
        var orden = await _db.OrdenesTrabajo.Include(o => o.Vehiculo).FirstOrDefaultAsync(o => o.Id == ordenId);
        if (orden == null) return NotFound(ApiResponse<string>.Error("Orden no encontrada"));

        // No permitir entrega si hay refacciones pendientes de entrega
        var refPendientes = await _db.SolicitudesRefaccion
            .AnyAsync(s => s.OrdenTrabajoId == ordenId && s.Estado != "Entregada" && s.Estado != "Rechazada");
        if (refPendientes)
            return BadRequest(ApiResponse<string>.Error("No se puede finalizar: hay refacciones pendientes de entrega o aprobacion."));

        // Guardar respuestas de checklist si vienen
        if (req.RespuestasChecklist != null && req.RespuestasChecklist.Count > 0)
        {
            await _checklistService.GuardarRespuestasAsync(new GuardarRespuestasChecklistRequest
            {
                OrdenTrabajoId = ordenId,
                Respuestas = req.RespuestasChecklist
            }, GetUserId() ?? 0);
        }

        // Combinar firmas con lo ya guardado para no borrarlas
        var firmaLider = string.IsNullOrWhiteSpace(req.FirmaLider) ? orden.FirmaLider : req.FirmaLider;
        var firmaSupervisor = string.IsNullOrWhiteSpace(req.FirmaSupervisor) ? orden.FirmaSupervisor : req.FirmaSupervisor;

        if (string.IsNullOrWhiteSpace(firmaLider) || string.IsNullOrWhiteSpace(firmaSupervisor))
        {
            return BadRequest(ApiResponse<string>.Error("Se requieren las firmas de lider y supervisor/administrador para finalizar."));
        }

        // Calcular costo total: checklist + refacciones entregadas
        var costoChecklist = await _db.ChecklistRespuestas
            .Include(r => r.ChecklistItem)
            .Where(r => r.OrdenTrabajoId == ordenId && !string.IsNullOrWhiteSpace(r.Valor))
            .SumAsync(r => r.ChecklistItem.CostoEstimado * (r.Cantidad == 0 ? 1 : r.Cantidad));

        var costoRefacciones = await _db.SolicitudesRefaccion
            .Where(s => s.OrdenTrabajoId == ordenId && s.Estado == "Entregada")
            .SumAsync(s => s.CostoReal ?? s.CostoEstimado ?? 0);

        orden.CostoTotal = costoChecklist + costoRefacciones;

        orden.Estado = EstadoOrdenTrabajoEnum.Validada; // usamos Validada como entregada
        orden.TrabajoRealizado = req.Observaciones ?? orden.TrabajoRealizado;
        orden.FechaFinalizacion = DateTime.UtcNow;
        orden.FechaValidacion = DateTime.UtcNow;
        orden.ValidadoPorId = GetUserId();

        orden.FirmaLider = firmaLider;
        orden.FirmaLiderNombre = !string.IsNullOrWhiteSpace(req.FirmaLiderNombre) ? req.FirmaLiderNombre : orden.FirmaLiderNombre;
        orden.FirmaLiderFecha = DateTime.UtcNow;

        orden.FirmaSupervisor = firmaSupervisor;
        orden.FirmaSupervisorNombre = !string.IsNullOrWhiteSpace(req.FirmaSupervisorNombre) ? req.FirmaSupervisorNombre : orden.FirmaSupervisorNombre;
        orden.FirmaSupervisorFecha = DateTime.UtcNow;

        // Flujo físico: al confirmar entrega con ambas firmas, regresa a Piso.
        if (orden.Vehiculo != null)
        {
            orden.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Piso;
            orden.Vehiculo.Estado = EstadoVehiculoEnum.Operativo;
            orden.Vehiculo.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Ok(true));
    }

    [HttpPost("{ordenId}/firma-lider")]
    [Authorize(Roles = "Lider")]
    public async Task<IActionResult> RegistrarFirmaLider(int ordenId, [FromBody] FirmaUnicaRequest req)
    {
        var orden = await _db.OrdenesTrabajo.Include(o => o.Vehiculo).FirstOrDefaultAsync(o => o.Id == ordenId);
        if (orden == null) return NotFound(ApiResponse<string>.Error("Orden no encontrada"));

        if (string.IsNullOrWhiteSpace(req.Firma))
            return BadRequest(ApiResponse<string>.Error("La firma de lider es requerida."));

        orden.FirmaLider = req.Firma;
        orden.FirmaLiderNombre = string.IsNullOrWhiteSpace(req.Nombre) ? "Lider" : req.Nombre;
        orden.FirmaLiderFecha = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(req.Observaciones))
        {
            orden.TrabajoRealizado = req.Observaciones;
        }

        // Si ya existe firma de supervisor, se considera entrega final y el vehículo vuelve a Piso.
        if (!string.IsNullOrWhiteSpace(orden.FirmaSupervisor))
        {
            orden.Estado = EstadoOrdenTrabajoEnum.Validada;
            orden.FechaValidacion ??= DateTime.UtcNow;
            orden.FechaFinalizacion ??= DateTime.UtcNow;
            orden.ValidadoPorId ??= GetUserId();
            if (orden.Vehiculo != null)
            {
                orden.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Piso;
                orden.Vehiculo.Estado = EstadoVehiculoEnum.Operativo;
                orden.Vehiculo.UpdatedAt = DateTime.UtcNow;
            }
        }
        else if (orden.Vehiculo != null)
        {
            orden.Vehiculo.Ubicacion = UbicacionVehiculoEnum.TransicionReparado;
            orden.Vehiculo.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        await _notificacionService.NotificarEntregaRecibidaAsync(orden.Folio, orden.Id, orden.Vehiculo?.Codigo);
        return Ok(ApiResponse<bool>.Ok(true));
    }

    [HttpPost("{ordenId}/firma-supervisor")]
    [Authorize(Roles = "SuperUsuario,Administrador,Supervisor")]
    public async Task<IActionResult> RegistrarFirmaSupervisor(int ordenId, [FromBody] FirmaUnicaRequest req)
    {
        var orden = await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .FirstOrDefaultAsync(o => o.Id == ordenId);
        if (orden == null) return NotFound(ApiResponse<string>.Error("Orden no encontrada"));

        if (string.IsNullOrWhiteSpace(req.Firma))
            return BadRequest(ApiResponse<string>.Error("La firma de supervisor/admin es requerida."));

        orden.FirmaSupervisor = req.Firma;
        orden.FirmaSupervisorNombre = string.IsNullOrWhiteSpace(req.Nombre) ? "Supervisor/Admin" : req.Nombre;
        orden.FirmaSupervisorFecha = DateTime.UtcNow;
        if (!string.IsNullOrWhiteSpace(req.Observaciones))
        {
            orden.TrabajoRealizado = req.Observaciones;
        }

        // Si ya existe firma de líder, se considera entrega final y el vehículo vuelve a Piso.
        if (!string.IsNullOrWhiteSpace(orden.FirmaLider))
        {
            orden.Estado = EstadoOrdenTrabajoEnum.Validada;
            orden.FechaValidacion ??= DateTime.UtcNow;
            orden.FechaFinalizacion ??= DateTime.UtcNow;
            orden.ValidadoPorId ??= GetUserId();
            if (orden.Vehiculo != null)
            {
                orden.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Piso;
                orden.Vehiculo.Estado = EstadoVehiculoEnum.Operativo;
                orden.Vehiculo.UpdatedAt = DateTime.UtcNow;
            }
        }
        else if (orden.Vehiculo != null)
        {
            orden.Vehiculo.Ubicacion = UbicacionVehiculoEnum.TransicionReparado;
            orden.Vehiculo.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Ok(true));
    }

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
