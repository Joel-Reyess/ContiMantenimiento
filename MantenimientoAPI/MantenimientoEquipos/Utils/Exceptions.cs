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
