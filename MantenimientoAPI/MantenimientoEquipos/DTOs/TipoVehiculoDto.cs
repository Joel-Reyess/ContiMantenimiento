namespace MantenimientoEquipos.DTOs
{
    public class TipoVehiculoDto
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public string? Descripcion { get; set; }
        public string? ImagenUrl { get; set; }
        public string? ImagenFallasUrl { get; set; }
        public int? MaxInWorkshop { get; set; }
        public int? FrecuenciaMantenimientoDias { get; set; }
        public int? FrecuenciaPreventivoMeses { get; set; }
        public int? ProgramadosPorSemana { get; set; }
        public DateTime? FechaProximoMantenimiento { get; set; }
        public bool Activo { get; set; }
        public int? ProveedorId { get; set; }
        public string? ProveedorNombre { get; set; }
        public int TotalVehiculos { get; set; }
    }
}
