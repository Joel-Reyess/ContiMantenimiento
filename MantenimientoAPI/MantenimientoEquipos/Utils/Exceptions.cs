namespace MantenimientoEquipos.Utils;

public class DuplicateActiveOrderException : Exception
{
    public string ExistingOrderFolio { get; }
    public int ExistingOrderId { get; }

    public DuplicateActiveOrderException(string existingOrderFolio, int existingOrderId)
        : base($"El vehículo ya tiene una orden de trabajo activa: {existingOrderFolio}")
    {
        ExistingOrderFolio = existingOrderFolio;
        ExistingOrderId = existingOrderId;
    }
}

/// <summary>
/// El vehículo ya tiene un reporte de falla pendiente (aún sin orden de trabajo).
/// Se pide confirmación antes de crear otro (requerimiento 9.1.3).
/// </summary>
public class DuplicateActiveReportException : Exception
{
    public string ExistingReportFolio { get; }
    public int ExistingReportId { get; }
    public DateTime ExistingReportFecha { get; }

    public DuplicateActiveReportException(string existingReportFolio, int existingReportId, DateTime existingReportFecha)
        : base($"El vehículo ya tiene un reporte activo sin orden de trabajo: {existingReportFolio}")
    {
        ExistingReportFolio = existingReportFolio;
        ExistingReportId = existingReportId;
        // La BD guarda UTC sin "Kind": marcarla para que se envíe con "Z" y la pantalla muestre el día local correcto
        ExistingReportFecha = DateTime.SpecifyKind(existingReportFecha, DateTimeKind.Utc);
    }
}
