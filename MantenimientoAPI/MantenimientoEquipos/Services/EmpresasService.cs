using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Services;

/// <summary>
/// Empresas proveedoras, sus tarifarios y el gasto por proveedor (PDF 06-nov: CFG-07, CFG-08, DSH-02).
/// La operación es la misma para todas; solo cambian los precios de las actividades.
/// </summary>
public class EmpresasService
{
    private const string SinAcentos = "SQL_Latin1_General_CP1_CI_AI";
    public const string SinEmpresa = "Sin empresa (tarifa base)";

    private readonly MantenimientoDbContext _db;
    private readonly EliminacionService _eliminacion;

    public EmpresasService(MantenimientoDbContext db, EliminacionService eliminacion)
    {
        _db = db;
        _eliminacion = eliminacion;
    }

    // ===== Empresas =====

    public async Task<List<EmpresaDto>> ListarAsync(bool soloActivas)
    {
        var query = _db.Empresas.AsNoTracking();
        if (soloActivas) query = query.Where(e => e.Activo);
        return await query
            .OrderBy(e => e.Nombre)
            .Select(e => new EmpresaDto
            {
                Id = e.Id,
                Nombre = e.Nombre,
                Identificador = e.Identificador,
                Activo = e.Activo,
                Contacto = e.Contacto,
                Telefono = e.Telefono,
                Email = e.Email,
                CreatedAt = e.CreatedAt,
                Tecnicos = e.Tecnicos.Count(),
                OrdenesPago = _db.RegistrosPago.Count(p => p.EmpresaId == e.Id),
                Tarifas = e.Tarifas.Count()
            })
            .ToListAsync();
    }

    public async Task<Empresa> CrearAsync(EmpresaRequest request)
    {
        var datos = await ValidarAsync(request, null);
        var empresa = new Empresa
        {
            Nombre = datos.Nombre,
            Identificador = datos.Identificador,
            Activo = request.Activo,
            Contacto = datos.Contacto,
            Telefono = datos.Telefono,
            Email = datos.Email,
            CreatedAt = DateTime.UtcNow
        };
        _db.Empresas.Add(empresa);
        await _db.SaveChangesAsync();
        return empresa;
    }

    public async Task<Empresa?> ActualizarAsync(int id, EmpresaRequest request)
    {
        var empresa = await _db.Empresas.FirstOrDefaultAsync(e => e.Id == id);
        if (empresa == null) return null;

        var datos = await ValidarAsync(request, id);
        var renombrada = empresa.Nombre != datos.Nombre;
        empresa.Nombre = datos.Nombre;
        empresa.Identificador = datos.Identificador;
        empresa.Activo = request.Activo;
        empresa.Contacto = datos.Contacto;
        empresa.Telefono = datos.Telefono;
        empresa.Email = datos.Email;
        empresa.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // EmpresaExterna (texto libre de antes) se mantiene como copia del nombre para lo que todavía lo lee
        if (renombrada)
            await _db.Users.Where(u => u.EmpresaId == id).ExecuteUpdateAsync(s => s.SetProperty(u => u.EmpresaExterna, empresa.Nombre));
        return empresa;
    }

    /// <summary>
    /// Elimina la empresa con sus tarifas. Si ya tiene técnicos u órdenes de pago no se elimina (se pierde el historial):
    /// hay que desactivarla. Devuelve el nombre, o null si no existe.
    /// </summary>
    public async Task<string?> EliminarAsync(int id, int? usuarioId, string? nombreUsuario)
    {
        var empresa = await _db.Empresas.FirstOrDefaultAsync(e => e.Id == id);
        if (empresa == null) return null;

        var tecnicos = await _db.Users.CountAsync(u => u.EmpresaId == id);
        var pagos = await _db.RegistrosPago.CountAsync(p => p.EmpresaId == id);
        if (tecnicos > 0 || pagos > 0)
        {
            var partes = new List<string>();
            if (tecnicos > 0) partes.Add($"{tecnicos} técnico(s)");
            if (pagos > 0) partes.Add($"{pagos} orden(es) de pago");
            throw new InvalidOperationException(
                $"{empresa.Nombre} tiene {string.Join(" y ", partes)}. Desactívala en lugar de eliminarla para conservar el historial.");
        }

        using var tx = await _db.Database.BeginTransactionAsync();
        var tarifas = await _db.TarifasEmpresa.Where(t => t.EmpresaId == id).ExecuteDeleteAsync();
        _db.Empresas.Remove(empresa);
        _eliminacion.Registrar(usuarioId, nombreUsuario, "Empresa", id,
            $"Empresa proveedora {empresa.Nombre} ({empresa.Identificador})" + (tarifas > 0 ? $" con {tarifas} tarifa(s)" : ""));
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        return empresa.Nombre;
    }

