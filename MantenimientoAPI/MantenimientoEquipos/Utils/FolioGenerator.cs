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
}
