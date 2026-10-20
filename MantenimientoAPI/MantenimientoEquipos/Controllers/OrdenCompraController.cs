using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.Utils;
using MantenimientoEquipos.Services;
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
    private readonly EliminacionService _eliminacion;

    public OrdenCompraController(MantenimientoDbContext db, EliminacionService eliminacion)
    {
        _db = db;
        _eliminacion = eliminacion;
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

    // Lo que ve la pantalla. Antes se devolvía la entidad con el proveedor completo (usuario con su hash de contraseña).
    public record OrdenCompraPagoVista(int Id, int OrdenTrabajoId, string? OrdenTrabajoFolio, string? TecnicoNombre, decimal MontoTotal, string Estado);
    public record OrdenCompraVista(int Id, string Folio, int ProveedorId, string? ProveedorNombre, DateTime FechaRegistro,
        string Estado, decimal Total, string? NumeroExterno, List<OrdenCompraPagoVista> Pagos);

    private async Task<List<OrdenCompraVista>> VistasAsync(int? id = null)
    {
        var ordenes = await _db.OrdenesCompra
            .AsNoTracking()
            .Where(oc => id == null || oc.Id == id)
            .OrderByDescending(oc => oc.FechaRegistro)
            .Select(oc => new
            {
                oc.Id, oc.Folio, oc.ProveedorId, ProveedorNombre = oc.Proveedor.NombreCompleto,
                oc.FechaRegistro, oc.Estado, oc.Total, oc.NumeroExterno,
                Pagos = oc.Pagos.Select(p => new { p.Id, p.OrdenTrabajoId, OrdenTrabajoFolio = p.OrdenTrabajo.Folio, TecnicoNombre = p.Tecnico.NombreCompleto, p.MontoTotal, p.Estado }).ToList()
            })
            .ToListAsync();
        return ordenes.Select(oc => new OrdenCompraVista(
            oc.Id, oc.Folio, oc.ProveedorId, oc.ProveedorNombre,
            DateTime.SpecifyKind(oc.FechaRegistro, DateTimeKind.Utc), oc.Estado, oc.Total, oc.NumeroExterno,
            oc.Pagos.Select(p => new OrdenCompraPagoVista(p.Id, p.OrdenTrabajoId, p.OrdenTrabajoFolio, p.TecnicoNombre, p.MontoTotal, p.Estado.ToString())).ToList()))
            .ToList();
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

        var vista = (await VistasAsync(ordenCompra.Id)).First();
        return Ok(ApiResponse<OrdenCompraVista>.Ok(vista, "Orden de compra generada correctamente."));
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
        return Ok(ApiResponse<OrdenCompraVista>.Ok((await VistasAsync(id)).First(), "Orden de compra actualizada correctamente."));
    }

    /// <summary>Elimina la orden de compra; sus pagos vuelven a Aprobado y sin OC. Solo administradores; queda en la bitácora.</summary>
    [HttpDelete("{id:int}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> Delete(int id)
    {
        var mensaje = await _eliminacion.EliminarOrdenCompraAsync(id, User.UsuarioId(), User.NombreUsuario());
        if (mensaje == null) return NotFound(ApiResponse<string>.Error("Orden de compra no encontrada."));
        return Ok(ApiResponse<string>.Ok(mensaje, mensaje));
    }

    [HttpGet]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> GetAll()
    {
        return Ok(ApiResponse<List<OrdenCompraVista>>.Ok(await VistasAsync()));
    }

    [HttpGet("{id}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> GetById(int id)
    {
        var orden = (await VistasAsync(id)).FirstOrDefault();

        if (orden == null)
            return NotFound(ApiResponse<string>.Error("Orden de compra no encontrada."));

        return Ok(ApiResponse<OrdenCompraVista>.Ok(orden));
    }
}
