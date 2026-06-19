using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Configuraciones generales del sistema
/// </summary>
public class ConfiguracionSistema
{
    [Key]
    public int Id { get; set; }

    /// <summary>
    /// Clave única de la configuración
    /// </summary>
    [Required]
    [MaxLength(50)]
    public required string Clave { get; set; }

    /// <summary>
    /// Valor de la configuración
    /// </summary>
    [MaxLength(500)]
    public string? Valor { get; set; }

    /// <summary>
    /// Descripción de qué controla esta configuración
    /// </summary>
    [MaxLength(200)]
    public string? Descripcion { get; set; }

    /// <summary>
    /// Tipo de dato: "string", "int", "bool", "decimal", "json"
    /// </summary>
    [MaxLength(20)]
    public string TipoDato { get; set; } = "string";

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    public int? UpdatedBy { get; set; }
}
