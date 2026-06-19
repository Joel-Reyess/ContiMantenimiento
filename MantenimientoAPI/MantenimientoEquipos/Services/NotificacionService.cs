using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;

namespace MantenimientoEquipos.Services;

public class NotificacionService
{
    private readonly MantenimientoDbContext _db;

    public NotificacionService(MantenimientoDbContext db)
    {
        _db = db;
    }

    private async Task<List<int>> ObtenerUsuariosPorRolAsync(params string[] roles)
    {
        if (roles == null || roles.Length == 0) return new List<int>();

        var lower = roles.Select(r => r.ToLower()).ToList();
        return await _db.Users
            .Include(u => u.Roles)
            .Where(u => u.Roles.Any(r => lower.Any(l => r.Nombre.ToLower().Contains(l))))
            .Select(u => u.Id)
            .ToListAsync();
    }

    private async Task CrearNotificacionesAsync(
        IEnumerable<int> usuarioIds,
        TipoNotificacionEnum tipo,
        string titulo,
        string mensaje,
        int? referenciaId = null,
        string? tipoReferencia = null,
        string? urlDestino = null)
    {
        var ids = usuarioIds?.Distinct().ToList() ?? new List<int>();
        if (!ids.Any()) return;

        var ahora = DateTime.UtcNow;
        var notificaciones = ids.Select(id => new Notificacion
        {
            UsuarioId = id,
            Tipo = tipo,
            Titulo = titulo,
            Mensaje = mensaje,
            ReferenciaId = referenciaId,
            TipoReferencia = tipoReferencia,
            UrlDestino = urlDestino,
            FechaCreacion = ahora
        });

        _db.Notificaciones.AddRange(notificaciones);
        await _db.SaveChangesAsync();
    }

    public async Task<NotificacionesResumenDto> GetResumenAsync(int userId)
    {
        var totalNoLeidas = await _db.Notificaciones
            .Where(n => n.UsuarioId == userId && !n.Leida)
            .CountAsync();

        var recientes = await _db.Notificaciones
            .Where(n => n.UsuarioId == userId)
            .OrderByDescending(n => n.FechaCreacion)
            .Take(10)
            .Select(n => new NotificacionDto
            {
                Id = n.Id,
                Tipo = n.Tipo,
                TipoNombre = n.Tipo.ToString(),
                Titulo = n.Titulo,
                Mensaje = n.Mensaje,
                UrlDestino = n.UrlDestino,
                ReferenciaId = n.ReferenciaId,
                TipoReferencia = n.TipoReferencia,
                Leida = n.Leida,
                FechaLectura = n.FechaLectura,
                FechaCreacion = n.FechaCreacion
            }).ToListAsync();

        return new NotificacionesResumenDto
        {
            TotalNoLeidas = totalNoLeidas,
            NotificacionesRecientes = recientes
        };
    }

    public async Task<List<NotificacionDto>> GetAllAsync(int userId, bool? soloNoLeidas = null)
    {
        var query = _db.Notificaciones.Where(n => n.UsuarioId == userId);

        if (soloNoLeidas == true)
            query = query.Where(n => !n.Leida);

        return await query
            .OrderByDescending(n => n.FechaCreacion)
            .Select(n => new NotificacionDto
            {
                Id = n.Id,
                Tipo = n.Tipo,
                TipoNombre = n.Tipo.ToString(),
                Titulo = n.Titulo,
                Mensaje = n.Mensaje,
                UrlDestino = n.UrlDestino,
                ReferenciaId = n.ReferenciaId,
                TipoReferencia = n.TipoReferencia,
                Leida = n.Leida,
                FechaLectura = n.FechaLectura,
                FechaCreacion = n.FechaCreacion
            }).ToListAsync();
    }

