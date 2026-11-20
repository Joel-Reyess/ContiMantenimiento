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
/// Flujo de mantenimiento para equipos eléctricos (montacargas, tuggers y traspaletas; documento preliminar del
/// 19-nov-2026). Equipos con su estado y preventivo, acciones de la orden (correctiva y preventiva), checklist
/// jerárquico por tipo e indicadores. El seguimiento de una orden sale por GET /api/flujo/orden/{id} como el de
/// contenedores (con Flujo = "Electrico").
/// </summary>
[ApiController]
[Route("api/equipos-electricos")]
[Authorize]
public class EquiposElectricosController : ControllerBase
{
    private readonly EquiposElectricosService _servicio;

    public EquiposElectricosController(EquiposElectricosService servicio)
    {
        _servicio = servicio;
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
            return StatusCode(ex.Status, ex.Codigo == null ? ApiResponse<string>.Error(ex.Message) : ApiResponse<string>.Error(ex.Message, ex.Codigo));
        }
        catch (InvalidOperationException ex)
        {
            // p. ej. no alcanza la existencia de una refacción al descontar el inventario
            return Conflict(ApiResponse<string>.Error(ex.Message));
        }
        catch (Exception ex) when (ex is DbUpdateException || ex is SqlException || ex.InnerException is SqlException)
        {
            return Conflict(ApiResponse<string>.Error("Otro usuario hizo un cambio en este momento. Actualiza la pantalla e inténtalo de nuevo."));
        }
    }

    private Task<IActionResult> Accion(Func<Task<ResultadoFlujoDto>> accion) => Ejecutar(accion, r => r.Mensaje);

    /// <summary>Equipos eléctricos con su estado operativo y su preventivo (el Operador solo consulta)</summary>
    [HttpGet]
    public Task<IActionResult> Listar() => Ejecutar(() => _servicio.ListarAsync(User.UsuarioFlujo()));

    [HttpPost("preventivos/iniciar")]
    [RolesAllowed("Tecnico")]
    public Task<IActionResult> IniciarPreventivo([FromBody] IniciarPreventivoRequest req) =>
        Accion(() => _servicio.IniciarPreventivoAsync(req, User.UsuarioFlujo()));

    [HttpPut("{vehiculoId:int}/proximo-preventivo")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public Task<IActionResult> AjustarProximo(int vehiculoId, [FromBody] AjustarPreventivoRequest req) =>
        Ejecutar(() => _servicio.AjustarProximoAsync(vehiculoId, req.Fecha, User.UsuarioFlujo()), _ => "Fecha del próximo preventivo actualizada");

    // ----- Acciones de la orden -----

    [HttpPost("ordenes/{id:int}/aceptar")]
    [RolesAllowed("Tecnico")]
    public Task<IActionResult> Aceptar(int id) => Accion(() => _servicio.AceptarAsync(id, User.UsuarioFlujo()));

    [HttpPost("ordenes/{id:int}/ingreso-taller")]
    [RolesAllowed("SuperUsuario", "Administrador", "Tecnico")]
    public Task<IActionResult> IngresoTaller(int id) => Accion(() => _servicio.ConfirmarIngresoTallerAsync(id, User.UsuarioFlujo()));

    [HttpPost("ordenes/{id:int}/inspeccion-previa")]
    [RolesAllowed("SuperUsuario", "Administrador", "Tecnico")]
    public Task<IActionResult> InspeccionPrevia(int id, [FromBody] InspeccionPreviaRequest req) =>
        Accion(() => _servicio.InspeccionPreviaAsync(id, req, User.UsuarioFlujo()));

    [HttpPost("ordenes/{id:int}/pruebas")]
    [RolesAllowed("SuperUsuario", "Administrador", "Tecnico")]
    public Task<IActionResult> Pruebas(int id, [FromBody] PruebasRequest req) =>
        Accion(() => _servicio.RegistrarPruebasAsync(id, req, User.UsuarioFlujo()));

    /// <summary>Guarda el checklist del preventivo; con terminar=true exige todas las actividades y cierra la parte técnica</summary>
    [HttpPut("ordenes/{id:int}/checklist")]
    [RolesAllowed("SuperUsuario", "Administrador", "Tecnico")]
    public Task<IActionResult> Checklist(int id, [FromBody] ChecklistPreventivoRequest req, [FromQuery] bool terminar = false) =>
        Accion(() => _servicio.GuardarChecklistAsync(id, req, terminar, User.UsuarioFlujo()));

    [HttpPost("ordenes/{id:int}/traslado-area")]
    [RolesAllowed("SuperUsuario", "Administrador", "Tecnico")]
    public Task<IActionResult> TrasladoArea(int id) => Accion(() => _servicio.ConfirmarTrasladoAreaAsync(id, User.UsuarioFlujo()));

    [HttpPost("ordenes/{id:int}/aprobar-entrega")]
    [RolesAllowed("SuperUsuario", "Administrador", "Lider")]
    public Task<IActionResult> AprobarEntrega(int id) => Accion(() => _servicio.AprobarEntregaAsync(id, User.UsuarioFlujo()));

    /// <summary>Documento de entrega firmado (campo "archivos": JPG/PNG/PDF, hasta 3 de 10 MB); cierra la orden</summary>
    [HttpPost("ordenes/{id:int}/documento")]
    [RolesAllowed("SuperUsuario", "Administrador", "Tecnico")]
    [RequestSizeLimit(35 * 1024 * 1024)]
    public Task<IActionResult> Documento(int id, [FromForm] List<IFormFile> archivos) =>
        Accion(() => _servicio.SubirDocumentoAsync(id, archivos, User.UsuarioFlujo()));

    [HttpPost("ordenes/{id:int}/cancelar")]
    [RolesAllowed("SuperUsuario", "Administrador", "Lider")]
    public Task<IActionResult> Cancelar(int id, [FromBody] CancelarElectricoRequest req) =>
        Accion(() => _servicio.CancelarAsync(id, req.Motivo, User.UsuarioFlujo()));

    // ----- Checklist preventivo por tipo (Administrador) -----

    [HttpGet("checklist/{tipoId:int}")]
    public Task<IActionResult> GetChecklist(int tipoId) => Ejecutar(() => _servicio.ChecklistTipoAsync(tipoId));

    [HttpPut("checklist/{tipoId:int}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public Task<IActionResult> GuardarChecklist(int tipoId, [FromBody] ChecklistPreventivoTipoDto req) =>
        Ejecutar(() => _servicio.GuardarChecklistTipoAsync(tipoId, req, User.UsuarioFlujo()), _ => "Checklist preventivo guardado");

    // ----- Indicadores y recordatorios -----

    [HttpGet("indicadores")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public Task<IActionResult> Indicadores() => Ejecutar(() => _servicio.IndicadoresAsync());

    /// <summary>Corre ahora los recordatorios (normalmente corren solos cada 10 minutos)</summary>
    [HttpPost("avisos/ejecutar")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public Task<IActionResult> EjecutarAvisos() => Ejecutar(() => _servicio.EjecutarAvisosAsync(), n => $"{n} recordatorio(s) enviado(s)");
}
