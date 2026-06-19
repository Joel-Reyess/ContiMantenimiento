using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Relación entre un reporte de falla y las fallas seleccionadas por imagen
/// </summary>
public class ReportImageFault
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ReporteFallaId { get; set; }
    public virtual ReporteFalla ReporteFalla { get; set; } = null!;

    [Required]
    public int ImageFaultId { get; set; }
    public virtual ImageFault ImageFault { get; set; } = null!;

    public int? VehicleImagePointId { get; set; }
    public virtual VehicleImagePoint? VehicleImagePoint { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
