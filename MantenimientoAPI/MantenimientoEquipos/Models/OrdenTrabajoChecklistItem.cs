using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Relación entre órdenes de trabajo e ítems específicos del checklist
/// Permite seleccionar qué ítems del checklist se van a realizar en una orden específica
/// </summary>
public class OrdenTrabajoChecklistItem
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int OrdenTrabajoId { get; set; }
    public virtual OrdenTrabajo OrdenTrabajo { get; set; } = null!;

    [Required]
    public int ChecklistItemId { get; set; }
    public virtual ChecklistItem ChecklistItem { get; set; } = null!;

    public DateTime FechaAsignacion { get; set; } = DateTime.UtcNow;
    public DateTime? FechaCompletado { get; set; }
    
    [MaxLength(20)]
    public string Estado { get; set; } = "Pendiente"; // Pendiente, EnProceso, Completado

    /// <summary>
    /// Cantidad o valor numérico asociado al ítem (si aplica)
    /// </summary>
    public decimal? Cantidad { get; set; }
    
    [MaxLength(500)]
    public string? Notas { get; set; }

    [MaxLength(500)]
    public string? FotoUrl { get; set; }
}
