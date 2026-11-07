using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.DTOs;

// ===== Empresas proveedoras (PDF 06-nov, CFG-07) =====

public class EmpresaDto
{
    public int Id { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string Identificador { get; set; } = string.Empty;
    public bool Activo { get; set; }
    public string? Contacto { get; set; }
    public string? Telefono { get; set; }
    public string? Email { get; set; }
    public DateTime CreatedAt { get; set; }
    /// <summary>Técnicos que pertenecen a la empresa</summary>
    public int Tecnicos { get; set; }
    /// <summary>Órdenes de pago generadas con sus tarifas</summary>
    public int OrdenesPago { get; set; }
    /// <summary>Actividades con tarifa propia (las demás usan el costo base)</summary>
    public int Tarifas { get; set; }
}

public class EmpresaRequest
{
    [Required(ErrorMessage = "Escribe el nombre de la empresa.")]
    [MaxLength(150, ErrorMessage = "El nombre no puede pasar de 150 caracteres.")]
    public string Nombre { get; set; } = string.Empty;

    [Required(ErrorMessage = "Escribe el identificador (RFC o ID) de la empresa.")]
    [MaxLength(30, ErrorMessage = "El identificador no puede pasar de 30 caracteres.")]
    public string Identificador { get; set; } = string.Empty;

    public bool Activo { get; set; } = true;

    [MaxLength(100, ErrorMessage = "El contacto no puede pasar de 100 caracteres.")]
    public string? Contacto { get; set; }

    [MaxLength(20, ErrorMessage = "El teléfono no puede pasar de 20 caracteres.")]
    public string? Telefono { get; set; }

    [MaxLength(100, ErrorMessage = "El correo no puede pasar de 100 caracteres.")]
    public string? Email { get; set; }
}

// ===== Tarifario por empresa (PDF 06-nov, CFG-08) =====

public class TarifaEmpresaDto
{
    public int ChecklistItemId { get; set; }
    public decimal Costo { get; set; }
}

public class TarifaEmpresaRequest
{
    public int ChecklistItemId { get; set; }
    /// <summary>Vacío (null): la actividad vuelve a usar el costo base</summary>
    public decimal? Costo { get; set; }
}

public class GuardarTarifasRequest
{
    /// <summary>Solo se tocan las actividades que vienen; las demás conservan su tarifa</summary>
    public List<TarifaEmpresaRequest> Items { get; set; } = new();
}

// ===== Dashboard financiero por proveedor (PDF 06-nov, DSH-02) =====

public class GastoProveedorFilaDto
{
    /// <summary>null = técnicos sin empresa (tarifa base)</summary>
    public int? EmpresaId { get; set; }
    public string Empresa { get; set; } = string.Empty;
    public int Reparaciones { get; set; }
    public decimal CostoTotal { get; set; }
    public decimal CostoPromedio { get; set; }
}

public class GastoPeriodoDto
{
    /// <summary>Clave estable del periodo (2026-09, 2026-09-Q1, 2026-W36…)</summary>
    public string Clave { get; set; } = string.Empty;
    /// <summary>Nombre para mostrar: "Septiembre 2026", "1–15 sep 2026", "Semana del 31 ago al 6 sep 2026"</summary>
    public string Etiqueta { get; set; } = string.Empty;
    /// <summary>Inicio (incluido) y fin (excluido), en hora local del navegador</summary>
    public DateTime Desde { get; set; }
    public DateTime Hasta { get; set; }
    /// <summary>Una fila por empresa con movimiento en el periodo, de mayor a menor gasto</summary>
    public List<GastoProveedorFilaDto> Proveedores { get; set; } = new();
    public int Reparaciones { get; set; }
    public decimal CostoTotal { get; set; }
    public decimal CostoPromedio { get; set; }
}

public class GastoProveedoresDto
{
    public string Periodicidad { get; set; } = string.Empty;
    /// <summary>null = todas las empresas; 0 = sin empresa</summary>
    public int? EmpresaId { get; set; }
    /// <summary>Del más reciente al más antiguo</summary>
    public List<GastoPeriodoDto> Periodos { get; set; } = new();
}
