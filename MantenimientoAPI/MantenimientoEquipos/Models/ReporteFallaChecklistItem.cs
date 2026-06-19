using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Relación entre reportes de falla e ítems específicos del checklist
/// Permite seleccionar qué ítems del checklist se van a realizar al crear un reporte de falla
/// </summary>
public class ReporteFallaChecklistItem
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ReporteFallaId { get; set; }
    public virtual ReporteFalla ReporteFalla { get; set; } = null!;

    [Required]
    public int ChecklistItemId { get; set; }
    public virtual ChecklistItem ChecklistItem { get; set; } = null!;

    public DateTime FechaAsignacion { get; set; } = DateTime.UtcNow;
    
    [MaxLength(20)]
    public string Estado { get; set; } = "Pendiente"; // Pendiente, EnProceso, Completado

    public decimal? Cantidad { get; set; }
    
    [MaxLength(500)]
    public string? Notas { get; set; }
}
