using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Puntos interactivos (hotspots) posicionados sobre una imagen del vehículo
/// </summary>
public class VehicleImagePoint
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public required string ImageKey { get; set; } // Identificador de la vista/imagen (ej: forklift_front)

    [Required]
    [Column(TypeName = "decimal(5,2)")]
    public decimal XPct { get; set; } // Posición horizontal en porcentaje

    [Required]
    [Column(TypeName = "decimal(5,2)")]
    public decimal YPct { get; set; } // Posición vertical en porcentaje

    [Column(TypeName = "decimal(5,2)")]
    public decimal? RadiusPct { get; set; } // Radio del punto en porcentaje (opcional)

    [Required]
    public int ImageFaultId { get; set; }
    public virtual ImageFault ImageFault { get; set; } = null!;

    public bool Active { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
