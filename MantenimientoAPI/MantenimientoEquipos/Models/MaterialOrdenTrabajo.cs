using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Refacción o consumible del inventario que el técnico usó en una orden (PDF 29-oct, 5.1). Se captura en la
/// etapa TALLER y se descuenta del inventario al terminar la reparación; ya descontado no se edita.
/// </summary>
public class MaterialOrdenTrabajo
{
    [Key]
    public int Id { get; set; }

    public int OrdenTrabajoId { get; set; }
    public virtual OrdenTrabajo OrdenTrabajo { get; set; } = null!;

    public int ConsumibleId { get; set; }
    public virtual Consumible Consumible { get; set; } = null!;

    public decimal Cantidad { get; set; }

    /// <summary>Costo unitario del inventario; se fija al descontar (la orden de pago usa este)</summary>
    public decimal CostoUnitario { get; set; }

    public int? RegistradoPorId { get; set; }
    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    public bool Descontado { get; set; }
    public DateTime? FechaDescuento { get; set; }
}
