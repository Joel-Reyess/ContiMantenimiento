using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Services;

/// <summary>
/// Orden de pago automática (PDF 29-oct, 6.1): al llegar la orden de trabajo a DISPONIBLE se genera una sola
/// orden de pago con lo que ya trae la orden (actividades realizadas, refacciones y consumibles usados,
/// técnico, vehículo...). Ya no se captura a mano.
/// PDF 06-nov: los importes salen del tarifario de la empresa del técnico (PAG-03) y las refacciones ya no se
/// cobran: el costo de la actividad incluye materiales y mano de obra (OT-24). Los materiales solo se informan.
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
    /// Actividades realizadas con su importe: lo que el técnico marcó en el checklist (mismo cálculo que se usaba
    /// al capturar el pago); si no marcó nada, los trabajos de la orden. Con empresa, cada actividad usa la tarifa
    /// de esa empresa y, si no la tiene, el costo base.
    /// </summary>
    public async Task<List<ActividadPagoDto>> ActividadesAsync(int ordenId, int? empresaId = null)
    {
        var lineas = (await _db.ChecklistRespuestas.AsNoTracking()
                .Where(r => r.OrdenTrabajoId == ordenId && r.Valor != null && r.Valor != "")
                .OrderBy(r => r.Id)
                .Select(r => new { r.ChecklistItemId, r.Valor, r.Cantidad, r.ChecklistItem.Pregunta, r.ChecklistItem.CostoEstimado })
                .ToListAsync())
            .Where(r => !RespuestasNegativas.Contains(r.Valor!.Trim().ToLowerInvariant()))
            .Select(r => (r.ChecklistItemId, r.Pregunta, Cantidad: r.Cantidad, r.CostoEstimado))
            .ToList();
        if (lineas.Count == 0)
        {
            lineas = (await _db.OrdenesTrabajoChecklistItems.AsNoTracking()
                    .Where(i => i.OrdenTrabajoId == ordenId)
                    .OrderBy(i => i.Id)
                    .Select(i => new { i.ChecklistItemId, i.ChecklistItem.Pregunta, i.Cantidad, i.ChecklistItem.CostoEstimado })
                    .ToListAsync())
                .Select(i => (i.ChecklistItemId, i.Pregunta, Cantidad: i.Cantidad ?? 1, i.CostoEstimado))
                .ToList();
        }

        var tarifas = new Dictionary<int, decimal>();
        if (empresaId.HasValue && lineas.Count > 0)
        {
            var ids = lineas.Select(l => l.ChecklistItemId).Distinct().ToList();
            tarifas = await _db.TarifasEmpresa.AsNoTracking()
                .Where(t => t.EmpresaId == empresaId.Value && ids.Contains(t.ChecklistItemId))
                .ToDictionaryAsync(t => t.ChecklistItemId, t => t.Costo);
        }

        return lineas
            .Select(l => Actividad(l.ChecklistItemId, l.Pregunta, l.Cantidad,
                tarifas.TryGetValue(l.ChecklistItemId, out var tarifa) ? tarifa : l.CostoEstimado))
            .ToList();
    }

    private static ActividadPagoDto Actividad(int? itemId, string descripcion, decimal cantidad, decimal costo)
    {
        var c = cantidad <= 0 ? 1 : cantidad;
        return new ActividadPagoDto
        {
            ChecklistItemId = itemId,
            Descripcion = descripcion,
            Cantidad = c,
            CostoUnitario = costo,
            Subtotal = Math.Round(c * costo, 2)
        };
    }

    /// <summary>
    /// Refacciones y consumibles usados (descontados del inventario) más las refacciones solicitadas y entregadas.
    /// Solo informativo (OT-24): nombre, código y cantidad, sin costos.
    /// </summary>
    public async Task<List<MaterialInformativoDto>> MaterialesAsync(int ordenId)
    {
        var lista = await _db.MaterialesOrdenTrabajo.AsNoTracking()
            .Where(m => m.OrdenTrabajoId == ordenId && m.Descontado)
            .OrderBy(m => m.Id)
            .Select(m => new MaterialInformativoDto
            {
                Codigo = m.Consumible.Codigo,
                Nombre = m.Consumible.Nombre,
                Categoria = m.Consumible.Categoria,
                Unidad = m.Consumible.Unidad,
                Cantidad = m.Cantidad
            })
            .ToListAsync();
        foreach (var m in lista) m.EsRefaccion = MaterialesOrdenService.EsRefaccion(m.Categoria);

        var solicitadas = await _db.SolicitudesRefaccion.AsNoTracking()
            .Where(s => s.OrdenTrabajoId == ordenId && s.Estado == "Entregada")
            .OrderBy(s => s.Id)
            .Select(s => new MaterialInformativoDto
            {
                Codigo = s.NumeroParte ?? "",
                Nombre = s.NombreRefaccion,
                Categoria = "Refaccion",
                EsRefaccion = true,
                Unidad = "pz",
                Cantidad = s.Cantidad
            })
            .ToListAsync();
        lista.AddRange(solicitadas);
        return lista;
    }

    /// <summary>
    /// Crea la orden de pago de la orden (sin guardar: va en la misma transacción que la validación).
    /// No crea otra si ya existe una, ni si la orden no tiene técnico. Los importes son los del tarifario de la
    /// empresa del técnico (o el costo base si no tiene empresa) y quedan fijos con sus renglones.
    /// </summary>
    public async Task<RegistroPago?> GenerarAsync(OrdenTrabajo o, string generadaPor)
    {
        if (o.TecnicoAsignadoId == null) return null;
        if (await _db.RegistrosPago.AnyAsync(p => p.OrdenTrabajoId == o.Id)) return null;

        var empresa = await _db.Users
            .Where(u => u.Id == o.TecnicoAsignadoId.Value && u.Empresa != null)
            .Select(u => new { u.Empresa!.Id, u.Empresa.Nombre })
            .FirstOrDefaultAsync();
        var actividades = await ActividadesAsync(o.Id, empresa?.Id);
        var total = actividades.Sum(a => a.Subtotal);
        var pago = new RegistroPago
        {
            OrdenTrabajoId = o.Id,
            TecnicoId = o.TecnicoAsignadoId.Value,
            EmpresaId = empresa?.Id,
            // Igual que el pago capturado: 1 "hora" con la tarifa = actividades
            HorasTrabajadas = 1,
            TarifaHora = total,
            CostoManoObra = total,
            // El costo de la actividad ya contempla materiales y mano de obra (OT-24)
            CostoRefacciones = 0,
            OtrosCostos = 0,
            MontoTotal = total,
            Estado = EstadoPagoEnum.Pendiente,
            Notas = Recortar($"Generada automáticamente al validar {o.Folio} ({generadaPor})"
                             + (empresa != null ? $". Tarifas de {empresa.Nombre}" : ". Técnico sin empresa: tarifa base"), 300),
            FechaRegistro = DateTime.UtcNow
        };
        var orden = 1;
        foreach (var a in actividades)
        {
            pago.Actividades.Add(new RegistroPagoActividad
            {
                ChecklistItemId = a.ChecklistItemId,
                Orden = orden++,
                Descripcion = Recortar(a.Descripcion, 200),
                Cantidad = a.Cantidad,
                CostoUnitario = a.CostoUnitario,
                Subtotal = a.Subtotal
            });
        }
        _db.RegistrosPago.Add(pago);
        return pago;
    }

    private static string Recortar(string texto, int max) => texto.Length > max ? texto[..max] : texto;

    public async Task<DetalleOrdenPagoDto?> DetalleAsync(int pagoId)
    {
        var p = await _db.RegistrosPago.AsNoTracking()
            .Where(x => x.Id == pagoId)
            .Select(x => new
            {
                x.Id, x.Estado, x.OrdenTrabajoId, x.TecnicoId, Tecnico = x.Tecnico.NombreCompleto, x.FechaRegistro, x.FechaAprobacion, x.FechaPago, x.Notas,
                x.CostoManoObra, x.CostoRefacciones, x.OtrosCostos, x.MontoTotal, x.NumeroFactura,
                x.EmpresaId,
                Empresa = x.Empresa != null ? x.Empresa.Nombre : null,
                EmpresaIdentificador = x.Empresa != null ? x.Empresa.Identificador : null,
                Orden = new
                {
                    x.OrdenTrabajo.Folio, x.OrdenTrabajo.FechaCreacion, x.OrdenTrabajo.FechaFinalizacion, x.OrdenTrabajo.FechaValidacion, x.OrdenTrabajo.AplicaGarantia,
                    ReporteFolio = x.OrdenTrabajo.ReporteFalla != null ? x.OrdenTrabajo.ReporteFalla.Folio : null,
                    FechaReporte = x.OrdenTrabajo.ReporteFalla != null ? (DateTime?)x.OrdenTrabajo.ReporteFalla.FechaReporte : null,
                    Vehiculo = x.OrdenTrabajo.Vehiculo.Codigo,
                    TipoId = (int)x.OrdenTrabajo.Vehiculo.Tipo,
                    Area = x.OrdenTrabajo.Vehiculo.Area != null ? x.OrdenTrabajo.Vehiculo.Area.Nombre : null
                }
            })
            .FirstOrDefaultAsync();
        if (p == null) return null;

        // Renglones fijos desde que se generó; las órdenes de pago anteriores a este cambio no los tienen y se
        // calculan como entonces (costo base)
        var actividades = await _db.RegistroPagoActividades.AsNoTracking()
            .Where(a => a.RegistroPagoId == pagoId)
            .OrderBy(a => a.Orden)
            .Select(a => new ActividadPagoDto
            {
                ChecklistItemId = a.ChecklistItemId,
                Descripcion = a.Descripcion,
                Cantidad = a.Cantidad,
                CostoUnitario = a.CostoUnitario,
                Subtotal = a.Subtotal
            })
            .ToListAsync();
        var conRenglones = actividades.Count > 0;
        if (!conRenglones) actividades = await ActividadesAsync(p.OrdenTrabajoId);

        return new DetalleOrdenPagoDto
        {
            Id = p.Id,
            Folio = Folio(p.Id),
            EstadoId = (int)p.Estado,
            Estado = p.Estado.ToString(),
            OrdenTrabajoId = p.OrdenTrabajoId,
            OrdenTrabajoFolio = p.Orden.Folio,
            ReporteFolio = p.Orden.ReporteFolio,
            FechaReporte = p.Orden.FechaReporte,
            VehiculoCodigo = p.Orden.Vehiculo,
            TipoVehiculo = await _db.TiposVehiculo.Where(t => t.Id == p.Orden.TipoId).Select(t => t.Nombre).FirstOrDefaultAsync(),
            Area = p.Orden.Area,
            TecnicoId = p.TecnicoId,
            Tecnico = p.Tecnico,
            EmpresaId = p.EmpresaId,
            Empresa = p.Empresa,
            EmpresaIdentificador = p.EmpresaIdentificador,
            FechaCreacionOrden = p.Orden.FechaCreacion,
            FechaFinalizacionOrden = p.Orden.FechaFinalizacion,
            FechaValidacionOrden = p.Orden.FechaValidacion,
            FechaRegistro = p.FechaRegistro,
            FechaAprobacion = p.FechaAprobacion,
            FechaPago = p.FechaPago,
            NumeroFactura = p.NumeroFactura,
            AplicaGarantia = p.Orden.AplicaGarantia,
            Actividades = actividades,
            ImportesFijos = conRenglones,
            Materiales = await MaterialesAsync(p.OrdenTrabajoId),
            // Los montos son los de la orden de pago (fijos desde que se generó)
            CostoActividades = p.CostoManoObra,
            // Solo órdenes de pago aprobadas antes del cambio pueden traer un cargo por refacciones
            CostoMateriales = p.CostoRefacciones,
            OtrosCostos = p.OtrosCostos,
            Total = p.MontoTotal,
            Notas = p.Notas
        };
    }
}
