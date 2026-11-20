using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>Categoría numerada del checklist preventivo de un tipo de vehículo eléctrico (EQE-10): "1. DAÑOS"</summary>
public class ChecklistPreventivoCategoria
{
    [Key]
    public int Id { get; set; }
    public int TipoVehiculoId { get; set; }
    public int Numero { get; set; }
    [Required, MaxLength(150)]
    public required string Nombre { get; set; }
    public bool Activo { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public virtual ICollection<ChecklistPreventivoActividad> Actividades { get; set; } = new List<ChecklistPreventivoActividad>();
}

/// <summary>Actividad de una categoría: "1.1 Inspeccionar tirón y maneral de arrastre."</summary>
public class ChecklistPreventivoActividad
{
    [Key]
    public int Id { get; set; }
    public int CategoriaId { get; set; }
    public virtual ChecklistPreventivoCategoria Categoria { get; set; } = null!;
    [Required, MaxLength(10)]
    public required string Numero { get; set; }
    [Required, MaxLength(300)]
    public required string Descripcion { get; set; }
    public int Orden { get; set; }
    public bool Activo { get; set; } = true;
}

/// <summary>
/// Resultado de una actividad en una orden preventiva: Buen estado / Mal estado (con observación). Es una copia del
/// checklist al iniciar el preventivo, para que cambiar el checklist después no altere lo que ya se revisó.
/// </summary>
public class PreventivoResultado
{
    [Key]
    public int Id { get; set; }
    public int OrdenTrabajoId { get; set; }
    public int? ActividadId { get; set; }
    public int CategoriaNumero { get; set; }
    [Required, MaxLength(150)]
    public required string Categoria { get; set; }
    [Required, MaxLength(10)]
    public required string Numero { get; set; }
    [Required, MaxLength(300)]
    public required string Descripcion { get; set; }
    public int Orden { get; set; }
    /// <summary>"Bueno", "Malo" o null (sin revisar)</summary>
    [MaxLength(10)]
    public string? Resultado { get; set; }
    [MaxLength(500)]
    public string? Observacion { get; set; }
}

/// <summary>Documento de entrega firmado (JPG, PNG o PDF; hasta 3 por orden, 10 MB cada uno). Una vez cargado no se modifica.</summary>
public class DocumentoEntrega
{
    [Key]
    public int Id { get; set; }
    public int OrdenTrabajoId { get; set; }
    [Required, MaxLength(500)]
    public required string Url { get; set; }
    [Required, MaxLength(200)]
    public required string NombreArchivo { get; set; }
    [MaxLength(100)]
    public string? TipoContenido { get; set; }
    public long Tamano { get; set; }
    public int? SubidoPorId { get; set; }
    [MaxLength(150)]
    public string? SubidoPorNombre { get; set; }
    public DateTime Fecha { get; set; } = DateTime.UtcNow;
}
