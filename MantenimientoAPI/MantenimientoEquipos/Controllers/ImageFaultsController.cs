using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Models;

namespace MantenimientoEquipos.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class ImageFaultsController : ControllerBase
{
    private readonly MantenimientoDbContext _db;

    public ImageFaultsController(MantenimientoDbContext db)
    {
        _db = db;
    }

    // GET: api/ImageFaults
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ApiResponse<List<ImageFaultDto>>))]
    public async Task<IActionResult> GetImageFaults([FromQuery] bool onlyActive = true)
    {
        var query = _db.ImageFaults.AsNoTracking();

        if (onlyActive)
        {
            query = query.Where(f => f.Active);
        }

        var imageFaults = await query
            .OrderBy(f => f.Name)
            .Select(f => new ImageFaultDto
            {
                Id = f.Id,
                Name = f.Name,
                Description = f.Description,
                Active = f.Active
            })
            .ToListAsync();

        return Ok(ApiResponse<List<ImageFaultDto>>.Ok(imageFaults));
    }

    // GET: api/ImageFaults/5
    [HttpGet("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ApiResponse<ImageFaultDto>))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetImageFault(int id)
    {
        var imageFault = await _db.ImageFaults
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == id);

        if (imageFault == null)
        {
            return NotFound(ApiResponse<string>.Error("Falla de imagen no encontrada"));
        }

        var dto = new ImageFaultDto
        {
            Id = imageFault.Id,
            Name = imageFault.Name,
            Description = imageFault.Description,
            Active = imageFault.Active
        };

        return Ok(ApiResponse<ImageFaultDto>.Ok(dto));
    }

    // POST: api/ImageFaults
    [HttpPost]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    [ProducesResponseType(StatusCodes.Status201Created, Type = typeof(ApiResponse<ImageFaultDto>))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> PostImageFault([FromBody] ImageFaultCreateDto createDto)
    {
        var normalizedName = createDto.Name.Trim();
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            return BadRequest(ApiResponse<string>.Error("El nombre de la falla es requerido"));
        }

        var exists = await _db.ImageFaults
            .AnyAsync(f => f.Name == normalizedName);

        if (exists)
        {
            return BadRequest(ApiResponse<string>.Error("Ya existe una falla de imagen con ese nombre"));
        }

        var imageFault = new ImageFault
        {
            Name = normalizedName,
            Description = string.IsNullOrWhiteSpace(createDto.Description) ? null : createDto.Description.Trim(),
            Active = createDto.Active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.ImageFaults.Add(imageFault);
        await _db.SaveChangesAsync();

        var dto = new ImageFaultDto
        {
            Id = imageFault.Id,
            Name = imageFault.Name,
            Description = imageFault.Description,
            Active = imageFault.Active
        };

        return CreatedAtAction(nameof(GetImageFault), new { id = imageFault.Id },
            ApiResponse<ImageFaultDto>.Ok(dto, "Falla de imagen creada exitosamente"));
    }

    // PUT: api/ImageFaults/5
    [HttpPut("{id:int}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ApiResponse<ImageFaultDto>))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PutImageFault(int id, [FromBody] ImageFaultUpdateDto updateDto)
    {
        if (id != updateDto.Id)
        {
            return BadRequest(ApiResponse<string>.Error("El id de la ruta no coincide con el cuerpo"));
        }

        var existingFault = await _db.ImageFaults.FindAsync(id);
        if (existingFault == null)
        {
            return NotFound(ApiResponse<string>.Error("Falla de imagen no encontrada"));
        }

        var normalizedName = updateDto.Name.Trim();
        if (string.IsNullOrWhiteSpace(normalizedName))
        {
            return BadRequest(ApiResponse<string>.Error("El nombre de la falla es requerido"));
        }

        var duplicateName = await _db.ImageFaults.AnyAsync(f => f.Id != id && f.Name == normalizedName);
        if (duplicateName)
        {
            return BadRequest(ApiResponse<string>.Error("Ya existe una falla de imagen con ese nombre"));
        }

        existingFault.Name = normalizedName;
        existingFault.Description = string.IsNullOrWhiteSpace(updateDto.Description) ? null : updateDto.Description.Trim();
        existingFault.Active = updateDto.Active;
        existingFault.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var dto = new ImageFaultDto
        {
            Id = existingFault.Id,
            Name = existingFault.Name,
            Description = existingFault.Description,
            Active = existingFault.Active
        };

        return Ok(ApiResponse<ImageFaultDto>.Ok(dto, "Falla de imagen actualizada"));
    }

    // DELETE: api/ImageFaults/5
    [HttpDelete("{id:int}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ApiResponse<bool>))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteImageFault(int id)
    {
        var imageFault = await _db.ImageFaults.FindAsync(id);
        if (imageFault == null)
        {
            return NotFound(ApiResponse<string>.Error("Falla de imagen no encontrada"));
        }

        var usedByPoints = await _db.VehicleImagePoints.AnyAsync(p => p.ImageFaultId == id);
        var usedByReports = await _db.ReportImageFaults.AnyAsync(r => r.ImageFaultId == id);
        if (usedByPoints || usedByReports)
        {
            return BadRequest(ApiResponse<string>.Error("No se puede eliminar la falla porque tiene puntos o reportes asociados"));
        }

        _db.ImageFaults.Remove(imageFault);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<bool>.Ok(true, "Falla de imagen eliminada"));
    }
}
