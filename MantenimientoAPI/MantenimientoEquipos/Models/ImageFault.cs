using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Catálogo independiente de fallas seleccionables mediante imagen
/// </summary>
public class ImageFault
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public required string Name { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    /// <summary>
    /// FV-03: falla interna de una actividad del checklist (los puntos de la foto se configuran con la actividad;
    /// esta fila solo guarda su nombre para el historial de los reportes). Null = falla capturada a mano (anterior).
    /// </summary>
    public int? ChecklistItemId { get; set; }

    public bool Active { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
