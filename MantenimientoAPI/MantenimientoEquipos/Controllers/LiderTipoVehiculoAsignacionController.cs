using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Services;

namespace MantenimientoEquipos.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class LiderTipoVehiculoAsignacionController : ControllerBase
{
    private readonly LiderTipoVehiculoAsignacionService _service;

    public LiderTipoVehiculoAsignacionController(LiderTipoVehiculoAsignacionService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<ActionResult<List<LiderTipoVehiculoAsignacionDto>>> GetAll()
    {
        var result = await _service.GetAllAsync();
        return Ok(ApiResponse<List<LiderTipoVehiculoAsignacionDto>>.Ok(result));
    }

    [HttpGet("usuario/{usuarioId}")]
    public async Task<ActionResult<List<LiderTipoVehiculoAsignacionDto>>> GetByUsuarioId(int usuarioId)
    {
        var result = await _service.GetByUsuarioIdAsync(usuarioId);
        return Ok(ApiResponse<List<LiderTipoVehiculoAsignacionDto>>.Ok(result));
    }

    [HttpPost]
    [Authorize(Roles = "SuperUsuario,Administrativo,Supervisor")]
    public async Task<ActionResult<LiderTipoVehiculoAsignacionDto>> Create(CreateLiderTipoVehiculoAsignacionRequest request)
    {
        try
        {
            var result = await _service.CreateAsync(request);
            return Ok(ApiResponse<LiderTipoVehiculoAsignacionDto>.Ok(result));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    [HttpPost("batch")]
    public async Task<IActionResult> CreateAsignaciones([FromBody] List<CreateLiderTipoVehiculoAsignacionRequest> request)
    {
        try
        {
            var result = await _service.CreateAsignacionesAsync(request);
            return Ok(ApiResponse<List<LiderTipoVehiculoAsignacionDto>>.Ok(result));
        }
        catch (Exception ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "SuperUsuario,Administrativo,Supervisor")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _service.DeleteAsync(id);
        if (!result)
            return NotFound(ApiResponse<string>.Error("Asignacion no encontrada"));

        return Ok(ApiResponse<bool>.Ok(true));
    }
}
