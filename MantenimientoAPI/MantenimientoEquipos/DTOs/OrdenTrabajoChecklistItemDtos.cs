using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.DTOs;

public class OrdenTrabajoChecklistItemDto
{
    public int Id { get; set; }
    public int OrdenTrabajoId { get; set; }
    public int ChecklistItemId { get; set; }
    public string ChecklistItemPregunta { get; set; } = string.Empty;
    public DateTime FechaAsignacion { get; set; }
    public DateTime? FechaCompletado { get; set; }
    public string Estado { get; set; } = "Pendiente";
    public decimal? Cantidad { get; set; }
    public string? Notas { get; set; }
    public string? FotoUrl { get; set; }
    
    // Propiedades para distinguir ítems de checklist estándar de actividades adicionales
    public string Tipo { get; set; } = "Checklist"; // "Checklist" o "ActividadAdicional"
    public int? SolicitudActividadId { get; set; }
}

public class CreateOrdenTrabajoChecklistItemRequest
{
    [Required(ErrorMessage = "El ID de la orden de trabajo es requerido")]
    public int OrdenTrabajoId { get; set; }

    [Required(ErrorMessage = "El ID del ítem del checklist es requerido")]
    public int ChecklistItemId { get; set; }

    public decimal? Cantidad { get; set; }

    [MaxLength(500)]
    public string? Notas { get; set; }
}

public class UpdateOrdenTrabajoChecklistItemRequest
{
    [MaxLength(20)]
    public string? Estado { get; set; }
    
    [MaxLength(500)]
    public string? Notas { get; set; }
    
    public decimal? Cantidad { get; set; }

    public DateTime? FechaCompletado { get; set; }
    public string? FotoUrl { get; set; }

    // Propiedad para distinguir si se está actualizando un ítem de checklist o una actividad adicional
    public string Tipo { get; set; } = "Checklist"; 
}

public class AsignarChecklistItemsRequest
{
    [Required(ErrorMessage = "El ID de la orden de trabajo es requerido")]
    public int OrdenTrabajoId { get; set; }
    
    [Required(ErrorMessage = "Debe proporcionar al menos un ítem del checklist")]
    public List<int> ChecklistItemIds { get; set; } = new();
    
    [MaxLength(500)]
    public string? Notas { get; set; }
}

public class GetChecklistItemsPorVehiculoResponse
{
    public int VehiculoId { get; set; }
    public string CodigoVehiculo { get; set; } = string.Empty;
    public string? TipoVehiculo { get; set; }
    public List<ChecklistItemDto> ChecklistItems { get; set; } = new();
    public int ChecklistTemplateId { get; set; }
    public string ChecklistTemplateName { get; set; } = string.Empty;
}
