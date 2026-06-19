using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Middlewares;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CatalogosController : ControllerBase
{
    private readonly MantenimientoDbContext _db;

    public CatalogosController(MantenimientoDbContext db)
    {
        _db = db;
    }

    // ===== ÁREAS =====

    [HttpGet("areas")]
    public async Task<IActionResult> GetAreas()
    {
        var areas = await _db.Areas
            .Include(a => a.Supervisor)
            .Select(a => new AreaDto
            {
                Id = a.Id,
                Nombre = a.Nombre,
                Codigo = a.Codigo,
                Descripcion = a.Descripcion,
                SupervisorId = a.SupervisorId,
                SupervisorNombre = a.Supervisor != null ? a.Supervisor.NombreCompleto : null,
                Activa = a.Activa
            }).ToListAsync();

        return Ok(ApiResponse<List<AreaDto>>.Ok(areas));
    }

    [HttpPost("areas")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> CreateArea([FromBody] AreaCreateRequest request)
    {
        var area = new Area
        {
            Nombre = request.Nombre,
            Codigo = request.Codigo,
            Descripcion = request.Descripcion,
            SupervisorId = request.SupervisorId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Areas.Add(area);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { area.Id }, "Área creada exitosamente"));
    }

    // ===== CATEGORÍAS DE FALLA =====

    [HttpGet("categorias-falla")]
    public async Task<IActionResult> GetCategoriasFalla()
    {
        var categorias = await _db.CategoriasFalla
            .Where(c => c.Activa)
            .Select(c => new CategoriaFallaDto
            {
                Id = c.Id,
                Nombre = c.Nombre,
                Descripcion = c.Descripcion,
                Icono = c.Icono,
                Activa = c.Activa
            }).ToListAsync();

        return Ok(ApiResponse<List<CategoriaFallaDto>>.Ok(categorias));
    }

    [HttpPost("categorias-falla")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> CreateCategoriaFalla([FromBody] CategoriaFallaCreateRequest request)
    {
        var categoria = new CategoriaFalla
        {
            Nombre = request.Nombre,
            Descripcion = request.Descripcion,
            Icono = request.Icono,
            CreatedAt = DateTime.UtcNow
        };

        _db.CategoriasFalla.Add(categoria);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { categoria.Id }, "Categoría creada exitosamente"));
    }

    // ===== ROLES =====

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles()
    {
        var roles = await _db.Roles
            .Where(r => r.Activo)
            .Select(r => new RolDto
            {
                Id = r.Id,
                Nombre = r.Nombre,
                Descripcion = r.Descripcion,
                Activo = r.Activo
            }).ToListAsync();

        return Ok(ApiResponse<List<RolDto>>.Ok(roles));
    }

    // ===== TÉCNICOS =====

    [HttpGet("tecnicos")]
    public async Task<IActionResult> GetTecnicos([FromQuery] TipoTecnicoEnum? tipo = null)
    {
        var query = _db.Users
            .Include(u => u.Roles)
            .Where(u => u.Roles.Any(r => r.Nombre == "Tecnico"))
            .Where(u => u.Status == UserStatusEnum.Activo);

        if (tipo.HasValue)
            query = query.Where(u => u.TipoTecnico == tipo);

        var tecnicos = await query
            .Select(u => new TecnicoDto
            {
                Id = u.Id,
                NombreCompleto = u.NombreCompleto,
                NumeroEmpleado = u.NumeroEmpleado,
                Telefono = u.Telefono,
                TipoTecnico = u.TipoTecnico.HasValue ? u.TipoTecnico.Value.ToString() : null,
                EmpresaExterna = u.EmpresaExterna,
                TarifaHora = u.TarifaHora,
                Especialidades = u.Especialidades,
                OrdenesActivas = u.OrdenesAsignadas.Count(o =>
                    o.Estado != EstadoOrdenTrabajoEnum.Completada &&
                    o.Estado != EstadoOrdenTrabajoEnum.Validada &&
                    o.Estado != EstadoOrdenTrabajoEnum.Cancelada),
                OrdenesCompletadas = u.OrdenesAsignadas.Count(o =>
                    o.Estado == EstadoOrdenTrabajoEnum.Completada ||
                    o.Estado == EstadoOrdenTrabajoEnum.Validada)
            }).ToListAsync();

        return Ok(ApiResponse<List<TecnicoDto>>.Ok(tecnicos));
    }

    // ===== ENUMS =====

    [HttpGet("tipos-vehiculo")]
    public IActionResult GetTiposVehiculo()
    {
        var tipos = Enum.GetValues<TipoVehiculoEnum>()
            .Select(t => new { Id = (int)t, Nombre = t.ToString() })
            .ToList();
        return Ok(ApiResponse<object>.Ok(tipos));
    }

    [HttpGet("estados-vehiculo")]
    public IActionResult GetEstadosVehiculo()
    {
        var estados = Enum.GetValues<EstadoVehiculoEnum>()
            .Select(e => new { Id = (int)e, Nombre = e.ToString() })
            .ToList();
        return Ok(ApiResponse<object>.Ok(estados));
    }

    [HttpGet("estados-orden")]
    public IActionResult GetEstadosOrden()
    {
        var estados = Enum.GetValues<EstadoOrdenTrabajoEnum>()
            .Select(e => new { Id = (int)e, Nombre = e.ToString() })
            .ToList();
        return Ok(ApiResponse<object>.Ok(estados));
    }

    [HttpGet("prioridades")]
    public IActionResult GetPrioridades()
    {
        var prioridades = Enum.GetValues<PrioridadEnum>()
            .Select(p => new
            {
                Id = (int)p,
                Nombre = p == PrioridadEnum.PuedeCircular ? "Puede circular" : "No puede circular"
            })
            .ToList();
        return Ok(ApiResponse<object>.Ok(prioridades));
    }

    // === ACTUALIZAR AREA (supervisor/estado) ===
    [HttpPut("areas/{id}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> UpdateArea(int id, [FromBody] AreaUpdateRequest request)
    {
        var area = await _db.Areas.FindAsync(id);
        if (area == null)
            return NotFound(ApiResponse<string>.Error("Area no encontrada"));

        if (!string.IsNullOrWhiteSpace(request.Nombre)) area.Nombre = request.Nombre;
        if (request.Codigo != null) area.Codigo = request.Codigo;
        if (request.Descripcion != null) area.Descripcion = request.Descripcion;
        if (request.SupervisorId.HasValue) area.SupervisorId = request.SupervisorId;
        if (request.Activa.HasValue) area.Activa = request.Activa.Value;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(new { area.Id }, "Area actualizada"));
    }
}

