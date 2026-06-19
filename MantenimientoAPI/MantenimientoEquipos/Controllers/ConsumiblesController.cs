using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using System.Security.Claims;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ConsumiblesController : ControllerBase
{
    private readonly MantenimientoDbContext _db;

    public ConsumiblesController(MantenimientoDbContext db)
    {
        _db = db;
    }

    private int? GetUserId() => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : null;

    [HttpGet]
    [Authorize(Roles = "SuperUsuario,Administrador,Supervisor")]
    public async Task<IActionResult> GetAll([FromQuery] bool? activo = null, [FromQuery] bool? bajoStock = null, [FromQuery] string? q = null)
    {
        var query = _db.Consumibles.AsQueryable();

        if (activo.HasValue)
            query = query.Where(c => c.Activo == activo.Value);

        if (bajoStock == true)
            query = query.Where(c => c.StockActual <= c.StockMinimo);

        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.ToLower();
            query = query.Where(c => c.Nombre.ToLower().Contains(term) || c.Codigo.ToLower().Contains(term) || (c.Categoria ?? "").ToLower().Contains(term));
        }

        var items = await query
            .OrderBy(c => c.Nombre)
            .Select(c => new ConsumibleDto
            {
                Id = c.Id,
                Codigo = c.Codigo,
                Nombre = c.Nombre,
                Categoria = c.Categoria,
                Unidad = c.Unidad,
                StockActual = c.StockActual,
                StockMinimo = c.StockMinimo,
                StockMaximo = c.StockMaximo,
                CostoUnitario = c.CostoUnitario,
                AlertaActiva = c.AlertaActiva,
                Activo = c.Activo
            })
            .ToListAsync();

        return Ok(ApiResponse<IEnumerable<ConsumibleDto>>.Ok(items));
    }

    [HttpGet("disponibles")]
    [Authorize(Roles = "SuperUsuario,Administrador,Supervisor,Tecnico")]
    public async Task<IActionResult> GetDisponibles()
    {
        var items = await _db.Consumibles
            .Where(c => c.Activo && c.StockActual > 0)
            .OrderBy(c => c.Nombre)
            .Select(c => new ConsumibleDto
            {
                Id = c.Id,
                Codigo = c.Codigo,
                Nombre = c.Nombre,
                Categoria = c.Categoria,
                Unidad = c.Unidad,
                StockActual = c.StockActual,
                StockMinimo = c.StockMinimo,
                StockMaximo = c.StockMaximo,
                CostoUnitario = c.CostoUnitario,
                AlertaActiva = c.AlertaActiva,
                Activo = c.Activo
            })
            .ToListAsync();

        return Ok(ApiResponse<IEnumerable<ConsumibleDto>>.Ok(items));
    }

    [HttpPost]
    [Authorize(Roles = "SuperUsuario,Administrador")]
    public async Task<IActionResult> Create([FromBody] ConsumibleCreateRequest request)
    {
        if (await _db.Consumibles.AnyAsync(c => c.Codigo == request.Codigo))
        {
            return BadRequest(ApiResponse<string>.Error("Ya existe un consumible con ese código."));
        }

        var entity = new Consumible
        {
            Codigo = request.Codigo,
            Nombre = request.Nombre,
            Categoria = request.Categoria,
            Unidad = request.Unidad,
            StockActual = request.StockActual,
            StockMinimo = request.StockMinimo,
            StockMaximo = request.StockMaximo,
            CostoUnitario = request.CostoUnitario ?? 0,
            Activo = request.Activo,
            AlertaActiva = request.StockActual <= request.StockMinimo
        };

        _db.Consumibles.Add(entity);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { entity.Id }));
    }

    [HttpPut("{id:int}")]
    [Authorize(Roles = "SuperUsuario,Administrador")]
    public async Task<IActionResult> Update(int id, [FromBody] ConsumibleUpdateRequest request)
    {
        var entity = await _db.Consumibles.FindAsync(id);
        if (entity == null) return NotFound(ApiResponse<string>.Error("Consumible no encontrado"));

        if (request.Nombre != null) entity.Nombre = request.Nombre;
        if (request.Categoria != null) entity.Categoria = request.Categoria;
        if (request.Unidad != null) entity.Unidad = request.Unidad;
        if (request.StockActual.HasValue) entity.StockActual = request.StockActual.Value;
        if (request.StockMinimo.HasValue) entity.StockMinimo = request.StockMinimo.Value;
        if (request.StockMaximo.HasValue) entity.StockMaximo = request.StockMaximo;
        if (request.CostoUnitario.HasValue) entity.CostoUnitario = request.CostoUnitario.Value;
        if (request.Activo.HasValue) entity.Activo = request.Activo.Value;

        entity.AlertaActiva = entity.StockActual <= entity.StockMinimo;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Ok(true));
    }

    [HttpPost("{id:int}/ajuste")]
    [Authorize(Roles = "SuperUsuario,Administrador")]
    public async Task<IActionResult> AjustarStock(int id, [FromBody] AjusteStockRequest request)
    {
        var entity = await _db.Consumibles.FindAsync(id);
        if (entity == null) return NotFound(ApiResponse<string>.Error("Consumible no encontrado"));

        var delta = request.Tipo == "ajuste-" ? -request.Cantidad : request.Cantidad;
        entity.StockActual += delta;
        if (entity.StockActual < 0) entity.StockActual = 0;
        entity.AlertaActiva = entity.StockActual <= entity.StockMinimo;
        entity.UpdatedAt = DateTime.UtcNow;

        _db.ConsumosConsumibles.Add(new ConsumoConsumible
        {
            ConsumibleId = id,
            UsuarioId = GetUserId(),
            TipoMovimiento = request.Tipo,
            Cantidad = request.Cantidad,
            Comentario = request.Comentario
        });

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Ok(true));
    }

    [HttpPost("{id:int}/consumo")]
    [Authorize(Roles = "SuperUsuario,Administrador,Supervisor,Tecnico")]
    public async Task<IActionResult> RegistrarConsumo(int id, [FromBody] ConsumoRequest request)
    {
        var entity = await _db.Consumibles.FindAsync(id);
        if (entity == null) return NotFound(ApiResponse<string>.Error("Consumible no encontrado"));

        if (request.Cantidad <= 0) return BadRequest(ApiResponse<string>.Error("Cantidad inválida"));
        if (entity.StockActual < request.Cantidad) return BadRequest(ApiResponse<string>.Error("Stock insuficiente"));

        entity.StockActual -= request.Cantidad;
        entity.AlertaActiva = entity.StockActual <= entity.StockMinimo;
        entity.UpdatedAt = DateTime.UtcNow;

        _db.ConsumosConsumibles.Add(new ConsumoConsumible
        {
            ConsumibleId = id,
            OrdenTrabajoId = request.OrdenTrabajoId,
            ReporteId = request.ReporteId,
            UsuarioId = GetUserId(),
            TipoMovimiento = "consumo",
            Cantidad = request.Cantidad,
            Comentario = request.Comentario
        });

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<bool>.Ok(true));
    }

    [HttpGet("alertas")]
    [Authorize(Roles = "SuperUsuario,Administrador,Supervisor")]
    public async Task<IActionResult> Alertas()
    {
        var items = await _db.Consumibles
            .Where(c => c.AlertaActiva || c.StockActual <= c.StockMinimo)
            .OrderBy(c => c.Nombre)
            .Select(c => new ConsumibleDto
            {
                Id = c.Id,
                Codigo = c.Codigo,
                Nombre = c.Nombre,
                Categoria = c.Categoria,
                Unidad = c.Unidad,
                StockActual = c.StockActual,
                StockMinimo = c.StockMinimo,
                StockMaximo = c.StockMaximo,
                AlertaActiva = c.AlertaActiva,
                Activo = c.Activo
            })
            .ToListAsync();

        return Ok(ApiResponse<IEnumerable<ConsumibleDto>>.Ok(items));
    }
}
