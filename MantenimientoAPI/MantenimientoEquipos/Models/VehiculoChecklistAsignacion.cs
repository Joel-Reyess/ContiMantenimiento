using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

public class VehiculoChecklistAsignacion
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int VehiculoId { get; set; }
    public virtual Vehiculo Vehiculo { get; set; } = null!;

    [Required]
    public int ChecklistTemplateId { get; set; }
    public virtual ChecklistTemplate ChecklistTemplate { get; set; } = null!;

    public DateTime FechaAsignacion { get; set; } = DateTime.UtcNow;

    public int? AsignadoPorId { get; set; }
    public virtual User? AsignadoPor { get; set; }

    public bool Activo { get; set; } = true;
}
