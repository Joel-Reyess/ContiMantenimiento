using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Empresa proveedora de mantenimiento (PDF 06-nov, CFG-07). Varias empresas hacen las mismas reparaciones con los
/// mismos conceptos, pero cada una con sus precios pactados (tarifario). Cada técnico pertenece a una sola empresa.
/// </summary>
public class Empresa
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(150)]
    public required string Nombre { get; set; }

    /// <summary>Identificador único: RFC u otro ID de la empresa</summary>
    [Required]
    [MaxLength(30)]
    public required string Identificador { get; set; }

    /// <summary>Inactiva: ya no se puede asignar a técnicos nuevos; se conserva para el historial de pagos</summary>
    public bool Activo { get; set; } = true;

    // Datos de contacto (opcionales)
    [MaxLength(100)]
    public string? Contacto { get; set; }

    [MaxLength(20)]
    public string? Telefono { get; set; }

    [MaxLength(100)]
    public string? Email { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navegación
    public virtual ICollection<User> Tecnicos { get; set; } = new HashSet<User>();
    public virtual ICollection<TarifaEmpresa> Tarifas { get; set; } = new HashSet<TarifaEmpresa>();
}

/// <summary>
/// Precio pactado de una actividad del checklist para una empresa (PDF 06-nov, CFG-08). Las actividades y sus títulos
/// son los mismos para todas las empresas; sin tarifa de la empresa se usa el costo base (ChecklistItem.CostoEstimado).
/// </summary>
public class TarifaEmpresa
{
    [Key]
    public int Id { get; set; }

    public int EmpresaId { get; set; }
    public virtual Empresa Empresa { get; set; } = null!;

    public int ChecklistItemId { get; set; }
    public virtual ChecklistItem ChecklistItem { get; set; } = null!;

    public decimal Costo { get; set; }

    public DateTime? UpdatedAt { get; set; }
}
