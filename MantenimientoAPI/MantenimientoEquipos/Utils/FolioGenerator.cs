using Microsoft.EntityFrameworkCore;

namespace MantenimientoEquipos.Utils;

/// <summary>
/// Generador de folios únicos para reportes y órdenes de trabajo
/// </summary>
public static class FolioGenerator
{
    /// <summary>
    /// Genera un folio para reporte de falla: RF-YYYYMMDD-XXXX
    /// </summary>
    public static string GenerarFolioReporte(int secuencia)
    {
        return $"RF-{DateTime.Now:yyyyMMdd}-{secuencia:D4}";
    }

    /// <summary>
    /// Genera un folio para orden de trabajo: OT-YYYYMMDD-XXXX
    /// </summary>
    public static string GenerarFolioOrden(int secuencia)
    {
        return $"OT-{DateTime.Now:yyyyMMdd}-{secuencia:D4}";
    }

    /// <summary>
    /// Siguiente folio del día ("RF" u "OT"): el mayor número que ya existe con la fecha de hoy + 1.
    /// Antes era "cuántos hay hoy + 1": al eliminar uno de hoy, o por la diferencia entre la hora UTC
    /// de la fecha guardada y la hora local del folio, repetía un folio existente y el alta fallaba.
    /// </summary>
    public static async Task<string> SiguienteAsync(IQueryable<string> folios, string prefijo, string formatoFecha = "yyyyMMdd", int digitos = 4)
    {
        var inicio = $"{prefijo}-{DateTime.Now.ToString(formatoFecha)}-";
        var delDia = await folios.Where(f => f.StartsWith(inicio)).ToListAsync();
        var mayor = delDia
            .Select(f => int.TryParse(f.Substring(inicio.Length), out var n) ? n : 0)
            .DefaultIfEmpty(0)
            .Max();
        return inicio + (mayor + 1).ToString($"D{digitos}");
    }
}
