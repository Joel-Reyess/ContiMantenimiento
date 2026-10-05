using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.Services;

namespace MantenimientoEquipos.Controllers;

/// <summary>
/// Exportación e importación masiva en Excel (requerimiento 12.2)
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ExcelController : ControllerBase
{
    // El Supervisor solo exporta lo que ve en sus pantallas; el resto es para administradores
    private static readonly string[] ExportablesSupervisor = { "vehiculos", "inventario" };

    private readonly ExcelExportService _exportService;
    private readonly ExcelImportService _importService;
    private readonly LiderTipoVehiculoAsignacionService _asignacionService;

    public ExcelController(ExcelExportService exportService, ExcelImportService importService, LiderTipoVehiculoAsignacionService asignacionService)
    {
        _exportService = exportService;
        _importService = importService;
        _asignacionService = asignacionService;
    }

    /// <summary>Exporta un módulo: vehiculos, inventario, reportes, ordenes, pagos, etc.</summary>
    [HttpGet("exportar/{entidad}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Exportar(string entidad)
    {
        entidad = entidad.ToLowerInvariant();
        if (!ExcelExportService.Hojas.ContainsKey(entidad))
            return NotFound(ApiResponse<string>.Error($"No existe la exportación '{entidad}'"));

        var esAdmin = User.IsInRole("SuperUsuario") || User.IsInRole("Administrador");
        if (!esAdmin && !ExportablesSupervisor.Contains(entidad))
            return StatusCode(403, ApiResponse<string>.Error("No tiene permisos para exportar esta información."));

        // Igual que el listado de la flota: Líder/Supervisor solo ven los tipos que tienen asignados
        List<TipoVehiculoEnum>? tiposPermitidos = null;
        if (!esAdmin && entidad == "vehiculos")
        {
            var asignaciones = await _asignacionService.GetByUsuarioIdAsync(UserId());
            if (asignaciones.Any()) tiposPermitidos = asignaciones.Select(a => a.TipoVehiculo).ToList();
        }

        var bytes = await _exportService.ExportarAsync(entidad, tiposPermitidos);
        return File(bytes, ExcelExportService.ContentType, NombreArchivo(ExcelExportService.Hojas[entidad]));
    }

    /// <summary>Un solo libro con todos los módulos (una hoja por módulo)</summary>
    [HttpGet("exportar-todo")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> ExportarTodo()
    {
        var bytes = await _exportService.ExportarTodoAsync(User.FindFirst("NombreCompleto")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value);
        return File(bytes, ExcelExportService.ContentType, NombreArchivo("Exportacion completa"));
    }

    [HttpGet("plantilla/{entidad}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> Plantilla(string entidad)
    {
        entidad = entidad.ToLowerInvariant();
        if (!ExcelImportService.Entidades.Contains(entidad))
            return NotFound(ApiResponse<string>.Error($"No existe plantilla para '{entidad}'"));

        var bytes = await _importService.GenerarPlantillaAsync(entidad);
        return File(bytes, ExcelExportService.ContentType, NombreArchivo($"Plantilla {ExcelExportService.Hojas[entidad]}"));
    }

    /// <summary>
    /// Valida el archivo y, con aplicar=true, guarda los cambios si no hubo ningún error.
    /// </summary>
    [HttpPost("importar/{entidad}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    [RequestSizeLimit(15_000_000)]
    public async Task<IActionResult> Importar(string entidad, IFormFile? archivo, [FromQuery] bool aplicar = false)
    {
        entidad = entidad.ToLowerInvariant();
        if (!ExcelImportService.Entidades.Contains(entidad))
            return NotFound(ApiResponse<string>.Error($"No se puede importar '{entidad}'"));
        if (archivo == null || archivo.Length == 0)
            return BadRequest(ApiResponse<string>.Error("Selecciona un archivo de Excel (.xlsx)"));
        if (!Path.GetExtension(archivo.FileName).Equals(".xlsx", StringComparison.OrdinalIgnoreCase))
            return BadRequest(ApiResponse<string>.Error("Solo se aceptan archivos .xlsx (Excel 2007 o posterior)"));

        try
        {
            using var stream = archivo.OpenReadStream();
            var resultado = await _importService.ImportarAsync(entidad, stream, aplicar, UserId());
            var mensaje = resultado.Aplicado
                ? $"Importación aplicada: {resultado.Nuevos} nuevo(s), {resultado.Actualizados} actualizado(s)"
                : resultado.TotalErrores > 0
                    ? $"Se encontraron {resultado.TotalErrores} error(es); no se guardó nada"
                    : "Archivo válido";
            return Ok(ApiResponse<ExcelImportResultDto>.Ok(resultado, mensaje));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    private int UserId() => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    private static string NombreArchivo(string nombre) =>
        $"ContiMantenimiento - {nombre} - {DateTime.Now:yyyy-MM-dd}.xlsx";
}
