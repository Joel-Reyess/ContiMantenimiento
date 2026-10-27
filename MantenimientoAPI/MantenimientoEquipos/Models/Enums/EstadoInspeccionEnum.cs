namespace MantenimientoEquipos.Models.Enums;

/// <summary>
/// Etapa INSPECCIÓN del flujo (PDF 23-oct-2026): el Líder valida o rechaza el reporte antes del traslado
/// </summary>
public enum EstadoInspeccionEnum
{
    Pendiente = 0,
    Validado = 1,
    Rechazado = 2
}
