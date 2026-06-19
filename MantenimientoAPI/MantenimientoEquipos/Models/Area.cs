using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Áreas de la planta donde operan los vehículos
/// </summary>
public class Area
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public required string Nombre { get; set; }

    [MaxLength(20)]
    public string? Codigo { get; set; }

    [MaxLength(300)]
    public string? Descripcion { get; set; }

    /// <summary>
    /// Supervisor responsable del área
    /// </summary>
    public int? SupervisorId { get; set; }
    public virtual User? Supervisor { get; set; }

    public bool Activa { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navegación
    public virtual ICollection<Vehiculo> Vehiculos { get; set; } = new HashSet<Vehiculo>();
    public virtual ICollection<User> Usuarios { get; set; } = new HashSet<User>();
}
