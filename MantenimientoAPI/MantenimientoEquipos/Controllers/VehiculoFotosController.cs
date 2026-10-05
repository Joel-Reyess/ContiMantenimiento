using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Services;

namespace MantenimientoEquipos.Controllers;

/// <summary>
/// Fotografías de un vehículo (requerimiento 8.4). Se sube una foto por petición.
/// </summary>
[ApiController]
[Route("api/vehiculos/{vehiculoId:int}/fotos")]
[Authorize]
public class VehiculoFotosController : ControllerBase
{
    private readonly VehiculoDocumentoService _service;

    public VehiculoFotosController(VehiculoDocumentoService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> Get(int vehiculoId)
    {
        var fotos = await _service.GetFotosAsync(vehiculoId);
        return Ok(ApiResponse<List<VehiculoFotoDto>>.Ok(fotos));
    }

    [HttpPost]
    [RequestSizeLimit(12_000_000)]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Upload(int vehiculoId, IFormFile? archivo)
    {
        try
        {
            var foto = await _service.AddFotoAsync(vehiculoId, archivo);
            return Ok(ApiResponse<VehiculoFotoDto>.Ok(foto, "Foto agregada"));
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ApiResponse<string>.Error(ex.Message));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    [HttpDelete("{id:int}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Delete(int vehiculoId, int id)
    {
        var ok = await _service.DeleteFotoAsync(vehiculoId, id);
        if (!ok) return NotFound(ApiResponse<string>.Error("Foto no encontrada"));
        return Ok(ApiResponse<string>.Ok("Foto eliminada"));
    }
}
