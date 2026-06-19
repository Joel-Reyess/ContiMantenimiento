using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.DTOs;

// ===== ÁREAS =====
public class AreaDto
{
    public int Id { get; set; }
    public required string Nombre { get; set; }
    public string? Codigo { get; set; }
    public string? Descripcion { get; set; }
    public int? SupervisorId { get; set; }
    public string? SupervisorNombre { get; set; }
    public bool Activa { get; set; }
}

public class AreaCreateRequest
{
    [Required(ErrorMessage = "El nombre del área es requerido")]
    [MaxLength(100)]
    public required string Nombre { get; set; }

    [MaxLength(20)]
    public string? Codigo { get; set; }

    [MaxLength(300)]
    public string? Descripcion { get; set; }

    public int? SupervisorId { get; set; }
}


// ===== CATEGORÍAS DE FALLA =====
public class CategoriaFallaDto
{
    public int Id { get; set; }
    public required string Nombre { get; set; }
    public string? Descripcion { get; set; }
    public string? Icono { get; set; }
    public bool Activa { get; set; }
}

public class CategoriaFallaCreateRequest
{
    [Required(ErrorMessage = "El nombre de la categoría es requerido")]
    [MaxLength(100)]
    public required string Nombre { get; set; }

    [MaxLength(300)]
    public string? Descripcion { get; set; }

    [MaxLength(50)]
    public string? Icono { get; set; }
}


// ===== ROLES =====
public class RolDto
{
    public int Id { get; set; }
    public required string Nombre { get; set; }
    public string? Descripcion { get; set; }
    public bool Activo { get; set; }
}


// ===== TÉCNICOS =====
public class TecnicoDto
{
    public int Id { get; set; }
    public required string NombreCompleto { get; set; }
    public string? NumeroEmpleado { get; set; }
    public string? Telefono { get; set; }
    public string? TipoTecnico { get; set; }
    public string? EmpresaExterna { get; set; }
    public decimal? TarifaHora { get; set; }
    public string? Especialidades { get; set; }
    public int OrdenesActivas { get; set; }
    public int OrdenesCompletadas { get; set; }
}

public class TecnicoCreateRequest
{
    [Required]
    [MaxLength(100)]
    public required string NombreCompleto { get; set; }

    [Required]
    [MaxLength(50)]
    public required string Username { get; set; }

    [Required]
    [MinLength(6)]
    public required string Password { get; set; }

    [MaxLength(20)]
    public string? NumeroEmpleado { get; set; }

    [MaxLength(20)]
    public string? Telefono { get; set; }

    public bool EsExterno { get; set; } = false;

    [MaxLength(100)]
    public string? EmpresaExterna { get; set; }

    public decimal? TarifaHora { get; set; }

    [MaxLength(200)]
    public string? Especialidades { get; set; }
}

public class AreaUpdateRequest
{
    public string? Nombre { get; set; }
    public string? Codigo { get; set; }
    public string? Descripcion { get; set; }
    public int? SupervisorId { get; set; }
    public bool? Activa { get; set; }
}

// ===== CONSUMIBLES =====
public class ConsumibleDto
{
    public int Id { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string? Categoria { get; set; }
    public string Unidad { get; set; } = "pieza";
    public decimal StockActual { get; set; }
    public decimal StockMinimo { get; set; }
    public decimal? StockMaximo { get; set; }
    public decimal CostoUnitario { get; set; }
    public bool AlertaActiva { get; set; }
    public bool Activo { get; set; }
}

public class ConsumibleCreateRequest
{
    public string Codigo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string? Categoria { get; set; }
    public string Unidad { get; set; } = "pieza";
    public decimal StockActual { get; set; }
    public decimal StockMinimo { get; set; }
    public decimal? StockMaximo { get; set; }
    public decimal? CostoUnitario { get; set; }
    public bool Activo { get; set; } = true;
}

public class ConsumibleUpdateRequest
{
    public string? Nombre { get; set; }
    public string? Categoria { get; set; }
    public string? Unidad { get; set; }
    public decimal? StockActual { get; set; }
    public decimal? StockMinimo { get; set; }
    public decimal? StockMaximo { get; set; }
    public decimal? CostoUnitario { get; set; }
    public bool? Activo { get; set; }
}

public class AjusteStockRequest
{
    public string Tipo { get; set; } = "ajuste+";
    public decimal Cantidad { get; set; }
    public string? Comentario { get; set; }
}

public class ConsumoRequest
{
    public int? OrdenTrabajoId { get; set; }
    public int? ReporteId { get; set; }
    public decimal Cantidad { get; set; }
    public string? Comentario { get; set; }
}
