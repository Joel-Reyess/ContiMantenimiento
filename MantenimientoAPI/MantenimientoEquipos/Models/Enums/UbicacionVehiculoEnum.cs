namespace MantenimientoEquipos.Models.Enums;

/// <summary>
/// Ubicación física del vehículo (independiente del estado operativo)
/// </summary>
public enum UbicacionVehiculoEnum
{
    Piso = 1,                   // En el piso de producción (Disponible)
    Taller = 2,                 // En el taller de mantenimiento (Reparación)
    Transicion = 3,             // En transición (Genérico)
    TransicionPorReparar = 4,   // Zona de transición (Espera de reparación)
    TransicionReparado = 5      // Zona de transición (Reparado, espera validación)
}
