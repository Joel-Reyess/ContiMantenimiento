using System.ComponentModel.DataAnnotations;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Reporte de falla registrado por escaneo de código y evidencia fotográfica
/// </summary>
public class ReporteFalla
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// Número de folio único del reporte
    /// </summary>
    [Required]
    [MaxLength(20)]
    public required string Folio { get; set; }

    /// <summary>
    /// Vehículo reportado (escaneado por código)
    /// </summary>
    [Required]
    public int VehiculoId { get; set; }
    public virtual Vehiculo Vehiculo { get; set; } = null!;

    /// <summary>
    /// Categoría de la falla
    /// </summary>
    public int? CategoriaFallaId { get; set; }
    public virtual CategoriaFalla? CategoriaFalla { get; set; }

    /// <summary>
    /// Usuario que reporta la falla
    /// </summary>
    [Required]
    public int ReportadoPorId { get; set; }
    public virtual User ReportadoPor { get; set; } = null!;

    [Required]
    public PrioridadEnum Prioridad { get; set; } = PrioridadEnum.Baja;

    /// <summary>
    /// Descripción detallada de la falla
    /// </summary>
    [Required]
    [MaxLength(1000)]
    public required string Descripcion { get; set; }

    /// <summary>
    /// Ubicación donde se detectó la falla (área/zona específica)
    /// </summary>
    [MaxLength(200)]
    public string? Ubicacion { get; set; }

    /// <summary>
    /// ¿El vehículo puede seguir operando?
    /// </summary>
    public bool PuedeOperar { get; set; } = false;

    [MaxLength(30)]
    public string TipoMantenimiento { get; set; } = "Correctivo";

    public DateTime FechaReporte { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Indica si ya se generó una orden de trabajo para este reporte
    /// </summary>
    public bool TieneOrdenTrabajo { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navegación
    public virtual ICollection<EvidenciaFotografica> Evidencias { get; set; } = new HashSet<EvidenciaFotografica>();
    public virtual OrdenTrabajo? OrdenTrabajo { get; set; }
    public virtual ICollection<ReporteFallaChecklistItem> ItemsChecklist { get; set; } = new HashSet<ReporteFallaChecklistItem>();

    public virtual ICollection<ReportImageFault> ImageFaults { get; set; } = new HashSet<ReportImageFault>();
}
