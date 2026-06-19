using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.DTOs
{
    public class SolicitudCambioDto
    {
        public int Id { get; set; }
        public int VehiculoId { get; set; }
        public string VehiculoCodigo { get; set; } = string.Empty;
        public string Descripcion { get; set; } = string.Empty;
        public int Estado { get; set; }
        public string EstadoNombre => Estado == 0 ? "Pendiente" : Estado == 1 ? "Aprobado" : "Rechazado";
        public int SolicitadoPorId { get; set; }
        public string SolicitadoPorNombre { get; set; } = string.Empty;
        public DateTime FechaSolicitud { get; set; }
        public int? AprobadoPorId { get; set; }
        public string? AprobadoPorNombre { get; set; }
        public DateTime? FechaRespuesta { get; set; }
        public string? ComentariosRespuesta { get; set; }
    }

    public class CreateSolicitudCambioDto
    {
        [Required]
        public int VehiculoId { get; set; }

        [Required]
        [MaxLength(1000)]
        public string Descripcion { get; set; } = string.Empty;
    }

    public class AprobarSolicitudCambioDto
    {
        [Required]
        public int Id { get; set; }
        
        [Required]
        public bool Aprobado { get; set; } // true = Aprobado, false = Rechazado

        [MaxLength(500)]
        public string? Comentarios { get; set; }
    }
}
