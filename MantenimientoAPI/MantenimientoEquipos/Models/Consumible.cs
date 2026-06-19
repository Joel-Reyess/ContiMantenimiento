using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

public class Consumible
{
    [Key]
    public int Id { get; set; }

    [Required, MaxLength(50)]
    public string Codigo { get; set; } = string.Empty;

    [Required, MaxLength(150)]
    public string Nombre { get; set; } = string.Empty;

    [MaxLength(100)]
    public string? Categoria { get; set; }

    [MaxLength(20)]
    public string Unidad { get; set; } = "pieza";

    public decimal StockActual { get; set; }
    public decimal StockMinimo { get; set; }
    public decimal? StockMaximo { get; set; }
    public decimal CostoUnitario { get; set; } = 0;

    public bool AlertaActiva { get; set; }
    public bool Activo { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<ConsumoConsumible> Movimientos { get; set; } = new HashSet<ConsumoConsumible>();
}
