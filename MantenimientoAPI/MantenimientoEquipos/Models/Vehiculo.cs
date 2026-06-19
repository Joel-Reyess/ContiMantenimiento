using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Vehiculos de transporte de material (carritos, tuggers, montacargas)
/// </summary>
public class Vehiculo
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// Codigo unico del vehiculo (para escaneo QR/codigo de barras)
    /// </summary>
    [Required]
    [MaxLength(50)]
    public required string Codigo { get; set; }

    [Required]
    public TipoVehiculoEnum Tipo { get; set; }

    [MaxLength(100)]
    public string? Marca { get; set; }

    [MaxLength(100)]
    public string? Modelo { get; set; }

    [MaxLength(50)]
    public string? NumeroSerie { get; set; }

    /// <summary>
    /// Año de fabricacion
    /// </summary>
    public int? Anio { get; set; }

    [Required]
    public EstadoVehiculoEnum Estado { get; set; } = EstadoVehiculoEnum.Operativo;

    /// <summary>
    /// Ubicación física del vehículo (independiente del estado operativo)
    /// </summary>
    [Required]
    public UbicacionVehiculoEnum Ubicacion { get; set; } = UbicacionVehiculoEnum.Piso;

    /// <summary>
    /// Area donde opera principalmente el vehiculo
    /// </summary>
    public int? AreaId { get; set; }
    public virtual Area? Area { get; set; }

    /// <summary>
    /// Fecha de adquisicion
    /// </summary>
    public DateTime? FechaAdquisicion { get; set; }

    /// <summary>
    /// Fecha del ultimo mantenimiento preventivo
    /// </summary>
    public DateTime? UltimoMantenimiento { get; set; }

    /// <summary>
    /// Fecha programada para proximo mantenimiento preventivo
    /// </summary>
    public DateTime? ProximoMantenimiento { get; set; }

    /// <summary>
    /// Capacidad de carga (kg)
    /// </summary>
    public decimal? CapacidadCarga { get; set; }

    /// <summary>
    /// Horas de operacion acumuladas
    /// </summary>
    public decimal? HorasOperacion { get; set; }

    /// <summary>
    /// Kilometros/metros recorridos
    /// </summary>
    public decimal? Kilometraje { get; set; }

    /// <summary>
    /// URL/ruta de la imagen del vehiculo
    /// </summary>
    [MaxLength(500)]
    public string? ImagenUrl { get; set; }

    /// <summary>
    /// Notas adicionales sobre el vehiculo
    /// </summary>
    [MaxLength(1000)]
    public string? Notas { get; set; }

    [MaxLength(2000)]
    public string? DocumentacionDibujos { get; set; }

    [MaxLength(2000)]
    public string? DocumentacionEspecificaciones { get; set; }

    [MaxLength(2000)]
    public string? ListaMateriales { get; set; }

    [MaxLength(2000)]
    public string? RegistroModificaciones { get; set; }

    public bool Activo { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedBy { get; set; }

    // Navegacion
    public virtual ICollection<ReporteFalla> Reportes { get; set; } = new HashSet<ReporteFalla>();
    public virtual ICollection<OrdenTrabajo> OrdenesTrabajo { get; set; } = new HashSet<OrdenTrabajo>();
    public virtual ICollection<HistorialMantenimiento> HistorialMantenimiento { get; set; } = new HashSet<HistorialMantenimiento>();
}
