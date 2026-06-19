using System.ComponentModel.DataAnnotations;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Plantillas de checklist dinamicos para diferentes tipos de mantenimiento.
/// </summary>
public class ChecklistTemplate
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public required string Nombre { get; set; }

    [MaxLength(300)]
    public string? Descripcion { get; set; }

    /// <summary>
    /// Tipo de vehiculo al que aplica (null = todos).
    /// </summary>
    public TipoVehiculoEnum? TipoVehiculo { get; set; }

    /// <summary>
    /// Tipo de mantenimiento: "Correctivo", "Preventivo", "Inspeccion".
    /// </summary>
    [MaxLength(30)]
    public string? TipoMantenimiento { get; set; }

    public bool Activo { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }

    // Navegacion
    public virtual ICollection<ChecklistItem> Items { get; set; } = new HashSet<ChecklistItem>();
    public virtual ICollection<VehiculoChecklistAsignacion> VehiculosAsociados { get; set; } = new HashSet<VehiculoChecklistAsignacion>();
}

/// <summary>
/// Elemento individual de un checklist.
/// </summary>
public class ChecklistItem
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ChecklistTemplateId { get; set; }
    public virtual ChecklistTemplate ChecklistTemplate { get; set; } = null!;

    /// <summary>
    /// Orden de aparicion en el checklist.
    /// </summary>
    public int Orden { get; set; }

    [Required]
    [MaxLength(200)]
    public required string Pregunta { get; set; }

    [Required]
    public TipoChecklistItemEnum TipoRespuesta { get; set; }

    /// <summary>
    /// Opciones separadas por | para tipo Seleccion.
    /// </summary>
    [MaxLength(500)]
    public string? Opciones { get; set; }

    /// <summary>
    /// Es obligatorio responder este item?
    /// </summary>
    public bool Obligatorio { get; set; } = true;

    /// <summary>
    /// Requiere evidencia fotografica?
    /// </summary>
    public bool RequiereFoto { get; set; } = false;

    /// <summary>
    /// Costo estimado asociado a la tarea del checklist.
    /// </summary>
    public decimal CostoEstimado { get; set; } = 0;

    public bool Activo { get; set; } = true;

    // Navegacion
    public virtual ICollection<ChecklistRespuesta> Respuestas { get; set; } = new HashSet<ChecklistRespuesta>();
    public virtual ICollection<OrdenTrabajoChecklistItem> OrdenesTrabajoAsociadas { get; set; } = new HashSet<OrdenTrabajoChecklistItem>();
}

/// <summary>
/// Respuestas del checklist para una orden de trabajo especifica.
/// </summary>
public class ChecklistRespuesta
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int OrdenTrabajoId { get; set; }
    public virtual OrdenTrabajo OrdenTrabajo { get; set; } = null!;

    [Required]
    public int ChecklistItemId { get; set; }
    public virtual ChecklistItem ChecklistItem { get; set; } = null!;

    /// <summary>
    /// Valor de la respuesta (texto, numero, si/no, opcion seleccionada).
    /// </summary>
    [MaxLength(500)]
    public string? Valor { get; set; }

    /// <summary>
    /// URL de la foto si el item requiere evidencia.
    /// </summary>
    [MaxLength(500)]
    public string? FotoUrl { get; set; }

    /// <summary>
    /// Notas adicionales del tecnico.
    /// </summary>
    [MaxLength(300)]
    public string? Notas { get; set; }

    /// <summary>
    /// Cantidad aplicada del item (para costos). Default 1.
    /// </summary>
    public decimal Cantidad { get; set; } = 1;

    public DateTime FechaRespuesta { get; set; } = DateTime.UtcNow;
    public int? RespondidoPorId { get; set; }
    public virtual User? RespondidoPor { get; set; }
}
