using System.ComponentModel.DataAnnotations;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.DTOs;

// ===== Flujo de 7 etapas y Zona de Transición (PDF 23-oct-2026) =====

/// <summary>Ocupación de una zona con su semáforo (verde 0-8, amarillo 9-12, rojo 13-15 de 15)</summary>
public class ZonaCapacidadDto
{
    public required string Zona { get; set; } // "danados" | "reparados"
    public required string Nombre { get; set; }
    public int Ocupados { get; set; }
    public int Capacidad { get; set; }
    public int Disponibles { get; set; }
    public required string Semaforo { get; set; } // verde | amarillo | rojo
    /// <summary>Ocupación a partir de la cual se avisa que la zona está próxima a saturarse (12 de 15)</summary>
    public int AlertaDesde { get; set; }
    /// <summary>Unidades esperando lugar para entrar a esta zona</summary>
    public int EnFila { get; set; }
}

public class CapacidadZonasDto
{
    public required ZonaCapacidadDto Danados { get; set; }
    public required ZonaCapacidadDto Reparados { get; set; }
}

/// <summary>Ventana de advertencia (12/15) o de zona saturada (15/15) tras un movimiento</summary>
public class AlertaCapacidadDto
{
    public required string Zona { get; set; }
    public required string Nivel { get; set; } // preventiva | saturada
    public required string Mensaje { get; set; }
    public int Ocupados { get; set; }
    public int Capacidad { get; set; }
}

public class ResultadoFlujoDto
{
    public required string Mensaje { get; set; }
    public int? OrdenId { get; set; }
    public string? OrdenFolio { get; set; }
    public AlertaCapacidadDto? Alerta { get; set; }
}

public class EtapaFlujoDto
{
    public required string Clave { get; set; }   // REPORTE, INSPECCION, TRASLADO, TALLER, TRASLADO_RETORNO, VALIDACION, DISPONIBLE
    public required string Nombre { get; set; }  // texto del ícono
    /// <summary>completada (verde), pendiente (naranja parpadeante), rechazada (rojo), bloqueada (azul: sin espacio), inactiva (gris)</summary>
    public required string Estado { get; set; }
    /// <summary>Texto bajo el ícono: rol o usuario responsable, "En espera", "Sin espacio"...</summary>
    public string? Etiqueta { get; set; }
    public string? Responsable { get; set; }
    public string? Mensaje { get; set; }
    public DateTime? Fecha { get; set; }
}

/// <summary>Renglón que se puede marcar como motivo de rechazo (trabajo del checklist o componente marcado en la foto)</summary>
public class ItemFlujoDto
{
    public required string Tipo { get; set; } // checklist | componente
    public int Id { get; set; }
    /// <summary>Trabajo del catálogo (para corregir el reporte); null en componentes</summary>
    public int? ChecklistItemId { get; set; }
    public required string Nombre { get; set; }
    public decimal? Cantidad { get; set; }
    public string? Notas { get; set; }
    /// <summary>true = hallazgo del técnico ("Reportado por Taller")</summary>
    public bool ReportadoPorTaller { get; set; }
}

public class HistorialFlujoDto
{
    public DateTime Fecha { get; set; }
    public required string Etapa { get; set; }
    public required string Accion { get; set; }
    public string? Usuario { get; set; }
    public string? Rol { get; set; }
    public string? Detalle { get; set; }
    public List<string> Motivos { get; set; } = new();
}

