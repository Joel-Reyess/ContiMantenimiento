using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Movimiento del presupuesto de una empresa proveedora (Reporte 6, PRS-01 a PRS-03). El presupuesto se lleva como
/// libro: asignado = asignaciones ± ajustes; utilizado = descuentos − reversiones; saldo = asignado − utilizado.
/// Sin llaves foráneas a la orden ni al pago a propósito: el movimiento conserva folios, importe, usuario y motivo
/// aunque la orden de trabajo o la orden de pago se eliminen (trazabilidad para auditoría).
/// </summary>
public class MovimientoPresupuesto
{
    public const string Asignacion = "Asignacion";
    public const string Ajuste = "Ajuste";
    public const string Descuento = "Descuento";
    public const string Reversion = "Reversion";

    [Key]
    public int Id { get; set; }

    public int EmpresaId { get; set; }
    public virtual Empresa Empresa { get; set; } = null!;

    /// <summary>Asignacion, Ajuste, Descuento (al generarse una orden de pago) o Reversion (al eliminarla o cancelarla)</summary>
    [Required]
    [MaxLength(20)]
    public required string Tipo { get; set; }

    /// <summary>Importe del movimiento. Asignación, descuento y reversión siempre positivos; el ajuste puede ser negativo</summary>
    public decimal Monto { get; set; }

    /// <summary>Saldo disponible de la empresa después del movimiento</summary>
    public decimal SaldoResultante { get; set; }

    public int? RegistroPagoId { get; set; }
    [MaxLength(20)]
    public string? FolioPago { get; set; }

    public int? OrdenTrabajoId { get; set; }
    [MaxLength(20)]
    public string? FolioOrden { get; set; }

    public int? VehiculoId { get; set; }
    [MaxLength(50)]
    public string? VehiculoCodigo { get; set; }

    [MaxLength(500)]
    public string? Motivo { get; set; }

    public int? UsuarioId { get; set; }
    [MaxLength(150)]
    public string? NombreUsuario { get; set; }

    public DateTime Fecha { get; set; } = DateTime.UtcNow;
}
