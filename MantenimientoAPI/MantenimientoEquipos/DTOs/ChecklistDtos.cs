using System.ComponentModel.DataAnnotations;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.DTOs;

public class ChecklistTemplateDto
{
    public int Id { get; set; }
    public required string Nombre { get; set; }
    public string? Descripcion { get; set; }
    public TipoVehiculoEnum? TipoVehiculo { get; set; }
    public string? TipoVehiculoNombre { get; set; }
    public string? TipoMantenimiento { get; set; }
    public bool Activo { get; set; }
    public List<ChecklistItemDto> Items { get; set; } = new();
}

public class ChecklistItemDto
{
    public int Id { get; set; }
    public int ChecklistTemplateId { get; set; }
    public int Orden { get; set; }
    public required string Pregunta { get; set; }
    public TipoChecklistItemEnum TipoRespuesta { get; set; }
    public string? TipoRespuestaNombre { get; set; }
    public string? Opciones { get; set; }
    public bool Obligatorio { get; set; }
    public bool RequiereFoto { get; set; }
    public decimal CostoEstimado { get; set; }
}

public class ChecklistTemplateCreateRequest
{
    [Required(ErrorMessage = "El nombre es requerido")]
    [MaxLength(100)]
    public required string Nombre { get; set; }

    [MaxLength(300)]
    public string? Descripcion { get; set; }

    public TipoVehiculoEnum? TipoVehiculo { get; set; }

    [MaxLength(30)]
    public string? TipoMantenimiento { get; set; }

    public List<ChecklistItemCreateRequest> Items { get; set; } = new();
}

public class ChecklistTemplateUpdateRequest : ChecklistTemplateCreateRequest
{
}

public class ChecklistItemCreateRequest
{
    public int? Id { get; set; }

    public int Orden { get; set; }

    [Required(ErrorMessage = "La pregunta es requerida")]
    [MaxLength(200)]
    public required string Pregunta { get; set; }

    [Required]
    public TipoChecklistItemEnum TipoRespuesta { get; set; }

    [MaxLength(500)]
    public string? Opciones { get; set; }

    public bool Obligatorio { get; set; } = true;
    public bool RequiereFoto { get; set; } = false;
    public decimal? CostoEstimado { get; set; } = 0;
}

public class ChecklistRespuestaDto
{
    public int Id { get; set; }
    public int ChecklistItemId { get; set; }
    public string? Pregunta { get; set; }
    public string? Valor { get; set; }
    public string? FotoUrl { get; set; }
    public string? Notas { get; set; }
    public decimal Cantidad { get; set; } = 1;
    public DateTime FechaRespuesta { get; set; }
    public decimal? CostoEstimado { get; set; }
}

public class GuardarRespuestasChecklistRequest
{
    [Required]
    public int OrdenTrabajoId { get; set; }

    public List<RespuestaItemRequest> Respuestas { get; set; } = new();
}

public class RespuestaItemRequest
{
    [Required]
    public int ChecklistItemId { get; set; }

    [MaxLength(500)]
    public string? Valor { get; set; }

    [MaxLength(500)]
    public string? FotoUrl { get; set; }

    [MaxLength(300)]
    public string? Notas { get; set; }

    public decimal? Cantidad { get; set; }
}

public class ChecklistAsignacionDto
{
    public int Id { get; set; }
    public int VehiculoId { get; set; }
    public string? VehiculoCodigo { get; set; }
    public int ChecklistTemplateId { get; set; }
    public string? ChecklistNombre { get; set; }
    public DateTime FechaAsignacion { get; set; }
    public int? AsignadoPorId { get; set; }
    public string? AsignadoPorNombre { get; set; }
}

public class AsignarChecklistVehiculoRequest
{
    [Required]
    public int VehiculoId { get; set; }

    public int? ChecklistTemplateId { get; set; }
}