public class FlujoDto
{
    public int? ReporteId { get; set; }
    public string? ReporteFolio { get; set; }
    public int? OrdenId { get; set; }
    public string? OrdenFolio { get; set; }
    public int? VehiculoId { get; set; }
    public string? VehiculoCodigo { get; set; }
    public string? VehiculoTipo { get; set; }
    public bool Cancelada { get; set; }
    public List<EtapaFlujoDto> Etapas { get; set; } = new();
    /// <summary>Lo que el usuario actual puede hacer ahora (validarReporte, confirmarTraslado, aceptarOrden...)</summary>
    public List<string> Acciones { get; set; } = new();
    /// <summary>Por qué una acción no se puede hacer todavía (p. ej. zona saturada)</summary>
    public string? Bloqueo { get; set; }
    /// <summary>Trabajos y componentes: los del reporte ("Reportado por [Usuario]") y los hallazgos del taller</summary>
    public List<ItemFlujoDto> Items { get; set; } = new();
    public string? ReportadoPorNombre { get; set; }
    /// <summary>Datos del reporte para corregirlo en la inspección</summary>
    public string? ReporteDescripcion { get; set; }
    public PrioridadEnum? ReportePrioridad { get; set; }
    public bool? ReportePuedeOperar { get; set; }
    /// <summary>Último rechazo (inspección o validación) para que quien corrige vea qué se pidió</summary>
    public HistorialFlujoDto? UltimoRechazo { get; set; }
    public List<HistorialFlujoDto> Historial { get; set; } = new();
}

public class UnidadZonaDto
{
    public int OrdenId { get; set; }
    public required string OrdenFolio { get; set; }
    public int? ReporteId { get; set; }
    public string? ReporteFolio { get; set; }
    public int VehiculoId { get; set; }
    public required string VehiculoCodigo { get; set; }
    public string? VehiculoTipo { get; set; }
    public string? Descripcion { get; set; }
    public string? Tecnico { get; set; }
    public PrioridadEnum Prioridad { get; set; }
    public DateTime Desde { get; set; }
    /// <summary>Lugar en la fila de espera (1 = el siguiente en entrar)</summary>
    public int? PosicionFila { get; set; }
    public bool SinEspacio { get; set; }
    public List<string> Acciones { get; set; } = new();
}

public class ReportePorInspeccionarDto
{
    public int ReporteId { get; set; }
    public required string Folio { get; set; }
    public required string VehiculoCodigo { get; set; }
    public string? VehiculoTipo { get; set; }
    public string? Descripcion { get; set; }
    public string? ReportadoPor { get; set; }
    public DateTime Fecha { get; set; }
    public EstadoInspeccionEnum Estado { get; set; }
}

public class ZonaTransicionDto
{
    public required CapacidadZonasDto Capacidad { get; set; }
    public List<ReportePorInspeccionarDto> PorInspeccionar { get; set; } = new();
    public List<UnidadZonaDto> PorTrasladar { get; set; } = new();
    public List<UnidadZonaDto> EnZonaDanados { get; set; } = new();
    public List<UnidadZonaDto> PorEntregar { get; set; } = new();
    public List<UnidadZonaDto> EnZonaReparados { get; set; } = new();
}

public class MotivoRechazoRequest
{
    [Required]
    [MaxLength(20)]
    public required string Tipo { get; set; } // checklist | componente
    public int Id { get; set; }
}

public class RechazoRequest
{
    public List<MotivoRechazoRequest> Motivos { get; set; } = new();
    [MaxLength(1000)]
    public string? Observacion { get; set; }
}

public class ValidarReporteRequest
{
    [MaxLength(1000)]
    public string? Observaciones { get; set; }
}

public class ValidarReparacionRequest
{
    public bool Aprobado { get; set; }
    public List<MotivoRechazoRequest> Motivos { get; set; } = new();
    [MaxLength(1000)]
    public string? Observacion { get; set; }
}

public class ItemReporteRequest
{
    public int ChecklistItemId { get; set; }
    public decimal? Cantidad { get; set; }
    [MaxLength(500)]
    public string? Notas { get; set; }
}

/// <summary>Corrección del reporte por el Líder (durante la inspección o tras un rechazo)</summary>
public class CorregirReporteRequest
{
    [MaxLength(1000)]
    public string? Descripcion { get; set; }
    public PrioridadEnum? Prioridad { get; set; }
    public bool? PuedeOperar { get; set; }
    /// <summary>null = no cambia los trabajos; lista = los reemplaza</summary>
    public List<ItemReporteRequest>? Items { get; set; }
    [MaxLength(1000)]
    public string? Observaciones { get; set; }
}

public class HallazgosRequest
{
    [MinLength(1)]
    public List<ItemReporteRequest> Items { get; set; } = new();
}
