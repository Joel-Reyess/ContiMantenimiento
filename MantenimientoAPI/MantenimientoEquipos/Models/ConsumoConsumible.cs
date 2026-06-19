using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

public class ConsumoConsumible
{
    [Key]
    public int Id { get; set; }

    [Required]
    public int ConsumibleId { get; set; }
    public virtual Consumible Consumible { get; set; } = null!;

    public int? OrdenTrabajoId { get; set; }
    public virtual OrdenTrabajo? OrdenTrabajo { get; set; }

    public int? ReporteId { get; set; }
    public virtual ReporteFalla? Reporte { get; set; }

    public int? UsuarioId { get; set; }
    public virtual User? Usuario { get; set; }

    [Required, MaxLength(20)]
    public string TipoMovimiento { get; set; } = "consumo"; // consumo | ajuste+ | ajuste-

    [Required]
    public decimal Cantidad { get; set; }

    [MaxLength(500)]
    public string? Comentario { get; set; }

    public bool? EsConsumoInusual { get; set; }

    public DateTime Fecha { get; set; } = DateTime.UtcNow;
}
