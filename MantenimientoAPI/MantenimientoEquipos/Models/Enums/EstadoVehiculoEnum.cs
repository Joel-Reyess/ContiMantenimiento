namespace MantenimientoEquipos.Models.Enums;

/// <summary>
/// Estados operativos de un vehículo
/// </summary>
public enum EstadoVehiculoEnum
{
    Operativo = 1,          // En funcionamiento normal
    EnReparacion = 2,       // Actualmente en proceso de reparación
    FueraDeServicio = 3,    // No disponible/dado de baja
    EnEspera = 4            // Esperando refacciones o técnico
}
