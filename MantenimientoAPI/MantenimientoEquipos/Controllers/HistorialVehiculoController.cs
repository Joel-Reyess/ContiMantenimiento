using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Services;

namespace MantenimientoEquipos.Controllers;

/// <summary>
/// Historial de mantenimiento individual por vehículo (Reporte 6, FLT-11 a FLT-16). Lo consultan quienes ven
/// Flota (Administrador, Gerente de Mantenimiento y Líder); los importes solo el Administrador y el Gerente de
/// Mantenimiento, igual que Control de Pagos y el dashboard financiero.
/// </summary>
[ApiController]
[Route("api/vehiculos")]
[Authorize]
public class HistorialVehiculoController : ControllerBase
{
    private readonly HistorialVehiculoService _historial;

    public HistorialVehiculoController(MantenimientoDbContext db)
    {
        _historial = new HistorialVehiculoService(db);
    }

    [HttpGet("{id:int}/historial-mantenimiento")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Lider")]
    public async Task<IActionResult> Get(int id, [FromQuery] HistorialVehiculoFiltros filtros)
    {
        if (filtros.Desde.HasValue && filtros.Hasta.HasValue && filtros.Desde.Value.Date > filtros.Hasta.Value.Date)
            return BadRequest(ApiResponse<string>.Error("La fecha inicial no puede ser posterior a la fecha final."));

        var verCostos = User.IsInRole("SuperUsuario") || User.IsInRole("Administrador") || User.IsInRole("Supervisor");
        var dto = await _historial.ObtenerAsync(id, filtros, verCostos);
        return dto == null
            ? NotFound(ApiResponse<string>.Error("Vehículo no encontrado"))
            : Ok(ApiResponse<HistorialVehiculoDto>.Ok(dto));
    }
}
