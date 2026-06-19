using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.Models;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly MantenimientoDbContext _db;

    public HealthController(MantenimientoDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Verifica el estado de la API
    /// </summary>
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            Status = "OK",
            Timestamp = DateTime.UtcNow,
            Service = "API Mantenimiento de Equipos - Continental SLP"
        });
    }

    /// <summary>
    /// Verifica la conexión a la base de datos
    /// </summary>
    [HttpGet("db")]
    public async Task<IActionResult> CheckDatabase()
    {
        try
        {
            var canConnect = await _db.Database.CanConnectAsync();
            return Ok(new
            {
                Status = canConnect ? "OK" : "Error",
                Database = canConnect ? "Conectado" : "Sin conexión",
                Timestamp = DateTime.UtcNow
            });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new
            {
                Status = "Error",
                Message = ex.Message,
                Timestamp = DateTime.UtcNow
            });
        }
    }
}
