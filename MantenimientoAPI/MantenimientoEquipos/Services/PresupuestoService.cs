using System.Globalization;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Services;

/// <summary>Asignado, utilizado y saldo de una empresa según su libro de movimientos</summary>
public record SaldoEmpresa(decimal Asignado, decimal Utilizado, bool TienePresupuesto)
{
    public decimal Saldo => Asignado - Utilizado;
}

/// <summary>Cambio de saldo de una empresa, para avisar después de guardar si cruzó el umbral o llegó a $0</summary>
public record CambioSaldo(int EmpresaId, decimal SaldoAntes, decimal SaldoDespues, decimal Asignado);

/// <summary>Importe devuelto al presupuesto de una empresa por una orden eliminada o cancelada</summary>
public record ReversionPresupuesto(int EmpresaId, string Empresa, string? FolioOrden, string? FolioPago, decimal Monto, bool OrdenEliminada);

/// <summary>Quién y por qué (para el libro de movimientos)</summary>
public record ContextoPresupuesto(int? UsuarioId, string? NombreUsuario, string? Motivo);

/// <summary>
/// Presupuesto de Empresas (Reporte 6, PRS-01 a PRS-03). Cada empresa lleva un libro de movimientos:
/// asignado = asignaciones ± ajustes; utilizado = descuentos − reversiones; saldo = asignado − utilizado.
/// El descuento se hace al generarse la orden de pago (con el total de la OP); si la orden de trabajo o la orden de
/// pago se eliminan, o la orden de pago se cancela (rechaza), el importe regresa a la empresa con un movimiento de
/// reversión que conserva folios, importe, usuario, fecha y motivo. Las órdenes de pago generadas antes de este
/// módulo no tienen movimiento y no se tocan.
/// </summary>
public class PresupuestoService
{
    public const string ClaveSaldoMinimo = "Presupuesto.SaldoMinimo";
    public const string ClaveUmbral = "Presupuesto.UmbralPreventivo";
    public const string ClaveCapacidad = "Seleccion.CapacidadMaxima";
    public const string ClaveUltimaEmpresa = "Seleccion.UltimaEmpresaId";
    public const int UmbralPorDefecto = 20;
    public const int CapacidadPorDefecto = 10;

    private readonly MantenimientoDbContext _db;
    private readonly FlujoAvisos _avisos;

    public PresupuestoService(MantenimientoDbContext db, FlujoAvisos avisos)
    {
        _db = db;
        _avisos = avisos;
    }

    public static string Moneda(decimal monto) => monto.ToString("C2", CultureInfo.GetCultureInfo("es-MX"));

    // ===================== Configuración =====================

    public async Task<ConfigSeleccionDto> LeerConfigAsync()
    {
        var conf = await _db.ConfiguracionSistema.AsNoTracking()
            .Where(c => c.Clave == ClaveSaldoMinimo || c.Clave == ClaveUmbral || c.Clave == ClaveCapacidad)
            .ToDictionaryAsync(c => c.Clave, c => c.Valor);
        decimal Dec(string k, decimal def) =>
            conf.TryGetValue(k, out var v) && decimal.TryParse(v, NumberStyles.Number, CultureInfo.InvariantCulture, out var n) && n >= 0 ? n : def;
        int Ent(string k, int def, int min) => conf.TryGetValue(k, out var v) && int.TryParse(v, out var n) && n >= min ? n : def;
        return new ConfigSeleccionDto
        {
            SaldoMinimo = Dec(ClaveSaldoMinimo, 0),
            UmbralPreventivo = Ent(ClaveUmbral, UmbralPorDefecto, 0),
            CapacidadMaxima = Ent(ClaveCapacidad, CapacidadPorDefecto, 1)
        };
    }

