using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.DTOs;

public class VehicleImagePointDto
{
    public int Id { get; set; }
    public required string ImageKey { get; set; }
    public decimal XPct { get; set; }
    public decimal YPct { get; set; }
    public decimal? RadiusPct { get; set; }
    public int ImageFaultId { get; set; }
    public string? ImageFaultName { get; set; }
    /// <summary>Descripción del componente (PDF 06-nov: se muestra debajo del nombre al elegir fallas)</summary>
    public string? ImageFaultDescription { get; set; }
    /// <summary>Actividad del checklist ligada a mano (null = se liga por nombre)</summary>
    public int? ChecklistItemId { get; set; }
    public bool Active { get; set; }
}

public class VehicleImagePointActividadDto
{
    /// <summary>Actividad del checklist que genera el componente; null = automática por nombre</summary>
    public int? ChecklistItemId { get; set; }
}

public class VehicleImagePointCreateDto
{
    [Required]
    [MaxLength(100)]
    public required string ImageKey { get; set; }

    [Required]
    public decimal XPct { get; set; }

    [Required]
    public decimal YPct { get; set; }

    public decimal? RadiusPct { get; set; }

    [Required]
    public int ImageFaultId { get; set; }

    public bool Active { get; set; } = true;
}

public class VehicleImagePointUpdateDto
{
    [Required]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public required string ImageKey { get; set; }

    [Required]
    public decimal XPct { get; set; }

    [Required]
    public decimal YPct { get; set; }

    public decimal? RadiusPct { get; set; }

    [Required]
    public int ImageFaultId { get; set; }

    public bool Active { get; set; }
}
