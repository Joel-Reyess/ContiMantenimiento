namespace MantenimientoEquipos.Models.Enums;

/// <summary>
/// Estados del flujo de una orden de trabajo
/// </summary>
public enum EstadoOrdenTrabajoEnum
{
    Pendiente = 1,          // Recién creada, sin asignar
    Asignada = 2,           // Asignada a un técnico
    EnProceso = 3,          // Técnico trabajando en ella
    EsperandoRefacciones = 4, // Pausada por falta de piezas
    Completada = 5,         // Trabajo terminado
    Cancelada = 6,          // Cancelada por algún motivo
    Validada = 7,           // Validada por supervisor/admin
    Entregado = 8           // Vehículo entregado al usuario/área
}
