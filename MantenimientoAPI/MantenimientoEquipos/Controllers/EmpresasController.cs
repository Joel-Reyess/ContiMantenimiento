using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.Utils;

namespace MantenimientoEquipos.Controllers;

/// <summary>
/// Empresas proveedoras y su tarifario (PDF 06-nov, CFG-07 y CFG-08). Las registran la administración y el
/// Gerente de Mantenimiento (Supervisor); el tarifario se captura en Configuración → Checklists (administración).
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
[RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
public class EmpresasController : ControllerBase
{
    private readonly EmpresasService _empresas;

    public EmpresasController(EmpresasService empresas)
    {
        _empresas = empresas;
    }

    /// <summary>Lista de empresas; con <c>activas=true</c> solo las activas (para asignarlas a técnicos)</summary>
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool activas = false)
    {
        return Ok(ApiResponse<List<EmpresaDto>>.Ok(await _empresas.ListarAsync(activas)));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] EmpresaRequest request)
    {
        try
        {
            var empresa = await _empresas.CrearAsync(request);
            return Ok(ApiResponse<object>.Ok(new { empresa.Id, empresa.Nombre, empresa.Identificador }, $"Empresa {empresa.Nombre} registrada"));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<string>.Error(ex.Message));
        }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] EmpresaRequest request)
    {
        try
        {
            var empresa = await _empresas.ActualizarAsync(id, request);
            if (empresa == null) return NotFound(ApiResponse<string>.Error("Empresa no encontrada"));
            return Ok(ApiResponse<object>.Ok(new { empresa.Id, empresa.Nombre, empresa.Identificador, empresa.Activo }, $"Empresa {empresa.Nombre} actualizada"));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<string>.Error(ex.Message));
        }
    }

    /// <summary>Solo si no tiene técnicos ni órdenes de pago; si los tiene se desactiva. Queda en la bitácora.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var nombre = await _empresas.EliminarAsync(id, User.UsuarioId(), User.NombreUsuario());
            if (nombre == null) return NotFound(ApiResponse<string>.Error("Empresa no encontrada"));
            return Ok(ApiResponse<string>.Ok(nombre, $"Empresa {nombre} eliminada"));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<string>.Error(ex.Message));
        }
    }

    /// <summary>Precios pactados de la empresa por actividad del checklist (las que no aparecen usan el costo base)</summary>
    [HttpGet("{id:int}/tarifas")]
    public async Task<IActionResult> GetTarifas(int id)
    {
        var tarifas = await _empresas.TarifasAsync(id);
        return tarifas == null
            ? NotFound(ApiResponse<string>.Error("Empresa no encontrada"))
            : Ok(ApiResponse<List<TarifaEmpresaDto>>.Ok(tarifas));
    }

    /// <summary>Captura del tarifario: igual que modificar los checklists, solo administración</summary>
    [HttpPut("{id:int}/tarifas")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> GuardarTarifas(int id, [FromBody] GuardarTarifasRequest request)
    {
        try
        {
            var tarifas = await _empresas.GuardarTarifasAsync(id, request);
            return tarifas == null
                ? NotFound(ApiResponse<string>.Error("Empresa no encontrada"))
                : Ok(ApiResponse<List<TarifaEmpresaDto>>.Ok(tarifas, "Tarifas guardadas"));
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }
}
