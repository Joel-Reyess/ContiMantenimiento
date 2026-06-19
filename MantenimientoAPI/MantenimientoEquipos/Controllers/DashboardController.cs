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
public class DashboardController : ControllerBase
{
    private readonly DashboardService _dashboardService;

    public DashboardController(DashboardService dashboardService)
    {
        _dashboardService = dashboardService;
    }

    /// <summary>
    /// Obtiene las estadísticas generales del dashboard principal
    /// </summary>
    [HttpGet("estadisticas")]
    [HttpGet("stats")]
    public async Task<IActionResult> GetEstadisticas()
    {
        var stats = await _dashboardService.GetEstadisticasGeneralesAsync();
        return Ok(ApiResponse<DashboardStatsDto>.Ok(stats));
    }

    /// <summary>
    /// Obtiene los KPIs del sistema
    /// </summary>
    [HttpGet("kpis")]
    public async Task<IActionResult> GetKPIs(
        [FromQuery] DateTime? desde = null,
        [FromQuery] DateTime? hasta = null)
    {
        var kpis = await _dashboardService.GetKPIsAsync(desde, hasta);
        return Ok(ApiResponse<KPIsDto>.Ok(kpis));
    }

    /// <summary>
    /// Obtiene el dashboard personalizado del técnico actual
    /// </summary>
    [HttpGet("tecnico")]
    public async Task<IActionResult> GetDashboardTecnico()
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var dashboard = await _dashboardService.GetDashboardTecnicoAsync(userId);
        return Ok(ApiResponse<DashboardTecnicoDto>.Ok(dashboard));
    }

    /// <summary>
    /// Resumen ampliado (conteos + lista de equipos) para roles administrativos/supervisores
    /// </summary>
    [HttpGet("resumen")]
    [Authorize(Roles = "SuperUsuario,Administrador,Supervisor")]
    public async Task<IActionResult> GetResumenFlota()
    {
        var resumen = await _dashboardService.GetResumenFlotaAsync();
        return Ok(ApiResponse<DashboardResumenDto>.Ok(resumen));
    }

    /// <summary>
    /// Reporte anual de mantenimientos por tipo de carro
    /// </summary>
    [HttpGet("reporte-anual")]
    [Authorize(Roles = "SuperUsuario,Administrador,Supervisor")]
    public async Task<IActionResult> GetReporteAnual([FromQuery] int? anio = null)
    {
        var reporte = await _dashboardService.GetReporteAnualPorTipoAsync(anio);
        return Ok(ApiResponse<List<ReporteAnualDto>>.Ok(reporte));
    }

    /// <summary>
    /// Lista de órdenes terminadas sin firma del líder
    /// </summary>
    [HttpGet("sin-firma")]
    [Authorize(Roles = "SuperUsuario,Administrador,Supervisor")]
    public async Task<IActionResult> GetOrdenesSinFirma()
    {
        var ordenes = await _dashboardService.GetCarrosTerminadosSinFirmaAsync();
        return Ok(ApiResponse<List<OrdenSinFirmaDto>>.Ok(ordenes));
    }

    /// <summary>
    /// Lista de vehículos actualmente en mantenimiento (Taller)
    /// </summary>
    [HttpGet("taller")]
    [Authorize(Roles = "SuperUsuario,Administrador,Supervisor")]
    public async Task<IActionResult> GetVehiculosEnTaller()
    {
        var vehiculos = await _dashboardService.GetVehiculosEnTallerAsync();
        return Ok(ApiResponse<List<VehiculoEnTallerDto>>.Ok(vehiculos));
    }

    /// <summary>
    /// Lista de órdenes terminadas sin registro de pago aprobado
    /// </summary>
    [HttpGet("ordenes-sin-pago")]
    [Authorize(Roles = "SuperUsuario,Administrador,Supervisor")]
    public async Task<IActionResult> GetOrdenesSinPago()
    {
        var ordenes = await _dashboardService.GetOrdenesSinPagoAsync();
        return Ok(ApiResponse<List<OrdenSinPagoDto>>.Ok(ordenes));
    }

    /// <summary>
    /// Órdenes por día para el gráfico de tendencia
    /// </summary>
    [HttpGet("ordenes-por-dia")]
    public async Task<IActionResult> GetOrdenesPorDia([FromQuery] int dias = 7)
    {
        var data = await _dashboardService.GetOrdenesPorDiaAsync(dias);
        return Ok(ApiResponse<List<EstadisticaDiariaDto>>.Ok(data));
    }

    /// <summary>
    /// Programación de mantenimiento preventivo para el dashboard
    /// </summary>
    [HttpGet("programacion-preventiva")]
    [AllowAnonymous]
    public async Task<IActionResult> GetProgramacionPreventiva()
    {
        var programacion = await _dashboardService.GetMantenimientosPreventivosProgramadosAsync();
        return Ok(ApiResponse<List<MantenimientoPreventivoProgramadoDto>>.Ok(programacion));
    }
}
