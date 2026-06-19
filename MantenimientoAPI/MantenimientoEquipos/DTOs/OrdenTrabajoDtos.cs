using System.ComponentModel.DataAnnotations;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.DTOs;

public class OrdenTrabajoDto
{
    public int Id { get; set; }
    public required string Folio { get; set; }
    public int? ReporteFallaId { get; set; }
    public string? ReporteFallaFolio { get; set; }
    public int VehiculoId { get; set; }
    public string? VehiculoCodigo { get; set; }
    public string? VehiculoTipo { get; set; }
    public int? VehiculoUbicacion { get; set; }
    public string? VehiculoUbicacionNombre { get; set; }
    public int? TecnicoAsignadoId { get; set; }
    public string? TecnicoNombre { get; set; }
    public int? FirmadoPorId { get; set; }
    public string? FirmadoPorNombre { get; set; }
    public string? FirmaAsignacionTexto { get; set; }
    public DateTime? FechaFirmaAsignacion { get; set; }
    public int CreadoPorId { get; set; }
    public string? CreadoPorNombre { get; set; }
    public EstadoOrdenTrabajoEnum Estado { get; set; }
    public string? EstadoNombre { get; set; }
    public PrioridadEnum Prioridad { get; set; }
    public string? PrioridadNombre { get; set; }
    public required string TipoMantenimiento { get; set; }
    public required string Descripcion { get; set; }
    public string? Diagnostico { get; set; }
    public string? TrabajoRealizado { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaAsignacion { get; set; }
    public DateTime? FechaInicio { get; set; }
    public DateTime? FechaFinalizacion { get; set; }
    public DateTime? FechaValidacion { get; set; }
    public decimal? HorasTrabajadas { get; set; }
    public decimal? CostoTotal { get; set; }
    public string? ValidadoPorNombre { get; set; }
    public string? FirmaLider { get; set; }
    public string? FirmaLiderNombre { get; set; }
    public DateTime? FirmaLiderFecha { get; set; }
    public string? FirmaSupervisor { get; set; }
    public string? FirmaSupervisorNombre { get; set; }
    public DateTime? FirmaSupervisorFecha { get; set; }

    // Estados de Aprobación
    public EstadoAprobacionEnum EstadoAprobacionLider { get; set; }
    public EstadoAprobacionEnum EstadoAprobacionSupervisor { get; set; }
    public string? ComentariosAprobacionLider { get; set; }
    public string? ComentariosAprobacionSupervisor { get; set; }

    public string? Notas { get; set; }
    public string? ChecklistRecepcionJson { get; set; }
    public string? HerramientasUsadas { get; set; }
    public decimal? HorasHerramienta { get; set; }
    public decimal? TiempoEsperaHoras { get; set; }
    public decimal? TiempoReparacionHoras { get; set; }
    public decimal? TiempoTransicionHoras { get; set; }
    public List<EvidenciaDto> Evidencias { get; set; } = new();
    public List<ChecklistRespuestaDto> RespuestasChecklist { get; set; } = new();
    public List<SolicitudRefaccionDto> SolicitudesRefaccion { get; set; } = new();
    public List<SolicitudActividadAdicionalDto> SolicitudesActividadAdicional { get; set; } = new();
    public List<ReporteFallaChecklistItemDto> ItemsChecklistReporte { get; set; } = new();
    public List<OrdenTrabajoChecklistItemDto> ItemsChecklist { get; set; } = new();
}

public class OrdenTrabajoCreateRequest
{
    public int? ReporteFallaId { get; set; }

    [Required(ErrorMessage = "El vehículo es requerido")]
    public int VehiculoId { get; set; }

    public int? TecnicoAsignadoId { get; set; }

    public PrioridadEnum Prioridad { get; set; } = PrioridadEnum.PuedeCircular;

    [Required]
    [MaxLength(30)]
    public string TipoMantenimiento { get; set; } = "Correctivo";

    [Required(ErrorMessage = "La descripción es requerida")]
    [MaxLength(1000)]
    public required string Descripcion { get; set; }

    [MaxLength(500)]
    public string? Notas { get; set; }
}

public class OrdenTrabajoUpdateRequest
{
    public int? TecnicoAsignadoId { get; set; }
    public EstadoOrdenTrabajoEnum? Estado { get; set; }
    public PrioridadEnum? Prioridad { get; set; }

    [MaxLength(1000)]
    public string? Diagnostico { get; set; }

    [MaxLength(1000)]
    public string? TrabajoRealizado { get; set; }

    public decimal? HorasTrabajadas { get; set; }
    public decimal? CostoTotal { get; set; }

    [MaxLength(500)]
    public string? Notas { get; set; }
}

public class OrdenTrabajoListDto
{
    public int Id { get; set; }
    public required string Folio { get; set; }
    public required string VehiculoCodigo { get; set; }
    public string? VehiculoTipo { get; set; }
    public int? VehiculoUbicacion { get; set; }
    public string? VehiculoUbicacionNombre { get; set; }
    public string? TecnicoNombre { get; set; }
    public EstadoOrdenTrabajoEnum Estado { get; set; }
    public string? EstadoNombre { get; set; }
    public PrioridadEnum Prioridad { get; set; }
    public string? PrioridadNombre { get; set; }
    public required string TipoMantenimiento { get; set; }
    public DateTime FechaCreacion { get; set; }
    public DateTime? FechaFinalizacion { get; set; }
}

public class AsignarTecnicoRequest
{
    [Required(ErrorMessage = "El técnico es requerido")]
    public int TecnicoId { get; set; }
    [MaxLength(300)]
    public string? FirmaAsignacionTexto { get; set; }
}

public class IniciarTrabajoRequest
{
    [MaxLength(1000)]
    public string? Diagnostico { get; set; }
}

public class CompletarTrabajoRequest
{
    [MaxLength(1000)]
    public string? TrabajoRealizado { get; set; }

    public decimal? HorasTrabajadas { get; set; }

    [MaxLength(500)]
    public string? Notas { get; set; }
}

public class ValidarOrdenRequest
{
    [MaxLength(500)]
    public string? Observaciones { get; set; }

    public bool Aprobado { get; set; } = true;
}

public class AprobarOrdenRequest
{
    [Required]
    public bool Aprobado { get; set; }

    [MaxLength(500)]
    public string? Comentarios { get; set; }
    
    // "Lider" o "Supervisor"
    [Required]
    public string RolAprobador { get; set; } = "Lider";
}
