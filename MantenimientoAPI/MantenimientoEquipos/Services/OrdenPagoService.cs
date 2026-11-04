using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Services;

/// <summary>
/// Orden de pago automática (PDF 29-oct, 6.1): al llegar la orden de trabajo a DISPONIBLE se genera una sola
/// orden de pago con lo que ya trae la orden (actividades realizadas, refacciones y consumibles usados,
/// técnico, vehículo...). Ya no se captura a mano.
/// </summary>
public class OrdenPagoService
{
    private static readonly string[] RespuestasNegativas = { "no", "false", "0" };

    private readonly MantenimientoDbContext _db;

    public OrdenPagoService(MantenimientoDbContext db)
    {
        _db = db;
    }

    public static string Folio(int pagoId) => $"OP-{pagoId:00000}";

    /// <summary>
    /// Actividades realizadas con su costo: lo que el técnico marcó en el checklist (mismo cálculo que se usaba
    /// al capturar el pago); si no marcó nada, los trabajos de la orden.
    /// </summary>
    public async Task<List<ActividadPagoDto>> ActividadesAsync(int ordenId)
    {
        var respuestas = (await _db.ChecklistRespuestas.AsNoTracking()
                .Where(r => r.OrdenTrabajoId == ordenId && r.Valor != null && r.Valor != "")
                .Select(r => new { r.Valor, r.Cantidad, r.ChecklistItem.Pregunta, r.ChecklistItem.CostoEstimado })
                .ToListAsync())
            .Where(r => !RespuestasNegativas.Contains(r.Valor!.Trim().ToLowerInvariant()))
            .Select(r => Actividad(r.Pregunta, r.Cantidad, r.CostoEstimado))
            .ToList();
        if (respuestas.Count > 0) return respuestas;

        return (await _db.OrdenesTrabajoChecklistItems.AsNoTracking()
                .Where(i => i.OrdenTrabajoId == ordenId)
                .OrderBy(i => i.Id)
                .Select(i => new { i.ChecklistItem.Pregunta, i.Cantidad, i.ChecklistItem.CostoEstimado })
                .ToListAsync())
            .Select(i => Actividad(i.Pregunta, i.Cantidad ?? 1, i.CostoEstimado))
            .ToList();
    }

    private static ActividadPagoDto Actividad(string descripcion, decimal cantidad, decimal costo)
    {
        var c = cantidad <= 0 ? 1 : cantidad;
        return new ActividadPagoDto { Descripcion = descripcion, Cantidad = c, CostoUnitario = costo, Subtotal = Math.Round(c * costo, 2) };
    }

    /// <summary>Refacciones y consumibles usados (descontados del inventario) más las refacciones solicitadas y entregadas</summary>
    public async Task<List<MaterialOrdenDto>> MaterialesAsync(int ordenId)
    {
        var lista = await _db.MaterialesOrdenTrabajo.AsNoTracking()
            .Where(m => m.OrdenTrabajoId == ordenId && m.Descontado)
            .OrderBy(m => m.Id)
            .Select(m => new MaterialOrdenDto
            {
                Id = m.Id,
                ConsumibleId = m.ConsumibleId,
                Codigo = m.Consumible.Codigo,
                Nombre = m.Consumible.Nombre,
                Categoria = m.Consumible.Categoria,
                Unidad = m.Consumible.Unidad,
                Cantidad = m.Cantidad,
                CostoUnitario = m.CostoUnitario,
                Descontado = true,
                FechaDescuento = m.FechaDescuento
            })
            .ToListAsync();
        foreach (var m in lista)
        {
            m.EsRefaccion = MaterialesOrdenService.EsRefaccion(m.Categoria);
            m.Subtotal = Math.Round(m.Cantidad * m.CostoUnitario, 2);
        }

        var solicitadas = await _db.SolicitudesRefaccion.AsNoTracking()
            .Where(s => s.OrdenTrabajoId == ordenId && s.Estado == "Entregada")
            .Select(s => new { s.Id, s.NumeroParte, s.NombreRefaccion, s.Cantidad, Costo = s.CostoReal ?? s.CostoEstimado ?? 0 })
            .ToListAsync();
        lista.AddRange(solicitadas.Select(s => new MaterialOrdenDto
        {
            Codigo = s.NumeroParte ?? "",
            Nombre = s.NombreRefaccion,
            Categoria = "Refaccion",
            EsRefaccion = true,
            Unidad = "pz",
            Cantidad = s.Cantidad,
            // El costo de la solicitud es por el total entregado
            CostoUnitario = s.Cantidad > 0 ? Math.Round(s.Costo / s.Cantidad, 2) : s.Costo,
            Subtotal = s.Costo,
            Descontado = true
        }));
        return lista;
    }

