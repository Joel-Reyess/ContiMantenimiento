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
public class VehicleImagePointsController : ControllerBase
{
    private readonly MantenimientoDbContext _db;

    public VehicleImagePointsController(MantenimientoDbContext db)
    {
        _db = db;
    }

    // GET: api/VehicleImagePoints
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ApiResponse<List<VehicleImagePointDto>>))]
    public async Task<IActionResult> GetVehicleImagePoints([FromQuery] string? imageKey = null, [FromQuery] bool onlyActive = true)
    {
        IQueryable<VehicleImagePoint> query = _db.VehicleImagePoints
            .AsNoTracking()
            .Include(p => p.ImageFault);

        if (!string.IsNullOrEmpty(imageKey))
        {
            var normalizedKey = imageKey.Trim();
            query = query.Where(p => p.ImageKey == normalizedKey);
        }

        if (onlyActive)
        {
            query = query.Where(p => p.Active && p.ImageFault.Active);
        }

        var vehicleImagePoints = await query
            .OrderBy(p => p.ImageKey)
            .ThenBy(p => p.Id)
            .Select(p => new VehicleImagePointDto
            {
                Id = p.Id,
                ImageKey = p.ImageKey,
                XPct = p.XPct,
                YPct = p.YPct,
                RadiusPct = p.RadiusPct,
                ImageFaultId = p.ImageFaultId,
                ImageFaultName = p.ImageFault.Name,
                ImageFaultDescription = p.ImageFault.Description,
                ChecklistItemId = p.ChecklistItemId,
                Active = p.Active
            })
            .ToListAsync();

        return Ok(ApiResponse<List<VehicleImagePointDto>>.Ok(vehicleImagePoints));
    }

    // GET: api/VehicleImagePoints/5
    [HttpGet("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ApiResponse<VehicleImagePointDto>))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetVehicleImagePoint(int id)
    {
        var vehicleImagePoint = await _db.VehicleImagePoints
            .AsNoTracking()
            .Include(p => p.ImageFault)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (vehicleImagePoint == null)
        {
            return NotFound(ApiResponse<string>.Error("Punto de imagen no encontrado"));
        }

        var dto = new VehicleImagePointDto
        {
            Id = vehicleImagePoint.Id,
            ImageKey = vehicleImagePoint.ImageKey,
            XPct = vehicleImagePoint.XPct,
            YPct = vehicleImagePoint.YPct,
            RadiusPct = vehicleImagePoint.RadiusPct,
            ImageFaultId = vehicleImagePoint.ImageFaultId,
            ImageFaultName = vehicleImagePoint.ImageFault.Name,
            ImageFaultDescription = vehicleImagePoint.ImageFault.Description,
            ChecklistItemId = vehicleImagePoint.ChecklistItemId,
            Active = vehicleImagePoint.Active
        };

        return Ok(ApiResponse<VehicleImagePointDto>.Ok(dto));
    }

    // POST: api/VehicleImagePoints
    [HttpPost]
    [RolesAllowed("SuperUsuario", "Administrador")] // Hotspots: solo administración
    [ProducesResponseType(StatusCodes.Status201Created, Type = typeof(ApiResponse<VehicleImagePointDto>))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> PostVehicleImagePoint([FromBody] VehicleImagePointCreateDto createDto)
    {
        var normalizedImageKey = createDto.ImageKey.Trim();
        if (string.IsNullOrWhiteSpace(normalizedImageKey))
        {
            return BadRequest(ApiResponse<string>.Error("El ImageKey es requerido"));
        }

        if (!IsValidCoordinates(createDto.XPct, createDto.YPct, createDto.RadiusPct))
        {
            return BadRequest(ApiResponse<string>.Error("Las coordenadas deben estar en rango de 0 a 100"));
        }

        var imageFault = await _db.ImageFaults
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == createDto.ImageFaultId);

        if (imageFault == null)
        {
            return BadRequest(ApiResponse<string>.Error("La falla seleccionada no existe"));
        }

        var vehicleImagePoint = new VehicleImagePoint
        {
            ImageKey = normalizedImageKey,
            XPct = createDto.XPct,
            YPct = createDto.YPct,
            RadiusPct = createDto.RadiusPct,
            ImageFaultId = createDto.ImageFaultId,
            Active = createDto.Active,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.VehicleImagePoints.Add(vehicleImagePoint);
        await _db.SaveChangesAsync();

        var dto = new VehicleImagePointDto
        {
            Id = vehicleImagePoint.Id,
            ImageKey = vehicleImagePoint.ImageKey,
            XPct = vehicleImagePoint.XPct,
            YPct = vehicleImagePoint.YPct,
            RadiusPct = vehicleImagePoint.RadiusPct,
            ImageFaultId = vehicleImagePoint.ImageFaultId,
            ImageFaultName = imageFault.Name,
            ImageFaultDescription = imageFault.Description,
            ChecklistItemId = vehicleImagePoint.ChecklistItemId,
            Active = vehicleImagePoint.Active
        };

        return CreatedAtAction(nameof(GetVehicleImagePoint), new { id = vehicleImagePoint.Id },
            ApiResponse<VehicleImagePointDto>.Ok(dto, "Punto de imagen creado exitosamente"));
    }

    // PUT: api/VehicleImagePoints/5
    [HttpPut("{id:int}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ApiResponse<VehicleImagePointDto>))]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> PutVehicleImagePoint(int id, [FromBody] VehicleImagePointUpdateDto updateDto)
    {
        if (id != updateDto.Id)
        {
            return BadRequest(ApiResponse<string>.Error("El id de la ruta no coincide con el cuerpo"));
        }

        var normalizedImageKey = updateDto.ImageKey.Trim();
        if (string.IsNullOrWhiteSpace(normalizedImageKey))
        {
            return BadRequest(ApiResponse<string>.Error("El ImageKey es requerido"));
        }

        if (!IsValidCoordinates(updateDto.XPct, updateDto.YPct, updateDto.RadiusPct))
        {
            return BadRequest(ApiResponse<string>.Error("Las coordenadas deben estar en rango de 0 a 100"));
        }

        var existingPoint = await _db.VehicleImagePoints.FindAsync(id);
        if (existingPoint == null)
        {
            return NotFound(ApiResponse<string>.Error("Punto de imagen no encontrado"));
        }

        var imageFault = await _db.ImageFaults
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == updateDto.ImageFaultId);

        if (imageFault == null)
        {
            return BadRequest(ApiResponse<string>.Error("La falla seleccionada no existe"));
        }

        existingPoint.ImageKey = normalizedImageKey;
        existingPoint.XPct = updateDto.XPct;
        existingPoint.YPct = updateDto.YPct;
        existingPoint.RadiusPct = updateDto.RadiusPct;
        existingPoint.ImageFaultId = updateDto.ImageFaultId;
        existingPoint.Active = updateDto.Active;
        existingPoint.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var dto = new VehicleImagePointDto
        {
            Id = existingPoint.Id,
            ImageKey = existingPoint.ImageKey,
            XPct = existingPoint.XPct,
            YPct = existingPoint.YPct,
            RadiusPct = existingPoint.RadiusPct,
            ImageFaultId = existingPoint.ImageFaultId,
            ImageFaultName = imageFault.Name,
            ImageFaultDescription = imageFault.Description,
            ChecklistItemId = existingPoint.ChecklistItemId,
            Active = existingPoint.Active
        };

        return Ok(ApiResponse<VehicleImagePointDto>.Ok(dto, "Punto de imagen actualizado"));
    }

    /// <summary>
    /// Liga el componente con la actividad del checklist que genera al reportarlo (PDF 06-nov). null = automática por nombre.
    /// Va aparte de la edición del punto para que mover el punto no borre la liga.
    /// </summary>
    [HttpPut("{id:int}/actividad")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> LigarActividad(int id, [FromBody] VehicleImagePointActividadDto body)
    {
        var punto = await _db.VehicleImagePoints.FindAsync(id);
        if (punto == null) return NotFound(ApiResponse<string>.Error("Punto de imagen no encontrado"));
        if (body.ChecklistItemId is > 0 && !await _db.ChecklistItems.AnyAsync(i => i.Id == body.ChecklistItemId && i.Activo))
            return BadRequest(ApiResponse<string>.Error("La actividad elegida ya no existe en el checklist; actualiza la pantalla."));
        punto.ChecklistItemId = body.ChecklistItemId is > 0 ? body.ChecklistItemId : null;
        punto.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<int?>.Ok(punto.ChecklistItemId, punto.ChecklistItemId == null ? "El componente se ligará por nombre" : "Actividad ligada al componente"));
    }

    // DELETE: api/VehicleImagePoints/5
    [HttpDelete("{id:int}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ApiResponse<bool>))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteVehicleImagePoint(int id)
    {
        var vehicleImagePoint = await _db.VehicleImagePoints.FindAsync(id);
        if (vehicleImagePoint == null)
        {
            return NotFound(ApiResponse<string>.Error("Punto de imagen no encontrado"));
        }

        // Los reportes que ya usaron el punto conservan la falla, solo pierden la posición en la imagen.
        // Se hace explícito porque según la BD la llave foránea puede no tener ON DELETE SET NULL.
        using var tx = await _db.Database.BeginTransactionAsync();
        await _db.ReportImageFaults
            .Where(r => r.VehicleImagePointId == id)
            .ExecuteUpdateAsync(s => s.SetProperty(r => r.VehicleImagePointId, (int?)null));
        _db.VehicleImagePoints.Remove(vehicleImagePoint);
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return Ok(ApiResponse<bool>.Ok(true, "Punto de imagen eliminado"));
    }

    private static bool IsValidCoordinates(decimal xPct, decimal yPct, decimal? radiusPct)
    {
        var xValid = xPct is >= 0 and <= 100;
        var yValid = yPct is >= 0 and <= 100;
        var radiusValid = !radiusPct.HasValue || (radiusPct.Value >= 0 && radiusPct.Value <= 100);
        return xValid && yValid && radiusValid;
    }
}
