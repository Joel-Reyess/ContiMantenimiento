using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Services;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VehiculoPrefijoConfigsController : ControllerBase
{
    private readonly VehiculoPrefijoConfigService _service;

    public VehiculoPrefijoConfigsController(VehiculoPrefijoConfigService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<VehiculoPrefijoConfig>>>> GetAll(
        [FromQuery] bool? activo = null,
        [FromQuery] string? busqueda = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var result = await _service.GetAllAsync(activo, busqueda, page, pageSize);
        return Ok(ApiResponse<PaginatedResponse<VehiculoPrefijoConfig>>.Ok(result));
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<VehiculoPrefijoConfig>> GetById(int id)
    {
        var config = await _service.GetByIdAsync(id);
        if (config == null) return NotFound();

        return Ok(config);
    }

    [HttpPost]
    public async Task<ActionResult<VehiculoPrefijoConfig>> Create(VehiculoPrefijoConfig config)
    {
        try
        {
            var created = await _service.CreateAsync(config);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<VehiculoPrefijoConfig>> Update(int id, VehiculoPrefijoConfig config)
    {
        try
        {
            var updated = await _service.UpdateAsync(id, config);
            if (updated == null) return NotFound();

            return Ok(updated);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var success = await _service.DeleteAsync(id);
        if (!success) return NotFound();

        return NoContent();
    }

    /// <summary>
    /// Obtiene el tipo de vehículo asociado a un código de vehículo basado en el prefijo
    /// </summary>
    [HttpGet("tipo-vehiculo-por-codigo/{codigoVehiculo}")]
    public async Task<ActionResult<int?>> GetTipoVehiculoIdByCodigo(string codigoVehiculo)
    {
        var tipoId = await _service.GetTipoVehiculoIdByCodigoAsync(codigoVehiculo);
        return Ok(tipoId);
    }
}
