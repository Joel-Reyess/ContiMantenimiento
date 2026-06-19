using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Solicitud de refacciones/piezas adicionales para una orden de trabajo
/// </summary>
public class SolicitudRefaccion
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int OrdenTrabajoId { get; set; }
    public virtual OrdenTrabajo OrdenTrabajo { get; set; } = null!;

    /// <summary>
    /// Nombre o descripción de la refacción
    /// </summary>
    [Required]
    [MaxLength(200)]
    public required string NombreRefaccion { get; set; }

    /// <summary>
    /// Número de parte (si aplica)
    /// </summary>
    [MaxLength(50)]
    public string? NumeroParte { get; set; }

    /// <summary>
    /// Cantidad solicitada
    /// </summary>
    [Required]
    public int Cantidad { get; set; } = 1;

    /// <summary>
    /// Justificación de la solicitud
    /// </summary>
    [MaxLength(500)]
    public string? Justificacion { get; set; }

    /// <summary>
    /// Estado: "Pendiente", "Aprobada", "Rechazada", "Entregada"
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Estado { get; set; } = "Pendiente";

    /// <summary>
    /// Costo estimado unitario
    /// </summary>
    public decimal? CostoEstimado { get; set; }

    /// <summary>
    /// Costo real final
    /// </summary>
    public decimal? CostoReal { get; set; }

    public int SolicitadoPorId { get; set; }
    public virtual User? SolicitadoPor { get; set; }

    public int? AprobadoPorId { get; set; }
    public virtual User? AprobadoPor { get; set; }

    public DateTime FechaSolicitud { get; set; } = DateTime.UtcNow;
    public DateTime? FechaAprobacion { get; set; }
    public DateTime? FechaEntrega { get; set; }

    [MaxLength(300)]
    public string? MotivoRechazo { get; set; }
}
