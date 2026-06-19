using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.DTOs;

public class ReporteFallaChecklistItemDto
{
    public int Id { get; set; }
    public int ReporteFallaId { get; set; }
    public int ChecklistItemId { get; set; }
    public string? ChecklistItemPregunta { get; set; }
    public string? Estado { get; set; }
    public decimal? Cantidad { get; set; }
    public string? Notas { get; set; }
    public DateTime FechaAsignacion { get; set; }
}

public class ReporteFallaChecklistItemCreateRequest
{
    [Required]
    public int ChecklistItemId { get; set; }
    
    public decimal? Cantidad { get; set; }

    [MaxLength(500)]
    public string? Notas { get; set; }
}

public class ReporteFallaChecklistItemUpdateRequest
{
    [MaxLength(20)]
    public string? Estado { get; set; }
    
    public decimal? Cantidad { get; set; }

    [MaxLength(500)]
    public string? Notas { get; set; }
}
