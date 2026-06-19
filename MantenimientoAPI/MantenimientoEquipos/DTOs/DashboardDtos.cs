using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.DTOs;

/// <summary>
/// Estadísticas generales para el dashboard principal
/// </summary>
public class DashboardStatsDto
{
    // Contadores principales
    public int TotalVehiculos { get; set; }
    public int VehiculosOperativos { get; set; }
    public int VehiculosEnReparacion { get; set; }
    public int VehiculosFueraServicio { get; set; }

    // Órdenes de trabajo
    public int OrdenesPendientes { get; set; }
    public int OrdenesEnProceso { get; set; }
    public int OrdenesCompletadasHoy { get; set; }
    public int OrdenesCompletadasSemana { get; set; }

    // Reportes
    public int ReportesNuevosHoy { get; set; }
    public int ReportesSinAtender { get; set; }

    // Pagos pendientes (técnicos externos)
    public int PagosPendientes { get; set; }
    public decimal MontoPagosPendientes { get; set; }
}

/// <summary>
/// Indicadores clave de rendimiento (KPIs)
/// </summary>
public class KPIsDto
{
    /// <summary>
    /// Tiempo promedio de resolución (horas)
    /// </summary>
    public decimal TiempoPromedioResolucion { get; set; }

    /// <summary>
    /// Porcentaje de disponibilidad de flota
    /// </summary>
    public decimal PorcentajeDisponibilidad { get; set; }

    /// <summary>
    /// Número de fallas por tipo de vehículo
    /// </summary>
    public List<FallasPorTipoDto> FallasPorTipo { get; set; } = new();

    /// <summary>
    /// Fallas más recurrentes por ítem de checklist
    /// </summary>
    public List<FallasRecurrentesChecklistDto> FallasRecurrentesChecklist { get; set; } = new();

    /// <summary>
    /// Matriz de ubicación (Zona vs Tipo de Vehículo)
    /// </summary>
    public List<UbicacionPorTipoMatrizDto> MatrizUbicacion { get; set; } = new();

    /// <summary>
    /// Órdenes por estado
    /// </summary>
    public List<OrdenesPorEstadoDto> OrdenesPorEstado { get; set; } = new();

    /// <summary>
    /// Costos del período
    /// </summary>
    public decimal CostoTotalPeriodo { get; set; }
    public decimal CostoManoObraPeriodo { get; set; }
    public decimal CostoRefaccionesPeriodo { get; set; }
}

public class FallasRecurrentesChecklistDto
{
    public int ChecklistItemId { get; set; }
    public string? Pregunta { get; set; }
    public int Cantidad { get; set; }
}

public class UbicacionPorTipoMatrizDto
{
    public string Ubicacion { get; set; } = string.Empty;
    public List<StatsPorTipoVehiculoDto> StatsPorTipo { get; set; } = new();
}

public class StatsPorTipoVehiculoDto
{
    public string TipoVehiculo { get; set; } = string.Empty;
    public int Cantidad { get; set; }
    public double PromedioDias { get; set; }
}

public class FallasPorTipoDto
{
    public TipoVehiculoEnum TipoVehiculo { get; set; }
    public string? TipoNombre { get; set; }
    public int CantidadFallas { get; set; }
}

public class OrdenesPorEstadoDto
{
    public EstadoOrdenTrabajoEnum Estado { get; set; }
    public string? EstadoNombre { get; set; }
    public int Cantidad { get; set; }
}

/// <summary>
/// Estadísticas semanales para reportes
/// </summary>
public class EstadisticasSemanalesDto
{
    public DateTime FechaInicio { get; set; }
    public DateTime FechaFin { get; set; }

    public List<EstadisticaDiariaDto> EstadisticasPorDia { get; set; } = new();

    public int TotalReportesCreados { get; set; }
    public int TotalOrdenesCreadas { get; set; }
    public int TotalOrdenesCompletadas { get; set; }
    public decimal TiempoPromedioResolucion { get; set; }
}

public class EstadisticaDiariaDto
{
    public DateTime Fecha { get; set; }
    public string? DiaSemana { get; set; }
    public int ReportesCreados { get; set; }
    public int OrdenesCreadas { get; set; }
    public int OrdenesCompletadas { get; set; }
}