    private record DatosEmpresa(string Nombre, string Identificador, string? Contacto, string? Telefono, string? Email);

    /// <summary>Limpia y valida; nombre e identificador únicos sin importar mayúsculas ni acentos</summary>
    private async Task<DatosEmpresa> ValidarAsync(EmpresaRequest r, int? excluirId)
    {
        var nombre = Regex.Replace(r.Nombre ?? "", @"\s+", " ").Trim();
        // El RFC va en mayúsculas y sin espacios
        var identificador = Regex.Replace(r.Identificador ?? "", @"\s+", "").ToUpperInvariant();
        if (nombre.Length == 0) throw new ArgumentException("Escribe el nombre de la empresa.");
        if (identificador.Length == 0) throw new ArgumentException("Escribe el identificador (RFC o ID) de la empresa.");
        if (nombre.Length > 150) throw new ArgumentException("El nombre no puede pasar de 150 caracteres.");
        if (identificador.Length > 30) throw new ArgumentException("El identificador no puede pasar de 30 caracteres.");
        var email = Vacio(r.Email);
        if (email != null && !Regex.IsMatch(email, @"^[^\s@]+@[^\s@]+\.[^\s@]+$"))
            throw new ArgumentException("El correo de contacto no tiene un formato válido.");

        var mismoNombre = await _db.Empresas
            .Where(e => (excluirId == null || e.Id != excluirId) && EF.Functions.Collate(e.Nombre, SinAcentos) == nombre)
            .Select(e => new { e.Nombre, e.Activo })
            .FirstOrDefaultAsync();
        if (mismoNombre != null)
            throw new InvalidOperationException(mismoNombre.Activo
                ? $"Ya existe la empresa \"{mismoNombre.Nombre}\"."
                : $"Ya existe la empresa \"{mismoNombre.Nombre}\", pero está inactiva. Actívala en lugar de crear otra.");

        var mismoId = await _db.Empresas
            .Where(e => (excluirId == null || e.Id != excluirId) && EF.Functions.Collate(e.Identificador, SinAcentos) == identificador)
            .Select(e => e.Nombre)
            .FirstOrDefaultAsync();
        if (mismoId != null)
            throw new InvalidOperationException($"El identificador \"{identificador}\" ya lo tiene la empresa \"{mismoId}\".");

        return new DatosEmpresa(nombre, identificador, Vacio(r.Contacto), Vacio(r.Telefono), email);
    }

