using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.DTOs;

public class ImageFaultDto
{
    public int Id { get; set; }
    public required string Name { get; set; }
    public string? Description { get; set; }
    public bool Active { get; set; }
}

public class ImageFaultCreateDto
{
    [Required]
    [MaxLength(100)]
    public required string Name { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public bool Active { get; set; } = true;
}

public class ImageFaultUpdateDto
{
    [Required]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public required string Name { get; set; }

    [MaxLength(500)]
    public string? Description { get; set; }

    public bool Active { get; set; }
}
