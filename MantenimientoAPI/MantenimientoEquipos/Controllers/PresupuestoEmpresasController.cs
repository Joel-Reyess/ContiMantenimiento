using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.Utils;

namespace MantenimientoEquipos.Controllers;

/// <summary>
/// Módulo "Presupuesto de Empresas" (Reporte 6, PRS-01 a PRS-03): presupuesto asignado, utilizado y saldo de cada
/// empresa, su libro de movimientos, los parámetros de la selección automática (saldo mínimo, aviso preventivo y
/// capacidad máxima) y las órdenes que esperan proveedor. Solo Administrador del Sistema y Gerente de Mantenimiento.
/// </summary>
[ApiController]
[Route("api/presupuesto-empresas")]
[Authorize]
[RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
public class PresupuestoEmpresasController : ControllerBase
{
    private readonly PresupuestoService _presupuesto;
    private readonly SeleccionService _seleccion;

    public PresupuestoEmpresasController(PresupuestoService presupuesto, SeleccionService seleccion)
    {
        _presupuesto = presupuesto;
        _seleccion = seleccion;
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
    }

    private async Task<PresupuestoEmpresasDto> ResumenAsync()
    {
        var config = await _presupuesto.LeerConfigAsync();
        return new PresupuestoEmpresasDto
        {
            Config = config,
            Empresas = await _seleccion.EvaluarAsync(config),
            SinProveedor = (await _seleccion.EsperandoEmpresa()
                    .OrderBy(o => o.FechaTrasladoIngreso)
                    .Select(o => new { o.Id, o.Folio, o.Vehiculo.Codigo, o.FechaSinProveedor, o.FechaTrasladoIngreso })
                    .ToListAsync())
                .Select(o => new OrdenSinProveedorDto { OrdenId = o.Id, OrdenFolio = o.Folio, VehiculoCodigo = o.Codigo, Desde = o.FechaSinProveedor ?? o.FechaTrasladoIngreso })
                .ToList()
        };
    }

    [HttpGet]
    public Task<IActionResult> Get() => Ejecutar(ResumenAsync);

    [HttpGet("movimientos")]
    public Task<IActionResult> Movimientos([FromQuery] int? empresaId = null, [FromQuery] int max = 300) =>
        Ejecutar(() => _presupuesto.MovimientosAsync(empresaId, max));

    /// <summary>Asignación o ajuste de presupuesto; si con eso hay empresa elegible, se asignan las órdenes en espera</summary>
    [HttpPost("movimientos")]
    public Task<IActionResult> Registrar([FromBody] MovimientoPresupuestoRequest req) => Ejecutar(async () =>
    {
        var mov = await _presupuesto.RegistrarManualAsync(req, new ContextoPresupuesto(User.UsuarioId(), User.NombreUsuario(), req.Motivo));
        var asignadas = await _seleccion.ReintentarAsync(User.UsuarioId());
        return new { movimientoId = mov.Id, saldo = mov.SaldoResultante, ordenesAsignadas = asignadas };
    }, r => (req.Tipo ?? "").StartsWith("asig", StringComparison.OrdinalIgnoreCase) ? "Presupuesto asignado" : "Ajuste registrado");

    [HttpPut("config")]
    public Task<IActionResult> GuardarConfig([FromBody] ConfigSeleccionDto req) => Ejecutar(async () =>
    {
        await _presupuesto.GuardarConfigAsync(req, User.UsuarioId());
        await _seleccion.ReintentarAsync(User.UsuarioId());
        return await _presupuesto.LeerConfigAsync();
    }, _ => "Parámetros guardados");

    /// <summary>Vuelve a intentar la asignación de las órdenes que esperan empresa proveedora</summary>
    [HttpPost("reintentar")]
    public Task<IActionResult> Reintentar() => Ejecutar(async () =>
    {
        var asignadas = await _seleccion.ReintentarAsync(User.UsuarioId());
        var pendientes = await _seleccion.EsperandoEmpresa().CountAsync();
        return new { asignadas, pendientes };
    }, r => r.asignadas > 0
        ? $"{r.asignadas} orden(es) asignada(s)" + (r.pendientes > 0 ? $"; {r.pendientes} siguen sin empresa disponible" : "")
        : r.pendientes > 0 ? "Sigue sin haber empresas disponibles" : "No hay órdenes esperando empresa");
}
