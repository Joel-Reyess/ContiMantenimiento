using System.ComponentModel.DataAnnotations;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Orden de trabajo para mantenimiento correctivo o preventivo
/// </summary>
public class OrdenTrabajo
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// Nカmero de folio カnico de la orden
    /// </summary>
    [Required]
    [MaxLength(20)]
    public required string Folio { get; set; }

    /// <summary>
    /// Reporte de falla que originИ esta orden (puede ser null para mantenimiento preventivo)
    /// </summary>
    public int? ReporteFallaId { get; set; }
    public virtual ReporteFalla? ReporteFalla { get; set; }

    /// <summary>
    /// Vehヴculo a reparar
    /// </summary>
    [Required]
    public int VehiculoId { get; set; }
    public virtual Vehiculo Vehiculo { get; set; } = null!;

    /// <summary>
    /// Tゼcnico asignado
    /// </summary>
    public int? TecnicoAsignadoId { get; set; }
    public virtual User? TecnicoAsignado { get; set; }

    /// <summary>
    /// Usuario que creИ/asignИ la orden
    /// </summary>
    [Required]
    public int CreadoPorId { get; set; }
    public virtual User CreadoPor { get; set; } = null!;

    /// <summary>
    /// Firma de aceptaciИn cuando se asigna un tゼcnico
    /// </summary>
    [MaxLength(300)]
    public string? FirmaAsignacionTexto { get; set; }

    /// <summary>
    /// Fecha y usuario que firmИ la asignaciИn
    /// </summary>
    public DateTime? FechaFirmaAsignacion { get; set; }
    public int? FirmadoPorId { get; set; }
    public virtual User? FirmadoPor { get; set; }

    [Required]
    public EstadoOrdenTrabajoEnum Estado { get; set; } = EstadoOrdenTrabajoEnum.Pendiente;

    [Required]
    public PrioridadEnum Prioridad { get; set; } = PrioridadEnum.PuedeCircular;

    /// <summary>
    /// Tipo de mantenimiento: "Correctivo", "Preventivo"
    /// </summary>
    [Required]
    [MaxLength(30)]
    public string TipoMantenimiento { get; set; } = "Correctivo";

    /// <summary>
    /// DescripciИn del trabajo a realizar
    /// </summary>
    [Required]
    [MaxLength(1000)]
    public required string Descripcion { get; set; }

    /// <summary>
    /// DiagnИstico del tゼcnico
    /// </summary>
    [MaxLength(1000)]
    public string? Diagnostico { get; set; }

    /// <summary>
    /// DescripciИn del trabajo realizado
    /// </summary>
    [MaxLength(1000)]
    public string? TrabajoRealizado { get; set; }

    public DateTime FechaCreacion { get; set; } = DateTime.UtcNow;
    public DateTime? FechaAsignacion { get; set; }
    public DateTime? FechaInicio { get; set; }
    public DateTime? FechaFinalizacion { get; set; }
    public DateTime? FechaValidacion { get; set; }

    /// <summary>
    /// Horas trabajadas en esta orden
    /// </summary>
    public decimal? HorasTrabajadas { get; set; }

    /// <summary>
    /// Costo total de la reparaciИn
    /// </summary>
    public decimal? CostoTotal { get; set; }

    // Datos adicionales
    public string? ChecklistRecepcionJson { get; set; }
    [MaxLength(300)]
    public string? HerramientasUsadas { get; set; }
    public decimal? HorasHerramienta { get; set; }
    public decimal? TiempoEsperaHoras { get; set; }
    public decimal? TiempoReparacionHoras { get; set; }
    public decimal? TiempoTransicionHoras { get; set; }

    /// <summary>
    /// Usuario que validИ la orden completada
    /// </summary>
    public int? ValidadoPorId { get; set; }
    public virtual User? ValidadoPor { get; set; }

    // Firmas requeridas para cierre (lider y supervisor/admin)
    [MaxLength(500)]
    public string? FirmaLider { get; set; }
    [MaxLength(200)]
    public string? FirmaLiderNombre { get; set; }
    public DateTime? FirmaLiderFecha { get; set; }

    [MaxLength(500)]
    public string? FirmaSupervisor { get; set; }
    [MaxLength(200)]
    public string? FirmaSupervisorNombre { get; set; }
    public DateTime? FirmaSupervisorFecha { get; set; }

    // Estados de Aprobación
    public EstadoAprobacionEnum EstadoAprobacionLider { get; set; } = EstadoAprobacionEnum.Pendiente;
    public EstadoAprobacionEnum EstadoAprobacionSupervisor { get; set; } = EstadoAprobacionEnum.Pendiente;

    [MaxLength(500)]
    public string? ComentariosAprobacionLider { get; set; }

    [MaxLength(500)]
    public string? ComentariosAprobacionSupervisor { get; set; }

    /// <summary>
    /// Notas o comentarios adicionales
    /// </summary>
    [MaxLength(500)]
    public string? Notas { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // NavegaciИn
    public virtual ICollection<EvidenciaFotografica> Evidencias { get; set; } = new HashSet<EvidenciaFotografica>();
    public virtual ICollection<ChecklistRespuesta> RespuestasChecklist { get; set; } = new HashSet<ChecklistRespuesta>();
    public virtual ICollection<SolicitudRefaccion> SolicitudesRefaccion { get; set; } = new HashSet<SolicitudRefaccion>();
    public virtual ICollection<SolicitudActividadAdicional> SolicitudesActividadAdicional { get; set; } = new HashSet<SolicitudActividadAdicional>();
    public virtual ICollection<OrdenTrabajoChecklistItem> ItemsChecklist { get; set; } = new HashSet<OrdenTrabajoChecklistItem>();
    public virtual RegistroPago? RegistroPago { get; set; }
}
