using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Categorías predefinidas de fallas (ej: eléctrica, mecánica, hidráulica, etc.)
/// </summary>
public class CategoriaFalla
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public required string Nombre { get; set; }

    [MaxLength(300)]
    public string? Descripcion { get; set; }

    /// <summary>
    /// Icono o color asociado para la UI
    /// </summary>
    [MaxLength(50)]
    public string? Icono { get; set; }

    public bool Activa { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navegación
    public virtual ICollection<ReporteFalla> Reportes { get; set; } = new HashSet<ReporteFalla>();
}
