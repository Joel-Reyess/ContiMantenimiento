using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.Middlewares;
using System.Security.Claims;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class VehiculosController : ControllerBase
{
    private readonly VehiculoService _vehiculoService;
    private readonly LiderTipoVehiculoAsignacionService _asignacionService;

    public VehiculosController(VehiculoService vehiculoService, LiderTipoVehiculoAsignacionService asignacionService)
    {
        _vehiculoService = vehiculoService;
        _asignacionService = asignacionService;
    }

    /// <summary>
    /// Obtiene la lista de vehículos con filtros opcionales
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] TipoVehiculoEnum? tipo = null,
        [FromQuery] EstadoVehiculoEnum? estado = null,
        [FromQuery] int? areaId = null,
        [FromQuery] UbicacionVehiculoEnum? ubicacion = null,
        [FromQuery] string? busqueda = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        List<TipoVehiculoEnum>? tiposPermitidos = null;
        
        if (User.IsInRole("Lider") || User.IsInRole("Supervisor"))
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var asignaciones = await _asignacionService.GetByUsuarioIdAsync(userId);
            if (asignaciones.Any())
            {
                tiposPermitidos = asignaciones.Select(a => a.TipoVehiculo).ToList();
            }
        }

        var vehiculos = await _vehiculoService.GetAllAsync(tipo, estado, areaId, ubicacion, tiposPermitidos, busqueda, page, pageSize);
        return Ok(ApiResponse<PaginatedResponse<VehiculoListDto>>.Ok(vehiculos));
    }

    /// <summary>
    /// Obtiene un vehículo por su ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var vehiculo = await _vehiculoService.GetByIdAsync(id);
        if (vehiculo == null)
            return NotFound(ApiResponse<string>.Error("Vehículo no encontrado"));

        return Ok(ApiResponse<VehiculoDto>.Ok(vehiculo));
    }

    /// <summary>
    /// Busca un vehículo por su código (para escaneo QR)
    /// </summary>
    [HttpGet("codigo/{codigo}")]
    public async Task<IActionResult> GetByCodigo(string codigo)
    {
        var vehiculo = await _vehiculoService.GetByCodigoAsync(codigo);
        if (vehiculo == null)
            return NotFound(ApiResponse<string>.Error("Vehículo no encontrado"));

        return Ok(ApiResponse<VehiculoDto>.Ok(vehiculo));
    }

    /// <summary>
    /// Valida un código antes del alta: si ya está registrado y qué tipo le asigna su prefijo
    /// </summary>
    [HttpGet("validar-codigo")]
    public async Task<IActionResult> ValidarCodigo([FromQuery] string codigo)
    {
        var resultado = await _vehiculoService.ValidarCodigoAsync(codigo);
        return Ok(ApiResponse<ValidarCodigoVehiculoDto>.Ok(resultado));
    }

    /// <summary>
    /// Crea un nuevo vehículo. Si no se indica el tipo, se detecta por el prefijo del código.
    /// </summary>
    [HttpPost]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Create([FromBody] VehiculoCreateRequest request)
    {
        request.Codigo = request.Codigo.Trim();
        var validacion = await _vehiculoService.ValidarCodigoAsync(request.Codigo);

        if (validacion.Existe)
        {
            var fecha = validacion.FechaRegistro?.ToLocalTime().ToString("dd/MM/yyyy") ?? "N/D";
            return BadRequest(ApiResponse<string>.Error(
                $"El vehículo {request.Codigo} ya está dado de alta en el sistema " +
                $"(Tipo: {validacion.TipoNombre}, Área: {validacion.AreaNombre ?? "Sin área"}, Registrado: {fecha})."));
        }

        request.Tipo ??= validacion.TipoDetectado;
        if (request.Tipo == null)
            return BadRequest(ApiResponse<string>.Error(
                $"No hay un prefijo configurado para el código {request.Codigo}. Selecciona el tipo de vehículo manualmente."));

        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var vehiculo = await _vehiculoService.CreateAsync(request, userId);

        return CreatedAtAction(nameof(GetById), new { id = vehiculo.Id },
            ApiResponse<object>.Ok(new { vehiculo.Id, vehiculo.Codigo }, "Vehículo creado exitosamente"));
    }

    /// <summary>
    /// Actualiza un vehículo existente
    /// </summary>
    [HttpPut("{id}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Update(int id, [FromBody] VehiculoUpdateRequest request)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _vehiculoService.UpdateAsync(id, request, userId);

        if (!result)
            return NotFound(ApiResponse<string>.Error("Vehículo no encontrado"));

        return Ok(ApiResponse<string>.Ok("Vehículo actualizado correctamente"));
    }

    /// <summary>
    /// Elimina un vehículo y todo su historial
    /// </summary>
    [HttpDelete("{id}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> Delete(int id)
    {
        var result = await _vehiculoService.DeleteManyAsync(new List<int> { id });
        if (result.VehiculosEliminados == 0)
            return NotFound(ApiResponse<string>.Error("Vehículo no encontrado"));

        return Ok(ApiResponse<EliminarVehiculosResultDto>.Ok(result, "Vehículo eliminado correctamente"));
    }

    /// <summary>
    /// Elimina varios vehículos a la vez (selección múltiple) junto con su historial
    /// </summary>
    [HttpPost("eliminar")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> DeleteMany([FromBody] EliminarVehiculosRequest request)
    {
        var result = await _vehiculoService.DeleteManyAsync(request.Ids);
        if (result.VehiculosEliminados == 0)
            return NotFound(ApiResponse<string>.Error("No se encontraron los vehículos seleccionados"));

        return Ok(ApiResponse<EliminarVehiculosResultDto>.Ok(result, $"{result.VehiculosEliminados} vehículo(s) eliminado(s) correctamente"));
    }

    /// <summary>
    /// Cambia el estado de un vehículo
    /// </summary>
    [HttpPatch("{id}/estado")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico")]
    public async Task<IActionResult> CambiarEstado(int id, [FromBody] EstadoVehiculoEnum nuevoEstado)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _vehiculoService.CambiarEstadoAsync(id, nuevoEstado, userId);

        if (!result)
            return NotFound(ApiResponse<string>.Error("Vehículo no encontrado"));

        return Ok(ApiResponse<string>.Ok("Estado actualizado correctamente"));
    }

    /// <summary>
    /// Cambia la ubicación física de un vehículo (Piso, Taller, Transición)
    /// </summary>
    [HttpPatch("{id}/ubicacion")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico")]
    public async Task<IActionResult> CambiarUbicacion(int id, [FromBody] CambiarUbicacionRequest request)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _vehiculoService.CambiarUbicacionAsync(id, request.Ubicacion, userId);

        if (!result)
            return NotFound(ApiResponse<string>.Error("Vehículo no encontrado"));

        return Ok(ApiResponse<string>.Ok("Ubicación actualizada correctamente"));
    }

    /// <summary>
    /// Obtiene el historial de mantenimiento de un vehículo
    /// </summary>
    [HttpGet("{id}/historial")]
    public async Task<IActionResult> GetHistorial(int id)
    {
        var historial = await _vehiculoService.GetHistorialAsync(id);
        return Ok(ApiResponse<List<HistorialMantenimientoDto>>.Ok(historial));
    }
}
