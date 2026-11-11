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
    /// <summary>Actividad del checklist que se ubicó en este punto (FV-03)</summary>
    public int? ChecklistItemId { get; set; }
    /// <summary>
    /// FV-03: el punto no tiene una actividad vigente del checklist de su tipo (punto anterior sin ligar, o la
    /// actividad se quitó del checklist). No se ofrece en los reportes hasta ligarlo en Fallas visuales.
    /// </summary>
    public bool SinActividad { get; set; }
    /// <summary>Título de la actividad (o su descripción si no tiene título)</summary>
    public string? ActividadTitulo { get; set; }
    /// <summary>Descripción de la actividad (Pregunta del checklist)</summary>
    public string? ActividadDescripcion { get; set; }
    /// <summary>Costo base de la actividad</summary>
    public decimal? ActividadCosto { get; set; }
    public bool Active { get; set; }
}

public class VehicleImagePointActividadDto
{
    /// <summary>Actividad del checklist que se ubica en el punto (obligatoria)</summary>
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

    /// <summary>FV-03: actividad del checklist del tipo de vehículo que se ubica en la foto (obligatoria)</summary>
    public int? ChecklistItemId { get; set; }

    /// <summary>Ya no se usa: la falla la pone la actividad. Se conserva para clientes anteriores.</summary>
    public int? ImageFaultId { get; set; }

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

    /// <summary>FV-03: si viene, el punto pasa a esa actividad; si no, conserva la suya</summary>
    public int? ChecklistItemId { get; set; }

    /// <summary>Ya no se usa (la falla la pone la actividad). Se conserva para clientes anteriores.</summary>
    public int? ImageFaultId { get; set; }

    public bool Active { get; set; } = true;
}
