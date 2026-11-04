using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Services;

/// <summary>
/// Consumo de inventario en la orden de trabajo (PDF 29-oct, 5.1): en la etapa TALLER el técnico elige las
/// refacciones y consumibles que usó; al terminar la reparación se descuentan del inventario (con su
/// movimiento en el historial) y pasan a la orden de pago. Nunca más de lo que hay en existencia.
/// </summary>
public class MaterialesOrdenService
{
    public const string MensajeSinExistencia =
        "La refacción seleccionada no cuenta con existencia suficiente para completar la operación solicitada. Consulta con el Gerente de Mantenimiento.";

    private static readonly EstadoOrdenTrabajoEnum[] EnTaller =
        { EstadoOrdenTrabajoEnum.Asignada, EstadoOrdenTrabajoEnum.EnProceso, EstadoOrdenTrabajoEnum.EsperandoRefacciones };

    private readonly MantenimientoDbContext _db;
    private readonly FlujoAvisos _avisos;

    public MaterialesOrdenService(MantenimientoDbContext db, FlujoAvisos avisos)
    {
        _db = db;
        _avisos = avisos;
    }

    public static bool EsRefaccion(string? categoria) =>
        (categoria ?? string.Empty).Contains("refac", StringComparison.OrdinalIgnoreCase);

    private static bool Trabaja(OrdenTrabajo o, UsuarioFlujo u) =>
        u.EsAdmin || u.Es("Supervisor") || (u.Es("Tecnico") && o.TecnicoAsignadoId == u.Id);

    private static string? Bloqueo(OrdenTrabajo o)
    {
        if (o.Estado == EstadoOrdenTrabajoEnum.Cancelada) return "La orden está cancelada.";
        if (o.Estado is EstadoOrdenTrabajoEnum.Validada or EstadoOrdenTrabajoEnum.Entregado)
            return "La orden ya está DISPONIBLE: sus consumos quedan bloqueados. Cualquier ajuste se hace con un movimiento de inventario autorizado por el Gerente de Mantenimiento.";
        if (o.Estado == EstadoOrdenTrabajoEnum.Completada)
            return "La reparación ya se terminó: los materiales se descontaron del inventario.";
        if (o.FechaAceptacion == null || !EnTaller.Contains(o.Estado))
            return "Los materiales se registran cuando el técnico acepta la orden (etapa TALLER).";
        return null;
    }

