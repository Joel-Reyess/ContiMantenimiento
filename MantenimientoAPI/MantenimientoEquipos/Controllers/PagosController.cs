using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.Utils;
using MantenimientoEquipos.Services;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.DTOs;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PagosController : ControllerBase
{
    private readonly MantenimientoDbContext _db;
    private readonly EliminacionService _eliminacion;
    private readonly OrdenPagoService _ordenesPago;
    private readonly FlujoAvisos _avisos;

    public PagosController(MantenimientoDbContext db, EliminacionService eliminacion, OrdenPagoService ordenesPago, FlujoAvisos avisos)
    {
        _db = db;
        _eliminacion = eliminacion;
        _ordenesPago = ordenesPago;
        _avisos = avisos;
    }

    /// <summary>Con orden, vehículo y reporte, para la lista de órdenes de pago</summary>
    private IQueryable<RegistroPago> ConDetalle() => _db.RegistrosPago
        .Include(p => p.OrdenTrabajo).ThenInclude(o => o.Vehiculo)
        .Include(p => p.OrdenTrabajo).ThenInclude(o => o.ReporteFalla)
        .Include(p => p.Tecnico)
        .Include(p => p.Empresa);

    private object MapDto(RegistroPago p) => new
    {
        p.Id,
        Folio = OrdenPagoService.Folio(p.Id),
        p.OrdenTrabajoId,
        OrdenTrabajoFolio = p.OrdenTrabajo?.Folio,
        VehiculoCodigo = p.OrdenTrabajo?.Vehiculo?.Codigo,
        ReporteFolio = p.OrdenTrabajo?.ReporteFalla?.Folio,
        p.TecnicoId,
        TecnicoNombre = p.Tecnico?.NombreCompleto,
        // Empresa responsable: la del técnico cuando se generó (PDF 06-nov)
        p.EmpresaId,
        EmpresaNombre = p.Empresa?.Nombre,
        Estado = p.Estado,
        EstadoNombre = p.Estado.ToString(),
        MontoManoObra = p.CostoManoObra,
        MontoRefacciones = p.CostoRefacciones,
        MontoTotal = p.MontoTotal,
        p.FechaRegistro,
        p.FechaAprobacion,
        p.FechaPago,
        p.NumeroFactura,
        p.Notas,
        // Para saber en la pantalla si el pago ya está en una orden de compra (no se puede eliminar suelto)
        p.OrdenCompraId
    };

    /// <summary>Elimina un pago (si está en una orden de compra, primero hay que eliminar la OC). Solo administradores; queda en la bitácora.</summary>
    [HttpDelete("{id:int}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var mensaje = await _eliminacion.EliminarPagoAsync(id, User.UsuarioId(), User.NombreUsuario());
            if (mensaje == null) return NotFound(ApiResponse<string>.Error("Pago no encontrado"));
            return Ok(ApiResponse<string>.Ok(mensaje, mensaje));
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ApiResponse<string>.Error(ex.Message));
        }
    }

    [HttpGet]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int? tecnicoId = null,
        [FromQuery] EstadoPagoEnum? estado = null,
        [FromQuery] DateTime? fechaDesde = null,
        [FromQuery] DateTime? fechaHasta = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] int? empresaId = null)
    {
        var query = ConDetalle().AsQueryable();

        if (tecnicoId.HasValue) query = query.Where(p => p.TecnicoId == tecnicoId.Value);
        // 0 = órdenes de pago de técnicos sin empresa (tarifa base)
        if (empresaId == 0) query = query.Where(p => p.EmpresaId == null);
        else if (empresaId.HasValue) query = query.Where(p => p.EmpresaId == empresaId.Value);
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
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")] // Antes cualquiera con sesión veía cualquier pago
    public async Task<IActionResult> GetById(int id)
    {
        var pago = await ConDetalle().FirstOrDefaultAsync(p => p.Id == id);
        if (pago == null) return NotFound(ApiResponse<string>.Error("Pago no encontrado"));
        return Ok(ApiResponse<object>.Ok(MapDto(pago)));
    }

    [HttpGet("pendientes")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> GetPendientes()
    {
        var list = await ConDetalle()
            .Where(p => p.Estado == EstadoPagoEnum.Pendiente || p.Estado == EstadoPagoEnum.EnRevision)
            .OrderByDescending(p => p.FechaRegistro)
            .ToListAsync();
        return Ok(ApiResponse<object>.Ok(list.Select(MapDto).ToList()));
    }

    [HttpGet("tecnico/{tecnicoId:int}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico")]
    public async Task<IActionResult> GetByTecnico(int tecnicoId)
    {
        // El técnico solo consulta sus propios pagos
        var esGestor = User.IsInRole("SuperUsuario") || User.IsInRole("Administrador") || User.IsInRole("Supervisor");
        if (!esGestor && User.UsuarioId() != tecnicoId)
            return StatusCode(403, ApiResponse<string>.Error("Solo puedes consultar tus propios pagos."));

        var list = await ConDetalle()
            .Where(p => p.TecnicoId == tecnicoId)
            .OrderByDescending(p => p.FechaRegistro)
            .ToListAsync();
        return Ok(ApiResponse<object>.Ok(list.Select(MapDto).ToList()));
    }

    public class RechazarPagoRequest
    {
        public string? Motivo { get; set; }
    }

    public class PagarRequest
    {
        public string? NumeroFactura { get; set; }
    }

    public class ActualizarPagoRequest
    {
        public decimal MontoManoObra { get; set; }
        public decimal? MontoRefacciones { get; set; }
        public string? Notas { get; set; }
    }

    /// <summary>
    /// Ya no se capturan a mano (PDF 29-oct, 6.1): la orden de pago se genera sola cuando la orden de trabajo
    /// llega a DISPONIBLE.
    /// </summary>
    [HttpPost]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public IActionResult Create() =>
        StatusCode(410, ApiResponse<string>.Error(
            "Las órdenes de pago ya no se capturan a mano: se generan automáticamente cuando la orden de trabajo se valida (DISPONIBLE)."));

    /// <summary>Lo que hereda de la orden: actividades, refacciones y consumibles, vehículo, técnico, fechas y total</summary>
    [HttpGet("{id:int}/detalle")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Detalle(int id)
    {
        var detalle = await _ordenesPago.DetalleAsync(id);
        return detalle == null
            ? NotFound(ApiResponse<string>.Error("Orden de pago no encontrada"))
            : Ok(ApiResponse<DetalleOrdenPagoDto>.Ok(detalle));
    }

    /// <summary>Órdenes ya validadas (DISPONIBLE) que aún no tienen su orden de pago, p.ej. las de antes de este cambio</summary>
    [HttpGet("sin-generar")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> SinGenerar()
    {
        var total = await OrdenesSinPago().CountAsync();
        return Ok(ApiResponse<int>.Ok(total));
    }

    [HttpPost("generar-pendientes")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> GenerarPendientes()
    {
        var ordenes = await OrdenesSinPago().Include(o => o.Vehiculo).ToListAsync();
        var generadas = new List<(RegistroPago Pago, string Folio)>();
        var nombre = User.NombreUsuario() ?? "Administración";
        foreach (var o in ordenes)
        {
            var pago = await _ordenesPago.GenerarAsync(o, nombre);
            if (pago != null) generadas.Add((pago, o.Folio));
        }
        await _db.SaveChangesAsync();
        foreach (var (pago, folio) in generadas)
            await _avisos.OrdenPagoGeneradaAsync(pago.Id, folio, User.UsuarioId());
        var resultado = new ResultadoGenerarPagosDto { Generadas = generadas.Count, Folios = generadas.Select(g => OrdenPagoService.Folio(g.Pago.Id)).ToList() };
        return Ok(ApiResponse<ResultadoGenerarPagosDto>.Ok(resultado,
            resultado.Generadas == 0 ? "No había órdenes pendientes de generar" : $"{resultado.Generadas} orden(es) de pago generada(s)"));
    }

    // Las inspecciones rápidas (INS) nacen validadas y no son reparaciones: no llevan orden de pago
    private IQueryable<OrdenTrabajo> OrdenesSinPago() => _db.OrdenesTrabajo
        .Where(o => (o.Estado == EstadoOrdenTrabajoEnum.Validada || o.Estado == EstadoOrdenTrabajoEnum.Entregado)
                    && o.TecnicoAsignadoId != null
                    && o.TipoMantenimiento != "Inspección" && o.TipoMantenimiento != "Inspeccion"
                    && !_db.RegistrosPago.Any(p => p.OrdenTrabajoId == o.Id)
                    // Su orden de pago se eliminó a propósito: no se vuelve a ofrecer
                    && !_db.LogAcciones.Any(l => l.Entidad == "OrdenTrabajo" && l.Accion == EliminacionService.AccionPagoDescartado && l.EntidadId == o.Id));

    [HttpPut("{id:int}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> Update(int id, [FromBody] ActualizarPagoRequest request)
    {
        var pago = await ConDetalle().FirstOrDefaultAsync(p => p.Id == id);
        if (pago == null) return NotFound(ApiResponse<string>.Error("Pago no encontrado"));

        // Los importes se fijan al generarse con el tarifario de la empresa del técnico (PDF 06-nov, PAG-03) y las
        // refacciones ya no se cobran (OT-24): aquí solo se guardan las notas; los montos que lleguen se ignoran
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
    public async Task<IActionResult> Rechazar(int id, [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] RechazarPagoRequest? body)
    {
        var pago = await _db.RegistrosPago.FindAsync(id);
        if (pago == null) return NotFound(ApiResponse<string>.Error("Pago no encontrado"));

        // Antes el cuerpo era `dynamic` y leer el motivo tronaba (500): no se podía rechazar
        pago.Estado = EstadoPagoEnum.Rechazado;
        var motivo = string.IsNullOrWhiteSpace(body?.Motivo) ? null : body!.Motivo!.Trim();
        if (motivo != null) pago.Notas = motivo.Length > 300 ? motivo[..300] : motivo;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<object>.Ok(MapDto(pago), "Pago rechazado"));
    }

    [HttpPost("{id:int}/revertir")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")] // El Gerente de Mantenimiento cambia el estatus de los pagos
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
    public async Task<IActionResult> Pagar(int id, [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] PagarRequest? body)
    {
        var pago = await _db.RegistrosPago.FindAsync(id);
        if (pago == null) return NotFound(ApiResponse<string>.Error("Pago no encontrado"));

        pago.Estado = EstadoPagoEnum.Pagado;
        pago.FechaPago = DateTime.UtcNow;
        // El número de factura que se captura al marcar pagado (antes se ignoraba); sale en la orden de pago impresa
        if (!string.IsNullOrWhiteSpace(body?.NumeroFactura))
        {
            var factura = body!.NumeroFactura!.Trim();
            pago.NumeroFactura = factura.Length > 50 ? factura[..50] : factura;
        }
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
