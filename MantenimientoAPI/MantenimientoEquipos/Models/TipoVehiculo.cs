using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MantenimientoEquipos.Models
{
    public class TipoVehiculo
    {
        public int Id { get; set; }
        
        [Required]
        [StringLength(100)]
        public string Nombre { get; set; } = string.Empty;
        
        [StringLength(300)]
        public string? Descripcion { get; set; }

        [StringLength(500)]
        public string? ImagenUrl { get; set; }

        [StringLength(500)]
        public string? ImagenFallasUrl { get; set; }

        public int? MaxInWorkshop { get; set; }

        public int? FrecuenciaMantenimientoDias { get; set; }

        // Programación preventiva por tipo
        public int? FrecuenciaPreventivoMeses { get; set; }
        public int? ProgramadosPorSemana { get; set; }
        public DateTime? FechaProximoMantenimiento { get; set; }
        
        public bool Activo { get; set; } = true;
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        public DateTime? UpdatedAt { get; set; }

        public int? ProveedorId { get; set; }
        public virtual User? Proveedor { get; set; }

        [NotMapped]
        public int TotalVehiculos { get; set; }
    }
}
