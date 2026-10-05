using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Services;

/// <summary>
/// Importación masiva desde Excel (requerimiento 12.2) de vehículos e inventario (refacciones/consumibles).
/// Flujo: se valida todo el archivo; si no hay errores y se pidió aplicar, se crean los registros
/// nuevos y se actualizan los existentes (por Código) en una sola transacción. Con un solo error no se aplica nada.
/// </summary>
public class ExcelImportService
{
    public const int MaxFilas = 10000;
    private const int MaxErroresDevueltos = 500;
    public static readonly string[] Entidades = { "vehiculos", "inventario" };

    // Encabezados de la plantilla. Al leer se ignoran mayúsculas, acentos y el "*" de obligatorio,
    // así que también se puede importar un archivo generado con "Exportar".
    private static readonly string[] ColumnasVehiculos = { "Código *", "Tipo", "Área", "Marca", "Modelo", "Notas" };
    private static readonly string[] ColumnasInventario =
        { "Código *", "Nombre *", "Categoría", "Unidad", "Stock actual", "Stock mínimo", "Stock máximo", "Costo unitario" };

    private readonly MantenimientoDbContext _db;
    private readonly VehiculoPrefijoConfigService _prefijoService;

    public ExcelImportService(MantenimientoDbContext db, VehiculoPrefijoConfigService prefijoService)
    {
        _db = db;
        _prefijoService = prefijoService;
    }

    // ===================== PLANTILLAS =====================

