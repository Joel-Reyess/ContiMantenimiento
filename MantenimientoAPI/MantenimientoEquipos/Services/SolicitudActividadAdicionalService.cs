using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;

namespace MantenimientoEquipos.Services;

public class SolicitudActividadAdicionalService
{
    private readonly MantenimientoDbContext _db;
    private readonly NotificacionService _notificacionService;

    public SolicitudActividadAdicionalService(MantenimientoDbContext db, NotificacionService notificacionService)
    {
        _db = db;
        _notificacionService = notificacionService;
    }

    public async Task<List<SolicitudActividadAdicionalDto>> GetAllAsync(string? estado = null, int? ordenTrabajoId = null)
    {
        var query = _db.SolicitudesActividadAdicional
            .Include(s => s.OrdenTrabajo)
            .Include(s => s.SolicitadoPor)
            .Include(s => s.AprobadoPor)
            .AsQueryable();

        if (!string.IsNullOrEmpty(estado))
            query = query.Where(s => s.Estado == estado);

        if (ordenTrabajoId.HasValue)
            query = query.Where(s => s.OrdenTrabajoId == ordenTrabajoId.Value);

        return await query
            .OrderByDescending(s => s.FechaSolicitud)
            .Select(s => new SolicitudActividadAdicionalDto
            {
                Id = s.Id,
                OrdenTrabajoId = s.OrdenTrabajoId,
                OrdenTrabajoFolio = s.OrdenTrabajo.Folio,
                Descripcion = s.Descripcion,
                Justificacion = s.Justificacion,
                Estado = s.Estado,
                SolicitadoPorId = s.SolicitadoPorId,
                SolicitadoPorNombre = s.SolicitadoPor != null ? s.SolicitadoPor.NombreCompleto : null,
                AprobadoPorNombre = s.AprobadoPor != null ? s.AprobadoPor.NombreCompleto : null,
                FechaSolicitud = s.FechaSolicitud,
                FechaRespuesta = s.FechaRespuesta,
                ComentariosResolucion = s.ComentariosResolucion,
                FotoUrl = s.FotoUrl
            }).ToListAsync();
    }

    public async Task<SolicitudActividadAdicionalDto?> GetByIdAsync(int id)
    {
        return await _db.SolicitudesActividadAdicional
            .Include(s => s.OrdenTrabajo)
            .Include(s => s.SolicitadoPor)
            .Include(s => s.AprobadoPor)
            .Where(s => s.Id == id)
            .Select(s => new SolicitudActividadAdicionalDto
            {
                Id = s.Id,
                OrdenTrabajoId = s.OrdenTrabajoId,
                OrdenTrabajoFolio = s.OrdenTrabajo.Folio,
                Descripcion = s.Descripcion,
                Justificacion = s.Justificacion,
                Estado = s.Estado,
                SolicitadoPorId = s.SolicitadoPorId,
                SolicitadoPorNombre = s.SolicitadoPor != null ? s.SolicitadoPor.NombreCompleto : null,
                AprobadoPorNombre = s.AprobadoPor != null ? s.AprobadoPor.NombreCompleto : null,
                FechaSolicitud = s.FechaSolicitud,
                FechaRespuesta = s.FechaRespuesta,
                ComentariosResolucion = s.ComentariosResolucion,
                FotoUrl = s.FotoUrl
            }).FirstOrDefaultAsync();
    }

    public async Task<SolicitudActividadAdicional> CreateAsync(CreateSolicitudActividadAdicionalDto request, int userId)
    {
        var orden = await _db.OrdenesTrabajo.FirstOrDefaultAsync(o => o.Id == request.OrdenTrabajoId);
        if (orden == null) throw new ArgumentException("Orden de trabajo no encontrada");

        // Solo el técnico asignado o un rol superior puede solicitar actividades
        var usuario = await _db.Users
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Id == userId);
        
        var esTecnico = (usuario?.Roles.Any(r => r.Nombre.ToLower().Contains("tecnic")) ?? false);
        var esAdminOSuper = (usuario?.Roles.Any(r => 
            r.Nombre.ToLower().Contains("admin") || 
            r.Nombre.ToLower().Contains("super") || 
            r.Nombre.ToLower().Contains("lider")) ?? false);

        if (esTecnico && !esAdminOSuper && orden.TecnicoAsignadoId.HasValue && orden.TecnicoAsignadoId != userId)
        {
            throw new ArgumentException("Solo el técnico asignado puede solicitar actividades adicionales para esta orden");
        }

        var solicitud = new SolicitudActividadAdicional
        {
            OrdenTrabajoId = request.OrdenTrabajoId,
            Descripcion = request.Descripcion,
            Justificacion = request.Justificacion,
            SolicitadoPorId = userId,
            Estado = "Pendiente",
            FechaSolicitud = DateTime.UtcNow,
            FotoUrl = request.FotoUrl
        };

        _db.SolicitudesActividadAdicional.Add(solicitud);
        await _db.SaveChangesAsync();

        // Notificar a supervisores
        var ordenNotif = await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
                .ThenInclude(v => v.Area)
            .FirstOrDefaultAsync(o => o.Id == request.OrdenTrabajoId);

        if (ordenNotif?.Vehiculo?.Area?.SupervisorId != null)
        {
            await _notificacionService.CrearNotificacionAsync(
                ordenNotif.Vehiculo.Area.SupervisorId.Value,
                TipoNotificacionEnum.SistemaGeneral,
                "Nueva Solicitud de Actividad Adicional",
                $"Se ha solicitado una actividad adicional: {request.Descripcion} para orden {ordenNotif.Folio}",
                solicitud.Id,
                "SolicitudActividadAdicional");
        }

        return solicitud;
    }

    public async Task<bool> ResponderAsync(int id, int userId, bool aprobado, string? comentarios = null)
    {
        var solicitud = await _db.SolicitudesActividadAdicional.FindAsync(id);
        if (solicitud == null || solicitud.Estado != "Pendiente") return false;

        solicitud.Estado = aprobado ? "Aprobada" : "Rechazada";
        solicitud.AprobadoPorId = userId;
        solicitud.FechaRespuesta = DateTime.UtcNow;
        solicitud.ComentariosResolucion = comentarios;

        await _db.SaveChangesAsync();

        // Notificar al solicitante
        await _notificacionService.CrearNotificacionAsync(
            solicitud.SolicitadoPorId,
            TipoNotificacionEnum.SistemaGeneral,
            aprobado ? "Actividad Adicional Aprobada" : "Actividad Adicional Rechazada",
            $"Tu solicitud de actividad '{solicitud.Descripcion}' ha sido {(aprobado ? "aprobada" : "rechazada")}",
            solicitud.Id,
            "SolicitudActividadAdicional");

        return true;
    }
}
