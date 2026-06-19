using System.ComponentModel.DataAnnotations;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Asignación de tipos de vehículos a líderes para su supervisión
/// </summary>
public class LiderTipoVehiculoAsignacion
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int UsuarioId { get; set; }
    public virtual User Usuario { get; set; } = null!;

    [Required]
    public TipoVehiculoEnum TipoVehiculo { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
