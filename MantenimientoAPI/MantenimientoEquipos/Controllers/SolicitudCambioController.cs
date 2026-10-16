using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.Utils;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.Middlewares;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.DTOs;
using System.Security.Claims;

namespace MantenimientoEquipos.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/[controller]")]
    public class SolicitudCambioController : ControllerBase
    {
        private readonly MantenimientoDbContext _context;
        private readonly EliminacionService _eliminacion;

        public SolicitudCambioController(MantenimientoDbContext context, EliminacionService eliminacion)
        {
            _context = context;
            _eliminacion = eliminacion;
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

        /// <summary>Elimina una solicitud de cambio de un vehículo. Solo administradores; queda en la bitácora.</summary>
        [HttpDelete("{id:int}")]
        [RolesAllowed("SuperUsuario", "Administrador")]
        public async Task<IActionResult> Delete(int id)
        {
            var mensaje = await _eliminacion.EliminarSolicitudCambioAsync(id, User.UsuarioId(), User.NombreUsuario());
            if (mensaje == null) return NotFound(ApiResponse<string>.Error("Solicitud no encontrada"));
            return Ok(ApiResponse<string>.Ok(mensaje, mensaje));
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
        [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
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
