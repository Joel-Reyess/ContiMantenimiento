using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Registro de acciones del sistema para auditoría
/// </summary>
public class LogAccion
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// Usuario que realizó la acción
    /// </summary>
    public int? UsuarioId { get; set; }
    public virtual User? Usuario { get; set; }

    [MaxLength(100)]
    public string? NombreUsuario { get; set; }

    /// <summary>
    /// Acción realizada: "Crear", "Actualizar", "Eliminar", "Login", etc.
    /// </summary>
    [Required]
    [MaxLength(50)]
    public required string Accion { get; set; }

    /// <summary>
    /// Entidad afectada: "Vehiculo", "OrdenTrabajo", etc.
    /// </summary>
    [Required]
    [MaxLength(50)]
    public required string Entidad { get; set; }

    /// <summary>
    /// ID de la entidad afectada
    /// </summary>
    public int? EntidadId { get; set; }

    /// <summary>
    /// Descripción detallada del cambio
    /// </summary>
    [MaxLength(1000)]
    public string? Descripcion { get; set; }

    /// <summary>
    /// Datos anteriores (JSON)
    /// </summary>
    public string? DatosAnteriores { get; set; }

    /// <summary>
    /// Datos nuevos (JSON)
    /// </summary>
    public string? DatosNuevos { get; set; }

    /// <summary>
    /// Dirección IP del usuario
    /// </summary>
    [MaxLength(50)]
    public string? DireccionIp { get; set; }

    public DateTime Fecha { get; set; } = DateTime.UtcNow;
}
