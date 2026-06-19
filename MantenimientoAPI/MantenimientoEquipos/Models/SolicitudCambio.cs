using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MantenimientoEquipos.Models
{
    public class SolicitudCambio
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int VehiculoId { get; set; }
        public virtual Vehiculo Vehiculo { get; set; } = null!;

        [Required]
        [MaxLength(1000)]
        public string Descripcion { get; set; } = string.Empty;

        /// <summary>
        /// 0: Pendiente, 1: Aprobado, 2: Rechazado
        /// </summary>
        public int Estado { get; set; } = 0;

        [Required]
        public int SolicitadoPorId { get; set; }
        public virtual User SolicitadoPor { get; set; } = null!;

        public DateTime FechaSolicitud { get; set; } = DateTime.UtcNow;

        public int? AprobadoPorId { get; set; }
        public virtual User? AprobadoPor { get; set; }

        public DateTime? FechaRespuesta { get; set; }

        [MaxLength(500)]
        public string? ComentariosRespuesta { get; set; }
    }
}
