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

    /// <summary>Mantenimiento a menos de 6 meses del anterior: las refacciones no tienen costo (se fija al terminar)</summary>
    public bool AplicaGarantia { get; set; }

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

    // ===== Flujo de 7 etapas: traslados a Zona de Transición y aceptación del taller =====
    /// <summary>TRASLADO: Operador/Líder confirmó la entrega física en la zona de dañados</summary>
    public DateTime? FechaTrasladoIngreso { get; set; }
    public int? TrasladoIngresoPorId { get; set; }
    public virtual User? TrasladoIngresoPor { get; set; }
    /// <summary>TALLER: el técnico aceptó la orden (la unidad sale de la zona de dañados al taller)</summary>
    public DateTime? FechaAceptacion { get; set; }
    /// <summary>Segundo TRASLADO: el técnico confirmó la entrega en la zona de reparados</summary>
    public DateTime? FechaTrasladoRetorno { get; set; }
    public int? TrasladoRetornoPorId { get; set; }
    public virtual User? TrasladoRetornoPor { get; set; }

    // ===== SELECCIÓN de empresa proveedora (Reporte 6, OT-28 a OT-34) =====
    /// <summary>Empresa proveedora que atiende la orden (la elige el sistema por turnos o la reasigna el Gerente)</summary>
    public int? EmpresaId { get; set; }
    public virtual Empresa? Empresa { get; set; }
    /// <summary>Cuándo quedó asignada la empresa (automática o manual)</summary>
    public DateTime? FechaSeleccion { get; set; }
    /// <summary>Desde cuándo espera en SELECCIÓN porque ninguna empresa es elegible (null = no está en ese estado)</summary>
    public DateTime? FechaSinProveedor { get; set; }
    /// <summary>Primer intento de aceptar con la empresa a su capacidad máxima (para avisar una sola vez)</summary>
    public DateTime? FechaAceptacionBloqueada { get; set; }

    // ===== Flujo de equipos eléctricos (EQE-01 a EQE-09) =====
    /// <summary>null o "Contenedor": flujo de 8 etapas; "Electrico": flujo de equipos eléctricos</summary>
    [MaxLength(20)]
    public string? Flujo { get; set; }
    /// <summary>Horómetro capturado al reportar o al iniciar el preventivo</summary>
    public decimal? Horometro { get; set; }
    /// <summary>El técnico confirmó que el equipo ya está en el taller</summary>
    public DateTime? FechaIngresoTaller { get; set; }
    /// <summary>Correctivo: diagnóstico registrado (inspección previa); después ya no se cancela</summary>
    public DateTime? FechaInspeccionPrevia { get; set; }
    /// <summary>Correctivo: pruebas operativas aprobadas</summary>
    public DateTime? FechaPruebas { get; set; }
    [MaxLength(1000)]
    public string? ResultadoPruebas { get; set; }
    /// <summary>El técnico llevó el equipo a su área</summary>
    public DateTime? FechaTrasladoArea { get; set; }
    /// <summary>El Líder aprobó la entrega en el sistema (requisito para subir el documento firmado)</summary>
    public DateTime? FechaAprobacionEntrega { get; set; }
    public int? AprobacionEntregaPorId { get; set; }
    /// <summary>Documento de entrega firmado cargado (cierra la orden; queda bloqueado)</summary>
    public DateTime? FechaDocumentoEntrega { get; set; }
    public int? DocumentoEntregaPorId { get; set; }
    /// <summary>Preventivo: Mensual o 5000 horas</summary>
    [MaxLength(20)]
    public string? TipoRevision { get; set; }
    /// <summary>Preventivo: ¿se encontró código de falla?, cuál y si quedó resuelto</summary>
    public bool? CodigoFallaEncontrado { get; set; }
    [MaxLength(60)]
    public string? CodigoFalla { get; set; }
    public bool? CodigoFallaResuelto { get; set; }
    /// <summary>Último aviso de entrega pendiente (sin aprobar cada 2 h; sin documento cada N h)</summary>
    public DateTime? UltimoAvisoEntrega { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // NavegaciИn
    public virtual ICollection<EvidenciaFotografica> Evidencias { get; set; } = new HashSet<EvidenciaFotografica>();
    public virtual ICollection<ChecklistRespuesta> RespuestasChecklist { get; set; } = new HashSet<ChecklistRespuesta>();
    public virtual ICollection<SolicitudRefaccion> SolicitudesRefaccion { get; set; } = new HashSet<SolicitudRefaccion>();
    public virtual ICollection<SolicitudActividadAdicional> SolicitudesActividadAdicional { get; set; } = new HashSet<SolicitudActividadAdicional>();
    public virtual ICollection<OrdenTrabajoChecklistItem> ItemsChecklist { get; set; } = new HashSet<OrdenTrabajoChecklistItem>();
    public virtual ICollection<MaterialOrdenTrabajo> Materiales { get; set; } = new HashSet<MaterialOrdenTrabajo>();
    public virtual RegistroPago? RegistroPago { get; set; }
}
