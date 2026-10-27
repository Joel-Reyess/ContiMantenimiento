using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.Utils;

namespace MantenimientoEquipos.Controllers;

/// <summary>
/// Flujo de 7 etapas (REPORTE › INSPECCIÓN › TRASLADO › TALLER › TRASLADO › VALIDACIÓN › DISPONIBLE)
/// y capacidad de la Zona de Transición (PDF 23-oct-2026)
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FlujoController : ControllerBase
{
    private readonly FlujoService _flujo;

    public FlujoController(FlujoService flujo)
    {
        _flujo = flujo;
    }

    private async Task<IActionResult> Ejecutar<T>(Func<Task<T>> accion, Func<T, string?>? mensaje = null)
    {
        try
        {
            var r = await accion();
            return Ok(ApiResponse<T>.Ok(r, mensaje?.Invoke(r)));
        }
        catch (FlujoException ex)
        {
            return StatusCode(ex.Status, ex.Codigo == null
                ? ApiResponse<string>.Error(ex.Message)
                : ApiResponse<string>.Error(ex.Message, ex.Codigo));
        }
        catch (Exception ex) when (ex is DbUpdateException || ex is SqlException || ex.InnerException is SqlException)
        {
            // Dos personas moviendo la misma orden (o la misma zona) al mismo tiempo
            return Conflict(ApiResponse<string>.Error("Otro usuario hizo un cambio en este momento. Actualiza la pantalla e inténtalo de nuevo."));
        }
    }

    private Task<IActionResult> Accion(Func<Task<ResultadoFlujoDto>> accion) => Ejecutar(accion, r => r.Mensaje);

    /// <summary>Ocupación de las dos zonas (Dashboard y Zona de Transición)</summary>
    [HttpGet("capacidad")]
    public Task<IActionResult> Capacidad() => Ejecutar(() => _flujo.GetCapacidadAsync());

    [HttpPut("capacidad")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public Task<IActionResult> GuardarCapacidad([FromBody] CapacidadRequest req) => Ejecutar(async () =>
    {
        await _flujo.GuardarCapacidadesAsync(req.Danados, req.Reparados, User.UsuarioId());
        return await _flujo.GetCapacidadAsync();
    }, _ => "Capacidad de la Zona de Transición actualizada");

    /// <summary>Unidades en cada zona, filas de espera y reportes por inspeccionar</summary>
    [HttpGet("zona")]
    public Task<IActionResult> Zona() => Ejecutar(() => _flujo.GetZonaAsync(User.UsuarioFlujo()));

    [HttpGet("orden/{id:int}")]
    public Task<IActionResult> Orden(int id) => Ejecutar(() => _flujo.GetFlujoOrdenAsync(id, User.UsuarioFlujo()));

    [HttpGet("reporte/{id:int}")]
    public Task<IActionResult> Reporte(int id) => Ejecutar(() => _flujo.GetFlujoReporteAsync(id, User.UsuarioFlujo()));

    // ----- INSPECCIÓN (Líder) -----

    [HttpPost("reportes/{id:int}/validar")]
    [RolesAllowed("SuperUsuario", "Administrador", "Lider")]
    public Task<IActionResult> ValidarReporte(int id, [FromBody] ValidarReporteRequest req) =>
        Accion(() => _flujo.ValidarReporteAsync(id, req, User.UsuarioFlujo()));

    [HttpPost("reportes/{id:int}/rechazar")]
    [RolesAllowed("SuperUsuario", "Administrador", "Lider")]
    public Task<IActionResult> RechazarReporte(int id, [FromBody] RechazoRequest req) =>
        Accion(() => _flujo.RechazarReporteAsync(id, req, User.UsuarioFlujo()));

    [HttpPost("reportes/{id:int}/corregir")]
    [RolesAllowed("SuperUsuario", "Administrador", "Lider")]
    public Task<IActionResult> CorregirReporte(int id, [FromBody] CorregirReporteRequest req) =>
        Accion(() => _flujo.CorregirReporteAsync(id, req, User.UsuarioFlujo()));

    // ----- TRASLADO a zona de dañados (Operador / Líder) -----

    [HttpPost("ordenes/{id:int}/traslado")]
    [RolesAllowed("SuperUsuario", "Administrador", "Lider", "Operador")]
    public Task<IActionResult> ConfirmarTraslado(int id) =>
        Accion(() => _flujo.ConfirmarTrasladoIngresoAsync(id, User.UsuarioFlujo()));

    // ----- TALLER (Técnico) -----

    [HttpPost("ordenes/{id:int}/aceptar")]
    [RolesAllowed("SuperUsuario", "Administrador", "Tecnico")]
    public Task<IActionResult> Aceptar(int id) =>
        Accion(() => _flujo.AceptarOrdenAsync(id, User.UsuarioFlujo()));

    [HttpPost("ordenes/{id:int}/hallazgos")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico")]
    public Task<IActionResult> Hallazgos(int id, [FromBody] HallazgosRequest req) =>
        Accion(() => _flujo.AgregarHallazgosAsync(id, req, User.UsuarioFlujo()));

    // ----- TRASLADO a zona de reparados (Técnico) -----

    [HttpPost("ordenes/{id:int}/retorno")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico")]
    public Task<IActionResult> ConfirmarRetorno(int id) =>
        Accion(() => _flujo.ConfirmarTrasladoRetornoAsync(id, User.UsuarioFlujo()));

    // ----- VALIDACIÓN (Líder o Gerente de Mantenimiento) -----

    [HttpPost("ordenes/{id:int}/validar")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Lider")]
    public Task<IActionResult> ValidarReparacion(int id, [FromBody] ValidarReparacionRequest req) =>
        Accion(() => _flujo.ValidarReparacionAsync(id, req, User.UsuarioFlujo()));
}

public class CapacidadRequest
{
    public int Danados { get; set; }
    public int Reparados { get; set; }
}
