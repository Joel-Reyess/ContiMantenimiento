using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.Utils;

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
    private static readonly string[] ExportablesSupervisor = { "vehiculos", "inventario", "reportes", "ordenes", "pagos" };
    private static readonly string[] ExtensionesImportables = { ".xlsx", ".csv", ".zip" };

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
    public async Task<IActionResult> Exportar(string entidad, [FromQuery] string? formato = null)
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
        return Archivo(bytes, ExcelExportService.Hojas[entidad], formato, ExcelExportService.Hojas[entidad]);
    }

    /// <summary>
    /// La flota con los filtros de la pantalla ("lo que estoy viendo"): búsqueda, tipo, área, prefijo y pestaña
    /// (excluirTipo = Tugger en la pestaña Contenedores). Mismos filtros que el listado (VehiculoFiltros).
    /// </summary>
    [HttpGet("exportar-flota")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> ExportarFlotaFiltrada(
        [FromQuery] string? busqueda = null,
        [FromQuery] int? tipo = null,
        [FromQuery] int? areaId = null,
        [FromQuery] int? excluirTipo = null,
        [FromQuery] string? prefijo = null,
        [FromQuery] string? formato = null)
    {
        var esAdmin = User.IsInRole("SuperUsuario") || User.IsInRole("Administrador");
        List<TipoVehiculoEnum>? tiposPermitidos = null;
        if (!esAdmin)
        {
            var asignaciones = await _asignacionService.GetByUsuarioIdAsync(UserId());
            if (asignaciones.Any()) tiposPermitidos = asignaciones.Select(a => a.TipoVehiculo).ToList();
        }

        var filtro = new FiltroVehiculos
        {
            Busqueda = busqueda,
            // Tipos nuevos (Id > 15) también: por eso llegan como int (PRE-03)
            Tipo = (TipoVehiculoEnum?)tipo,
            AreaId = areaId,
            ExcluirTipo = (TipoVehiculoEnum?)excluirTipo,
            Prefijo = prefijo,
            TiposPermitidos = tiposPermitidos
        };
        var (archivo, _) = await _exportService.ExportarFlotaFiltradaAsync(filtro,
            User.FindFirst("NombreCompleto")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value);
        return Archivo(archivo, "Flota filtrada", formato, ExcelExportService.Hojas["vehiculos"]);
    }

    /// <summary>Un solo libro con todos los módulos (una hoja por módulo)</summary>
    [HttpGet("exportar-todo")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> ExportarTodo([FromQuery] string? formato = null)
    {
        var bytes = await _exportService.ExportarTodoAsync(User.FindFirst("NombreCompleto")?.Value ?? User.FindFirst(ClaimTypes.Name)?.Value);
        // En CSV: un .zip con un .csv por hoja ("Vehículos.csv", "Usuarios.csv"...)
        if (EsCsv(formato))
            return File(CsvLibro.XlsxAZip(bytes), CsvLibro.ContentTypeZip, NombreArchivo("Exportacion completa", ".zip"));
        return File(bytes, ExcelExportService.ContentType, NombreArchivo("Exportacion completa"));
    }

    [HttpGet("plantilla/{entidad}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> Plantilla(string entidad, [FromQuery] string? formato = null)
    {
        entidad = entidad.ToLowerInvariant();
        if (!ExcelImportService.Entidades.Contains(entidad))
            return NotFound(ApiResponse<string>.Error($"No existe plantilla para '{entidad}'"));

        var bytes = await _importService.GenerarPlantillaAsync(entidad);
        return Archivo(bytes, $"Plantilla {ExcelExportService.Hojas[entidad]}", formato, ExcelExportService.Hojas[entidad]);
    }

    /// <summary>
    /// Valida el archivo y, con aplicar=true, guarda los cambios si no hubo ningún error.
    /// Entidades: vehiculos, inventario, areas, prefijos y usuarios.
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
        if (!ExtensionesImportables.Contains(Path.GetExtension(archivo.FileName).ToLowerInvariant()))
            return BadRequest(ApiResponse<string>.Error("Solo se aceptan archivos de Excel (.xlsx), CSV (.csv) o un .zip con archivos CSV"));

        try
        {
            using var stream = archivo.OpenReadStream();
            var resultado = await _importService.ImportarAsync(entidad, stream, aplicar, UserId(), User.NombreUsuario(), archivo.FileName);
            var mensaje = resultado.Aplicado
                ? $"Importación aplicada: {resultado.Nuevos} nuevo(s), {resultado.Actualizados} actualizado(s)"
                    + (resultado.Credenciales.Count > 0 ? $"; se generaron {resultado.Credenciales.Count} contraseña(s) temporal(es)" : "")
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

    /// <summary>
    /// Importación masiva desde Configuración: el archivo de "Exportar todo" (Excel o .zip de CSV), todas las hojas
    /// importables a la vez y en un solo paso (si una tiene errores no se guarda ninguna).
    /// </summary>
    [HttpPost("importar-todo")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    [RequestSizeLimit(30_000_000)]
    public async Task<IActionResult> ImportarTodo(IFormFile? archivo, [FromQuery] bool aplicar = false)
    {
        if (archivo == null || archivo.Length == 0)
            return BadRequest(ApiResponse<string>.Error("Selecciona el archivo (.xlsx o .zip de CSV)"));
        var ext = Path.GetExtension(archivo.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".zip")
            return BadRequest(ApiResponse<string>.Error("Para importar todo usa el archivo de \"Exportar todo\": Excel (.xlsx) o .zip con un CSV por hoja"));
        try
        {
            using var stream = archivo.OpenReadStream();
            var r = await _importService.ImportarTodoAsync(stream, aplicar, UserId(), User.NombreUsuario(), archivo.FileName);
            var nuevos = r.Hojas.Sum(h => h.Nuevos);
            var actualizados = r.Hojas.Sum(h => h.Actualizados);
            var mensaje = r.Aplicado
                ? $"Importación aplicada: {nuevos} nuevo(s) y {actualizados} actualizado(s) en {r.Hojas.Count} hoja(s)"
                : r.TotalErrores > 0
                    ? $"Se encontraron {r.TotalErrores} error(es); no se guardó nada"
                    : $"Archivo válido: {nuevos} nuevo(s) y {actualizados} actualizado(s) en {r.Hojas.Count} hoja(s)";
            return Ok(ApiResponse<ExcelImportTodoResultDto>.Ok(r, mensaje));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    private static bool EsCsv(string? formato) => string.Equals(formato, "csv", StringComparison.OrdinalIgnoreCase);

    /// <summary>El libro tal cual (.xlsx) o, con formato=csv, su hoja principal como .csv</summary>
    private FileContentResult Archivo(byte[] xlsx, string nombre, string? formato, string hoja) =>
        EsCsv(formato)
            ? File(CsvLibro.XlsxACsv(xlsx, hoja), CsvLibro.ContentTypeCsv, NombreArchivo(nombre, ".csv"))
            : File(xlsx, ExcelExportService.ContentType, NombreArchivo(nombre));

    private int UserId() => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

    private static string NombreArchivo(string nombre, string extension = ".xlsx") =>
        $"ContiMantenimiento - {nombre} - {DateTime.Now:yyyy-MM-dd}{extension}";
}
