using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using System.Security.Claims;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "SuperUsuario,Administrador,Supervisor,Tecnico")]
public class RecepcionController : ControllerBase
{
    private readonly MantenimientoDbContext _db;

    public RecepcionController(MantenimientoDbContext db)
    {
        _db = db;
    }

    private int? GetUserId() => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    [HttpGet("pendientes")]
    public async Task<IActionResult> GetPendientes()
    {
        var pendientes = await _db.ReportesFalla
            .Include(r => r.Vehiculo)
            .Include(r => r.ItemsChecklist)
                .ThenInclude(ic => ic.ChecklistItem)
            .Where(r => !r.TieneOrdenTrabajo && !_db.OrdenesTrabajo.Any(o => o.ReporteFallaId == r.Id))
            .OrderBy(r => r.FechaReporte)
            .Select(r => new
            {
                r.Id,
                r.Folio,
                r.Descripcion,
                r.FechaReporte,
                r.VehiculoId,
                VehiculoCodigo = r.Vehiculo.Codigo,
                VehiculoTipo = r.Vehiculo.Tipo.ToString(),
                ItemsChecklist = r.ItemsChecklist
                    .Select(ic => new {
                        ic.ChecklistItemId,
                        Pregunta = ic.ChecklistItem.Pregunta,
                        ic.Estado,
                        ic.Cantidad
                    }).ToList()
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(pendientes));
    }

    [HttpPost("{reporteId}/check-in")]
    public async Task<IActionResult> CheckIn(int reporteId, [FromBody] CheckInRequest request, [FromQuery] bool force = false)
    {
        var reporte = await _db.ReportesFalla
            .Include(r => r.Vehiculo)
            .FirstOrDefaultAsync(r => r.Id == reporteId);
        if (reporte == null) return NotFound(ApiResponse<string>.Error("Reporte no encontrado"));

        var userId = GetUserId() ?? 0;

        // Validar si ya hay una orden activa para este vehículo (que no sea la de este reporte si ya existe)
        var ordenActiva = await _db.OrdenesTrabajo
            .Where(o => o.VehiculoId == reporte.VehiculoId &&
                        o.ReporteFallaId != reporteId &&
                        (o.Estado == EstadoOrdenTrabajoEnum.Pendiente ||
                         o.Estado == EstadoOrdenTrabajoEnum.Asignada ||
                         o.Estado == EstadoOrdenTrabajoEnum.EnProceso))
            .FirstOrDefaultAsync();

        if (ordenActiva != null && !force)
        {
            return Conflict(ApiResponse<string>.Error(
                $"El vehículo {reporte.Vehiculo.Codigo} ya tiene una orden de trabajo activa: {ordenActiva.Folio}",
                "DuplicateActiveOrder",
                new { ExistingOrderFolio = ordenActiva.Folio, ExistingOrderId = ordenActiva.Id }));
        }

        // Crear orden si no existe
        OrdenTrabajo? orden = await _db.OrdenesTrabajo.FirstOrDefaultAsync(o => o.ReporteFallaId == reporteId);
        if (orden == null)
        {
            orden = new OrdenTrabajo
            {
                Folio = $"OT-{DateTime.UtcNow:yyyyMMddHHmmss}",
                ReporteFallaId = reporteId,
                VehiculoId = reporte.VehiculoId,
                CreadoPorId = userId,
                Estado = request.TecnicoId.HasValue ? EstadoOrdenTrabajoEnum.Asignada : EstadoOrdenTrabajoEnum.EnProceso,
                Prioridad = PrioridadEnum.PuedeCircular,
                TipoMantenimiento = reporte.TipoMantenimiento ?? "Correctivo",
                Descripcion = $"Recepción de reporte {reporte.Folio}: {reporte.Descripcion}",
                CreatedAt = DateTime.UtcNow
            };
            _db.OrdenesTrabajo.Add(orden);
            await _db.SaveChangesAsync(); // Guardar para obtener el ID de la orden

            // Copiar ítems del checklist del reporte a la nueva orden
            var reportWithItems = await _db.ReportesFalla
                .Include(r => r.ItemsChecklist)
                .FirstOrDefaultAsync(r => r.Id == reporteId);

            if (reportWithItems?.ItemsChecklist != null && reportWithItems.ItemsChecklist.Any())
            {
                var itemsOrden = reportWithItems.ItemsChecklist.Select(ri => new OrdenTrabajoChecklistItem
                {
                    OrdenTrabajoId = orden.Id,
                    ChecklistItemId = ri.ChecklistItemId,
                    FechaAsignacion = DateTime.UtcNow,
                    Estado = "Pendiente",
                    Cantidad = ri.Cantidad,
                    Notas = ri.Notas
                }).ToList();

                _db.OrdenesTrabajoChecklistItems.AddRange(itemsOrden);
            }
        }
        else
        {
            orden.Estado = request.TecnicoId.HasValue ? EstadoOrdenTrabajoEnum.Asignada : EstadoOrdenTrabajoEnum.EnProceso;
        }

        orden.FechaInicio = DateTime.UtcNow;
        orden.Diagnostico = request.Diagnostico;
        if (request.TecnicoId.HasValue)
        {
            orden.TecnicoAsignadoId = request.TecnicoId;
            orden.FechaAsignacion = DateTime.UtcNow;
            orden.Estado = EstadoOrdenTrabajoEnum.Asignada;
        }
        reporte.TieneOrdenTrabajo = true;
        orden.UpdatedAt = DateTime.UtcNow;

        // Actualizar ubicación del vehículo de forma explícita para evitar desincronización
        var vehiculo = reporte.Vehiculo ?? await _db.Vehiculos.FirstOrDefaultAsync(v => v.Id == reporte.VehiculoId);
        if (vehiculo != null)
        {
            vehiculo.Ubicacion = UbicacionVehiculoEnum.Taller;
            vehiculo.Estado = EstadoVehiculoEnum.EnReparacion;
            vehiculo.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { ordenId = orden.Id }));
    }

    [HttpPost("{reporteId}/danios-extra")]
    public async Task<IActionResult> DaniosExtra(int reporteId, [FromBody] DanioExtraRequest request)
    {
        var reporte = await _db.ReportesFalla.FirstOrDefaultAsync(r => r.Id == reporteId);
        if (reporte == null) return NotFound(ApiResponse<string>.Error("Reporte no encontrado"));

        var orden = await _db.OrdenesTrabajo.FirstOrDefaultAsync(o => o.ReporteFallaId == reporteId);
        if (orden == null)
        {
            return BadRequest(ApiResponse<string>.Error("La orden aún no existe. Realiza check-in primero."));
        }

        // Guardar nota de daños extra en la descripción del reporte (append)
        reporte.Descripcion += $"\n[Daño extra] {request.DescripcionExtra}";
        reporte.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        // La solicitud de refacción se realiza aparte para no acoplarla al daño extra
        return Ok(ApiResponse<object>.Ok(new { ordenId = orden.Id }));
    }
}

public class CheckInRequest
{
    public string? Diagnostico { get; set; }
    public int? TecnicoId { get; set; }
}

public class DanioExtraRequest
{
    public string DescripcionExtra { get; set; } = string.Empty;
    public bool RequiereRefaccion { get; set; } = false;
    public string? RefaccionNombre { get; set; }
}

