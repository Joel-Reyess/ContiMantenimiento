using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.Models;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/vehiculos/{vehiculoId:int}/documentos")]
[Authorize]
public class VehiculoDocumentosController : ControllerBase
{
    private readonly VehiculoDocumentoService _service;

    public VehiculoDocumentosController(VehiculoDocumentoService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> Get(int vehiculoId)
    {
        var docs = await _service.GetByVehiculoAsync(vehiculoId);
        return Ok(ApiResponse<List<VehiculoDocumentoDto>>.Ok(docs));
    }

    [HttpPost]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> Upload(int vehiculoId, [FromForm] VehiculoDocumentoCreateRequest request, IFormFile? archivo)
    {
        if (vehiculoId != request.VehiculoId)
            return BadRequest(ApiResponse<string>.Error("VehiculoId inconsistente"));

        // Versioning logic: handled in service or here.
        // Assuming service creates a new entry. We might want to deactivate old ones or just add new.
        // For now, we rely on the service to just create it. The model has Version=1 by default.
        // If we want auto-increment, we would need to check for existing docs with same name.
        
        var doc = await _service.CreateAsync(request, archivo);
        return Ok(ApiResponse<VehiculoDocumentoDto>.Ok(doc, "Documento cargado"));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int vehiculoId, int id)
    {
        var ok = await _service.DeleteAsync(id);
        if (!ok) return NotFound(ApiResponse<string>.Error("Documento no encontrado"));
        return Ok(ApiResponse<string>.Ok("Eliminado"));
    }
}
