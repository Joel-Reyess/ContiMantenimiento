using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Historial consolidado de mantenimientos por vehículo
/// </summary>
public class HistorialMantenimiento
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int VehiculoId { get; set; }
    public virtual Vehiculo Vehiculo { get; set; } = null!;

    /// <summary>
    /// Referencia a la orden de trabajo (si existe)
    /// </summary>
    public int? OrdenTrabajoId { get; set; }
    public virtual OrdenTrabajo? OrdenTrabajo { get; set; }

    /// <summary>
    /// Tipo: "Correctivo", "Preventivo", "Inspección"
    /// </summary>
    [Required]
    [MaxLength(30)]
    public required string TipoMantenimiento { get; set; }

    /// <summary>
    /// Descripción breve del trabajo realizado
    /// </summary>
    [Required]
    [MaxLength(500)]
    public required string Descripcion { get; set; }

    /// <summary>
    /// Técnico que realizó el trabajo
    /// </summary>
    [MaxLength(100)]
    public string? TecnicoNombre { get; set; }

    public int? TecnicoId { get; set; }
    public virtual User? Tecnico { get; set; }

    public DateTime FechaMantenimiento { get; set; }

    /// <summary>
    /// Horas/kilómetros del vehículo al momento del mantenimiento
    /// </summary>
    public decimal? HorasVehiculo { get; set; }
    public decimal? KilometrajeVehiculo { get; set; }

    /// <summary>
    /// Costo total del mantenimiento
    /// </summary>
    public decimal? Costo { get; set; }

    /// <summary>
    /// Notas adicionales
    /// </summary>
    [MaxLength(500)]
    public string? Notas { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
