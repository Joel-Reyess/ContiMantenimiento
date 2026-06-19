using System.ComponentModel.DataAnnotations;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.DTOs;

public class ReporteFallaDto
{
    public int Id { get; set; }
    public required string Folio { get; set; }
    public int VehiculoId { get; set; }
    public string? VehiculoCodigo { get; set; }
    public string? VehiculoTipo { get; set; }
    public int? CategoriaFallaId { get; set; }
    public string? CategoriaNombre { get; set; }
    public int ReportadoPorId { get; set; }
    public string? ReportadoPorNombre { get; set; }
    public PrioridadEnum Prioridad { get; set; }
    public string? PrioridadNombre { get; set; }
    public string? TipoMantenimiento { get; set; }
    public required string Descripcion { get; set; }
    public string? Ubicacion { get; set; }
    public bool PuedeOperar { get; set; }
    public DateTime FechaReporte { get; set; }
    public bool TieneOrdenTrabajo { get; set; }
    public int? OrdenTrabajoId { get; set; }
    public List<EvidenciaDto> Evidencias { get; set; } = new();
    public List<ReporteFallaChecklistItemDto> ItemsChecklist { get; set; } = new();
    public List<ReportImageFaultDto> ImageFaults { get; set; } = new();
}

public class ReporteFallaCreateRequest
{
    [Required(ErrorMessage = "El código del vehículo es requerido")]
    public required string CodigoVehiculo { get; set; }

    public int? CategoriaFallaId { get; set; }

    public PrioridadEnum Prioridad { get; set; } = PrioridadEnum.PuedeCircular;

    [MaxLength(30)]
    public string? TipoMantenimiento { get; set; }

    [Required(ErrorMessage = "La descripción es requerida")]
    [MaxLength(1000)]
    public required string Descripcion { get; set; }

    [MaxLength(200)]
    public string? Ubicacion { get; set; }

    public bool PuedeOperar { get; set; } = false;

    public List<int> ChecklistItemIds { get; set; } = new();
    
    public List<ChecklistItemSelectionDto> ChecklistItems { get; set; } = new();
    public List<ReportImageFaultCreateDto> ImageFaults { get; set; } = new();
}

public class ChecklistItemSelectionDto
{
    public int Id { get; set; }
    public decimal? Cantidad { get; set; }
}

public class ReporteFallaListDto
{
    public int Id { get; set; }
    public required string Folio { get; set; }
    public required string VehiculoCodigo { get; set; }
    public string? VehiculoTipo { get; set; }
    public string? CategoriaNombre { get; set; }
    public PrioridadEnum Prioridad { get; set; }
    public string? PrioridadNombre { get; set; }
    public string? TipoMantenimiento { get; set; }
    public DateTime FechaReporte { get; set; }
    public bool TieneOrdenTrabajo { get; set; }
    public string? ReportadoPorNombre { get; set; }
    public int CantidadEvidencias { get; set; }
}

public class EvidenciaDto
{
    public int Id { get; set; }
    public required string UrlImagen { get; set; }
    public string? NombreArchivo { get; set; }
    public string? Descripcion { get; set; }
    public string? TipoEvidencia { get; set; }
    public DateTime FechaCaptura { get; set; }
}

public class EvidenciaUploadRequest
{
    public int? ReporteFallaId { get; set; }
    public int? OrdenTrabajoId { get; set; }

    [MaxLength(300)]
    public string? Descripcion { get; set; }

    /// <summary>
    /// Tipo: "antes", "durante", "despues"
    /// </summary>
    [MaxLength(20)]
    public string? TipoEvidencia { get; set; }
}