    /// <summary>
    /// Crea la orden de pago de la orden (sin guardar: va en la misma transacción que la validación).
    /// No crea otra si ya existe una, ni si la orden no tiene técnico.
    /// </summary>
    public async Task<RegistroPago?> GenerarAsync(OrdenTrabajo o, string generadaPor)
    {
        if (o.TecnicoAsignadoId == null) return null;
        if (await _db.RegistrosPago.AnyAsync(p => p.OrdenTrabajoId == o.Id)) return null;

        var actividades = (await ActividadesAsync(o.Id)).Sum(a => a.Subtotal);
        var materiales = (await MaterialesAsync(o.Id)).Sum(m => m.Subtotal);
        // Garantía (mantenimiento a menos de 6 meses): las refacciones no tienen costo. En órdenes de antes de este
        // cambio la marca era el costo total en 0 aunque hubiera refacciones entregadas.
        var garantia = o.AplicaGarantia || (o.CostoTotal == 0 && materiales > 0);
        if (garantia) materiales = 0m;
        var pago = new RegistroPago
        {
            OrdenTrabajoId = o.Id,
            TecnicoId = o.TecnicoAsignadoId.Value,
            // Igual que el pago capturado: 1 "hora" con la tarifa = actividades
            HorasTrabajadas = 1,
            TarifaHora = actividades,
            CostoManoObra = actividades,
            CostoRefacciones = materiales,
            OtrosCostos = 0,
            MontoTotal = actividades + materiales,
            Estado = EstadoPagoEnum.Pendiente,
            Notas = $"Generada automáticamente al validar {o.Folio} ({generadaPor})"
                    + (garantia ? ". Garantía: refacciones sin costo." : ""),
            FechaRegistro = DateTime.UtcNow
        };
        _db.RegistrosPago.Add(pago);
        return pago;
    }

    public async Task<DetalleOrdenPagoDto?> DetalleAsync(int pagoId)
    {
        var p = await _db.RegistrosPago.AsNoTracking()
            .Where(x => x.Id == pagoId)
            .Select(x => new
            {
                x.Id, x.Estado, x.OrdenTrabajoId, x.TecnicoId, Tecnico = x.Tecnico.NombreCompleto, x.FechaRegistro, x.FechaPago, x.Notas,
                x.CostoManoObra, x.CostoRefacciones, x.MontoTotal,
                Orden = new
                {
                    x.OrdenTrabajo.Folio, x.OrdenTrabajo.FechaCreacion, x.OrdenTrabajo.FechaFinalizacion, x.OrdenTrabajo.AplicaGarantia,
                    ReporteFolio = x.OrdenTrabajo.ReporteFalla != null ? x.OrdenTrabajo.ReporteFalla.Folio : null,
                    Vehiculo = x.OrdenTrabajo.Vehiculo.Codigo,
                    TipoId = (int)x.OrdenTrabajo.Vehiculo.Tipo,
                    Area = x.OrdenTrabajo.Vehiculo.Area != null ? x.OrdenTrabajo.Vehiculo.Area.Nombre : null
                }
            })
            .FirstOrDefaultAsync();
        if (p == null) return null;

        return new DetalleOrdenPagoDto
        {
            Id = p.Id,
            Folio = Folio(p.Id),
            EstadoId = (int)p.Estado,
            Estado = p.Estado.ToString(),
            OrdenTrabajoId = p.OrdenTrabajoId,
            OrdenTrabajoFolio = p.Orden.Folio,
            ReporteFolio = p.Orden.ReporteFolio,
            VehiculoCodigo = p.Orden.Vehiculo,
            TipoVehiculo = await _db.TiposVehiculo.Where(t => t.Id == p.Orden.TipoId).Select(t => t.Nombre).FirstOrDefaultAsync(),
            Area = p.Orden.Area,
            TecnicoId = p.TecnicoId,
            Tecnico = p.Tecnico,
            FechaCreacionOrden = p.Orden.FechaCreacion,
            FechaFinalizacionOrden = p.Orden.FechaFinalizacion,
            FechaRegistro = p.FechaRegistro,
            FechaPago = p.FechaPago,
            AplicaGarantia = p.Orden.AplicaGarantia,
            Actividades = await ActividadesAsync(p.OrdenTrabajoId),
            Materiales = await MaterialesAsync(p.OrdenTrabajoId),
            // Los montos son los de la orden de pago (fijos desde que se generó)
            CostoActividades = p.CostoManoObra,
            CostoMateriales = p.CostoRefacciones,
            Total = p.MontoTotal,
            Notas = p.Notas
        };
    }
}
