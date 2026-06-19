using System.ComponentModel.DataAnnotations;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.DTOs;

// ===== SOLICITUDES DE REFACCIÓN =====

public class SolicitudRefaccionDto
{
    public int Id { get; set; }
    public int OrdenTrabajoId { get; set; }
    public string? OrdenTrabajoFolio { get; set; }
    public required string NombreRefaccion { get; set; }
    public string? NumeroParte { get; set; }
    public int Cantidad { get; set; }
    public string? Justificacion { get; set; }
    public required string Estado { get; set; }
    public decimal? CostoEstimado { get; set; }
    public decimal? CostoReal { get; set; }
    public string? SolicitadoPorNombre { get; set; }
    public string? AprobadoPorNombre { get; set; }
    public DateTime FechaSolicitud { get; set; }
    public DateTime? FechaAprobacion { get; set; }
    public DateTime? FechaEntrega { get; set; }
    public string? MotivoRechazo { get; set; }
}

public class SolicitudRefaccionCreateRequest
{
    [Required]
    public int OrdenTrabajoId { get; set; }

    [Required(ErrorMessage = "El nombre de la refacción es requerido")]
    [MaxLength(200)]
    public required string NombreRefaccion { get; set; }

    [MaxLength(50)]
    public string? NumeroParte { get; set; }

    [Range(1, 1000)]
    public int Cantidad { get; set; } = 1;

    [MaxLength(500)]
    public string? Justificacion { get; set; }

    public decimal? CostoEstimado { get; set; }
}

public class SolicitudRefaccionBatchRequest
{
    [Required]
    public List<SolicitudRefaccionCreateRequest> Solicitudes { get; set; } = new();
}

public class AprobarRefaccionRequest
{
    public decimal? CostoReal { get; set; }
}

public class RechazarRefaccionRequest
{
    [Required(ErrorMessage = "El motivo de rechazo es requerido")]
    [MaxLength(300)]
    public required string MotivoRechazo { get; set; }
}


// ===== REGISTRO DE PAGOS =====

public class RegistroPagoDto
{
    public int Id { get; set; }
    public int OrdenTrabajoId { get; set; }
    public string? OrdenTrabajoFolio { get; set; }
    public int TecnicoId { get; set; }
    public string? TecnicoNombre { get; set; }
    public string? EmpresaExterna { get; set; }
    public decimal HorasTrabajadas { get; set; }
    public decimal TarifaHora { get; set; }
    public decimal CostoManoObra { get; set; }
    public decimal CostoRefacciones { get; set; }
    public decimal OtrosCostos { get; set; }
    public decimal MontoTotal { get; set; }
    public EstadoPagoEnum Estado { get; set; }
    public string? EstadoNombre { get; set; }
    public string? NumeroFactura { get; set; }
    public string? FacturaUrl { get; set; }
    public DateTime FechaRegistro { get; set; }
    public DateTime? FechaAprobacion { get; set; }
    public DateTime? FechaPago { get; set; }
    public string? AprobadoPorNombre { get; set; }
    public string? Notas { get; set; }
}

public class RegistroPagoCreateRequest
{
    [Required]
    public int OrdenTrabajoId { get; set; }

    [Required]
    public decimal HorasTrabajadas { get; set; }

    public decimal CostoRefacciones { get; set; }
    public decimal OtrosCostos { get; set; }

    [MaxLength(50)]
    public string? NumeroFactura { get; set; }

    [MaxLength(300)]
    public string? Notas { get; set; }
}

public class AprobarPagoRequest
{
    [MaxLength(300)]
    public string? Observaciones { get; set; }
}

public class RegistrarPagoRequest
{
    public DateTime FechaPago { get; set; } = DateTime.UtcNow;

    [MaxLength(300)]
    public string? Observaciones { get; set; }
}