    public async Task GuardarConfigAsync(ConfigSeleccionDto c, int? usuarioId)
    {
        if (c.SaldoMinimo < 0 || c.SaldoMinimo > 100_000_000)
            throw new FlujoException("El saldo mínimo debe estar entre $0 y $100,000,000.", 400);
        if (c.UmbralPreventivo < 1 || c.UmbralPreventivo > 99)
            throw new FlujoException("El aviso preventivo debe estar entre 1% y 99% del presupuesto asignado.", 400);
        if (c.CapacidadMaxima < 1 || c.CapacidadMaxima > 500)
            throw new FlujoException("La capacidad máxima debe estar entre 1 y 500 órdenes activas por empresa.", 400);
        await GuardarValorAsync(ClaveSaldoMinimo, Math.Round(c.SaldoMinimo, 2).ToString(CultureInfo.InvariantCulture), "decimal",
            "Saldo mínimo para que una empresa reciba órdenes de trabajo nuevas", usuarioId);
        await GuardarValorAsync(ClaveUmbral, c.UmbralPreventivo.ToString(), "int",
            "Porcentaje del presupuesto asignado en el que se avisa que la empresa está por agotarlo", usuarioId);
        await GuardarValorAsync(ClaveCapacidad, c.CapacidadMaxima.ToString(), "int",
            "Órdenes activas que puede tener cada empresa a la vez", usuarioId);
        await _db.SaveChangesAsync();
    }

    /// <summary>Guarda un valor de configuración (sin SaveChanges)</summary>
    public async Task GuardarValorAsync(string clave, string valor, string tipo, string descripcion, int? usuarioId)
    {
        var c = await _db.ConfiguracionSistema.FirstOrDefaultAsync(x => x.Clave == clave);
        if (c == null)
        {
            c = new ConfiguracionSistema { Clave = clave, Descripcion = descripcion, TipoDato = tipo };
            _db.ConfiguracionSistema.Add(c);
        }
        c.Valor = valor;
        c.UpdatedAt = DateTime.UtcNow;
        c.UpdatedBy = usuarioId;
    }

    // ===================== Saldos =====================

    public async Task<Dictionary<int, SaldoEmpresa>> SaldosAsync(IReadOnlyCollection<int>? empresaIds = null)
    {
        var q = _db.MovimientosPresupuesto.AsNoTracking();
        if (empresaIds != null) q = q.Where(m => empresaIds.Contains(m.EmpresaId));
        var filas = await q.GroupBy(m => new { m.EmpresaId, m.Tipo })
            .Select(g => new { g.Key.EmpresaId, g.Key.Tipo, Total = g.Sum(x => x.Monto) })
            .ToListAsync();
        return filas.GroupBy(f => f.EmpresaId).ToDictionary(g => g.Key, g =>
        {
            decimal T(string tipo) => g.Where(x => x.Tipo == tipo).Sum(x => x.Total);
            var asignado = T(MovimientoPresupuesto.Asignacion) + T(MovimientoPresupuesto.Ajuste);
            var utilizado = T(MovimientoPresupuesto.Descuento) - T(MovimientoPresupuesto.Reversion);
            var tiene = g.Any(x => x.Tipo == MovimientoPresupuesto.Asignacion || x.Tipo == MovimientoPresupuesto.Ajuste);
            return new SaldoEmpresa(asignado, utilizado, tiene);
        });
    }

    public async Task<SaldoEmpresa> SaldoAsync(int empresaId) =>
        (await SaldosAsync(new[] { empresaId })).TryGetValue(empresaId, out var s) ? s : new SaldoEmpresa(0, 0, false);

    /// <summary>Disponible / Preventivo / Agotado / Sin presupuesto</summary>
    public static string EstadoFinanciero(SaldoEmpresa s, int umbral)
    {
        if (!s.TienePresupuesto) return "Sin presupuesto";
        if (s.Saldo <= 0) return "Agotado";
        if (s.Asignado > 0 && s.Saldo <= s.Asignado * umbral / 100m) return "Preventivo";
        return "Disponible";
    }

    // ===================== Movimientos manuales =====================

