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
    public DateTime CreatedAt { get; set; }
    public List<VehiculoFotoDto> Fotos { get; set; } = new();
}

public class VehiculoCreateRequest
{
    [Required(ErrorMessage = "El código del vehículo es requerido")]
    [MaxLength(50)]
    public required string Codigo { get; set; }

    /// <summary>
    /// Opcional: si no se envía se detecta por el prefijo del código
    /// </summary>
    public TipoVehiculoEnum? Tipo { get; set; }

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
    public string? FotoUrl { get; set; }
}

public class CambiarUbicacionRequest
{
    public UbicacionVehiculoEnum Ubicacion { get; set; }
}

public class VehiculoFotoDto
{
    public int Id { get; set; }
    public required string Url { get; set; }
    public string? Nombre { get; set; }
    public DateTime CreatedAt { get; set; }
}

/// <summary>
/// Resultado de validar un código antes de dar de alta un vehículo:
/// si ya existe (con sus datos de referencia) y qué tipo se detecta por prefijo.
/// </summary>
public class ValidarCodigoVehiculoDto
{
    public required string Codigo { get; set; }
    public bool Existe { get; set; }
    public int? VehiculoId { get; set; }
    public string? TipoNombre { get; set; }
    public string? AreaNombre { get; set; }
    public DateTime? FechaRegistro { get; set; }
    public TipoVehiculoEnum? TipoDetectado { get; set; }
    public string? TipoDetectadoNombre { get; set; }
}

public class EliminarVehiculosRequest
{
    [Required]
    [MinLength(1, ErrorMessage = "Selecciona al menos un vehículo")]
    public List<int> Ids { get; set; } = new();
}

public class EliminarVehiculosResultDto
{
    public int VehiculosEliminados { get; set; }
    public int ReportesEliminados { get; set; }
    public int OrdenesEliminadas { get; set; }
}

/// <summary>
/// Eliminación por filtro (área, tipo, prefijo; PDF 29-oct). Son los mismos filtros de la pantalla
/// Flota de Contenedores, así se elimina exactamente lo que se está viendo.
/// </summary>
public class EliminarVehiculosPorFiltroRequest
{
    public string? Busqueda { get; set; }
    public TipoVehiculoEnum? Tipo { get; set; }
    public int? AreaId { get; set; }
    public string? Prefijo { get; set; }
    /// <summary>La pestaña "Contenedores" deja fuera a los Tuggers</summary>
    public TipoVehiculoEnum? ExcluirTipo { get; set; }
    /// <summary>true: solo regresa cuántos vehículos se eliminarían, sin borrar nada</summary>
    public bool SoloContar { get; set; }
    /// <summary>Total que confirmó el usuario; si ya no coincide con los filtros no se elimina nada</summary>
    public int? TotalConfirmado { get; set; }
}

public class VistaPreviaEliminacionVehiculosDto
{
    public int Total { get; set; }
    /// <summary>Vehículos con reportes u órdenes (también se borra ese historial)</summary>
    public int ConHistorial { get; set; }
    /// <summary>Los primeros códigos, en orden, para mostrarlos al confirmar</summary>
    public List<string> Codigos { get; set; } = new();
}