/// <summary>
/// Estadísticas para el dashboard del técnico
/// </summary>
public class DashboardTecnicoDto
{
    public int OrdenesAsignadas { get; set; }
    public int OrdenesEnProceso { get; set; }
    public int OrdenesCompletadasHoy { get; set; }
    public int OrdenesCompletadasSemana { get; set; }
    public int MetaMensual { get; set; }
    public List<OrdenTrabajoListDto> OrdenesActivas { get; set; } = new();
}

/// <summary>
/// Resumen ampliado para dashboards de administracion/supervision
/// </summary>
public class DashboardResumenDto
{
    public int TotalVehiculos { get; set; }
    public int VehiculosOperativos { get; set; } // Piso
    public int VehiculosEnMantenimiento { get; set; } // Taller
    public int VehiculosFueraServicio { get; set; } // Transicion (Mapped)
    
    // Nuevos campos explícitos
    public int VehiculosEnPiso { get; set; }
    public int VehiculosEnTaller { get; set; }
    public int VehiculosEnTransicion { get; set; }

    public List<VehiculoResumenDto> Equipos { get; set; } = new();
    public List<EstadoPorTipoDto> EstadosPorTipo { get; set; } = new();
}

public class EstadoPorTipoDto
{
    public string Tipo { get; set; } = string.Empty;
    public int Total { get; set; }
    public int Operativos { get; set; } // Piso
    public int EnMantenimiento { get; set; } // Taller
    public int FueraDeServicio { get; set; } // Transicion (Mapped)

    // Nuevos campos explícitos
    public int Piso { get; set; }
    public int Taller { get; set; }
    public int Transicion { get; set; }
}

public class VehiculoResumenDto
{
    public int Id { get; set; }
    public string? Codigo { get; set; }
    public string? TipoNombre { get; set; }
    public string? Marca { get; set; }
    public string? Modelo { get; set; }
    public string? NumeroSerie { get; set; }
    public int? Anio { get; set; }
    public string? EstadoNombre { get; set; }
    public string? AreaNombre { get; set; }
    public DateTime? UltimoMantenimiento { get; set; }
    public DateTime? ProximoMantenimiento { get; set; }
    public decimal? CapacidadCarga { get; set; }
    public decimal? HorasOperacion { get; set; }
    public decimal? Kilometraje { get; set; }
    public bool Activo { get; set; }
}

public class ReporteAnualDto
{
    public int Mes { get; set; }
    public string? MesNombre { get; set; }
    public string? TipoVehiculo { get; set; }
    public int Cantidad { get; set; }
}

public class OrdenSinFirmaDto
{
    public int Id { get; set; }
    public string? Folio { get; set; }
    public string? VehiculoCodigo { get; set; }
    public string? Estado { get; set; }
    public DateTime FechaFinalizacion { get; set; }
    public string? TecnicoNombre { get; set; }
}

public class VehiculoEnTallerDto
{
    public int VehiculoId { get; set; }
    public string? Codigo { get; set; }
    public string? Tipo { get; set; }
    public string? TipoMantenimiento { get; set; }
    public string? TecnicoNombre { get; set; }
    public DateTime FechaIngreso { get; set; }
    public double DiasEnTaller { get; set; }
    public string? EstadoOrden { get; set; }
    public string? FolioOrden { get; set; }
    public int OrdenId { get; set; }
}

public class OrdenSinPagoDto
{
    public int OrdenId { get; set; }
    public string? Folio { get; set; }
    public string? Vehiculo { get; set; }
    public string? Tecnico { get; set; }
    public DateTime FechaFinalizacion { get; set; }
    public decimal CostoTotal { get; set; }
    public string? EstadoPago { get; set; }
}

public class MantenimientoPreventivoProgramadoDto
{
    public int VehiculoId { get; set; }
    public string? VehiculoCodigo { get; set; }
    public string? TipoVehiculo { get; set; }
    public DateTime? UltimaFecha { get; set; }
    public DateTime ProximaFecha { get; set; }
    public int DiasRestantes { get; set; }
    public string? Estado { get; set; } // "Programado", "Próximo", "Vencido"
}
