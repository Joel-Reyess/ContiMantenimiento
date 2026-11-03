using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.Middlewares;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RecepcionController : ControllerBase
{
    private readonly MantenimientoDbContext _db;

    public RecepcionController(MantenimientoDbContext db)
    {
        _db = db;
    }


    [HttpGet("pendientes")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico", "Lider", "Operador")] // Líder y Operador: solo consulta
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
                VehiculoTipo = _db.TiposVehiculo.Where(t => t.Id == (int)r.Vehiculo.Tipo).Select(t => t.Nombre).FirstOrDefault() ?? r.Vehiculo.Tipo.ToString(),
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
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico")]
    public IActionResult CheckIn(int reporteId) =>
        // Flujo de 7 etapas: la orden nace al validar el reporte (INSPECCIÓN) y el taller la acepta en la Zona de Transición
        StatusCode(410, ApiResponse<string>.Error("La recepción cambió: el Líder valida el reporte y el técnico acepta la orden desde la Zona de Transición."));

    [HttpPost("{reporteId}/danios-extra")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico")]
    public IActionResult DaniosExtra(int reporteId) =>
        // Flujo de 7 etapas: la orden nace al validar el reporte (INSPECCIÓN) y el taller la acepta en la Zona de Transición
        StatusCode(410, ApiResponse<string>.Error("La recepción cambió: el Líder valida el reporte y el técnico acepta la orden desde la Zona de Transición."));
}
