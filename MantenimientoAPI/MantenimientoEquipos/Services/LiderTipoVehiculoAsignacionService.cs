using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models.Enums;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace MantenimientoEquipos.Services
{
    public class LiderTipoVehiculoAsignacionService
    {
        private readonly MantenimientoDbContext _db;

        public LiderTipoVehiculoAsignacionService(MantenimientoDbContext db)
        {
            _db = db;
        }

        public async Task<List<LiderTipoVehiculoAsignacionDto>> GetAllAsync()
        {
            return await _db.LiderTipoVehiculoAsignaciones
                .Include(x => x.Usuario)
                .Select(x => new LiderTipoVehiculoAsignacionDto
                {
                    Id = x.Id,
                    UsuarioId = x.UsuarioId,
                    UsuarioNombre = x.Usuario.NombreCompleto,
                    TipoVehiculo = x.TipoVehiculo,
                    TipoVehiculoNombre = x.TipoVehiculo.ToString(),
                    CreatedAt = x.CreatedAt
                })
                .ToListAsync();
        }

        public async Task<List<LiderTipoVehiculoAsignacionDto>> GetByUsuarioIdAsync(int usuarioId)
        {
            return await _db.LiderTipoVehiculoAsignaciones
                .Include(x => x.Usuario)
                .Where(x => x.UsuarioId == usuarioId)
                .Select(x => new LiderTipoVehiculoAsignacionDto
                {
                    Id = x.Id,
                    UsuarioId = x.UsuarioId,
                    UsuarioNombre = x.Usuario.NombreCompleto,
                    TipoVehiculo = x.TipoVehiculo,
                    TipoVehiculoNombre = x.TipoVehiculo.ToString(),
                    CreatedAt = x.CreatedAt
                })
                .ToListAsync();
        }

        public async Task<LiderTipoVehiculoAsignacionDto> CreateAsync(CreateLiderTipoVehiculoAsignacionRequest request)
        {
            var usuario = await _db.Users.FindAsync(request.UsuarioId);
            if (usuario == null)
                throw new ArgumentException("El usuario no existe");

            var exists = await _db.LiderTipoVehiculoAsignaciones
                .AnyAsync(x => x.UsuarioId == request.UsuarioId && x.TipoVehiculo == request.TipoVehiculo);

            if (exists)
                throw new ArgumentException("Este tipo de vehículo ya está asignado a este usuario");

            var entity = new LiderTipoVehiculoAsignacion
            {
                UsuarioId = request.UsuarioId,
                TipoVehiculo = request.TipoVehiculo
            };

            _db.LiderTipoVehiculoAsignaciones.Add(entity);
            await _db.SaveChangesAsync();

            return new LiderTipoVehiculoAsignacionDto
            {
                Id = entity.Id,
                UsuarioId = entity.UsuarioId,
                UsuarioNombre = usuario.NombreCompleto,
                TipoVehiculo = entity.TipoVehiculo,
                TipoVehiculoNombre = entity.TipoVehiculo.ToString(),
                CreatedAt = entity.CreatedAt
            };
        }

        public async Task<List<LiderTipoVehiculoAsignacionDto>> CreateAsignacionesAsync(List<CreateLiderTipoVehiculoAsignacionRequest> requests)
        {
            var nuevasAsignaciones = new List<LiderTipoVehiculoAsignacion>();
            var resultado = new List<LiderTipoVehiculoAsignacionDto>();
            var primerUsuarioId = requests.FirstOrDefault()?.UsuarioId;

            if (primerUsuarioId == null)
            {
                throw new ArgumentException("La lista de solicitudes está vacía o el UsuarioId no está presente.");
            }

            var usuario = await _db.Users.FindAsync(primerUsuarioId);
            if (usuario == null)
            {
                throw new ArgumentException("El usuario no existe");
            }

            var tiposDeVehiculoExistentes = await _db.LiderTipoVehiculoAsignaciones
                .Where(a => a.UsuarioId == primerUsuarioId)
                .Select(a => a.TipoVehiculo)
                .ToListAsync();

            var tiposDeVehiculoParaAgregar = requests
                .Select(r => r.TipoVehiculo)
                .Distinct()
                .Except(tiposDeVehiculoExistentes)
                .ToList();

            foreach (var tipoVehiculo in tiposDeVehiculoParaAgregar)
            {
                nuevasAsignaciones.Add(new LiderTipoVehiculoAsignacion
                {
                    UsuarioId = primerUsuarioId.Value,
                    TipoVehiculo = tipoVehiculo
                });
            }

            if (nuevasAsignaciones.Any())
            {
                _db.LiderTipoVehiculoAsignaciones.AddRange(nuevasAsignaciones);
                await _db.SaveChangesAsync();
            }

            var asignacionesActuales = await _db.LiderTipoVehiculoAsignaciones
                .Include(a => a.Usuario)
                .Where(a => a.UsuarioId == primerUsuarioId)
                .Select(a => new LiderTipoVehiculoAsignacionDto
                {
                    Id = a.Id,
                    UsuarioId = a.UsuarioId,
                    UsuarioNombre = a.Usuario.NombreCompleto,
                    TipoVehiculo = a.TipoVehiculo,
                    TipoVehiculoNombre = a.TipoVehiculo.ToString(),
                    CreatedAt = a.CreatedAt
                })
                .ToListAsync();

            return asignacionesActuales;
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var entity = await _db.LiderTipoVehiculoAsignaciones.FindAsync(id);
            if (entity == null)
                return false;

            _db.LiderTipoVehiculoAsignaciones.Remove(entity);
            await _db.SaveChangesAsync();
            return true;
        }
    }
}
