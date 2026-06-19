using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Metas mensuales de mantenimiento por técnico
/// </summary>
public class MetaTecnico
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int UsuarioId { get; set; }
    
    [ForeignKey(nameof(UsuarioId))]
    public virtual User Usuario { get; set; } = null!;

    [Required]
    public int Mes { get; set; }

    [Required]
    public int Anio { get; set; }

    [Required]
    public int MetaMantenimientos { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