    /// <summary>Asignación (suma al presupuesto) o ajuste (positivo o negativo) que hace el Administrador o el Gerente</summary>
    public async Task<MovimientoPresupuesto> RegistrarManualAsync(MovimientoPresupuestoRequest req, ContextoPresupuesto ctx)
    {
        var tipo = (req.Tipo ?? "").Trim();
        if (tipo.Equals("asignacion", StringComparison.OrdinalIgnoreCase) || tipo.Equals("asignación", StringComparison.OrdinalIgnoreCase)) tipo = MovimientoPresupuesto.Asignacion;
        else if (tipo.Equals("ajuste", StringComparison.OrdinalIgnoreCase)) tipo = MovimientoPresupuesto.Ajuste;
        else throw new FlujoException("El movimiento debe ser una asignación o un ajuste.", 400);
        var monto = Math.Round(req.Monto, 2);
        if (tipo == MovimientoPresupuesto.Asignacion && monto <= 0)
            throw new FlujoException("Escribe el monto a asignar (mayor a $0).", 400);
        if (tipo == MovimientoPresupuesto.Ajuste && monto == 0)
            throw new FlujoException("Escribe el monto del ajuste (positivo para sumar, negativo para restar).", 400);
        if (Math.Abs(monto) > 100_000_000)
            throw new FlujoException("El monto no puede pasar de $100,000,000.", 400);
        var motivo = Limpio(req.Motivo);
        if (tipo == MovimientoPresupuesto.Ajuste && motivo == null)
            throw new FlujoException("Escribe el motivo del ajuste.", 400, "MotivoObligatorio");

        var empresa = await _db.Empresas.AsNoTracking().FirstOrDefaultAsync(e => e.Id == req.EmpresaId)
                      ?? throw new FlujoException("Empresa no encontrada.", 404);
        var antes = await SaldoAsync(empresa.Id);
        if (tipo == MovimientoPresupuesto.Ajuste && antes.Asignado + monto < 0)
            throw new FlujoException($"El ajuste dejaría el presupuesto asignado de {empresa.Nombre} en negativo (hoy es {Moneda(antes.Asignado)}).", 400);

        var mov = new MovimientoPresupuesto
        {
            EmpresaId = empresa.Id,
            Tipo = tipo,
            Monto = monto,
            SaldoResultante = antes.Saldo + monto,
            Motivo = Recortar(motivo ?? "Asignación de presupuesto", 500),
            UsuarioId = ctx.UsuarioId,
            NombreUsuario = Recortar(ctx.NombreUsuario, 150),
            Fecha = DateTime.UtcNow
        };
        _db.MovimientosPresupuesto.Add(mov);
        await _db.SaveChangesAsync();
        await AvisarUmbralesAsync(new[] { new CambioSaldo(empresa.Id, antes.Saldo, mov.SaldoResultante, antes.Asignado + monto) }, ctx.UsuarioId);
        return mov;
    }

    // ===================== Descuento al generar la orden de pago =====================

    /// <summary>
    /// Descuenta del presupuesto de la empresa el total de la orden de pago recién guardada (ya con Id). Agrega el
    /// movimiento sin guardar; devuelve el cambio de saldo para avisar después de confirmar.
    /// </summary>
    public async Task<CambioSaldo?> DescontarAsync(RegistroPago pago, string? folioOrden, int? vehiculoId, string? vehiculoCodigo, ContextoPresupuesto ctx)
    {
        if (pago.EmpresaId == null || pago.Id == 0) return null;
        if (await _db.MovimientosPresupuesto.AnyAsync(m => m.RegistroPagoId == pago.Id)) return null;
        var antes = await SaldoAsync(pago.EmpresaId.Value);
        var mov = new MovimientoPresupuesto
        {
            EmpresaId = pago.EmpresaId.Value,
            Tipo = MovimientoPresupuesto.Descuento,
            Monto = pago.MontoTotal,
            SaldoResultante = antes.Saldo - pago.MontoTotal,
            RegistroPagoId = pago.Id,
            FolioPago = OrdenPagoService.Folio(pago.Id),
            OrdenTrabajoId = pago.OrdenTrabajoId,
            FolioOrden = folioOrden,
            VehiculoId = vehiculoId,
            VehiculoCodigo = Recortar(vehiculoCodigo, 50),
            Motivo = Recortar(ctx.Motivo ?? $"Orden de pago generada para {folioOrden}", 500),
            UsuarioId = ctx.UsuarioId,
            NombreUsuario = Recortar(ctx.NombreUsuario, 150),
            Fecha = DateTime.UtcNow
        };
        _db.MovimientosPresupuesto.Add(mov);
        return new CambioSaldo(pago.EmpresaId.Value, antes.Saldo, mov.SaldoResultante, antes.Asignado);
    }

