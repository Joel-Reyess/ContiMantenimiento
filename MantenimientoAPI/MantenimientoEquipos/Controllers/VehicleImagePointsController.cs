using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Services;

namespace MantenimientoEquipos.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize]
public class VehicleImagePointsController : ControllerBase
{
    private readonly MantenimientoDbContext _db;
    private readonly FallasVisualesService _fallas;

    public VehicleImagePointsController(MantenimientoDbContext db, FallasVisualesService fallas)
    {
        _db = db;
        _fallas = fallas;
    }

    // GET: api/VehicleImagePoints
    // FV-03: cada punto trae su actividad del checklist (título, descripción y costo leídos del checklist).
    // Los que no tienen actividad vigente salen con SinActividad = true (el reporte no los ofrece).
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

        var puntos = await query.OrderBy(p => p.ImageKey).ThenBy(p => p.Id).ToListAsync();
        return Ok(ApiResponse<List<VehicleImagePointDto>>.Ok(await _fallas.ADtoAsync(puntos)));
    }

    // GET: api/VehicleImagePoints/5
    [HttpGet("{id:int}")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ApiResponse<VehicleImagePointDto>))]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetVehicleImagePoint(int id)
    {
        var punto = await _db.VehicleImagePoints
            .AsNoTracking()
            .Include(p => p.ImageFault)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (punto == null)
        {
            return NotFound(ApiResponse<string>.Error("Punto de imagen no encontrado"));
        }

        return Ok(ApiResponse<VehicleImagePointDto>.Ok((await _fallas.ADtoAsync(new List<VehicleImagePoint> { punto }))[0]));
    }

    // POST: api/VehicleImagePoints
    // FV-03: el punto se crea con una actividad del checklist del tipo (ya no se elige una falla capturada aparte)
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

        ChecklistItem actividad;
        try
        {
            actividad = await _fallas.ValidarActividadAsync(createDto.ChecklistItemId, normalizedImageKey);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }

        var falla = await _fallas.FallaDeActividadAsync(actividad);
        var punto = new VehicleImagePoint
        {
            ImageKey = normalizedImageKey,
            XPct = createDto.XPct,
            YPct = createDto.YPct,
            RadiusPct = createDto.RadiusPct,
            ImageFault = falla,
            ChecklistItemId = actividad.Id,
            Active = true,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _db.VehicleImagePoints.Add(punto);
        await _db.SaveChangesAsync();

        var dto = (await _fallas.ADtoAsync(new List<VehicleImagePoint> { punto }))[0];
        return CreatedAtAction(nameof(GetVehicleImagePoint), new { id = punto.Id },
            ApiResponse<VehicleImagePointDto>.Ok(dto, "Actividad ubicada en la foto"));
    }

    // PUT: api/VehicleImagePoints/5
    // Mueve el punto; si trae ChecklistItemId, también cambia su actividad
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

        var punto = await _db.VehicleImagePoints.Include(p => p.ImageFault).FirstOrDefaultAsync(p => p.Id == id);
        if (punto == null)
        {
            return NotFound(ApiResponse<string>.Error("Punto de imagen no encontrado"));
        }

        if (updateDto.ChecklistItemId is > 0)
        {
            try
            {
                var actividad = await _fallas.ValidarActividadAsync(updateDto.ChecklistItemId, normalizedImageKey);
                punto.ImageFault = await _fallas.FallaDeActividadAsync(actividad);
                punto.ChecklistItemId = actividad.Id;
            }
            catch (ArgumentException ex)
            {
                return BadRequest(ApiResponse<string>.Error(ex.Message));
            }
        }

        punto.ImageKey = normalizedImageKey;
        punto.XPct = updateDto.XPct;
        punto.YPct = updateDto.YPct;
        punto.RadiusPct = updateDto.RadiusPct;
        punto.Active = updateDto.Active;
        punto.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        var dto = (await _fallas.ADtoAsync(new List<VehicleImagePoint> { punto }))[0];
        return Ok(ApiResponse<VehicleImagePointDto>.Ok(dto, "Punto actualizado"));
    }

    /// <summary>
    /// Liga el punto con la actividad del checklist que representa (FV-03: obligatoria; así se corrigen los puntos
    /// anteriores que quedaron "Sin actividad"). Va aparte de mover el punto.
    /// </summary>
    [HttpPut("{id:int}/actividad")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> LigarActividad(int id, [FromBody] VehicleImagePointActividadDto body)
    {
        var punto = await _db.VehicleImagePoints.FindAsync(id);
        if (punto == null) return NotFound(ApiResponse<string>.Error("Punto de imagen no encontrado"));
        try
        {
            var actividad = await _fallas.ValidarActividadAsync(body.ChecklistItemId, punto.ImageKey);
            punto.ImageFault = await _fallas.FallaDeActividadAsync(actividad);
            punto.ChecklistItemId = actividad.Id;
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
        punto.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<int?>.Ok(punto.ChecklistItemId, "Actividad ligada al punto"));
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
