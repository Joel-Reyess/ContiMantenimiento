using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Configuración de prefijos para vehículos
/// Permite asociar un prefijo de código con un tipo de vehículo para autoselección de checklist
/// </summary>
public class VehiculoPrefijoConfig
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(20)]
    public required string PrefijoCodigo { get; set; }

    [Required]
    public int TipoVehiculoId { get; set; }

    [MaxLength(100)]
    public string? Descripcion { get; set; }

    public bool Activo { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedBy { get; set; }

    // Navegación
    public virtual TipoVehiculo? TipoVehiculo { get; set; }
}
