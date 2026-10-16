using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.Utils;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly MantenimientoDbContext _db;
    private readonly IConfiguration _config;
    private readonly ILogger<AdminController> _logger;
    private readonly EliminacionService _eliminacion;

    public AdminController(MantenimientoDbContext db, IConfiguration config, ILogger<AdminController> logger, EliminacionService eliminacion)
    {
        _db = db;
        _config = config;
        _logger = logger;
        _eliminacion = eliminacion;
    }

    public class ResetDatosRequest
    {
        public string? ClaveMaestra { get; set; }
    }

    /// <summary>
    /// Reinicia los datos operativos del sistema.
    /// Se conservan: usuarios clave (administradores, líderes y la lista fija), roles, áreas, tipos de
    /// vehículo, prefijos, checklists, fallas visuales, categorías de falla, la asignación de líderes de
    /// los usuarios que se quedan y la bitácora (el reinicio mismo queda registrado ahí).
    /// Se eliminan: vehículos, reportes, órdenes, evidencias, inventario, refacciones, pagos, órdenes de
    /// compra, notificaciones, historial y los demás usuarios (técnicos, supervisores, operadores...).
    /// </summary>
    /// <summary>
    /// Bitácora: eliminaciones y reinicios con quién, cuándo y qué (requerimiento 9.3).
    /// Filtros opcionales; las fechas se reciben con zona horaria y se comparan en UTC.
    /// </summary>
    [HttpGet("bitacora")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> GetBitacora(
        [FromQuery] string? accion = null,
        [FromQuery] string? entidad = null,
        [FromQuery] string? busqueda = null,
        [FromQuery] DateTimeOffset? desde = null,
        [FromQuery] DateTimeOffset? hasta = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var query = _db.LogAcciones.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(accion)) query = query.Where(l => l.Accion == accion);
        if (!string.IsNullOrWhiteSpace(entidad)) query = query.Where(l => l.Entidad == entidad);
        if (!string.IsNullOrWhiteSpace(busqueda))
        {
            var texto = busqueda.Trim();
            query = query.Where(l => (l.Descripcion != null && l.Descripcion.Contains(texto))
                || (l.NombreUsuario != null && l.NombreUsuario.Contains(texto)));
        }
        if (desde.HasValue)
        {
            var d = desde.Value.UtcDateTime;
            query = query.Where(l => l.Fecha >= d);
        }
        if (hasta.HasValue)
        {
            var h = hasta.Value.UtcDateTime;
            query = query.Where(l => l.Fecha <= h);
        }

        var total = await query.CountAsync();
        var filas = await query
            .OrderByDescending(l => l.Fecha)
            .ThenByDescending(l => l.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(l => new { l.Id, l.Fecha, l.NombreUsuario, l.Accion, l.Entidad, l.EntidadId, l.Descripcion })
            .ToListAsync();

        var items = filas.Select(l => new BitacoraDto
        {
            Id = l.Id,
            Fecha = DateTime.SpecifyKind(l.Fecha, DateTimeKind.Utc),
            Usuario = l.NombreUsuario,
            Accion = l.Accion,
            Entidad = l.Entidad,
            EntidadId = l.EntidadId,
            Descripcion = l.Descripcion
        }).ToList();

        return Ok(ApiResponse<PaginatedResponse<BitacoraDto>>.Ok(new PaginatedResponse<BitacoraDto>
        {
            Items = items,
            TotalItems = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(total / (double)pageSize)
        }));
    }

    [HttpPost("reset-datos")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> ResetDatos([FromBody] ResetDatosRequest? request)
    {
        // El reinicio puede repetirse, pero siempre exige la clave maestra
        // (appsettings "Seguridad:ClaveMaestraReinicio" o variable de entorno Seguridad__ClaveMaestraReinicio)
        var claveConfigurada = _config["Seguridad:ClaveMaestraReinicio"];
        if (string.IsNullOrWhiteSpace(claveConfigurada))
        {
            return StatusCode(500, ApiResponse<string>.Error("No hay una clave maestra configurada en el servidor (Seguridad:ClaveMaestraReinicio)."));
        }

        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (string.IsNullOrEmpty(request?.ClaveMaestra) || !ClaveCoincide(request.ClaveMaestra, claveConfigurada))
        {
            _logger.LogWarning("Intento de reinicio de datos con clave maestra incorrecta. UsuarioId={UserId}", userIdClaim);
            return StatusCode(403, ApiResponse<string>.Error("Clave maestra incorrecta."));
        }

        _logger.LogWarning("Reinicio de datos autorizado con clave maestra. UsuarioId={UserId}", userIdClaim);

        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            // Para el registro en la bitácora
            var vehiculosAntes = await _db.Vehiculos.CountAsync();
            var reportesAntes = await _db.ReportesFalla.CountAsync();
            var ordenesAntes = await _db.OrdenesTrabajo.CountAsync();

            // Dependientes directos
            await _db.EvidenciasFotograficas.ExecuteDeleteAsync();
            await _db.ReportesFallaChecklistItems.ExecuteDeleteAsync();
            await _db.OrdenesTrabajoChecklistItems.ExecuteDeleteAsync();
            await _db.ChecklistRespuestas.ExecuteDeleteAsync();
            await _db.ReportImageFaults.ExecuteDeleteAsync();

            await _db.SolicitudesRefaccion.ExecuteDeleteAsync();
            await _db.SolicitudesActividadAdicional.ExecuteDeleteAsync();
            // Desvincular consumos de órdenes antes de borrar (evitar FK conflict en caso de race condition o lock)
            // Usamos Raw SQL para manejar posibles nombres de tabla (singular/plural) y asegurar eliminación
            // Intentamos limpiar ambas posibles tablas para ser robustos ante inconsistencias de nombres en diferentes entornos
            try { await _db.Database.ExecuteSqlRawAsync("UPDATE ConsumosConsumibles SET OrdenTrabajoId = NULL"); await _db.Database.ExecuteSqlRawAsync("DELETE FROM ConsumosConsumibles"); } catch { }
            try { await _db.Database.ExecuteSqlRawAsync("UPDATE ConsumosConsumible SET OrdenTrabajoId = NULL"); await _db.Database.ExecuteSqlRawAsync("DELETE FROM ConsumosConsumible"); } catch { }
            await _db.RegistrosPago.ExecuteDeleteAsync();
            await _db.Notificaciones.ExecuteDeleteAsync();
            await _db.HistorialMantenimiento.ExecuteDeleteAsync();
            await _db.VehiculoDocumentos.ExecuteDeleteAsync();
            await _db.VehiculoChecklistAsignaciones.ExecuteDeleteAsync();

            await _db.OrdenesCompra.ExecuteDeleteAsync();
            await _db.OrdenesTrabajo.ExecuteDeleteAsync();
            await _db.ReportesFalla.ExecuteDeleteAsync();

            await _db.Consumibles.ExecuteDeleteAsync();
            // SolicitudCambios apunta a Vehiculos y Users sin cascada
            await _db.SolicitudesCambio.ExecuteDeleteAsync();
            await _db.Vehiculos.ExecuteDeleteAsync();
            // Los prefijos, categorías de falla, tipos, checklists y fallas visuales son configuración:
            // se conservan (antes se borraban prefijos y categorías aunque la pantalla decía otra cosa)

            // Lista de usuarios a conservar por username
            var usuariosConservar = new List<string>
            {
                "aojeda", "eparedes", "mmartinez", "agalvez", "asierra", "hborges", "eflores", "msalinas"
            };

            // Roles a conservar
            var rolesConservar = new List<string> { "Administrador", "SuperUsuario", "Lider", "Tecnico_demo" };

            // Obtener usuarios que NO deben ser borrados
            var usuariosIdsConservar = await _db.Users
                .Include(u => u.Roles)
                .Where(u => usuariosConservar.Contains(u.Username) || u.Roles.Any(r => rolesConservar.Contains(r.Nombre)))
                .Select(u => u.Id)
                .ToListAsync();

            var usuariosEliminados = 0;
            // Si no se encontró a nadie que conservar no se borra ningún usuario (sería quedarse sin acceso)
            if (usuariosIdsConservar.Any())
            {
                // Quitar las referencias de los usuarios que se van (varias FKs son NO ACTION)
                await _db.Areas
                    .Where(a => a.SupervisorId.HasValue && !usuariosIdsConservar.Contains(a.SupervisorId.Value))
                    .ExecuteUpdateAsync(s => s.SetProperty(a => a.SupervisorId, (int?)null));
                await _db.TiposVehiculo
                    .Where(t => t.ProveedorId.HasValue && !usuariosIdsConservar.Contains(t.ProveedorId.Value))
                    .ExecuteUpdateAsync(s => s.SetProperty(t => t.ProveedorId, (int?)null));
                // La bitácora se conserva: guarda el nombre, solo se suelta la referencia
                await _db.LogAcciones
                    .Where(l => l.UsuarioId.HasValue && !usuariosIdsConservar.Contains(l.UsuarioId.Value))
                    .ExecuteUpdateAsync(s => s.SetProperty(l => l.UsuarioId, (int?)null));
                await _db.LiderTipoVehiculoAsignaciones
                    .Where(l => !usuariosIdsConservar.Contains(l.UsuarioId))
                    .ExecuteDeleteAsync();
                if (await TablaExisteAsync("MetasTecnico"))
                    await _db.MetasTecnico.Where(m => !usuariosIdsConservar.Contains(m.UsuarioId)).ExecuteDeleteAsync();
                // Relación usuario-rol (por si la BD no la tiene en cascada); los ids son enteros de la BD
                await _db.Database.ExecuteSqlRawAsync(
                    $"DELETE FROM UserRoles WHERE UserId NOT IN ({string.Join(",", usuariosIdsConservar)})");

                usuariosEliminados = await _db.Users
                    .Where(u => !usuariosIdsConservar.Contains(u.Id))
                    .ExecuteDeleteAsync();
            }

            // Se conservan: Roles, Areas, TiposVehiculo, VehiculoPrefijoConfigs, ChecklistTemplates e Items,
            // ImageFaults, VehicleImagePoints, CategoriasFalla y LogAcciones.
            _eliminacion.Registrar(User.UsuarioId(), User.NombreUsuario(), "Sistema", null,
                $"Reinicio de datos: {vehiculosAntes} vehículo(s), {reportesAntes} reporte(s), {ordenesAntes} orden(es) " +
                $"y {usuariosEliminados} usuario(s) eliminados", accion: "Reiniciar");
            await _db.SaveChangesAsync();

            await tx.CommitAsync();

            // Queda en el log de Serilog (Logs/mantenimiento-*.log), que no se borra con el reinicio.
            // No se usa ConfiguracionSistema porque ningún script crea esa tabla y no existe en todas las BD.
            _logger.LogWarning("Reinicio de datos completado. UsuarioId={UserId}", userIdClaim);
            return Ok(ApiResponse<string>.Ok("Datos operativos reiniciados. Se conservó la configuración (usuarios clave, áreas, tipos, prefijos, checklists y fallas visuales) y la bitácora."));
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            return StatusCode(500, ApiResponse<string>.Error($"No se pudo reiniciar los datos: {ex.Message}"));
        }
    }

    private static bool ClaveCoincide(string recibida, string esperada)
    {
        var a = SHA256.HashData(Encoding.UTF8.GetBytes(recibida));
        var b = SHA256.HashData(Encoding.UTF8.GetBytes(esperada));
        return CryptographicOperations.FixedTimeEquals(a, b);
    }

    private async Task<bool> TablaExisteAsync(string nombre) =>
        await _db.Database.SqlQuery<int>($"SELECT COUNT(*) AS Value FROM sys.tables WHERE name = {nombre}").SingleAsync() > 0;
}
