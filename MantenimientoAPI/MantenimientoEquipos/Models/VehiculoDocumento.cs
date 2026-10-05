using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MantenimientoEquipos.Models;

public class VehiculoDocumento
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int VehiculoId { get; set; }
    public virtual Vehiculo Vehiculo { get; set; } = null!;

    [Required, MaxLength(200)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(50)]
    public string? Tipo { get; set; }

    [MaxLength(500)]
    public string? Descripcion { get; set; }

    [Required, MaxLength(500)]
    public string UrlArchivo { get; set; } = string.Empty;

    // Version, IsActive y Comentarios no existen en la tabla: la migración que crea
    // VehiculoDocumentos (AddUbicacionToVehiculo) nunca las incluyó. Si se mapean, cualquier
    // consulta o alta de documentos/fotos falla con "Invalid column name".
    [NotMapped]
    public int Version { get; set; } = 1;

    [NotMapped]
    public bool IsActive { get; set; } = true;

    [NotMapped, MaxLength(500)]
    public string? Comentarios { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
