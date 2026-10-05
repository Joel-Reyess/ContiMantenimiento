namespace MantenimientoEquipos.DTOs;

public class ExcelImportErrorDto
{
    /// <summary>Número de fila en Excel (la fila 1 son los encabezados)</summary>
    public int Fila { get; set; }
    public string? Columna { get; set; }
    public required string Mensaje { get; set; }
}

/// <summary>
/// Resultado de validar (y opcionalmente aplicar) una importación de Excel.
/// Si hay errores no se aplica nada.
/// </summary>
public class ExcelImportResultDto
{
    public required string Entidad { get; set; }
    public string? Hoja { get; set; }
    public int TotalFilas { get; set; }
    public int Nuevos { get; set; }
    public int Actualizados { get; set; }
    public int TotalErrores { get; set; }
    /// <summary>Primeros errores encontrados (máximo 500)</summary>
    public List<ExcelImportErrorDto> Errores { get; set; } = new();
    public bool Aplicado { get; set; }
}
