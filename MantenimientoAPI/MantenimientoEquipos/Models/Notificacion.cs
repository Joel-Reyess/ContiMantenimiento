using System.ComponentModel.DataAnnotations;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Notificaciones del sistema para usuarios
/// </summary>
public class Notificacion
{
    [Key]
    public int Id { get; set; }

    [Required]
    public TipoNotificacionEnum Tipo { get; set; }

    /// <summary>
    /// Usuario destinatario
    /// </summary>
    [Required]
    public int UsuarioId { get; set; }
    public virtual User Usuario { get; set; } = null!;

    [Required]
    [MaxLength(150)]
    public required string Titulo { get; set; }

    [Required]
    [MaxLength(500)]
    public required string Mensaje { get; set; }

    /// <summary>
    /// URL de navegación al hacer clic
    /// </summary>
    [MaxLength(200)]
    public string? UrlDestino { get; set; }

    /// <summary>
    /// ID de referencia (orden de trabajo, reporte, etc.)
    /// </summary>
    public int? ReferenciaId { get; set; }

    /// <summary>
    /// Tipo de entidad referenciada: "OrdenTrabajo", "ReporteFalla", etc.
    /// </summary>
    [MaxLength(50)]
    public string? TipoReferencia { get; set; }

    public bool Leida { get; set; } = false;
    public DateTime? FechaLectura { get; set; }

    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
}
