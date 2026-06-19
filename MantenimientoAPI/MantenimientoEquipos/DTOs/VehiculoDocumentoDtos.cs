using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.DTOs;

public class VehiculoDocumentoDto
{
    public int Id { get; set; }
    public int VehiculoId { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Tipo { get; set; }
    public string? Descripcion { get; set; }
    public string UrlArchivo { get; set; } = string.Empty;
    public int Version { get; set; }
    public bool IsActive { get; set; }
    public string? Comentarios { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class VehiculoDocumentoCreateRequest
{
    [Required]
    public int VehiculoId { get; set; }

    [Required, MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Tipo { get; set; }

    [MaxLength(500)]
    public string? Descripcion { get; set; }
}