    // ===================== Reversión y sincronización =====================

    /// <summary>
    /// Deja el libro de cada orden de pago como debe estar: si la OP se va a eliminar (o está cancelada) su importe
    /// regresa a la empresa; si una OP cancelada se vuelve a aprobar o pagar, se descuenta otra vez. Solo toca las OP
    /// que ya descontaron presupuesto (las anteriores a este módulo no tienen movimientos). Guarda los movimientos.
    /// </summary>
    /// <param name="eliminadas">true si las órdenes de pago se van a eliminar (llamar ANTES de borrarlas)</param>
    public async Task<List<ReversionPresupuesto>> SincronizarPagosAsync(IReadOnlyCollection<int> pagoIds, bool eliminadas, bool ordenEliminada, ContextoPresupuesto ctx)
    {
        var resultado = new List<ReversionPresupuesto>();
        var ids = pagoIds.Distinct().ToList();
        if (ids.Count == 0) return resultado;
        var movimientos = await _db.MovimientosPresupuesto.AsNoTracking()
            .Where(m => m.RegistroPagoId != null && ids.Contains(m.RegistroPagoId.Value)
                        && (m.Tipo == MovimientoPresupuesto.Descuento || m.Tipo == MovimientoPresupuesto.Reversion))
            .OrderBy(m => m.Id)
            .ToListAsync();
        if (movimientos.Count == 0) return resultado;

        var pagos = await _db.RegistrosPago.AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .Select(p => new { p.Id, p.Estado, p.OrdenTrabajoId, Folio = p.OrdenTrabajo.Folio, p.OrdenTrabajo.VehiculoId, Vehiculo = p.OrdenTrabajo.Vehiculo.Codigo })
            .ToDictionaryAsync(p => p.Id);
        var nombres = await _db.Empresas.AsNoTracking().ToDictionaryAsync(e => e.Id, e => e.Nombre);
        var cambios = new List<CambioSaldo>();

        foreach (var g in movimientos.GroupBy(m => m.RegistroPagoId!.Value))
        {
            var primero = g.First(m => m.Tipo == MovimientoPresupuesto.Descuento || m.Tipo == MovimientoPresupuesto.Reversion);
            var original = g.FirstOrDefault(m => m.Tipo == MovimientoPresupuesto.Descuento)?.Monto ?? 0;
            var neto = g.Where(m => m.Tipo == MovimientoPresupuesto.Descuento).Sum(m => m.Monto)
                       - g.Where(m => m.Tipo == MovimientoPresupuesto.Reversion).Sum(m => m.Monto);
            pagos.TryGetValue(g.Key, out var pago);
            var debeConsumir = !eliminadas && pago != null && pago.Estado != EstadoPagoEnum.Rechazado;
            var objetivo = debeConsumir ? original : 0;
            var diferencia = objetivo - neto;
            if (diferencia == 0) continue;

            var empresaId = primero.EmpresaId;
            var antes = await SaldoAsync(empresaId);
            var tipo = diferencia > 0 ? MovimientoPresupuesto.Descuento : MovimientoPresupuesto.Reversion;
            var monto = Math.Abs(diferencia);
            var folioOrden = pago?.Folio ?? primero.FolioOrden;
            var motivo = Limpio(ctx.Motivo) ?? (tipo == MovimientoPresupuesto.Descuento
                ? $"La orden de pago {primero.FolioPago} se reactivó"
                : eliminadas ? $"Se eliminó la orden de pago {primero.FolioPago}" : $"Se canceló la orden de pago {primero.FolioPago}");
            var saldo = antes.Saldo + (tipo == MovimientoPresupuesto.Reversion ? monto : -monto);
            _db.MovimientosPresupuesto.Add(new MovimientoPresupuesto
            {
                EmpresaId = empresaId,
                Tipo = tipo,
                Monto = monto,
                SaldoResultante = saldo,
                RegistroPagoId = g.Key,
                FolioPago = primero.FolioPago,
                OrdenTrabajoId = pago?.OrdenTrabajoId ?? primero.OrdenTrabajoId,
                FolioOrden = folioOrden,
                VehiculoId = pago?.VehiculoId ?? primero.VehiculoId,
                VehiculoCodigo = Recortar(pago?.Vehiculo ?? primero.VehiculoCodigo, 50),
                Motivo = Recortar(motivo, 500),
                UsuarioId = ctx.UsuarioId,
                NombreUsuario = Recortar(ctx.NombreUsuario, 150),
                Fecha = DateTime.UtcNow
            });
            // Se guarda uno por uno para que el saldo del siguiente movimiento de la misma empresa ya lo cuente
            await _db.SaveChangesAsync();
            if (tipo == MovimientoPresupuesto.Reversion)
                resultado.Add(new ReversionPresupuesto(empresaId, nombres.GetValueOrDefault(empresaId, "la empresa"), folioOrden, primero.FolioPago, monto, ordenEliminada));
            else
                cambios.Add(new CambioSaldo(empresaId, antes.Saldo, saldo, antes.Asignado));
        }
        if (cambios.Count > 0) await AvisarUmbralesAsync(cambios, ctx.UsuarioId);
        return resultado;
    }

