using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Trazabilidad del flujo de 7 etapas: quién hizo qué y cuándo en cada reporte y orden
/// (validaciones, rechazos con sus motivos, ediciones del reporte, traslados).
/// Sin llaves foráneas a propósito: guarda el nombre del usuario y se borra junto con el
/// reporte/orden en EliminacionService.
/// </summary>
public class HistorialFlujo
{
    [Key]
    public int Id { get; set; }

    public int? ReporteFallaId { get; set; }
    public int? OrdenTrabajoId { get; set; }

    /// <summary>REPORTE, INSPECCION, TRASLADO, TALLER, TRASLADO_RETORNO, VALIDACION, DISPONIBLE</summary>
    [Required]
    [MaxLength(30)]
    public required string Etapa { get; set; }

    /// <summary>Creado, Validado, Rechazado, Reenviado, Confirmado, Aceptada, Iniciada, Terminada, ...</summary>
    [Required]
    [MaxLength(50)]
    public required string Accion { get; set; }

    public int? UsuarioId { get; set; }

    [MaxLength(150)]
    public string? NombreUsuario { get; set; }

    [MaxLength(30)]
    public string? RolUsuario { get; set; }

    [MaxLength(2000)]
    public string? Detalle { get; set; }

    /// <summary>JSON: motivos marcados en un rechazo, o el reporte como estaba antes de editarlo</summary>
    public string? DatosJson { get; set; }

    public DateTime Fecha { get; set; } = DateTime.UtcNow;
}