    public async Task<MaterialesOrdenDto> GetAsync(int ordenId, UsuarioFlujo u)
    {
        var o = await _db.OrdenesTrabajo.AsNoTracking().FirstOrDefaultAsync(x => x.Id == ordenId)
                ?? throw new FlujoException("Orden de trabajo no encontrada", 404);
        var items = await _db.MaterialesOrdenTrabajo.AsNoTracking()
            .Where(m => m.OrdenTrabajoId == ordenId)
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
                // Pendiente: el costo vigente del inventario; descontado: el que quedó fijo
                CostoUnitario = m.Descontado ? m.CostoUnitario : m.Consumible.CostoUnitario,
                Descontado = m.Descontado,
                FechaDescuento = m.FechaDescuento,
                StockActual = m.Consumible.StockActual
            })
            .ToListAsync();
        foreach (var i in items)
        {
            i.EsRefaccion = EsRefaccion(i.Categoria);
            i.Subtotal = Math.Round(i.Cantidad * i.CostoUnitario, 2);
        }

        var bloqueo = Bloqueo(o);
        return new MaterialesOrdenDto
        {
            OrdenId = o.Id,
            OrdenFolio = o.Folio,
            Editable = bloqueo == null && Trabaja(o, u),
            Bloqueo = bloqueo,
            AplicaGarantia = o.AplicaGarantia,
            Items = items,
            TotalRefacciones = items.Where(i => i.EsRefaccion).Sum(i => i.Subtotal),
            TotalConsumibles = items.Where(i => !i.EsRefaccion).Sum(i => i.Subtotal),
            Total = items.Sum(i => i.Subtotal)
        };
    }

    /// <summary>Reemplaza los materiales aún no descontados de la orden (los descontados no se tocan)</summary>
    public async Task<MaterialesOrdenDto> GuardarAsync(int ordenId, GuardarMaterialesRequest req, UsuarioFlujo u)
    {
        var o = await _db.OrdenesTrabajo.FirstOrDefaultAsync(x => x.Id == ordenId)
                ?? throw new FlujoException("Orden de trabajo no encontrada", 404);
        if (!Trabaja(o, u)) throw new FlujoException("Solo el técnico asignado a la orden puede registrar materiales.", 403);
        var bloqueo = Bloqueo(o);
        if (bloqueo != null) throw new FlujoException(bloqueo);

        if (req.Items.Any(i => i.Cantidad <= 0))
            throw new FlujoException("Cada material debe tener una cantidad mayor a 0.", 400);
        var pedidos = req.Items.GroupBy(i => i.ConsumibleId).ToDictionary(g => g.Key, g => g.Sum(i => i.Cantidad));
        var ids = pedidos.Keys.ToList();
        var inventario = await _db.Consumibles.Where(c => ids.Contains(c.Id) && c.Activo).ToDictionaryAsync(c => c.Id);
        if (inventario.Count != ids.Count)
            throw new FlujoException("Uno de los materiales elegidos ya no está en el inventario; actualiza la pantalla.", 400);

        var sinExistencia = pedidos.Where(p => p.Value > inventario[p.Key].StockActual).Select(p => inventario[p.Key]).ToList();
        if (sinExistencia.Count > 0)
            throw new FlujoException($"{MensajeSinExistencia} ({string.Join(", ", sinExistencia.Select(c => $"{c.Nombre}: hay {c.StockActual:0.##} {c.Unidad}"))})",
                400, "SinExistencia");

        // Todo o nada, y uno a la vez por orden: se toma la orden (sigue en TALLER) antes de reemplazar la lista;
        // otro guardado o el término de la reparación esperan a que este termine
        await using var tx = await _db.Database.BeginTransactionAsync();
        var tomada = await _db.OrdenesTrabajo
            .Where(x => x.Id == ordenId && x.FechaAceptacion != null && EnTaller.Contains(x.Estado))
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.UpdatedAt, DateTime.UtcNow));
        if (tomada == 0) throw new FlujoException("La orden cambió de estado mientras guardabas. Actualiza la pantalla.");
        await _db.MaterialesOrdenTrabajo.Where(m => m.OrdenTrabajoId == ordenId && !m.Descontado).ExecuteDeleteAsync();
        foreach (var (consumibleId, cantidad) in pedidos)
        {
            _db.MaterialesOrdenTrabajo.Add(new MaterialOrdenTrabajo
            {
                OrdenTrabajoId = ordenId,
                ConsumibleId = consumibleId,
                Cantidad = cantidad,
                CostoUnitario = inventario[consumibleId].CostoUnitario,
                RegistradoPorId = u.Id,
                FechaRegistro = DateTime.UtcNow
            });
        }
        FlujoHistorial.Agregar(_db, o.ReporteFallaId, o.Id, "TALLER", "Materiales", u.Id, u.Nombre, FlujoHistorial.RolPrincipal(u.Roles),
            pedidos.Count == 0
                ? "Quitó los materiales pendientes"
                : "Materiales: " + string.Join(", ", pedidos.Select(p => $"{inventario[p.Key].Nombre} x{p.Value:0.##}")));
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        return await GetAsync(ordenId, u);
    }

    /// <summary>
    /// Al terminar la reparación: descuenta del inventario lo pendiente, con su movimiento. Va dentro de la
    /// transacción de quien termina la orden; si algo ya no alcanza, no se descuenta nada y se avisa.
    /// Regresa los artículos que llegaron a su stock mínimo (para avisar al Gerente después de guardar).
    /// </summary>
    public async Task<List<(int Id, string Nombre)>> DescontarAsync(OrdenTrabajo o, int userId)
    {
        var pendientes = await _db.MaterialesOrdenTrabajo.Include(m => m.Consumible)
            .Where(m => m.OrdenTrabajoId == o.Id && !m.Descontado)
            .ToListAsync();
        var minimos = new List<(int, string)>();
        var ahora = DateTime.UtcNow;
        foreach (var g in pendientes.GroupBy(m => m.ConsumibleId).OrderBy(g => g.Key))
        {
            var cantidad = g.Sum(m => m.Cantidad);
            var c = g.First().Consumible;
            // Descuento condicionado: si otra orden ya se llevó la existencia, no queda en negativo
            var descontados = await _db.Consumibles
                .Where(x => x.Id == g.Key && x.StockActual >= cantidad)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(x => x.StockActual, x => x.StockActual - cantidad)
                    .SetProperty(x => x.AlertaActiva, x => x.StockActual - cantidad <= x.StockMinimo)
                    .SetProperty(x => x.UpdatedAt, ahora));
            if (descontados == 0)
            {
                var hay = await _db.Consumibles.Where(x => x.Id == g.Key).Select(x => x.StockActual).FirstOrDefaultAsync();
                throw new InvalidOperationException($"{MensajeSinExistencia} ({c.Nombre}: se usaron {cantidad:0.##} y hay {hay:0.##} {c.Unidad})");
            }
            var despues = await _db.Consumibles.Where(x => x.Id == g.Key).Select(x => new { x.StockActual, x.StockMinimo, x.CostoUnitario }).FirstAsync();
            foreach (var m in g)
            {
                m.Descontado = true;
                m.FechaDescuento = ahora;
                m.CostoUnitario = despues.CostoUnitario;
            }
            _db.ConsumosConsumibles.Add(new ConsumoConsumible
            {
                ConsumibleId = g.Key,
                OrdenTrabajoId = o.Id,
                ReporteId = o.ReporteFallaId,
                UsuarioId = userId,
                TipoMovimiento = "consumo",
                Cantidad = cantidad,
                Comentario = $"{o.Folio}: usado en la reparación",
                Fecha = ahora
            });
            if (despues.StockActual <= despues.StockMinimo && despues.StockActual + cantidad > despues.StockMinimo)
                minimos.Add((g.Key, c.Nombre));
        }
        return minimos;
    }

    /// <summary>Aviso al Gerente de Mantenimiento cuando un artículo llega a su stock mínimo</summary>
    public Task AvisarStockMinimoAsync(IEnumerable<(int Id, string Nombre)> articulos, int? actorId) =>
        _avisos.StockMinimoAsync(articulos, actorId);

    /// <summary>Costo de lo que se usó (lo ya descontado, con el costo que quedó fijo)</summary>
    public async Task<decimal> CostoAsync(int ordenId) =>
        await _db.MaterialesOrdenTrabajo.Where(m => m.OrdenTrabajoId == ordenId && m.Descontado)
            .SumAsync(m => (decimal?)(m.Cantidad * m.CostoUnitario)) ?? 0m;
}
