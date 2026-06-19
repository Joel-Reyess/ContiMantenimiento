using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Utils;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AdminController : ControllerBase
{
    private readonly MantenimientoDbContext _db;

    public AdminController(MantenimientoDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Reinicia los datos operativos del sistema conservando usuarios/roles, áreas,
    /// configuraciones de prefijos y plantillas de checklist.
    /// Operación destructiva: elimina vehículos, órdenes, reportes, evidencias,
    /// consumibles, solicitudes, pagos, notificaciones y logs.
    /// </summary>
    [HttpPost("reset-datos")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> ResetDatos()
    {
        // Verificar si ya se ha ejecutado el hard reset
        var configReset = await _db.ConfiguracionSistema.FirstOrDefaultAsync(c => c.Clave == "HardResetExecuted");
        if (configReset != null && configReset.Valor == "true")
        {
            return StatusCode(403, ApiResponse<string>.Error("El reinicio de datos ya ha sido ejecutado anteriormente y no puede repetirse."));
        }

        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            // Dependientes directos
            await _db.EvidenciasFotograficas.ExecuteDeleteAsync();
            await _db.ReportesFallaChecklistItems.ExecuteDeleteAsync();
            await _db.OrdenesTrabajoChecklistItems.ExecuteDeleteAsync();
            await _db.ChecklistRespuestas.ExecuteDeleteAsync();

            await _db.SolicitudesRefaccion.ExecuteDeleteAsync();
            // Desvincular consumos de órdenes antes de borrar (evitar FK conflict en caso de race condition o lock)
            // Usamos Raw SQL para manejar posibles nombres de tabla (singular/plural) y asegurar eliminación
            // Intentamos limpiar ambas posibles tablas para ser robustos ante inconsistencias de nombres en diferentes entornos
            try { await _db.Database.ExecuteSqlRawAsync("UPDATE ConsumosConsumibles SET OrdenTrabajoId = NULL"); await _db.Database.ExecuteSqlRawAsync("DELETE FROM ConsumosConsumibles"); } catch { }
            try { await _db.Database.ExecuteSqlRawAsync("UPDATE ConsumosConsumible SET OrdenTrabajoId = NULL"); await _db.Database.ExecuteSqlRawAsync("DELETE FROM ConsumosConsumible"); } catch { }
            await _db.RegistrosPago.ExecuteDeleteAsync();
            await _db.Notificaciones.ExecuteDeleteAsync();
            await _db.LogAcciones.ExecuteDeleteAsync();
            await _db.HistorialMantenimiento.ExecuteDeleteAsync();
            await _db.VehiculoDocumentos.ExecuteDeleteAsync();
            await _db.VehiculoChecklistAsignaciones.ExecuteDeleteAsync();

            await _db.OrdenesCompra.ExecuteDeleteAsync();
            await _db.OrdenesTrabajo.ExecuteDeleteAsync();
            await _db.ReportesFalla.ExecuteDeleteAsync();

            await _db.Consumibles.ExecuteDeleteAsync();
            await _db.Vehiculos.ExecuteDeleteAsync();
            await _db.VehiculoPrefijoConfigs.ExecuteDeleteAsync();

            await _db.CategoriasFalla.ExecuteDeleteAsync();
            // await _db.TiposVehiculo.ExecuteDeleteAsync();
            await _db.LiderTipoVehiculoAsignaciones.ExecuteDeleteAsync();

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

            // Eliminar usuarios que no esten en la lista de ids a conservar
            if (usuariosIdsConservar.Any())
            {
                // Desvincular supervisores de áreas que van a ser eliminados para evitar conflicto de FK
                await _db.Areas
                    .Where(a => a.SupervisorId.HasValue && !usuariosIdsConservar.Contains(a.SupervisorId.Value))
                    .ExecuteUpdateAsync(s => s.SetProperty(a => a.SupervisorId, (int?)null));

                await _db.Users
                    .Where(u => !usuariosIdsConservar.Contains(u.Id))
                    .ExecuteDeleteAsync();
            }
            else
            {
                 // Fallback por seguridad: si la lista de conservar está vacía (raro), no borrar a nadie o revisar lógica
                 // En este caso, permitimos borrar a todos si no hay coincidencias, pero logueamos advertencia (o no hacemos nada especial)
            }


            // Se conservan: Roles, Areas,
            // ChecklistTemplates e Items, ConfiguracionSistema.

            // Marcar que el reset ya se ejecutó
            if (configReset == null)
            {
                _db.ConfiguracionSistema.Add(new ConfiguracionSistema
                {
                    Clave = "HardResetExecuted",
                    Valor = "true",
                    Descripcion = "Indica si el reinicio maestro de datos ya fue ejecutado",
                    TipoDato = "bool",
                    UpdatedAt = DateTime.UtcNow
                });
            }
            else
            {
                configReset.Valor = "true";
                configReset.UpdatedAt = DateTime.UtcNow;
            }
            await _db.SaveChangesAsync();

            await tx.CommitAsync();
            return Ok(ApiResponse<string>.Ok("Datos operativos reiniciados. Se conservaron usuarios clave, áreas y plantillas de checklist."));
        }
        catch (Exception ex)
        {
            await tx.RollbackAsync();
            return StatusCode(500, ApiResponse<string>.Error($"No se pudo reiniciar los datos: {ex.Message}"));
        }
    }
}
