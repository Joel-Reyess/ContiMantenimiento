using System.ComponentModel.DataAnnotations;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Registro de pago para técnicos externos
/// </summary>
public class RegistroPago
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int OrdenTrabajoId { get; set; }
    public virtual OrdenTrabajo OrdenTrabajo { get; set; } = null!;

    /// <summary>
    /// Técnico externo que realizó el trabajo
    /// </summary>
    [Required]
    public int TecnicoId { get; set; }
    public virtual User Tecnico { get; set; } = null!;

    /// <summary>
    /// Horas trabajadas
    /// </summary>
    [Required]
    public decimal HorasTrabajadas { get; set; }

    /// <summary>
    /// Tarifa por hora aplicada
    /// </summary>
    [Required]
    public decimal TarifaHora { get; set; }

    /// <summary>
    /// Costo de mano de obra (horas * tarifa)
    /// </summary>
    public decimal CostoManoObra { get; set; }

    /// <summary>
    /// Costo de refacciones utilizadas
    /// </summary>
    public decimal CostoRefacciones { get; set; }

    /// <summary>
    /// Otros costos adicionales
    /// </summary>
    public decimal OtrosCostos { get; set; }

    /// <summary>
    /// Monto total a pagar
    /// </summary>
    public decimal MontoTotal { get; set; }

    [Required]
    public EstadoPagoEnum Estado { get; set; } = EstadoPagoEnum.Pendiente;

    /// <summary>
    /// Número de factura del proveedor
    /// </summary>
    [MaxLength(50)]
    public string? NumeroFactura { get; set; }

    /// <summary>
    /// URL del archivo de factura
    /// </summary>
    [MaxLength(500)]
    public string? FacturaUrl { get; set; }

    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;
    public DateTime? FechaAprobacion { get; set; }
    public DateTime? FechaPago { get; set; }

    public int? AprobadoPorId { get; set; }
    public virtual User? AprobadoPor { get; set; }

    [MaxLength(300)]
    public string? Notas { get; set; }

    public int? OrdenCompraId { get; set; }
    public virtual OrdenCompra? OrdenCompra { get; set; }
}