    // ===================== Avisos =====================

    /// <summary>Aviso preventivo al cruzar el umbral y crítico al llegar a $0 (Gerente de Mantenimiento)</summary>
    public async Task AvisarUmbralesAsync(IEnumerable<CambioSaldo> cambios, int? actor)
    {
        var umbral = (await LeerConfigAsync()).UmbralPreventivo;
        foreach (var c in cambios)
        {
            var limite = c.Asignado * umbral / 100m;
            if (c.SaldoDespues <= 0 && c.SaldoAntes > 0)
                await _avisos.PresupuestoAgotadoAsync(c.EmpresaId, actor);
            else if (c.SaldoDespues > 0 && c.Asignado > 0 && c.SaldoDespues <= limite && c.SaldoAntes > limite)
                await _avisos.PresupuestoPreventivoAsync(c.EmpresaId, actor);
        }
    }

    public Task AvisarReversionesAsync(IEnumerable<ReversionPresupuesto> reversiones, int? actor) =>
        _avisos.PresupuestoRestituidoAsync(reversiones.ToList(), actor);

    // ===================== Consulta del libro =====================

    public async Task<List<MovimientoPresupuestoDto>> MovimientosAsync(int? empresaId, int max = 300)
    {
        var q = _db.MovimientosPresupuesto.AsNoTracking();
        if (empresaId.HasValue) q = q.Where(m => m.EmpresaId == empresaId);
        return await q.OrderByDescending(m => m.Fecha).ThenByDescending(m => m.Id)
            .Take(Math.Clamp(max, 1, 2000))
            .Select(m => new MovimientoPresupuestoDto
            {
                Id = m.Id, EmpresaId = m.EmpresaId, Empresa = m.Empresa.Nombre, Tipo = m.Tipo, Monto = m.Monto,
                SaldoResultante = m.SaldoResultante, FolioPago = m.FolioPago, OrdenTrabajoId = m.OrdenTrabajoId, FolioOrden = m.FolioOrden,
                VehiculoCodigo = m.VehiculoCodigo, Motivo = m.Motivo, Usuario = m.NombreUsuario, Fecha = m.Fecha
            })
            .ToListAsync();
    }

    private static string? Limpio(string? texto) => string.IsNullOrWhiteSpace(texto) ? null : texto.Trim();
    private static string? Recortar(string? texto, int max) => texto == null || texto.Length <= max ? texto : texto[..max];
}
