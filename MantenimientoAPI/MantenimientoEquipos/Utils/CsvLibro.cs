using System.Globalization;
using System.IO.Compression;
using System.Text;
using ClosedXML.Excel;

namespace MantenimientoEquipos.Utils;

/// <summary>
/// CSV de la plataforma: la misma información y los mismos encabezados que las hojas de Excel, para que lo que
/// se exporta se pueda volver a importar. Un módulo = un .csv; "todo" = un .zip con un .csv por hoja (el nombre
/// del archivo hace de nombre de hoja: "Vehículos.csv"). UTF-8 con BOM y comas, como lo abre Excel en México.
/// </summary>
public static class CsvLibro
{
    public const string ContentTypeCsv = "text/csv; charset=utf-8";
    public const string ContentTypeZip = "application/zip";

    private static readonly UTF8Encoding Utf8ConBom = new(true);
    private static readonly UTF8Encoding Utf8Estricto = new(false, true);

    // ===================== Escribir =====================

    /// <summary>Una hoja como CSV (fechas dd/MM/yyyy, números sin separador de miles y con punto decimal)</summary>
    public static byte[] HojaACsv(IXLWorksheet hoja)
    {
        var sb = new StringBuilder();
        var rango = hoja.RangeUsed();
        if (rango != null)
        {
            var ultimaColumna = rango.LastColumn().ColumnNumber();
            var ultimaFila = rango.LastRow().RowNumber();
            for (var r = 1; r <= ultimaFila; r++)
            {
                for (var c = 1; c <= ultimaColumna; c++)
                {
                    if (c > 1) sb.Append(',');
                    var v = hoja.Cell(r, c).Value;
                    var t = Texto(v);
                    // Códigos largos o con ceros a la izquierda (92039161001001, 0012): Excel los volvería número
                    // (9.2E+13) y al guardar se perderían; con ="..." los deja como texto
                    sb.Append(v.IsText && CodigoNumerico(t) ? Campo("=\"" + t + "\"", sinApostrofo: true) : Campo(t));
                }
                sb.Append("\r\n");
            }
        }
        return Utf8ConBom.GetPreamble().Concat(Utf8ConBom.GetBytes(sb.ToString())).ToArray();
    }

