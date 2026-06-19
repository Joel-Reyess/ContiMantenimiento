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
    /// Crea un nuevo vehículo
    /// </summary>
    [HttpPost]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Create([FromBody] VehiculoCreateRequest request)
    {
        if (await _vehiculoService.ExisteCodigoAsync(request.Codigo))
            return BadRequest(ApiResponse<string>.Error("Ya existe un vehículo con ese código"));

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
