using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Roles del sistema (SuperUsuario, Supervisor de Área, Técnico, Administrativo)
/// </summary>
public class Rol
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public required string Nombre { get; set; }

    [MaxLength(200)]
    public string? Descripcion { get; set; }

    public bool Activo { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
