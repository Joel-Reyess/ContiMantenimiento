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

        /// <summary>
        /// Al registrar o editar un vehículo de este tipo se piden Marca, Modelo, Año y Número de serie
        /// (Tuggers y Montacargas; los contenedores no los llevan). Script 20.
        /// </summary>
        public bool PideDatosEquipo { get; set; }

        /// <summary>
        /// Flujo de mantenimiento del tipo (EQE-02, flujo de equipos eléctricos): "Contenedor" (flujo de 8 etapas con Zona de
        /// Transición y selección de empresa) o "Electrico" (montacargas, tuggers, traspaletas: proveedor único, sin zona,
        /// correctivo y preventivo programado). Los prefijos del tipo heredan su flujo.
        /// </summary>
        public string FlujoMantenimiento { get; set; } = "Contenedor";

        /// <summary>Preventivo por horas de uso (equipos eléctricos): se habilita al llegar a estas horas desde el último</summary>
        public int? HorasPreventivo { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        public DateTime? UpdatedAt { get; set; }

        public int? ProveedorId { get; set; }
        public virtual User? Proveedor { get; set; }

        [NotMapped]
        public int TotalVehiculos { get; set; }
    }
}