    public async Task MarcarComoLeidasAsync(int userId, List<int> notificacionIds)
    {
        var notificaciones = await _db.Notificaciones
            .Where(n => n.UsuarioId == userId && notificacionIds.Contains(n.Id) && !n.Leida)
            .ToListAsync();

        foreach (var n in notificaciones)
        {
            n.Leida = true;
            n.FechaLectura = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
    }

    public async Task MarcarTodasComoLeidasAsync(int userId)
    {
        var notificaciones = await _db.Notificaciones
            .Where(n => n.UsuarioId == userId && !n.Leida)
            .ToListAsync();

        foreach (var n in notificaciones)
        {
            n.Leida = true;
            n.FechaLectura = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
    }

    public async Task CrearNotificacionAsync(
        int usuarioId,
        TipoNotificacionEnum tipo,
        string titulo,
        string mensaje,
        int? referenciaId = null,
        string? tipoReferencia = null,
        string? urlDestino = null)
    {
        var notificacion = new Notificacion
        {
            UsuarioId = usuarioId,
            Tipo = tipo,
            Titulo = titulo,
            Mensaje = mensaje,
            ReferenciaId = referenciaId,
            TipoReferencia = tipoReferencia,
            UrlDestino = urlDestino,
            FechaCreacion = DateTime.UtcNow
        };

        _db.Notificaciones.Add(notificacion);
        await _db.SaveChangesAsync();
    }

    public async Task CrearNotificacionRolesAsync(
        TipoNotificacionEnum tipo,
        string titulo,
        string mensaje,
        string[] roles,
        int? referenciaId = null,
        string? tipoReferencia = null,
        string? urlDestino = null)
    {
        var usuarios = await ObtenerUsuariosPorRolAsync(roles);
        await CrearNotificacionesAsync(usuarios, tipo, titulo, mensaje, referenciaId, tipoReferencia, urlDestino);
    }

    public async Task NotificarNuevoReporteAsync(int supervisorId, string folio, int vehiculoId)
    {
        await CrearNotificacionAsync(
            supervisorId,
            TipoNotificacionEnum.NuevoReporte,
            "Nuevo reporte de falla",
            $"Se ha registrado el reporte {folio}",
            vehiculoId,
            "ReporteFalla",
            $"/reportes/{folio}"
        );
    }

    public async Task NotificarNuevaOrdenAsync(string folio, int ordenId, string? vehiculoCodigo = null)
    {
        var mensaje = $"Se genera la orden {folio}" + (string.IsNullOrWhiteSpace(vehiculoCodigo) ? string.Empty : $" para {vehiculoCodigo}");
        await CrearNotificacionRolesAsync(
            TipoNotificacionEnum.OrdenActualizada,
            "Nueva orden de trabajo",
            mensaje,
            new[] { "superusuario", "administrador", "supervisor" },
            ordenId,
            "OrdenTrabajo",
            $"/ordenes/{ordenId}"
        );
    }

    public async Task NotificarOrdenDisponibleATecnicosAsync(string folio, int ordenId, string? vehiculoCodigo = null)
    {
        var mensaje = $"Nueva orden disponible {folio}" + (string.IsNullOrWhiteSpace(vehiculoCodigo) ? string.Empty : $" ({vehiculoCodigo})");
        await CrearNotificacionRolesAsync(
            TipoNotificacionEnum.OrdenActualizada,
            "Orden pendiente de asignar",
            mensaje,
            new[] { "tecnico" },
            ordenId,
            "OrdenTrabajo",
            $"/ordenes/{ordenId}"
        );
    }

    public async Task NotificarOrdenAsignadaAsync(int tecnicoId, string folio, int ordenId)
    {
        await CrearNotificacionAsync(
            tecnicoId,
            TipoNotificacionEnum.OrdenAsignada,
            "Orden de trabajo asignada",
            $"Se te ha asignado la orden {folio}",
            ordenId,
            "OrdenTrabajo",
            $"/ordenes/{ordenId}"
        );
    }

    public async Task NotificarOrdenListaParaEntregaAsync(string folio, int ordenId, string? vehiculoCodigo = null)
    {
        var mensaje = $"La orden {folio}" + (string.IsNullOrWhiteSpace(vehiculoCodigo) ? string.Empty : $" ({vehiculoCodigo})") + " estК lista para entrega.";
        await CrearNotificacionRolesAsync(
            TipoNotificacionEnum.OrdenActualizada,
            "Orden lista para entrega",
            mensaje,
            new[] { "lider", "supervisor", "administrador", "superusuario" },
            ordenId,
            "OrdenTrabajo",
            $"/ordenes/{ordenId}"
        );
    }

    public async Task NotificarEntregaRecibidaAsync(string folio, int ordenId, string? vehiculoCodigo = null)
    {
        var mensaje = $"El lider registra la entrega de {folio}" + (string.IsNullOrWhiteSpace(vehiculoCodigo) ? string.Empty : $" ({vehiculoCodigo})");
        await CrearNotificacionRolesAsync(
            TipoNotificacionEnum.OrdenActualizada,
            "Entrega registrada por lider",
            mensaje,
            new[] { "supervisor", "administrador", "superusuario" },
            ordenId,
            "OrdenTrabajo",
            $"/ordenes/{ordenId}"
        );
    }

    public async Task EliminarAsync(int userId, int notificacionId)
    {
        var notif = await _db.Notificaciones
            .FirstOrDefaultAsync(n => n.UsuarioId == userId && n.Id == notificacionId);
        if (notif == null) return;

        _db.Notificaciones.Remove(notif);
        await _db.SaveChangesAsync();
    }
}
