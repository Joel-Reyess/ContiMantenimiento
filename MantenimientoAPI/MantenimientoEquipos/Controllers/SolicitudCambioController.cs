using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.DTOs;
using System.Security.Claims;

namespace MantenimientoEquipos.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SolicitudCambioController : ControllerBase
    {
        private readonly MantenimientoDbContext _context;

        public SolicitudCambioController(MantenimientoDbContext context)
        {
            _context = context;
        }

        private int GetUserId()
        {
            var identity = HttpContext.User.Identity as ClaimsIdentity;
            var idClaim = identity?.FindFirst(ClaimTypes.NameIdentifier) ?? identity?.FindFirst("id");
            if (idClaim != null && int.TryParse(idClaim.Value, out int userId))
            {
                return userId;
            }
            return 0; // Fallback or throw
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<IEnumerable<SolicitudCambioDto>>>> GetAll([FromQuery] int? vehiculoId = null)
        {
            var query = _context.SolicitudesCambio
                .Include(s => s.Vehiculo)
                .Include(s => s.SolicitadoPor)
                .Include(s => s.AprobadoPor)
                .AsQueryable();

            if (vehiculoId.HasValue)
            {
                query = query.Where(s => s.VehiculoId == vehiculoId.Value);
            }

            var list = await query.OrderByDescending(s => s.FechaSolicitud).ToListAsync();

            var dtos = list.Select(s => new SolicitudCambioDto
            {
                Id = s.Id,
                VehiculoId = s.VehiculoId,
                VehiculoCodigo = s.Vehiculo.Codigo,
                Descripcion = s.Descripcion,
                Estado = s.Estado,
                SolicitadoPorId = s.SolicitadoPorId,
                SolicitadoPorNombre = s.SolicitadoPor.NombreCompleto,
                FechaSolicitud = s.FechaSolicitud,
                AprobadoPorId = s.AprobadoPorId,
                AprobadoPorNombre = s.AprobadoPor?.NombreCompleto,
                FechaRespuesta = s.FechaRespuesta,
                ComentariosRespuesta = s.ComentariosRespuesta
            });

            return Ok(ApiResponse<IEnumerable<SolicitudCambioDto>>.Ok(dtos));
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<SolicitudCambioDto>>> Create(CreateSolicitudCambioDto dto)
        {
            var userId = GetUserId();
            if (userId == 0) return Unauthorized();

            var solicitud = new SolicitudCambio
            {
                VehiculoId = dto.VehiculoId,
                Descripcion = dto.Descripcion,
                Estado = 0, // Pendiente
                SolicitadoPorId = userId,
                FechaSolicitud = DateTime.UtcNow
            };

            _context.SolicitudesCambio.Add(solicitud);
            await _context.SaveChangesAsync();

            // Reload for includes
            var saved = await _context.SolicitudesCambio
                .Include(s => s.Vehiculo)
                .Include(s => s.SolicitadoPor)
                .FirstOrDefaultAsync(s => s.Id == solicitud.Id);

            var result = new SolicitudCambioDto
            {
                Id = saved!.Id,
                VehiculoId = saved.VehiculoId,
                VehiculoCodigo = saved.Vehiculo.Codigo,
                Descripcion = saved.Descripcion,
                Estado = saved.Estado,
                SolicitadoPorId = saved.SolicitadoPorId,
                SolicitadoPorNombre = saved.SolicitadoPor.NombreCompleto,
                FechaSolicitud = saved.FechaSolicitud
            };

            return Ok(ApiResponse<SolicitudCambioDto>.Ok(result, "Solicitud creada"));
        }

        [HttpPost("responder")]
        public async Task<ActionResult<ApiResponse<bool>>> Responder(AprobarSolicitudCambioDto dto)
        {
            var userId = GetUserId();
            if (userId == 0) return Unauthorized();

            var solicitud = await _context.SolicitudesCambio.FindAsync(dto.Id);
            if (solicitud == null) return NotFound(ApiResponse<bool>.Error("Solicitud no encontrada"));

            if (solicitud.Estado != 0)
                return BadRequest(ApiResponse<bool>.Error("La solicitud ya fue respondida"));

            solicitud.Estado = dto.Aprobado ? 1 : 2;
            solicitud.AprobadoPorId = userId;
            solicitud.FechaRespuesta = DateTime.UtcNow;
            solicitud.ComentariosRespuesta = dto.Comentarios;

            await _context.SaveChangesAsync();

            return Ok(ApiResponse<bool>.Ok(true, dto.Aprobado ? "Solicitud aprobada" : "Solicitud rechazada"));
        }
    }
}
