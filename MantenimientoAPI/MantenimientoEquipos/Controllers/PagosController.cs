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
public class PagosController : ControllerBase
{
    private readonly MantenimientoDbContext _db;

    public PagosController(MantenimientoDbContext db)
    {
        _db = db;
    }

    private object MapDto(RegistroPago p) => new
    {
        p.Id,
        p.OrdenTrabajoId,
        OrdenTrabajoFolio = p.OrdenTrabajo?.Folio,
        p.TecnicoId,
        TecnicoNombre = p.Tecnico?.NombreCompleto,
        Estado = p.Estado,
        EstadoNombre = p.Estado.ToString(),
        MontoManoObra = p.CostoManoObra,
        MontoRefacciones = p.CostoRefacciones,
        MontoTotal = p.MontoTotal,
        p.FechaRegistro,
        p.FechaAprobacion,
        p.FechaPago,
        p.Notas
    };

    [HttpGet]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? tecnicoId = null,
        [FromQuery] EstadoPagoEnum? estado = null,
        [FromQuery] DateTime? fechaDesde = null,
        [FromQuery] DateTime? fechaHasta = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20)
    {
        var query = _db.RegistrosPago
            .Include(p => p.OrdenTrabajo)
            .Include(p => p.Tecnico)
            .AsQueryable();

        if (tecnicoId.HasValue) query = query.Where(p => p.TecnicoId == tecnicoId.Value);
        if (estado.HasValue) query = query.Where(p => p.Estado == estado.Value);
        if (fechaDesde.HasValue) query = query.Where(p => p.FechaRegistro >= fechaDesde.Value);
        if (fechaHasta.HasValue) query = query.Where(p => p.FechaRegistro <= fechaHasta.Value);

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(p => p.FechaRegistro)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
            Items = items.Select(MapDto),
            TotalItems = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(total / (double)pageSize)
        }));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id)
    {
        var pago = await _db.RegistrosPago
            .Include(p => p.OrdenTrabajo)
            .Include(p => p.Tecnico)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (pago == null) return NotFound(ApiResponse<string>.Error("Pago no encontrado"));
        return Ok(ApiResponse<object>.Ok(MapDto(pago)));
    }

    [HttpGet("pendientes")]
    public async Task<IActionResult> GetPendientes()
    {
        var list = await _db.RegistrosPago
            .Include(p => p.OrdenTrabajo)
            .Include(p => p.Tecnico)
            .Where(p => p.Estado == EstadoPagoEnum.Pendiente || p.Estado == EstadoPagoEnum.EnRevision)
            .OrderByDescending(p => p.FechaRegistro)
            .ToListAsync();
        return Ok(ApiResponse<object>.Ok(list.Select(MapDto).ToList()));
    }

    [HttpGet("tecnico/{tecnicoId:int}")]
    public async Task<IActionResult> GetByTecnico(int tecnicoId)
    {
        var list = await _db.RegistrosPago
            .Include(p => p.OrdenTrabajo)
            .Include(p => p.Tecnico)
            .Where(p => p.TecnicoId == tecnicoId)
            .OrderByDescending(p => p.FechaRegistro)
            .ToListAsync();
        return Ok(ApiResponse<object>.Ok(list.Select(MapDto).ToList()));
    }

    public class CrearPagoRequest
    {
        public int OrdenTrabajoId { get; set; }
        public int TecnicoId { get; set; }
        public decimal MontoManoObra { get; set; }
        public decimal? MontoRefacciones { get; set; }
        public string? Notas { get; set; }
    }

    public class ActualizarPagoRequest
    {
        public decimal MontoManoObra { get; set; }
        public decimal? MontoRefacciones { get; set; }
        public string? Notas { get; set; }
    }

    [HttpPost]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Create([FromBody] CrearPagoRequest request)
    {
        var orden = await _db.OrdenesTrabajo.FindAsync(request.OrdenTrabajoId);
        if (orden == null) return NotFound(ApiResponse<string>.Error("Orden no encontrada"));

        var tecnico = await _db.Users.FindAsync(request.TecnicoId);
        if (tecnico == null) return NotFound(ApiResponse<string>.Error("Tecnico no encontrado"));

        // Validacion: evitar doble pago para la misma orden
        var pagoExistente = await _db.RegistrosPago
            .AsNoTracking()
            .AnyAsync(p => p.OrdenTrabajoId == request.OrdenTrabajoId);
        if (pagoExistente)
        {
            return BadRequest(ApiResponse<string>.Error("Ya existe un pago registrado para esta orden de trabajo."));
        }

        var pago = new RegistroPago
        {
            OrdenTrabajoId = request.OrdenTrabajoId,
            TecnicoId = request.TecnicoId,
            HorasTrabajadas = 1,
            TarifaHora = request.MontoManoObra,
            CostoManoObra = request.MontoManoObra,
            CostoRefacciones = request.MontoRefacciones ?? 0,
            OtrosCostos = 0,
            MontoTotal = request.MontoManoObra + (request.MontoRefacciones ?? 0),
            Estado = EstadoPagoEnum.Pendiente,
            Notas = request.Notas,
            FechaRegistro = DateTime.UtcNow
        };

        _db.RegistrosPago.Add(pago);
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(MapDto(pago), "Pago registrado"));
    }

    [HttpPut("{id:int}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Update(int id, [FromBody] ActualizarPagoRequest request)
    {
        var pago = await _db.RegistrosPago.FindAsync(id);
        if (pago == null) return NotFound(ApiResponse<string>.Error("Pago no encontrado"));

        pago.CostoManoObra = request.MontoManoObra;
        pago.CostoRefacciones = request.MontoRefacciones ?? 0;
        pago.TarifaHora = request.MontoManoObra;
        pago.MontoTotal = request.MontoManoObra + (request.MontoRefacciones ?? 0);
        pago.Notas = request.Notas ?? pago.Notas;

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(MapDto(pago), "Pago actualizado"));
    }

    [HttpPost("{id:int}/aprobar")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Aprobar(int id)
    {
        var pago = await _db.RegistrosPago.FindAsync(id);
        if (pago == null) return NotFound(ApiResponse<string>.Error("Pago no encontrado"));

        pago.Estado = EstadoPagoEnum.Aprobado;
        pago.FechaAprobacion = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(MapDto(pago), "Pago aprobado"));
    }

    [HttpPost("{id:int}/rechazar")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Rechazar(int id, [FromBody] dynamic body)
    {
        var pago = await _db.RegistrosPago.FindAsync(id);
        if (pago == null) return NotFound(ApiResponse<string>.Error("Pago no encontrado"));

        pago.Estado = EstadoPagoEnum.Rechazado;
        pago.Notas = (string?)body?.motivo ?? pago.Notas;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(MapDto(pago), "Pago rechazado"));
    }

    [HttpPost("{id:int}/revertir")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> Revertir(int id)
    {
        var pago = await _db.RegistrosPago.FindAsync(id);
        if (pago == null) return NotFound(ApiResponse<string>.Error("Pago no encontrado"));

        // Revertir a estado Aprobado si estaba Pagado, o Pendiente si estaba Aprobado?
        // El requerimiento dice "revertir o eliminar la marca de pago".
        // Si revertimos desde PAGADO, debería volver a APROBADO para poder pagarlo de nuevo o rechazarlo.
        // Si revertimos desde APROBADO, debería volver a PENDIENTE (o EnRevision).
        
        if (pago.Estado == EstadoPagoEnum.Pagado)
        {
            pago.Estado = EstadoPagoEnum.Aprobado;
            pago.FechaPago = null;
        }
        else if (pago.Estado == EstadoPagoEnum.Aprobado)
        {
            pago.Estado = EstadoPagoEnum.Pendiente;
            pago.FechaAprobacion = null;
        }
        else
        {
            return BadRequest(ApiResponse<string>.Error("El pago no está en un estado revertible (Pagado o Aprobado)."));
        }

        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(MapDto(pago), "Pago revertido"));
    }

    [HttpPost("{id:int}/pagar")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Pagar(int id, [FromBody] dynamic body)
    {
        var pago = await _db.RegistrosPago.FindAsync(id);
        if (pago == null) return NotFound(ApiResponse<string>.Error("Pago no encontrado"));

        pago.Estado = EstadoPagoEnum.Pagado;
        pago.FechaPago = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(MapDto(pago), "Pago marcado como pagado"));
    }

    [HttpGet("resumen-tecnicos")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> ResumenTecnicos([FromQuery] DateTime? fechaDesde = null, [FromQuery] DateTime? fechaHasta = null)
    {
        var query = _db.RegistrosPago
            .Include(p => p.Tecnico)
            .AsQueryable();
        if (fechaDesde.HasValue) query = query.Where(p => p.FechaRegistro >= fechaDesde.Value);
        if (fechaHasta.HasValue) query = query.Where(p => p.FechaRegistro <= fechaHasta.Value);

        var resumen = await query
            .GroupBy(p => new { p.TecnicoId, p.Tecnico.NombreCompleto })
            .Select(g => new
            {
                TecnicoId = g.Key.TecnicoId,
                TecnicoNombre = g.Key.NombreCompleto,
                TotalOrdenes = g.Count(),
                MontoPendiente = g.Where(x => x.Estado == EstadoPagoEnum.Pendiente || x.Estado == EstadoPagoEnum.EnRevision).Sum(x => x.MontoTotal),
                MontoPagado = g.Where(x => x.Estado == EstadoPagoEnum.Pagado).Sum(x => x.MontoTotal)
            }).ToListAsync();

        return Ok(ApiResponse<object>.Ok(resumen));
    }
}
