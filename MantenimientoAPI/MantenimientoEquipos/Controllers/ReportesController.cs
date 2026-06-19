using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Utils;
using System.Security.Claims;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ReportesController : ControllerBase
{
    private readonly ReporteFallaService _reporteService;
    private readonly NotificacionService _notificacionService;
    private readonly IWebHostEnvironment _env;
    private readonly LiderTipoVehiculoAsignacionService _asignacionService;

    public ReportesController(ReporteFallaService reporteService, NotificacionService notificacionService, IWebHostEnvironment env, LiderTipoVehiculoAsignacionService asignacionService)
    {
        _reporteService = reporteService;
        _notificacionService = notificacionService;
        _env = env;
        _asignacionService = asignacionService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] bool? sinOrden = null,
        [FromQuery] int? vehiculoId = null,
        [FromQuery] DateTime? desde = null,
        [FromQuery] DateTime? hasta = null)
    {
        List<TipoVehiculoEnum>? tiposPermitidos = null;
        
        if (User.IsInRole("Lider") || User.IsInRole("Supervisor"))
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var asignaciones = await _asignacionService.GetByUsuarioIdAsync(userId);
            if (asignaciones.Any())
            {
                tiposPermitidos = asignaciones.Select(a => a.TipoVehiculo).ToList();
            }
        }

        var reportes = await _reporteService.GetAllAsync(sinOrden, vehiculoId, desde, hasta, tiposPermitidos);
        return Ok(ApiResponse<List<ReporteFallaListDto>>.Ok(reportes));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var reporte = await _reporteService.GetByIdAsync(id);
        if (reporte == null)
            return NotFound(ApiResponse<string>.Error("Reporte no encontrado"));

        return Ok(ApiResponse<ReporteFallaDto>.Ok(reporte));
    }

    [HttpPost]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico", "Operador", "Lider")]
    public async Task<IActionResult> Create([FromBody] ReporteFallaCreateRequest request, [FromQuery] bool force = false)
    {
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var reporte = await _reporteService.CreateAsync(request, userId, force);

            await _notificacionService.CrearNotificacionRolesAsync(
                Models.Enums.TipoNotificacionEnum.NuevoReporte,
                "Nuevo reporte de falla",
                $"Folio {reporte.Folio} para vehiculo {reporte.Vehiculo?.Codigo ?? request.CodigoVehiculo}",
                new[] { "superusuario", "administrador", "supervisor" },
                reporte.Id,
                "ReporteFalla",
                $"/reportes/{reporte.Folio}");

            return CreatedAtAction(nameof(GetById), new { id = reporte.Id },
                ApiResponse<object>.Ok(new { reporte.Id, reporte.Folio }, "Reporte creado exitosamente"));
        }
        catch (DuplicateActiveOrderException ex)
        {
            return Conflict(ApiResponse<string>.Error(ex.Message, "DuplicateActiveOrder", new { ex.ExistingOrderFolio, ex.ExistingOrderId }));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    [HttpGet("{id}/evidencias")]
    public async Task<IActionResult> GetEvidencias(int id)
    {
        var reporte = await _reporteService.GetByIdAsync(id);
        if (reporte == null)
            return NotFound(ApiResponse<string>.Error("Reporte no encontrado"));

        return Ok(ApiResponse<List<EvidenciaDto>>.Ok(reporte.Evidencias));
    }

    [HttpPost("crear-con-checklist-automatico")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico", "Operador", "Lider")]
    public async Task<IActionResult> CreateWithAutoChecklist([FromBody] ReporteFallaCreateRequest request, [FromQuery] bool force = false)
    {
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var reporte = await _reporteService.CreateWithAutoChecklistAsync(request, userId, force);

            await _notificacionService.CrearNotificacionRolesAsync(
                Models.Enums.TipoNotificacionEnum.NuevoReporte,
                "Nuevo reporte de falla",
                $"Folio {reporte.Folio} para vehiculo {reporte.Vehiculo?.Codigo ?? request.CodigoVehiculo}",
                new[] { "superusuario", "administrador", "supervisor" },
                reporte.Id,
                "ReporteFalla",
                $"/reportes/{reporte.Folio}");

            return CreatedAtAction(nameof(GetById), new { id = reporte.Id },
                ApiResponse<object>.Ok(new { reporte.Id, reporte.Folio }, "Reporte creado exitosamente con checklist automatico"));
        }
        catch (DuplicateActiveOrderException ex)
        {
            return Conflict(ApiResponse<string>.Error(ex.Message, "DuplicateActiveOrder", new { ex.ExistingOrderFolio, ex.ExistingOrderId }));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    [HttpPost("{id}/evidencias")]
    public async Task<IActionResult> AgregarEvidencia(int id, IFormFile? archivo, [FromForm] string? descripcion, [FromForm] string? tipoEvidencia)
    {
        var reporte = await _reporteService.GetByIdAsync(id);
        if (reporte == null)
            return NotFound(ApiResponse<string>.Error("Reporte no encontrado"));

        if (archivo == null || archivo.Length == 0)
            return BadRequest(ApiResponse<string>.Error("Debe enviar un archivo de evidencia"));

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        var uploadsPath = Path.Combine(webRoot, "uploads", "evidencias");
        Directory.CreateDirectory(uploadsPath);

        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(archivo.FileName)}";
        var filePath = Path.Combine(uploadsPath, fileName);

        using (var stream = System.IO.File.Create(filePath))
        {
            await archivo.CopyToAsync(stream);
        }

        var urlImagen = $"/uploads/evidencias/{fileName}";

        var evidencia = await _reporteService.AgregarEvidenciaAsync(
            id, urlImagen, archivo.FileName, descripcion, tipoEvidencia, userId);

        return Ok(ApiResponse<object>.Ok(new { evidencia.Id, evidencia.UrlImagen },
            "Evidencia agregada correctamente"));
    }

    [HttpGet("estadisticas")]
    public async Task<IActionResult> GetEstadisticas()
    {
        var hoy = await _reporteService.ContarReportesHoyAsync();
        var sinAtender = await _reporteService.ContarReportesSinAtenderAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            ReportesHoy = hoy,
            ReportesSinAtender = sinAtender
        }));
    }

    [HttpGet("sin-atender")]
    public async Task<IActionResult> GetSinAtender()
    {
        var reportes = await _reporteService.GetAllAsync(sinOrden: true, null, null, null);
        return Ok(ApiResponse<List<ReporteFallaListDto>>.Ok(reportes));
    }
}
