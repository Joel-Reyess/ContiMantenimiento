using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
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

    private readonly EliminacionService _eliminacion;
    private readonly FlujoAvisos _avisos;

    public ReportesController(ReporteFallaService reporteService, NotificacionService notificacionService, IWebHostEnvironment env, LiderTipoVehiculoAsignacionService asignacionService, EliminacionService eliminacion, FlujoAvisos avisos)
    {
        _avisos = avisos;
        _eliminacion = eliminacion;
        _reporteService = reporteService;
        _notificacionService = notificacionService;
        _env = env;
        _asignacionService = asignacionService;
    }

    /// <summary>
    /// En la lista el Operador ve solo los reportes que él levantó; el detalle sí lo abre
    /// (lo necesita al consultar una orden de trabajo en solo lectura)
    /// </summary>
    private int? SoloPropiosId() => User.EsSoloOperador() ? User.UsuarioId() : null;

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] bool? sinOrden = null,
        [FromQuery] int? vehiculoId = null,
        [FromQuery] DateTime? desde = null,
        [FromQuery] DateTime? hasta = null,
        [FromQuery] string? busqueda = null,
        [FromQuery] PrioridadEnum? prioridad = null,
        [FromQuery] int? categoriaId = null)
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

        var reportes = await _reporteService.GetAllAsync(sinOrden, vehiculoId, desde, hasta, tiposPermitidos, busqueda, prioridad, categoriaId, SoloPropiosId());
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

            // Aviso al Líder del tipo de vehículo para que haga la inspección (flujo de 7 etapas)
            await _avisos.NuevoReporteAsync(reporte.Id, userId);

            return CreatedAtAction(nameof(GetById), new { id = reporte.Id },
                ApiResponse<object>.Ok(new { reporte.Id, reporte.Folio }, "Reporte creado exitosamente"));
        }
        catch (DuplicateActiveOrderException ex)
        {
            return Conflict(ApiResponse<string>.Error(ex.Message, "DuplicateActiveOrder", new { ex.ExistingOrderFolio, ex.ExistingOrderId }));
        }
        catch (DuplicateActiveReportException ex)
        {
            return Conflict(ApiResponse<string>.Error(ex.Message, "DuplicateActiveReport",
                new { ex.ExistingReportFolio, ex.ExistingReportId, ex.ExistingReportFecha }));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
        catch (DbUpdateException)
        {
            // Dos reportes guardados en el mismo instante con el mismo folio: se explica en vez de un error 500
            return Conflict(ApiResponse<string>.Error("No se pudo guardar el reporte porque otro se registró al mismo tiempo. Inténtalo de nuevo."));
        }
    }

    /// <summary>
    /// Elimina un reporte (y su orden de trabajo, si tiene). Solo administradores; queda en la bitácora
    /// quién, cuándo y qué folio (requerimiento 9.3).
    /// </summary>
    [HttpDelete("{id:int}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public Task<IActionResult> Delete(int id) => EliminarAsync(new[] { id });

    /// <summary>Elimina varios reportes a la vez</summary>
    [HttpPost("eliminar")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public Task<IActionResult> DeleteMany([FromBody] EliminarIdsRequest request) => EliminarAsync(request.Ids);

    private async Task<IActionResult> EliminarAsync(IReadOnlyCollection<int> ids)
    {
        var r = await _eliminacion.EliminarReportesConRegistroAsync(ids, User.UsuarioId(), User.NombreUsuario());
        if (r.Reportes == 0)
            return NotFound(ApiResponse<string>.Error("No se encontraron los reportes seleccionados"));

        var mensaje = r.Reportes == 1 ? $"Reporte {r.Folios[0]} eliminado" : $"{r.Reportes} reportes eliminados";
        if (r.Ordenes > 0) mensaje += $", junto con {r.Ordenes} orden(es) de trabajo";
        return Ok(ApiResponse<EliminacionResultadoDto>.Ok(r, mensaje));
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

            // Aviso al Líder del tipo de vehículo para que haga la inspección (flujo de 7 etapas)
            await _avisos.NuevoReporteAsync(reporte.Id, userId);

            return CreatedAtAction(nameof(GetById), new { id = reporte.Id },
                ApiResponse<object>.Ok(new { reporte.Id, reporte.Folio }, "Reporte creado exitosamente con checklist automatico"));
        }
        catch (DuplicateActiveOrderException ex)
        {
            return Conflict(ApiResponse<string>.Error(ex.Message, "DuplicateActiveOrder", new { ex.ExistingOrderFolio, ex.ExistingOrderId }));
        }
        catch (DuplicateActiveReportException ex)
        {
            return Conflict(ApiResponse<string>.Error(ex.Message, "DuplicateActiveReport",
                new { ex.ExistingReportFolio, ex.ExistingReportId, ex.ExistingReportFecha }));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
        catch (DbUpdateException)
        {
            return Conflict(ApiResponse<string>.Error("No se pudo guardar el reporte porque otro se registró al mismo tiempo. Inténtalo de nuevo."));
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
        var reportes = await _reporteService.GetAllAsync(sinOrden: true, reportadoPorId: SoloPropiosId());
        return Ok(ApiResponse<List<ReporteFallaListDto>>.Ok(reportes));
    }
}
