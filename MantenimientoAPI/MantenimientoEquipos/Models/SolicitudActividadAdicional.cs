using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Solicitud de actividades adicionales encontradas durante una orden de trabajo
/// </summary>
public class SolicitudActividadAdicional
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int OrdenTrabajoId { get; set; }
    public virtual OrdenTrabajo OrdenTrabajo { get; set; } = null!;

    [Required]
    [MaxLength(1000)]
    public required string Descripcion { get; set; }

    [MaxLength(1000)]
    public string? Justificacion { get; set; }

    /// <summary>
    /// Estado: "Pendiente", "Aprobada", "Rechazada"
    /// </summary>
    [Required]
    [MaxLength(20)]
    public string Estado { get; set; } = "Pendiente";

    [Required]
    public int SolicitadoPorId { get; set; }
    public virtual User SolicitadoPor { get; set; } = null!;

    public DateTime FechaSolicitud { get; set; } = DateTime.UtcNow;

    public int? AprobadoPorId { get; set; }
    public virtual User? AprobadoPor { get; set; }

    public DateTime? FechaRespuesta { get; set; }

    [MaxLength(500)]
    public string? ComentariosResolucion { get; set; }

    [MaxLength(500)]
    public string? FotoUrl { get; set; }

    // Campos para ejecución de la actividad por el técnico
    public DateTime? FechaCompletado { get; set; }
    
    [MaxLength(500)]
    public string? NotasEjecucion { get; set; }

    [MaxLength(500)]
    public string? FotoEjecucionUrl { get; set; }
}
