using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Evidencias fotográficas asociadas a reportes de falla u órdenes de trabajo
/// </summary>
public class EvidenciaFotografica
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// Reporte de falla asociado (puede ser null si es de orden de trabajo)
    /// </summary>
    public int? ReporteFallaId { get; set; }
    public virtual ReporteFalla? ReporteFalla { get; set; }

    /// <summary>
    /// Orden de trabajo asociada (puede ser null si es de reporte)
    /// </summary>
    public int? OrdenTrabajoId { get; set; }
    public virtual OrdenTrabajo? OrdenTrabajo { get; set; }

    /// <summary>
    /// Ruta o URL del archivo de imagen
    /// </summary>
    [Required]
    [MaxLength(500)]
    public required string UrlImagen { get; set; }

    /// <summary>
    /// Nombre original del archivo
    /// </summary>
    [MaxLength(200)]
    public string? NombreArchivo { get; set; }

    /// <summary>
    /// Descripción o nota sobre la imagen
    /// </summary>
    [MaxLength(300)]
    public string? Descripcion { get; set; }

    /// <summary>
    /// Tipo: "antes", "durante", "despues"
    /// </summary>
    [MaxLength(20)]
    public string? TipoEvidencia { get; set; }

    public DateTime FechaCaptura { get; set; } = DateTime.UtcNow;
    public int? SubidoPorId { get; set; }
    public virtual User? SubidoPor { get; set; }
}