    /// <summary>Todas las hojas visibles del libro, cada una como "Nombre de la hoja.csv" dentro de un .zip</summary>
    public static byte[] LibroAZip(XLWorkbook libro)
    {
        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, true, Encoding.UTF8))
        {
            foreach (var hoja in libro.Worksheets.Where(h => h.Visibility == XLWorksheetVisibility.Visible))
            {
                var entrada = zip.CreateEntry($"{NombreArchivo(hoja.Name)}.csv", CompressionLevel.Optimal);
                using var s = entrada.Open();
                var datos = HojaACsv(hoja);
                s.Write(datos, 0, datos.Length);
            }
        }
        return ms.ToArray();
    }

    /// <summary>Lee un .xlsx generado por la plataforma y regresa la hoja pedida (o la primera) como CSV</summary>
    public static byte[] XlsxACsv(byte[] xlsx, string? hoja = null)
    {
        using var libro = new XLWorkbook(new MemoryStream(xlsx));
        var h = (hoja == null ? null : libro.Worksheets.FirstOrDefault(w => w.Name == hoja))
                ?? libro.Worksheets.First(w => w.Visibility == XLWorksheetVisibility.Visible);
        return HojaACsv(h);
    }

    public static byte[] XlsxAZip(byte[] xlsx)
    {
        using var libro = new XLWorkbook(new MemoryStream(xlsx));
        return LibroAZip(libro);
    }

    private static string Texto(XLCellValue v)
    {
        if (v.IsBlank) return "";
        if (v.IsNumber) return v.GetNumber().ToString("0.##########", CultureInfo.InvariantCulture);
        if (v.IsDateTime)
        {
            var d = v.GetDateTime();
            return d.TimeOfDay == TimeSpan.Zero ? d.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture) : d.ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture);
        }
        if (v.IsBoolean) return v.GetBoolean() ? "Sí" : "No";
        return v.ToString(CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// Campo con comillas cuando hace falta. Un texto que empieza con =, +, @ o - (y no es número) lleva un apóstrofo
    /// para que Excel no lo tome como fórmula; al importar se le quita.
    /// </summary>
    private static string Campo(string valor, bool sinApostrofo = false)
    {
        if (!sinApostrofo && valor.Length > 0 && (valor[0] is '=' or '+' or '@' || (valor[0] == '-' && !decimal.TryParse(valor, NumberStyles.Number, CultureInfo.InvariantCulture, out _))))
            valor = "'" + valor;
        return valor.IndexOfAny(new[] { ',', '"', '\r', '\n', ';' }) >= 0 ? "\"" + valor.Replace("\"", "\"\"") + "\"" : valor;
    }

    private static bool CodigoNumerico(string t) =>
        t.Length > 1 && t.All(char.IsAsciiDigit) && (t.Length >= 11 || t[0] == '0');

    private static string NombreArchivo(string nombre) =>
        new(nombre.Select(ch => Path.GetInvalidFileNameChars().Contains(ch) ? '_' : ch).ToArray());

    // ===================== Leer =====================

    /// <summary>
    /// Abre lo que suba el usuario como un libro de Excel: .xlsx tal cual; .csv como una hoja llamada
    /// <paramref name="hojaCsv"/>; .zip con una hoja por cada .csv (el nombre del archivo es el nombre de la hoja).
    /// </summary>
    public static XLWorkbook Abrir(Stream archivo, string? nombreArchivo, string hojaCsv)
    {
        var ext = Path.GetExtension(nombreArchivo ?? "").ToLowerInvariant();
        using var ms = new MemoryStream();
        archivo.CopyTo(ms);
        var datos = ms.ToArray();

        if (ext == ".csv") return LibroDeCsv(new[] { (hojaCsv, datos) });
        if (ext == ".zip") return LibroDeZip(datos);
        try
        {
            return new XLWorkbook(new MemoryStream(datos));
        }
        catch (Exception)
        {
            // Sin extensión conocida: puede ser un .zip de CSV
            if (datos.Length > 2 && datos[0] == 'P' && datos[1] == 'K')
            {
                try { return LibroDeZip(datos); } catch (ArgumentException) { }
            }
            throw new ArgumentException("El archivo no es un Excel (.xlsx), CSV (.csv) ni un .zip de CSV. Guárdalo en uno de esos formatos e inténtalo de nuevo.");
        }
    }

    private static XLWorkbook LibroDeZip(byte[] datos)
    {
        var hojas = new List<(string, byte[])>();
        try
        {
            using var zip = new ZipArchive(new MemoryStream(datos), ZipArchiveMode.Read);
            foreach (var e in zip.Entries.Where(e => e.FullName.EndsWith(".csv", StringComparison.OrdinalIgnoreCase) && !e.FullName.StartsWith("__MACOSX")))
            {
                using var s = e.Open();
                using var m = new MemoryStream();
                s.CopyTo(m);
                hojas.Add((Path.GetFileNameWithoutExtension(e.Name), m.ToArray()));
            }
        }
        catch (InvalidDataException)
        {
            throw new ArgumentException("El .zip está dañado o no se puede abrir.");
        }
        if (hojas.Count == 0) throw new ArgumentException("El .zip no tiene archivos .csv.");
        return LibroDeCsv(hojas);
    }

    private static XLWorkbook LibroDeCsv(IEnumerable<(string Hoja, byte[] Datos)> archivos)
    {
        var libro = new XLWorkbook();
        foreach (var (nombre, datos) in archivos)
        {
            var texto = Decodificar(datos);
            var separador = Separador(texto);
            var hoja = libro.Worksheets.Add(NombreHoja(nombre, libro));
            var r = 0;
            foreach (var fila in Filas(texto, separador))
            {
                r++;
                for (var c = 0; c < fila.Count; c++)
                {
                    var valor = fila[c];
                    // ="0012" (código guardado como texto para Excel) → 0012
                    if (valor.Length >= 3 && valor.StartsWith("=\"") && valor.EndsWith('"')) valor = valor[2..^1];
                    if (valor.Length > 1 && valor[0] == '\'' && valor[1] is '=' or '+' or '@' or '-') valor = valor[1..];
                    // Con ";" Excel usa coma decimal (12,5): se pasa a punto para que se lea como número
                    if (separador == ';' && System.Text.RegularExpressions.Regex.IsMatch(valor, @"^-?\d+(\.\d{3})*,\d+$"))
                        valor = valor.Replace(".", "").Replace(',', '.');
                    if (valor.Length > 0) hoja.Cell(r, c + 1).SetValue(valor);
                }
            }
        }
        return libro;
    }

    /// <summary>UTF-8 (con o sin BOM); si no lo es, Latin-1 (lo que guarda Excel como "CSV" en Windows)</summary>
    private static string Decodificar(byte[] datos)
    {
        var inicio = datos.Length >= 3 && datos[0] == 0xEF && datos[1] == 0xBB && datos[2] == 0xBF ? 3 : 0;
        try { return Utf8Estricto.GetString(datos, inicio, datos.Length - inicio); }
        catch (DecoderFallbackException) { return Encoding.Latin1.GetString(datos); }
    }

    /// <summary>Coma o punto y coma, según lo que traiga el encabezado</summary>
    private static char Separador(string texto)
    {
        var fin = texto.IndexOfAny(new[] { '\r', '\n' });
        var encabezado = fin < 0 ? texto : texto[..fin];
        return encabezado.Count(ch => ch == ';') > encabezado.Count(ch => ch == ',') ? ';' : ',';
    }

    /// <summary>Lector de CSV (RFC 4180): comillas, comillas dobles escapadas y saltos de línea dentro de comillas</summary>
    private static IEnumerable<List<string>> Filas(string texto, char sep)
    {
        var fila = new List<string>();
        var campo = new StringBuilder();
        var enComillas = false;
        for (var i = 0; i < texto.Length; i++)
        {
            var ch = texto[i];
            if (enComillas)
            {
                if (ch == '"')
                {
                    if (i + 1 < texto.Length && texto[i + 1] == '"') { campo.Append('"'); i++; }
                    else enComillas = false;
                }
                else campo.Append(ch);
                continue;
            }
            if (ch == '"' && campo.Length == 0) enComillas = true;
            else if (ch == sep) { fila.Add(campo.ToString()); campo.Clear(); }
            else if (ch == '\r' || ch == '\n')
            {
                if (ch == '\r' && i + 1 < texto.Length && texto[i + 1] == '\n') i++;
                fila.Add(campo.ToString()); campo.Clear();
                if (fila.Any(f => f.Length > 0)) yield return fila;
                fila = new List<string>();
            }
            else campo.Append(ch);
        }
        if (campo.Length > 0 || fila.Count > 0)
        {
            fila.Add(campo.ToString());
            if (fila.Any(f => f.Length > 0)) yield return fila;
        }
    }

    /// <summary>Excel limita el nombre de hoja a 31 caracteres y no acepta algunos signos</summary>
    private static string NombreHoja(string nombre, XLWorkbook libro)
    {
        var limpio = new string(nombre.Select(ch => "[]*?/\\:".Contains(ch) ? '_' : ch).ToArray()).Trim();
        if (limpio.Length == 0) limpio = "Hoja";
        if (limpio.Length > 31) limpio = limpio[..31];
        var final = limpio;
        for (var n = 2; libro.Worksheets.Any(w => string.Equals(w.Name, final, StringComparison.OrdinalIgnoreCase)); n++)
            final = $"{limpio[..Math.Min(limpio.Length, 28)]} {n}";
        return final;
    }
}