    public async Task<byte[]> GenerarPlantillaAsync(string entidad)
    {
        using var wb = new XLWorkbook();
        if (entidad == "vehiculos")
        {
            var ws = HojaPlantilla(wb, ExcelExportService.Hojas["vehiculos"], ColumnasVehiculos);
            var tipos = await _db.TiposVehiculo.AsNoTracking().Where(t => t.Activo).OrderBy(t => t.Nombre).Select(t => t.Nombre).ToListAsync();
            var areas = await _db.Areas.AsNoTracking().Where(a => a.Activa).OrderBy(a => a.Nombre).Select(a => a.Nombre).ToListAsync();

            // Listas desplegables para Tipo y Área (hoja oculta)
            var listas = wb.Worksheets.Add("Listas");
            listas.Cell(1, 1).Value = "Tipos";
            listas.Cell(1, 2).Value = "Áreas";
            for (var i = 0; i < tipos.Count; i++) listas.Cell(i + 2, 1).Value = tipos[i];
            for (var i = 0; i < areas.Count; i++) listas.Cell(i + 2, 2).Value = areas[i];
            if (tipos.Count > 0)
                ws.Range(2, 2, MaxFilas + 1, 2).CreateDataValidation().List(listas.Range(2, 1, tipos.Count + 1, 1), true);
            if (areas.Count > 0)
                ws.Range(2, 3, MaxFilas + 1, 3).CreateDataValidation().List(listas.Range(2, 2, areas.Count + 1, 2), true);
            listas.Hide();

            Instrucciones(wb, new[]
            {
                "Plantilla de importación de VEHÍCULOS",
                "",
                "• Una fila por vehículo, a partir de la fila 2. No cambies los encabezados.",
                "• Código (obligatorio): identificador del equipo, por ejemplo MTC-045 o 916100000100.",
                "• Tipo (opcional): si lo dejas vacío se detecta con los prefijos configurados. Si ningún prefijo coincide, la fila marcará error.",
                "• Área (opcional): debe ser un área activa del sistema (usa la lista desplegable).",
                "• Marca, Modelo y Notas son opcionales.",
                "",
                "Si el Código YA EXISTE, el vehículo se ACTUALIZA con los datos que escribas; las celdas vacías no cambian nada.",
                "Si el Código NO existe, se da de alta.",
                "",
                "Antes de importar, el sistema valida todo el archivo y muestra los errores por fila.",
                "Si hay al menos un error no se guarda nada; corrige y vuelve a intentar.",
                $"Máximo {MaxFilas:N0} filas por archivo.",
                "",
                "También puedes usar un archivo generado con \"Exportar Excel\": se leen las columnas Código, Tipo, Área, Marca, Modelo y Notas y se ignoran las demás."
            });
        }
        else if (entidad == "inventario")
        {
            var ws = HojaPlantilla(wb, ExcelExportService.Hojas["inventario"], ColumnasInventario);
            ws.Range(2, 5, MaxFilas + 1, 8).Style.NumberFormat.Format = "#,##0.00";
            Instrucciones(wb, new[]
            {
                "Plantilla de importación de INVENTARIO (refacciones y consumibles)",
                "",
                "• Una fila por artículo, a partir de la fila 2. No cambies los encabezados.",
                "• Código (obligatorio): clave única del artículo.",
                "• Nombre: obligatorio para artículos nuevos.",
                "• Categoría: si contiene la palabra \"Refacción\" el artículo aparece en el filtro Refacciones; si no, en Consumibles.",
                "• Unidad: pieza, litro, metro, etc. Si se deja vacía en un artículo nuevo se usa \"pieza\".",
                "• Stock actual, Stock mínimo, Stock máximo y Costo unitario: números iguales o mayores a 0.",
                "",
                "Si el Código YA EXISTE, el artículo se ACTUALIZA con los datos que escribas; las celdas vacías no cambian nada.",
                "Si cambia el Stock actual de un artículo existente se registra un movimiento de ajuste (\"Importación desde Excel\").",
                "Si el Código NO existe, se da de alta.",
                "",
                "Antes de importar, el sistema valida todo el archivo y muestra los errores por fila.",
                "Si hay al menos un error no se guarda nada; corrige y vuelve a intentar.",
                $"Máximo {MaxFilas:N0} filas por archivo."
            });
        }
        else
        {
            throw new ArgumentException($"No existe plantilla para '{entidad}'");
        }

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static IXLWorksheet HojaPlantilla(XLWorkbook wb, string nombre, string[] columnas)
    {
        var ws = wb.Worksheets.Add(nombre);
        for (var c = 0; c < columnas.Length; c++)
        {
            ws.Cell(1, c + 1).Value = columnas[c];
            ws.Column(c + 1).Width = 22;
        }
        // Código como texto para conservar ceros a la izquierda y números largos
        ws.Range(2, 1, MaxFilas + 1, 1).Style.NumberFormat.Format = "@";
        ExcelExportService.EstiloEncabezado(ws.Range(1, 1, 1, columnas.Length));
        ws.SheetView.FreezeRows(1);
        return ws;
    }

    private static void Instrucciones(XLWorkbook wb, string[] lineas)
    {
        var ws = wb.Worksheets.Add("Instrucciones");
        for (var i = 0; i < lineas.Length; i++) ws.Cell(i + 1, 1).Value = lineas[i];
        ws.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(13);
        ws.Column(1).Width = 120;
    }

    // ===================== IMPORTACIÓN =====================

    public async Task<ExcelImportResultDto> ImportarAsync(string entidad, Stream archivo, bool aplicar, int userId)
    {
        XLWorkbook wb;
        try
        {
            wb = new XLWorkbook(archivo);
        }
        catch (Exception)
        {
            throw new ArgumentException("El archivo no es un Excel válido. Guárdalo como .xlsx e inténtalo de nuevo.");
        }

        using (wb)
        {
            var hoja = BuscarHoja(wb, ExcelExportService.Hojas[entidad]);
            var tabla = LeerTabla(hoja, MaxFilas);
            var resultado = new ExcelImportResultDto { Entidad = entidad, Hoja = hoja.Name, TotalFilas = tabla.Filas.Count };

            return entidad switch
            {
                "vehiculos" => await ImportarVehiculosAsync(tabla, resultado, aplicar, userId),
                "inventario" => await ImportarInventarioAsync(tabla, resultado, aplicar, userId),
                _ => throw new ArgumentException($"No se puede importar '{entidad}'")
            };
        }
    }

    private async Task<ExcelImportResultDto> ImportarVehiculosAsync(TablaExcel tabla, ExcelImportResultDto resultado, bool aplicar, int userId)
    {
        tabla.Requerir("Código");
        var errores = new Errores(resultado);

        var tipos = (await _db.TiposVehiculo.AsNoTracking().Select(t => new { t.Id, t.Nombre }).ToListAsync())
            .Where(t => Enum.IsDefined(typeof(TipoVehiculoEnum), t.Id))
            .GroupBy(t => Normalizar(t.Nombre))
            .ToDictionary(g => g.Key, g => (TipoVehiculoEnum)g.First().Id);
        var areas = (await _db.Areas.AsNoTracking().Where(a => a.Activa).Select(a => new { a.Id, a.Nombre }).ToListAsync())
            .GroupBy(a => Normalizar(a.Nombre))
            .ToDictionary(g => g.Key, g => g.First().Id);
        var prefijos = await _prefijoService.GetPrefijosActivosAsync();
        var existentes = (await _db.Vehiculos.ToListAsync())
            .GroupBy(v => v.Codigo.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var vistos = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var cambios = new List<Action>();

        foreach (var fila in tabla.Filas)
        {
            var codigo = fila.Texto("Código");
            var tipoTexto = fila.Texto("Tipo");
            var areaTexto = fila.Texto("Área");
            var marca = fila.Texto("Marca");
            var modelo = fila.Texto("Modelo");
            var notas = fila.Texto("Notas");
            var erroresAntes = resultado.TotalErrores;

            if (string.IsNullOrEmpty(codigo)) { errores.Add(fila.Numero, "Código", "El código es obligatorio"); continue; }
            if (codigo.Length > 50) errores.Add(fila.Numero, "Código", "Máximo 50 caracteres");
            if (vistos.TryGetValue(codigo, out var filaPrevia))
                errores.Add(fila.Numero, "Código", $"Código repetido en el archivo (también en la fila {filaPrevia})");
            else
                vistos[codigo] = fila.Numero;

            existentes.TryGetValue(codigo, out var existente);

            TipoVehiculoEnum? tipo = null;
            if (!string.IsNullOrEmpty(tipoTexto))
            {
                if (tipos.TryGetValue(Normalizar(tipoTexto), out var t)) tipo = t;
                else errores.Add(fila.Numero, "Tipo", $"El tipo '{tipoTexto}' no existe en el sistema");
            }
            else if (existente == null)
            {
                var detectado = VehiculoPrefijoConfigService.DetectarTipoVehiculoId(codigo, prefijos);
                if (detectado.HasValue && Enum.IsDefined(typeof(TipoVehiculoEnum), detectado.Value))
                    tipo = (TipoVehiculoEnum)detectado.Value;
                else
                    errores.Add(fila.Numero, "Tipo", "No se indicó el tipo y ningún prefijo configurado coincide con el código");
            }

            int? areaId = null;
            if (!string.IsNullOrEmpty(areaTexto))
            {
                if (areas.TryGetValue(Normalizar(areaTexto), out var a)) areaId = a;
                else errores.Add(fila.Numero, "Área", $"El área '{areaTexto}' no existe o está inactiva");
            }

            if (marca?.Length > 100) errores.Add(fila.Numero, "Marca", "Máximo 100 caracteres");
            if (modelo?.Length > 100) errores.Add(fila.Numero, "Modelo", "Máximo 100 caracteres");
            if (notas?.Length > 1000) errores.Add(fila.Numero, "Notas", "Máximo 1000 caracteres");

            if (resultado.TotalErrores > erroresAntes) continue;

            if (existente == null)
            {
                resultado.Nuevos++;
                cambios.Add(() => _db.Vehiculos.Add(new Vehiculo
                {
                    Codigo = codigo,
                    Tipo = tipo!.Value,
                    AreaId = areaId,
                    Marca = marca,
                    Modelo = modelo,
                    Notas = notas,
                    Estado = EstadoVehiculoEnum.Operativo,
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow
                }));
            }
            else
            {
                resultado.Actualizados++;
                cambios.Add(() =>
                {
                    if (tipo.HasValue) existente.Tipo = tipo.Value;
                    if (areaId.HasValue) existente.AreaId = areaId;
                    if (marca != null) existente.Marca = marca;
                    if (modelo != null) existente.Modelo = modelo;
                    if (notas != null) existente.Notas = notas;
                    existente.UpdatedAt = DateTime.UtcNow;
                    existente.UpdatedBy = userId;
                });
            }
        }

        return await AplicarAsync(resultado, cambios, aplicar);
    }

    private async Task<ExcelImportResultDto> ImportarInventarioAsync(TablaExcel tabla, ExcelImportResultDto resultado, bool aplicar, int userId)
    {
        tabla.Requerir("Código");
        var errores = new Errores(resultado);

        var existentes = (await _db.Consumibles.ToListAsync())
            .GroupBy(c => c.Codigo.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var vistos = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var cambios = new List<Action>();

        foreach (var fila in tabla.Filas)
        {
            var codigo = fila.Texto("Código");
            var nombre = fila.Texto("Nombre");
            var categoria = fila.Texto("Categoría");
            var unidad = fila.Texto("Unidad");
            var erroresAntes = resultado.TotalErrores;

            if (string.IsNullOrEmpty(codigo)) { errores.Add(fila.Numero, "Código", "El código es obligatorio"); continue; }
            if (codigo.Length > 50) errores.Add(fila.Numero, "Código", "Máximo 50 caracteres");
            if (vistos.TryGetValue(codigo, out var filaPrevia))
                errores.Add(fila.Numero, "Código", $"Código repetido en el archivo (también en la fila {filaPrevia})");
            else
                vistos[codigo] = fila.Numero;

            existentes.TryGetValue(codigo, out var existente);

            if (existente == null && string.IsNullOrEmpty(nombre))
                errores.Add(fila.Numero, "Nombre", "El nombre es obligatorio para artículos nuevos");
            if (nombre?.Length > 150) errores.Add(fila.Numero, "Nombre", "Máximo 150 caracteres");
            if (categoria?.Length > 100) errores.Add(fila.Numero, "Categoría", "Máximo 100 caracteres");
            if (unidad?.Length > 20) errores.Add(fila.Numero, "Unidad", "Máximo 20 caracteres");

            decimal? Numero(string columna)
            {
                var (valor, error) = fila.Decimal(columna);
                if (error != null) errores.Add(fila.Numero, columna, error);
                else if (valor < 0) errores.Add(fila.Numero, columna, "No puede ser negativo");
                return valor;
            }
            var stockActual = Numero("Stock actual");
            var stockMinimo = Numero("Stock mínimo");
            var stockMaximo = Numero("Stock máximo");
            var costo = Numero("Costo unitario");

            var minimoFinal = stockMinimo ?? existente?.StockMinimo ?? 0;
            var maximoFinal = stockMaximo ?? existente?.StockMaximo;
            if (maximoFinal.HasValue && maximoFinal < minimoFinal)
                errores.Add(fila.Numero, "Stock máximo", "El stock máximo no puede ser menor que el mínimo");

            if (resultado.TotalErrores > erroresAntes) continue;

            if (existente == null)
            {
                resultado.Nuevos++;
                cambios.Add(() => _db.Consumibles.Add(new Consumible
                {
                    Codigo = codigo,
                    Nombre = nombre!,
                    Categoria = categoria,
                    Unidad = string.IsNullOrEmpty(unidad) ? "pieza" : unidad,
                    StockActual = stockActual ?? 0,
                    StockMinimo = stockMinimo ?? 0,
                    StockMaximo = stockMaximo,
                    CostoUnitario = costo ?? 0,
                    Activo = true,
                    AlertaActiva = (stockActual ?? 0) <= (stockMinimo ?? 0)
                }));
            }
            else
            {
                resultado.Actualizados++;
                cambios.Add(() =>
                {
                    if (nombre != null) existente.Nombre = nombre;
                    if (categoria != null) existente.Categoria = categoria;
                    if (unidad != null) existente.Unidad = unidad;
                    if (stockMinimo.HasValue) existente.StockMinimo = stockMinimo.Value;
                    if (stockMaximo.HasValue) existente.StockMaximo = stockMaximo;
                    if (costo.HasValue) existente.CostoUnitario = costo.Value;
                    if (stockActual.HasValue && stockActual.Value != existente.StockActual)
                    {
                        // Mismo registro que deja un ajuste manual de stock
                        var delta = stockActual.Value - existente.StockActual;
                        _db.ConsumosConsumibles.Add(new ConsumoConsumible
                        {
                            ConsumibleId = existente.Id,
                            UsuarioId = userId,
                            TipoMovimiento = delta > 0 ? "ajuste+" : "ajuste-",
                            Cantidad = Math.Abs(delta),
                            Comentario = "Importación desde Excel"
                        });
                        existente.StockActual = stockActual.Value;
                    }
                    existente.AlertaActiva = existente.StockActual <= existente.StockMinimo;
                    existente.UpdatedAt = DateTime.UtcNow;
                });
            }
        }

        return await AplicarAsync(resultado, cambios, aplicar);
    }

    private async Task<ExcelImportResultDto> AplicarAsync(ExcelImportResultDto resultado, List<Action> cambios, bool aplicar)
    {
        if (!aplicar || resultado.TotalErrores > 0 || cambios.Count == 0) return resultado;

        using var tx = await _db.Database.BeginTransactionAsync();
        foreach (var cambio in cambios) cambio();
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        resultado.Aplicado = true;
        return resultado;
    }

    // ===================== LECTURA DEL ARCHIVO =====================

    private static IXLWorksheet BuscarHoja(XLWorkbook wb, string nombreEsperado)
    {
        var buscado = Normalizar(nombreEsperado);
        var hoja = wb.Worksheets.FirstOrDefault(w => Normalizar(w.Name) == buscado)
            ?? wb.Worksheets.FirstOrDefault(w => w.Visibility == XLWorksheetVisibility.Visible
                && !new[] { "instrucciones", "listas", "resumen" }.Contains(Normalizar(w.Name)));
        return hoja ?? throw new ArgumentException("El archivo no tiene hojas con datos");
    }

    private static TablaExcel LeerTabla(IXLWorksheet hoja, int maxFilas)
    {
        var columnas = new Dictionary<string, int>();
        var encabezados = hoja.Row(1).CellsUsed().ToList();
        foreach (var cell in encabezados)
        {
            var clave = Normalizar(cell.GetString());
            if (clave.Length > 0 && !columnas.ContainsKey(clave)) columnas[clave] = cell.Address.ColumnNumber;
        }
        if (columnas.Count == 0)
            throw new ArgumentException($"La hoja '{hoja.Name}' no tiene encabezados en la fila 1");

        var ultima = hoja.LastRowUsed(XLCellsUsedOptions.Contents)?.RowNumber() ?? 1;
        var filas = new List<FilaExcel>();
        for (var r = 2; r <= ultima; r++)
        {
            var valores = columnas.ToDictionary(c => c.Key, c => hoja.Cell(r, c.Value).Value);
            if (valores.Values.All(v => v.IsBlank || (v.IsText && string.IsNullOrWhiteSpace(v.GetText())))) continue;
            filas.Add(new FilaExcel(r, valores));
            if (filas.Count > maxFilas)
                throw new ArgumentException($"El archivo tiene más de {maxFilas:N0} filas. Divídelo en varios archivos.");
        }
        return new TablaExcel(hoja.Name, columnas.Keys.ToHashSet(), filas);
    }

    private sealed record TablaExcel(string Hoja, HashSet<string> Columnas, List<FilaExcel> Filas)
    {
        public void Requerir(string columna)
        {
            if (!Columnas.Contains(Normalizar(columna)))
                throw new ArgumentException($"No se encontró la columna '{columna}' en la hoja '{Hoja}'. Usa la plantilla de importación.");
        }
    }

    private sealed record FilaExcel(int Numero, Dictionary<string, XLCellValue> Valores)
    {
        /// <summary>Texto recortado, o null si la celda está vacía o la columna no viene en el archivo</summary>
        public string? Texto(string columna)
        {
            if (!Valores.TryGetValue(Normalizar(columna), out var v) || v.IsBlank) return null;
            var texto = v.IsNumber
                ? v.GetNumber().ToString("0.##########", CultureInfo.InvariantCulture)
                : v.IsDateTime ? v.GetDateTime().ToString("dd/MM/yyyy", CultureInfo.InvariantCulture)
                : v.ToString(CultureInfo.InvariantCulture);
            texto = texto.Trim();
            return texto.Length == 0 ? null : texto;
        }

        public (decimal? Valor, string? Error) Decimal(string columna)
        {
            if (!Valores.TryGetValue(Normalizar(columna), out var v) || v.IsBlank) return (null, null);
            if (v.IsNumber) return ((decimal)v.GetNumber(), null);
            var texto = Texto(columna)?.Replace("$", "").Replace(",", "").Replace(" ", "");
            if (string.IsNullOrEmpty(texto)) return (null, null);
            return decimal.TryParse(texto, NumberStyles.Number, CultureInfo.InvariantCulture, out var d)
                ? (d, null)
                : (null, $"'{Texto(columna)}' no es un número válido");
        }
    }

    private sealed class Errores
    {
        private readonly ExcelImportResultDto _resultado;
        public Errores(ExcelImportResultDto resultado) => _resultado = resultado;

        public void Add(int fila, string columna, string mensaje)
        {
            _resultado.TotalErrores++;
            if (_resultado.Errores.Count < MaxErroresDevueltos)
                _resultado.Errores.Add(new ExcelImportErrorDto { Fila = fila, Columna = columna, Mensaje = mensaje });
        }
    }

    /// <summary>Minúsculas, sin acentos, sin "*" y con espacios simples: "Código *" → "codigo"</summary>
    internal static string Normalizar(string? texto)
    {
        if (string.IsNullOrWhiteSpace(texto)) return string.Empty;
        var sinAcentos = new StringBuilder();
        foreach (var ch in texto.Replace("*", "").Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD))
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark) sinAcentos.Append(ch);
        return string.Join(' ', sinAcentos.ToString().Normalize(NormalizationForm.FormC)
            .Split(' ', StringSplitOptions.RemoveEmptyEntries));
    }
}
