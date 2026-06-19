namespace MantenimientoEquipos.DTOs;

public class HistorialMantenimientoDto
{
    public int Id { get; set; }
    public string FolioOrden { get; set; } = string.Empty;
    public string TipoMantenimiento { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public string? TecnicoNombre { get; set; }
    public DateTime FechaFinalizacion { get; set; }
    public decimal CostoTotal { get; set; }
    public string Estado { get; set; } = string.Empty;
    public int OrdenTrabajoId { get; set; }

    // Campos para timeline detallada
    public DateTime? FechaReporteFalla { get; set; }
    public DateTime? FechaRecepcion { get; set; }
    public DateTime? FechaChecklistCompletado { get; set; }
    public DateTime? FechaFirmaAsignacion { get; set; }
    public DateTime? FechaInicioTrabajo { get; set; }
    public DateTime? FechaFirmaLider { get; set; }
}
