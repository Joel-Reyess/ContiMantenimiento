using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.Middlewares;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdenCompraController : ControllerBase
{
    private readonly MantenimientoDbContext _db;

    public OrdenCompraController(MantenimientoDbContext db)
    {
        _db = db;
    }

    public class CreateOrdenCompraRequest
    {
        public List<int> PagoIds { get; set; } = new();
        public string? NumeroExterno { get; set; }
    }

    public class UpdateOrdenCompraRequest
    {
        public string? NumeroExterno { get; set; }
        public string? Estado { get; set; }
    }

    [HttpPost]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Create([FromBody] CreateOrdenCompraRequest request)
    {
        if (request.PagoIds == null || !request.PagoIds.Any())
            return BadRequest(ApiResponse<string>.Error("Debe seleccionar al menos un pago."));

        var pagos = await _db.RegistrosPago
            .Include(p => p.Tecnico)
            .Where(p => request.PagoIds.Contains(p.Id))
            .ToListAsync();

        if (pagos.Count != request.PagoIds.Count)
            return BadRequest(ApiResponse<string>.Error("Algunos pagos no fueron encontrados."));

        var proveedorId = pagos.First().TecnicoId;
        if (pagos.Any(p => p.TecnicoId != proveedorId))
            return BadRequest(ApiResponse<string>.Error("Todos los pagos deben pertenecer al mismo proveedor."));

        if (pagos.Any(p => p.OrdenCompraId != null))
            return BadRequest(ApiResponse<string>.Error("Algunos pagos ya están asignados a una orden de compra."));

        var total = pagos.Sum(p => p.MontoTotal);

        var ordenCompra = new OrdenCompra(
            folio: $"OC-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString().Substring(0, 4).ToUpper()}",
            proveedorId: proveedorId,
            total: total,
            numeroExterno: request.NumeroExterno
        );

        _db.OrdenesCompra.Add(ordenCompra);
        await _db.SaveChangesAsync();

        foreach (var pago in pagos)
        {
            pago.OrdenCompraId = ordenCompra.Id;
            pago.Estado = EstadoPagoEnum.Pagado;
            pago.FechaPago = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<OrdenCompra>.Ok(ordenCompra, "Orden de compra generada correctamente."));
    }

    [HttpPut("{id}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateOrdenCompraRequest request)
    {
        var ordenCompra = await _db.OrdenesCompra.FindAsync(id);
        if (ordenCompra == null)
            return NotFound(ApiResponse<string>.Error("Orden de compra no encontrada."));

        if (request.NumeroExterno != null)
        {
            ordenCompra.NumeroExterno = request.NumeroExterno;
        }

        if (request.Estado != null)
        {
            ordenCompra.Estado = request.Estado;
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<OrdenCompra>.Ok(ordenCompra, "Orden de compra actualizada correctamente."));
    }

    [HttpGet]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> GetAll()
    {
        var ordenes = await _db.OrdenesCompra
            .Include(oc => oc.Proveedor)
            .OrderByDescending(oc => oc.FechaRegistro)
            .ToListAsync();

        return Ok(ApiResponse<List<OrdenCompra>>.Ok(ordenes));
    }

    [HttpGet("{id}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> GetById(int id)
    {
        var orden = await _db.OrdenesCompra
            .Include(oc => oc.Proveedor)
            .Include(oc => oc.Pagos)
                .ThenInclude(p => p.OrdenTrabajo)
                    .ThenInclude(ot => ot.SolicitudesRefaccion)
            .FirstOrDefaultAsync(oc => oc.Id == id);

        if (orden == null)
            return NotFound(ApiResponse<string>.Error("Orden de compra no encontrada."));

        return Ok(ApiResponse<OrdenCompra>.Ok(orden));
    }
}
