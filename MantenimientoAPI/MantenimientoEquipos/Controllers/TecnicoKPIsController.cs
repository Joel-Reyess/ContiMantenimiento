using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Services;
using System.Security.Claims;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TecnicoKPIsController : ControllerBase
{
    private readonly TecnicoKPIsService _kpiService;

    public TecnicoKPIsController(TecnicoKPIsService kpiService)
    {
        _kpiService = kpiService;
    }

    [HttpGet]
    [Authorize(Roles = "SuperUsuario,Administrador,Supervisor")]
    public async Task<IActionResult> GetKPIs([FromQuery] int? mes, [FromQuery] int? anio)
    {
        mes ??= DateTime.Now.Month;
        anio ??= DateTime.Now.Year;

        var kpis = await _kpiService.GetTecnicoKPIsAsync(mes.Value, anio.Value);
        return Ok(ApiResponse<List<TecnicoKpiDto>>.Ok(kpis));
    }

    [HttpGet("detalle/{tecnicoId}")]
    [Authorize(Roles = "SuperUsuario,Administrador,Supervisor")]
    public async Task<IActionResult> GetDetalleKPI(int tecnicoId, [FromQuery] int? mes, [FromQuery] int? anio)
    {
        mes ??= DateTime.Now.Month;
        anio ??= DateTime.Now.Year;

        var detalle = await _kpiService.GetDetalleKPIAsync(tecnicoId, mes.Value, anio.Value);
        return Ok(ApiResponse<TecnicoKpiDto>.Ok(detalle));
    }

    [HttpPost("meta")]
    [Authorize(Roles = "SuperUsuario,Administrador,Supervisor")]
    public async Task<IActionResult> UpsertMeta([FromBody] UpsertMetaTecnicoDto dto)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _kpiService.UpsertMetaAsync(dto, userId);
        
        return result 
            ? Ok(ApiResponse<string>.Ok("Meta actualizada correctamente"))
            : BadRequest(ApiResponse<string>.Error("No se pudo actualizar la meta"));
    }
}
