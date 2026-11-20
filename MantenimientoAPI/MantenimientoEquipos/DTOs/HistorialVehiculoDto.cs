namespace MantenimientoEquipos.DTOs;

/// <summary>Filtros del historial de mantenimiento de un vehículo (Reporte 6, FLT-16); todos opcionales</summary>
public class HistorialVehiculoFiltros
{
    public DateTime? Desde { get; set; }
    public DateTime? Hasta { get; set; }
    public string? TipoMantenimiento { get; set; }
    /// <summary>Componente o actividad intervenida (nombre tal como aparece en el historial)</summary>
    public string? Componente { get; set; }
    public int? EmpresaId { get; set; }
    public int? TecnicoId { get; set; }
    /// <summary>Clave del estado: Pendiente, Asignada, EnProceso, ..., Validada, Cancelada o SinOrden</summary>
    public string? Estado { get; set; }
}

/// <summary>
/// Historial de mantenimiento individual de un vehículo y su trazabilidad completa (Reporte 6, FLT-11 a FLT-16).
/// Los importes salen solo de las órdenes de pago vigentes; quien no ve costos recibe los importes en null.
/// </summary>
public class HistorialVehiculoDto
{
    public int VehiculoId { get; set; }
    public string VehiculoCodigo { get; set; } = string.Empty;
    public string? VehiculoTipo { get; set; }
    /// <summary>Si el usuario ve importes (Administrador y Gerente de Mantenimiento)</summary>
    public bool VerCostos { get; set; }
    public bool HayFiltros { get; set; }
    public HistorialResumenDto Resumen { get; set; } = new();
    public List<IntervencionDto> Intervenciones { get; set; } = new();
    public HistorialEstadisticasDto Estadisticas { get; set; } = new();
    /// <summary>Null para quien no ve costos</summary>
    public HistorialEconomicoDto? Economico { get; set; }
    public HistorialOpcionesFiltroDto Filtros { get; set; } = new();
}

/// <summary>FLT-12: resumen ejecutivo</summary>
public class HistorialResumenDto
{
    public int TotalReportes { get; set; }
    public int TotalOrdenes { get; set; }
    public int TotalActividades { get; set; }
    public decimal? ImporteAcumulado { get; set; }
    public DateTime? FechaUltimoMantenimiento { get; set; }
    public DateTime? FechaUltimoReporte { get; set; }
    public ConteoDto? EmpresaMayorParticipacion { get; set; }
    public decimal? CostoPromedio { get; set; }
}

/// <summary>FLT-13: una intervención = una orden de trabajo (con su reporte) o un reporte que no llegó a orden</summary>
public class IntervencionDto
{
    public int? ReporteId { get; set; }
    public string? ReporteFolio { get; set; }
    public int? OrdenId { get; set; }
    public string? OrdenFolio { get; set; }
    public DateTime Fecha { get; set; }
    public DateTime? FechaConclusion { get; set; }
    public string TipoMantenimiento { get; set; } = "Correctivo";
    public string? DescripcionFalla { get; set; }
    public List<string> FallasReportadas { get; set; } = new();
    public List<string> Componentes { get; set; } = new();
    public List<ActividadIntervencionDto> Actividades { get; set; } = new();
    public List<MaterialIntervencionDto> Materiales { get; set; } = new();
    public int? TecnicoId { get; set; }
    public string? Tecnico { get; set; }
    public bool TecnicoActivo { get; set; } = true;
    public int? EmpresaId { get; set; }
    public string? Empresa { get; set; }
    public decimal? Importe { get; set; }
    public string? PagoFolio { get; set; }
    public string Estado { get; set; } = string.Empty;
    public string EstadoNombre { get; set; } = string.Empty;
    /// <summary>
    /// Línea de tiempo del proceso (auditoría visual nov-2026: la ficha anterior la mostraba por orden y se había
    /// perdido): fecha de cada etapa que ya ocurrió
    /// </summary>
    public List<EtapaTiempoDto> LineaTiempo { get; set; } = new();
}

public class EtapaTiempoDto
{
    public string Etapa { get; set; } = string.Empty;
    public DateTime Fecha { get; set; }
    public string? Detalle { get; set; }
}

public class ActividadIntervencionDto
{
    public string Nombre { get; set; } = string.Empty;
    public decimal Cantidad { get; set; } = 1;
    public bool Completada { get; set; }
    /// <summary>Hallazgo agregado por el taller (no venía en el reporte)</summary>
    public bool Hallazgo { get; set; }
}

public class MaterialIntervencionDto
{
    public string Nombre { get; set; } = string.Empty;
    public decimal Cantidad { get; set; }
}

/// <summary>FLT-14: recurrencia</summary>
public class HistorialEstadisticasDto
{
    public List<ConteoDto> ActividadesFrecuentes { get; set; } = new();
    public List<ConteoDto> ComponentesFrecuentes { get; set; } = new();
    public List<ConteoDto> FallasRecurrentes { get; set; } = new();
    public List<ConteoDto> TiposMantenimiento { get; set; } = new();
    public string? TipoPredominante { get; set; }
}

public class ConteoDto
{
    public int? Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public int Eventos { get; set; }
    public decimal? Importe { get; set; }
}

/// <summary>FLT-15: análisis económico (solo con órdenes de pago vigentes)</summary>
public class HistorialEconomicoDto
{
    public decimal Total { get; set; }
    public int IntervencionesConCosto { get; set; }
    public decimal Promedio { get; set; }
    /// <summary>Por actividad cobrada (renglones de la orden de pago); las órdenes de pago anteriores sin renglones van en "Sin detalle"</summary>
    public List<ConteoDto> PorActividad { get; set; } = new();
    public List<ConteoDto> PorProveedor { get; set; } = new();
    /// <summary>Por mes (aaaa-mm), del más antiguo al más reciente</summary>
    public List<PeriodoCostoDto> PorPeriodo { get; set; } = new();
    /// <summary>Por año, con la variación contra el año anterior</summary>
    public List<PeriodoCostoDto> Comparativo { get; set; } = new();
}

public class PeriodoCostoDto
{
    public string Periodo { get; set; } = string.Empty;
    public decimal Importe { get; set; }
    public int Intervenciones { get; set; }
    public decimal Promedio { get; set; }
    /// <summary>Variación porcentual del importe contra el periodo anterior (null si no hay anterior o era 0)</summary>
    public decimal? VariacionPct { get; set; }
}

public class OpcionFiltroDto
{
    public string Valor { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public bool Activo { get; set; } = true;
}

public class HistorialOpcionesFiltroDto
{
    public List<OpcionFiltroDto> TiposMantenimiento { get; set; } = new();
    public List<OpcionFiltroDto> Componentes { get; set; } = new();
    public List<OpcionFiltroDto> Empresas { get; set; } = new();
    public List<OpcionFiltroDto> Tecnicos { get; set; } = new();
    public List<OpcionFiltroDto> Estados { get; set; } = new();
}
