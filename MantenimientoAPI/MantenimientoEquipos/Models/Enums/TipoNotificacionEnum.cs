namespace MantenimientoEquipos.Models.Enums;

/// <summary>
/// Tipos de notificaciones del sistema
/// </summary>
public enum TipoNotificacionEnum
{
    NuevoReporte = 1,           // Se reportó una nueva falla
    OrdenAsignada = 2,          // Se asignó una orden de trabajo
    OrdenActualizada = 3,       // Cambio de estado en una orden
    RefaccionSolicitada = 4,    // Solicitud de refacción
    RefaccionAprobada = 5,      // Refacción aprobada
    PagoAprobado = 6,           // Pago a técnico externo aprobado
    SistemaGeneral = 7          // Notificación general del sistema
}
