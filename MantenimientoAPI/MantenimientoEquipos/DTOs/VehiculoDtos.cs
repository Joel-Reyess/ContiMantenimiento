using System.ComponentModel.DataAnnotations;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.DTOs;

public class VehiculoDto
{
    public int Id { get; set; }
    public required string Codigo { get; set; }
    public TipoVehiculoEnum Tipo { get; set; }
    public string? TipoNombre { get; set; }
    public string? Marca { get; set; }
    public string? Modelo { get; set; }
    public string? NumeroSerie { get; set; }
    public int? Anio { get; set; }
    public EstadoVehiculoEnum Estado { get; set; }
    public string? EstadoNombre { get; set; }
    public UbicacionVehiculoEnum Ubicacion { get; set; }
    public string? UbicacionNombre { get; set; }
    public int? AreaId { get; set; }
    public string? AreaNombre { get; set; }
    public DateTime? FechaAdquisicion { get; set; }
    public DateTime? UltimoMantenimiento { get; set; }
    public DateTime? ProximoMantenimiento { get; set; }
    public decimal? CapacidadCarga { get; set; }
    public decimal? HorasOperacion { get; set; }
    public decimal? Kilometraje { get; set; }
    public string? ImagenUrl { get; set; }
    public string? Notas { get; set; }
    public string? DocumentacionDibujos { get; set; }
    public string? DocumentacionEspecificaciones { get; set; }
    public string? ListaMateriales { get; set; }
    public string? RegistroModificaciones { get; set; }
    public bool Activo { get; set; }
}

public class VehiculoCreateRequest
{
    [Required(ErrorMessage = "El código del vehículo es requerido")]
    [MaxLength(50)]
    public required string Codigo { get; set; }

    [Required(ErrorMessage = "El tipo de vehículo es requerido")]
    public TipoVehiculoEnum Tipo { get; set; }

    [MaxLength(100)]
    public string? Marca { get; set; }

    [MaxLength(100)]
    public string? Modelo { get; set; }

    [MaxLength(50)]
    public string? NumeroSerie { get; set; }

    public int? Anio { get; set; }
    public int? AreaId { get; set; }
    public DateTime? FechaAdquisicion { get; set; }
    public decimal? CapacidadCarga { get; set; }

    [MaxLength(1000)]
    public string? Notas { get; set; }

    [MaxLength(2000)]
    public string? DocumentacionDibujos { get; set; }

    [MaxLength(2000)]
    public string? DocumentacionEspecificaciones { get; set; }

    [MaxLength(2000)]
    public string? ListaMateriales { get; set; }

    [MaxLength(2000)]
    public string? RegistroModificaciones { get; set; }
}

public class VehiculoUpdateRequest
{
    [MaxLength(100)]
    public string? Marca { get; set; }

    [MaxLength(100)]
    public string? Modelo { get; set; }

    [MaxLength(50)]
    public string? NumeroSerie { get; set; }

    public int? Anio { get; set; }
    public TipoVehiculoEnum? Tipo { get; set; }
    public EstadoVehiculoEnum? Estado { get; set; }
    public UbicacionVehiculoEnum? Ubicacion { get; set; }
    public int? AreaId { get; set; }
    public DateTime? ProximoMantenimiento { get; set; }
    public decimal? CapacidadCarga { get; set; }
    public decimal? HorasOperacion { get; set; }
    public decimal? Kilometraje { get; set; }
    public string? ImagenUrl { get; set; }

    [MaxLength(1000)]
    public string? Notas { get; set; }

    [MaxLength(2000)]
    public string? DocumentacionDibujos { get; set; }

    [MaxLength(2000)]
    public string? DocumentacionEspecificaciones { get; set; }

    [MaxLength(2000)]
    public string? ListaMateriales { get; set; }

    [MaxLength(2000)]
    public string? RegistroModificaciones { get; set; }

    public bool? Activo { get; set; }
}

public class VehiculoListDto
{
    public int Id { get; set; }
    public required string Codigo { get; set; }
    public TipoVehiculoEnum Tipo { get; set; }
    public string? TipoNombre { get; set; }
    public string? Marca { get; set; }
    public string? Modelo { get; set; }
    public EstadoVehiculoEnum Estado { get; set; }
    public string? EstadoNombre { get; set; }
    public UbicacionVehiculoEnum Ubicacion { get; set; }
    public string? UbicacionNombre { get; set; }
    public string? AreaNombre { get; set; }
    public string? TipoImagenUrl { get; set; }
    public DateTime? UltimoMantenimiento { get; set; }
    public int TotalReportes { get; set; }
}

public class CambiarUbicacionRequest
{
    public UbicacionVehiculoEnum Ubicacion { get; set; }
}
