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
    public bool Active { get; set; }
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