    private static string? Vacio(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    /// <summary>
    /// Empresa que se le puede asignar al usuario (USR-02): solo los técnicos llevan empresa, y debe estar activa
    /// (si ya la tenía y luego se desactivó, puede conservarla). Devuelve null si queda sin empresa.
    /// </summary>
    public async Task<Empresa?> EmpresaParaUsuarioAsync(int? empresaId, bool esTecnico, int? empresaActual)
    {
        if (!esTecnico || empresaId == null || empresaId <= 0) return null;
        var empresa = await _db.Empresas.FirstOrDefaultAsync(e => e.Id == empresaId.Value)
            ?? throw new ArgumentException("La empresa seleccionada no existe. Actualiza la pantalla.");
        if (!empresa.Activo && empresa.Id != empresaActual)
            throw new ArgumentException($"La empresa {empresa.Nombre} está inactiva. Actívala en Empresas proveedoras o elige otra.");
        return empresa;
    }

    // ===== Tarifario =====

    public async Task<List<TarifaEmpresaDto>?> TarifasAsync(int empresaId)
    {
        if (!await _db.Empresas.AnyAsync(e => e.Id == empresaId)) return null;
        return await _db.TarifasEmpresa.AsNoTracking()
            .Where(t => t.EmpresaId == empresaId)
            .OrderBy(t => t.ChecklistItemId)
            .Select(t => new TarifaEmpresaDto { ChecklistItemId = t.ChecklistItemId, Costo = t.Costo })
            .ToListAsync();
    }

    /// <summary>Guarda los precios de la empresa para las actividades indicadas; vacío = vuelve al costo base</summary>
    public async Task<List<TarifaEmpresaDto>?> GuardarTarifasAsync(int empresaId, GuardarTarifasRequest request)
    {
        if (!await _db.Empresas.AnyAsync(e => e.Id == empresaId)) return null;

        var items = request.Items ?? new();
        if (items.Any(i => i.Costo < 0)) throw new ArgumentException("Las tarifas no pueden ser negativas.");
        if (items.Any(i => i.Costo > 99_999_999m)) throw new ArgumentException("La tarifa es demasiado grande.");
        var ids = items.Select(i => i.ChecklistItemId).Distinct().ToList();
        var existentes = await _db.ChecklistItems.Where(i => ids.Contains(i.Id)).Select(i => i.Id).ToListAsync();
        var faltan = ids.Except(existentes).ToList();
        if (faltan.Count > 0) throw new ArgumentException("Una o más actividades ya no existen. Actualiza la pantalla.");

        var actuales = await _db.TarifasEmpresa.Where(t => t.EmpresaId == empresaId && ids.Contains(t.ChecklistItemId)).ToListAsync();
        var ahora = DateTime.UtcNow;
        // Si una actividad viene repetida, cuenta la última
        foreach (var item in items.GroupBy(i => i.ChecklistItemId).Select(g => g.Last()))
        {
            var tarifa = actuales.FirstOrDefault(t => t.ChecklistItemId == item.ChecklistItemId);
            if (item.Costo == null)
            {
                if (tarifa != null) _db.TarifasEmpresa.Remove(tarifa);
            }
            else if (tarifa == null)
            {
                _db.TarifasEmpresa.Add(new TarifaEmpresa { EmpresaId = empresaId, ChecklistItemId = item.ChecklistItemId, Costo = Math.Round(item.Costo.Value, 2), UpdatedAt = ahora });
            }
            else if (tarifa.Costo != Math.Round(item.Costo.Value, 2))
            {
                tarifa.Costo = Math.Round(item.Costo.Value, 2);
                tarifa.UpdatedAt = ahora;
            }
        }
        await _db.SaveChangesAsync();
        return await TarifasAsync(empresaId);
    }

    // ===== Dashboard financiero por proveedor (DSH-02) =====

    private static readonly string[] Meses =
        { "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre" };
    private static readonly string[] MesesCortos =
        { "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic" };

    public static readonly string[] Periodicidades = { "semanal", "quincenal", "mensual" };

    /// <summary>
    /// Reparaciones (órdenes de pago no rechazadas), costo total y costo promedio por empresa en los últimos
    /// <paramref name="periodos"/> periodos. Cada orden de pago cuenta en la empresa con la que se generó y en el periodo
    /// de su fecha de generación (cuando la reparación quedó validada). <paramref name="zonaMinutos"/> es la diferencia
    /// UTC − hora local del navegador (como getTimezoneOffset), para cortar los periodos en hora local.
    /// </summary>
    public async Task<GastoProveedoresDto> GastoPorProveedorAsync(string periodicidad, int periodos, int? empresaId, int zonaMinutos, DateTime? ahoraUtc = null)
    {
        periodicidad = (periodicidad ?? "").Trim().ToLowerInvariant();
        if (!Periodicidades.Contains(periodicidad)) periodicidad = "mensual";
        periodos = Math.Clamp(periodos, 1, 24);
        zonaMinutos = Math.Clamp(zonaMinutos, -14 * 60, 14 * 60);

        var hoyLocal = (ahoraUtc ?? DateTime.UtcNow).AddMinutes(-zonaMinutos).Date;
        var lista = new List<GastoPeriodoDto>();
        var inicio = InicioPeriodo(hoyLocal, periodicidad);
        for (var i = 0; i < periodos; i++)
        {
            var fin = FinPeriodo(inicio, periodicidad);
            lista.Add(new GastoPeriodoDto { Clave = Clave(inicio, periodicidad), Etiqueta = Etiqueta(inicio, fin, periodicidad), Desde = inicio, Hasta = fin });
            inicio = InicioPeriodo(inicio.AddDays(-1), periodicidad);
        }

        // Rango completo en UTC
        var desdeUtc = lista[^1].Desde.AddMinutes(zonaMinutos);
        var hastaUtc = lista[0].Hasta.AddMinutes(zonaMinutos);
        var query = _db.RegistrosPago.AsNoTracking()
            .Where(p => p.Estado != EstadoPagoEnum.Rechazado && p.FechaRegistro >= desdeUtc && p.FechaRegistro < hastaUtc);
        if (empresaId == 0) query = query.Where(p => p.EmpresaId == null);
        else if (empresaId > 0) query = query.Where(p => p.EmpresaId == empresaId);
        var pagos = await query
            .Select(p => new { p.EmpresaId, Empresa = p.Empresa != null ? p.Empresa.Nombre : null, p.FechaRegistro, p.MontoTotal })
            .ToListAsync();

        foreach (var periodo in lista)
        {
            var delPeriodo = pagos
                .Where(p => { var local = p.FechaRegistro.AddMinutes(-zonaMinutos); return local >= periodo.Desde && local < periodo.Hasta; })
                .ToList();
            periodo.Proveedores = delPeriodo
                .GroupBy(p => new { p.EmpresaId, p.Empresa })
                .Select(g => Fila(g.Key.EmpresaId, g.Key.Empresa ?? SinEmpresa, g.Count(), g.Sum(x => x.MontoTotal)))
                .OrderByDescending(f => f.CostoTotal)
                .ThenBy(f => f.Empresa)
                .ToList();
            periodo.Reparaciones = delPeriodo.Count;
            periodo.CostoTotal = delPeriodo.Sum(p => p.MontoTotal);
            periodo.CostoPromedio = periodo.Reparaciones > 0 ? Math.Round(periodo.CostoTotal / periodo.Reparaciones, 2) : 0;
        }

        return new GastoProveedoresDto { Periodicidad = periodicidad, EmpresaId = empresaId, Periodos = lista };
    }

    private static GastoProveedorFilaDto Fila(int? empresaId, string empresa, int reparaciones, decimal total) => new()
    {
        EmpresaId = empresaId,
        Empresa = empresa,
        Reparaciones = reparaciones,
        CostoTotal = total,
        CostoPromedio = reparaciones > 0 ? Math.Round(total / reparaciones, 2) : 0
    };

    /// <summary>Semanas de lunes a domingo; quincenas del 1 al 15 y del 16 a fin de mes</summary>
    private static DateTime InicioPeriodo(DateTime dia, string periodicidad) => periodicidad switch
    {
        "semanal" => dia.AddDays(-(((int)dia.DayOfWeek + 6) % 7)),
        "quincenal" => new DateTime(dia.Year, dia.Month, dia.Day <= 15 ? 1 : 16),
        _ => new DateTime(dia.Year, dia.Month, 1)
    };

    private static DateTime FinPeriodo(DateTime inicio, string periodicidad) => periodicidad switch
    {
        "semanal" => inicio.AddDays(7),
        "quincenal" => inicio.Day == 1 ? inicio.AddDays(15) : new DateTime(inicio.Year, inicio.Month, 1).AddMonths(1),
        _ => inicio.AddMonths(1)
    };

    private static string Clave(DateTime inicio, string periodicidad) => periodicidad switch
    {
        "semanal" => inicio.ToString("yyyy-MM-dd"),
        "quincenal" => $"{inicio:yyyy-MM}-Q{(inicio.Day == 1 ? 1 : 2)}",
        _ => inicio.ToString("yyyy-MM")
    };

    private static string Etiqueta(DateTime inicio, DateTime finExcluido, string periodicidad)
    {
        var ultimo = finExcluido.AddDays(-1);
        string Corta(DateTime d) => $"{d.Day} {MesesCortos[d.Month - 1]}";
        return periodicidad switch
        {
            "mensual" => $"{Meses[inicio.Month - 1]} {inicio.Year}",
            "quincenal" => $"{inicio.Day}–{ultimo.Day} {MesesCortos[inicio.Month - 1]} {inicio.Year}",
            _ => inicio.Year != ultimo.Year
                ? $"{Corta(inicio)} {inicio.Year} – {Corta(ultimo)} {ultimo.Year}"
                : inicio.Month != ultimo.Month
                    ? $"{Corta(inicio)} – {Corta(ultimo)} {ultimo.Year}"
                    : $"{inicio.Day}–{ultimo.Day} {MesesCortos[inicio.Month - 1]} {inicio.Year}"
        };
    }
}
