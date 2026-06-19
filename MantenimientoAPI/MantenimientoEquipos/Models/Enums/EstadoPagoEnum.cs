namespace MantenimientoEquipos.Models.Enums;

/// <summary>
/// Estados de pago para técnicos externos
/// </summary>
public enum EstadoPagoEnum
{
    Pendiente = 1,      // Aún no se ha procesado
    EnRevision = 2,     // En proceso de validación
    Aprobado = 3,       // Aprobado para pago
    Pagado = 4,         // Ya se realizó el pago
    Rechazado = 5       // Rechazado/cancelado
}
