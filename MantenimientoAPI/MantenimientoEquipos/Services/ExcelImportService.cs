using System.Globalization;
using System.Text;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.Utils;

namespace MantenimientoEquipos.Services;

/// <summary>
/// Importación masiva desde Excel (requerimiento 12.2): vehículos, inventario (refacciones/consumibles)
/// y los catálogos de áreas, prefijos y usuarios.
/// Flujo: se valida todo el archivo; si no hay errores y se pidió aplicar, se crean los registros
/// nuevos y se actualizan los existentes (por su clave) en una sola transacción. Con un solo error no se aplica nada.
/// Cada importación aplicada queda en la bitácora.
/// </summary>
public class ExcelImportService
{
    public const int MaxFilas = 10000;
    private const int MaxErroresDevueltos = 500;
    public static readonly string[] Entidades = { "vehiculos", "inventario", "areas", "prefijos", "usuarios" };

    /// <summary>Entidad con la que cada importación queda en la bitácora</summary>
    private static readonly Dictionary<string, string> EntidadBitacora = new()
    {
        ["vehiculos"] = "Vehiculo",
        ["inventario"] = "Consumible",
        ["areas"] = "Area",
        ["prefijos"] = "Prefijo",
        ["usuarios"] = "Usuario"
    };

    // Encabezados de la plantilla. Al leer se ignoran mayúsculas, acentos y el "*" de obligatorio,
    // así que también se puede importar un archivo generado con "Exportar".
    private static readonly string[] ColumnasVehiculos = { "Código *", "Tipo", "Área", "Marca", "Modelo", "Notas" };
    private static readonly string[] ColumnasInventario =
        { "Código *", "Nombre *", "Categoría", "Unidad", "Stock actual", "Stock mínimo", "Stock máximo", "Costo unitario" };
    // Sin columna Activa/Activo: "Desactivar" solo existe para usuarios (requerimiento 14.2 y estandarización de
    // eliminación). Un archivo viejo que todavía la traiga se acepta y esa columna se ignora.
    private static readonly string[] ColumnasAreas = { "Nombre *", "Código", "Descripción", "Supervisor" };
    private static readonly string[] ColumnasPrefijos = { "Prefijo *", "Tipo de vehículo *", "Descripción" };
    private static readonly string[] ColumnasUsuarios =
        { "Usuario *", "Nombre *", "Número de empleado", "Correo", "Teléfono", "Rol *", "Área", "Estado", "Contraseña" };

    private static readonly (string Nombre, UserStatusEnum Valor)[] EstadosUsuario =
    {
        ("Activo", UserStatusEnum.Activo),
        ("Desactivado", UserStatusEnum.Desactivado),
        ("Suspendido", UserStatusEnum.Suspendido),
        ("Inactivo", UserStatusEnum.Desactivado)
    };
    private static readonly string[] RolesAdministrador = { "SuperUsuario", "Administrador" };
    private static readonly string[] RolesSupervisor = { "SuperUsuario", "Administrador", "Supervisor" };

    private static readonly string[] ReglasValidacion =
    {
        "Antes de importar, el sistema valida todo el archivo y muestra los errores por fila.",
        "Si hay al menos un error no se guarda nada; corrige y vuelve a intentar.",
        $"Máximo {MaxFilas:N0} filas por archivo.",
        "",
        "También puedes usar un archivo generado con \"Exportar Excel\": se leen las columnas de esta plantilla y se ignoran las demás."
    };

    private readonly MantenimientoDbContext _db;
    private readonly VehiculoPrefijoConfigService _prefijoService;
    private readonly EliminacionService _bitacora;

    public ExcelImportService(MantenimientoDbContext db, VehiculoPrefijoConfigService prefijoService, EliminacionService bitacora)
    {
        _db = db;
        _prefijoService = prefijoService;
        _bitacora = bitacora;
    }

    // ===================== PLANTILLAS =====================

    public async Task<byte[]> GenerarPlantillaAsync(string entidad)
    {
        using var wb = new XLWorkbook();
        if (entidad == "vehiculos")
        {
            var ws = HojaPlantilla(wb, ExcelExportService.Hojas["vehiculos"], ColumnasVehiculos);
            ListaDesplegable(wb, ws, 2, "Tipos", await NombresTiposActivosAsync());
            ListaDesplegable(wb, ws, 3, "Áreas", await NombresAreasActivasAsync());

            Instrucciones(wb, new[]
            {
                "Plantilla de importación de VEHÍCULOS",
                "",
                "• Una fila por vehículo, a partir de la fila 2. No cambies los encabezados.",
                "• Código (obligatorio): identificador del equipo, por ejemplo MTC-045 o 916100000100.",
                "• Tipo (opcional): el nombre del tipo; también se acepta una parte que lo identifique sin duda (p. ej. \"Costado\" = CassetteDeCostado).",
                "  Si lo dejas vacío se detecta con los prefijos configurados. Si ningún prefijo coincide, la fila marcará error.",
                "• Área (opcional): debe ser un área activa del sistema (usa la lista desplegable). No importan mayúsculas, acentos ni espacios.",
                "• Las columnas que no reconozca el sistema (por ejemplo \"Prefijo\") se ignoran.",
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
        else if (entidad == "areas")
        {
            var ws = HojaPlantilla(wb, ExcelExportService.Hojas["areas"], ColumnasAreas, 2);
            var supervisores = await _db.Users.AsNoTracking()
                .Where(u => u.Status == UserStatusEnum.Activo && u.Roles.Any(r => RolesSupervisor.Contains(r.Nombre)))
                .OrderBy(u => u.NombreCompleto)
                .Select(u => u.NombreCompleto)
                .Distinct()
                .ToListAsync();
            // No estricta: también se puede escribir el usuario o a alguien que no sea supervisor
            ListaDesplegable(wb, ws, 4, "Supervisores", supervisores, estricta: false);
            Instrucciones(wb, new[]
            {
                "Plantilla de importación de ÁREAS",
                "",
                "• Una fila por área, a partir de la fila 2. No cambies los encabezados.",
                "• Nombre (obligatorio): identifica el área. No importan mayúsculas, acentos ni espacios (\"Almacén\" = \"almacen\").",
                "• Código (opcional): clave corta del área, máximo 20 caracteres. Dos áreas no pueden tener el mismo código.",
                "• Descripción (opcional): máximo 300 caracteres.",
                "• Supervisor (opcional): nombre completo o usuario de una persona registrada y activa.",
                "  La lista desplegable trae a los supervisores y administradores activos.",
                "",
                "Si el Nombre YA EXISTE, el área se ACTUALIZA con los datos que escribas; las celdas vacías no cambian nada.",
                "Si el Nombre NO existe, se da de alta. Para cambiarle el nombre a un área usa la pantalla Catálogo de áreas.",
                "Si el área existía pero estaba inactiva, al importarla se vuelve a activar. Para quitar un área usa Eliminar en la pantalla.",
                ""
            }.Concat(ReglasValidacion).ToArray());
        }
        else if (entidad == "prefijos")
        {
            var ws = HojaPlantilla(wb, ExcelExportService.Hojas["prefijos"], ColumnasPrefijos);
            ListaDesplegable(wb, ws, 2, "Tipos", await NombresTiposActivosAsync());
            Instrucciones(wb, new[]
            {
                "Plantilla de importación de PREFIJOS de vehículos",
                "",
                "• Una fila por prefijo, a partir de la fila 2. No cambies los encabezados.",
                "• Prefijo (obligatorio): el inicio del código de los vehículos de un tipo, por ejemplo MTC o 9161. Máximo 20 caracteres.",
                "• Tipo de vehículo: obligatorio para prefijos nuevos. Debe ser un tipo activo (usa la lista desplegable).",
                "• Descripción (opcional): máximo 100 caracteres.",
                "",
                "Si el Prefijo YA EXISTE, se ACTUALIZA con los datos que escribas; las celdas vacías no cambian nada.",
                "Si el Prefijo NO existe, se da de alta. Si se había quitado, al importarlo se vuelve a activar.",
                "Para quitar un prefijo usa Eliminar en la pantalla de Prefijos.",
                ""
            }.Concat(ReglasValidacion).ToArray());
        }
        else if (entidad == "usuarios")
        {
            // Usuario, número de empleado, teléfono y contraseña como texto (ceros a la izquierda, números largos)
            var ws = HojaPlantilla(wb, ExcelExportService.Hojas["usuarios"], ColumnasUsuarios, 3, 5, 9);
            var roles = await _db.Roles.AsNoTracking().Where(r => r.Activo).OrderBy(r => r.Id).Select(r => r.Nombre).ToListAsync();
            // Rol no estricta para poder escribir varios separados por coma
            ListaDesplegable(wb, ws, 6, "Roles", roles, estricta: false);
            ListaDesplegable(wb, ws, 7, "Áreas", await NombresAreasActivasAsync());
            ListaDesplegable(wb, ws, 8, "Estado", EstadosUsuario.Take(3).Select(e => e.Nombre).ToList());
            Instrucciones(wb, new[]
            {
                "Plantilla de importación de USUARIOS",
                "",
                "• Una fila por usuario, a partir de la fila 2. No cambies los encabezados.",
                "• Usuario (obligatorio): el nombre con el que inicia sesión, sin espacios. Máximo 50 caracteres.",
                "• Nombre y Rol: obligatorios para usuarios nuevos.",
                $"• Rol: {string.Join(", ", roles)} (usa la lista desplegable). Para dar varios roles sepáralos con coma.",
                "• Área (opcional): debe ser un área activa (usa la lista desplegable).",
                "• Estado (opcional): Activo, Desactivado o Suspendido. Si lo dejas vacío, los usuarios nuevos quedan activos.",
                "• Número de empleado, Correo y Teléfono son opcionales.",
                "• Contraseña (opcional, mínimo 6 caracteres):",
                "  - Usuario nuevo sin contraseña: el sistema genera una temporal y la muestra al terminar la importación. Solo se muestra esa vez.",
                "  - Usuario existente: si escribes una contraseña, reemplaza la actual; si la dejas vacía, no cambia.",
                "  Por seguridad, borra las contraseñas de este archivo cuando termines de importarlo.",
                "",
                "Si el Usuario YA EXISTE, se ACTUALIZA con los datos que escribas; las celdas vacías no cambian nada.",
                "Si escribes un Rol para un usuario existente, sus roles se reemplazan por los que indiques.",
                "Si el Usuario NO existe, se da de alta.",
                "Desde la importación no puedes desactivar tu propio usuario ni quitarte el rol de administrador.",
                ""
            }.Concat(ReglasValidacion).ToArray());
        }
        else
        {
            throw new ArgumentException($"No existe plantilla para '{entidad}'");
        }

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    private static IXLWorksheet HojaPlantilla(XLWorkbook wb, string nombre, string[] columnas, params int[] otrasColumnasTexto)
    {
        var ws = wb.Worksheets.Add(nombre);
        for (var c = 0; c < columnas.Length; c++)
        {
            ws.Cell(1, c + 1).Value = columnas[c];
            ws.Column(c + 1).Width = 22;
        }
        // La clave (primera columna) como texto para conservar ceros a la izquierda y números largos
        foreach (var columna in otrasColumnasTexto.Prepend(1))
            ws.Range(2, columna, MaxFilas + 1, columna).Style.NumberFormat.Format = "@";
        ExcelExportService.EstiloEncabezado(ws.Range(1, 1, 1, columnas.Length));
        ws.SheetView.FreezeRows(1);
        return ws;
    }

    /// <summary>
    /// Lista desplegable en una columna de la plantilla; los valores van en la hoja oculta "Listas".
    /// Si no es estricta, Excel permite escribir otro valor (el sistema lo valida al importar).
    /// </summary>
    private static void ListaDesplegable(XLWorkbook wb, IXLWorksheet ws, int columna, string titulo, IReadOnlyList<string> valores, bool estricta = true)
    {
        if (valores.Count == 0) return;
        if (!wb.Worksheets.TryGetWorksheet("Listas", out var listas)) listas = wb.Worksheets.Add("Listas");
        var col = (listas.LastColumnUsed()?.ColumnNumber() ?? 0) + 1;
        listas.Cell(1, col).Value = titulo;
        for (var i = 0; i < valores.Count; i++) listas.Cell(i + 2, col).Value = valores[i];
        var validacion = ws.Range(2, columna, MaxFilas + 1, columna).CreateDataValidation();
        validacion.List(listas.Range(2, col, valores.Count + 1, col), true);
        validacion.ShowErrorMessage = estricta;
        listas.Hide();
    }

    private Task<List<string>> NombresTiposActivosAsync() =>
        _db.TiposVehiculo.AsNoTracking().Where(t => t.Activo).OrderBy(t => t.Nombre).Select(t => t.Nombre).ToListAsync();

    private Task<List<string>> NombresAreasActivasAsync() =>
        _db.Areas.AsNoTracking().Where(a => a.Activa).OrderBy(a => a.Nombre).Select(a => a.Nombre).ToListAsync();

    private static void Instrucciones(XLWorkbook wb, string[] lineas)
    {
        var ws = wb.Worksheets.Add("Instrucciones");
        for (var i = 0; i < lineas.Length; i++) ws.Cell(i + 1, 1).Value = lineas[i];
        ws.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(13);
        ws.Column(1).Width = 120;
    }

    // ===================== IMPORTACIÓN =====================

    /// <summary>Datos de la importación en curso: quién, con qué archivo y si se aplica o solo se valida</summary>
    private sealed record Importacion(string Entidad, bool Aplicar, int UsuarioId, string? NombreUsuario, string? Archivo);

    public async Task<ExcelImportResultDto> ImportarAsync(
        string entidad, Stream archivo, bool aplicar, int userId, string? nombreUsuario = null, string? nombreArchivo = null)
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
            var imp = new Importacion(entidad, aplicar, userId, nombreUsuario, nombreArchivo);

            return entidad switch
            {
                "vehiculos" => await ImportarVehiculosAsync(tabla, resultado, imp),
                "inventario" => await ImportarInventarioAsync(tabla, resultado, imp),
                "areas" => await ImportarAreasAsync(tabla, resultado, imp),
                "prefijos" => await ImportarPrefijosAsync(tabla, resultado, imp),
                "usuarios" => await ImportarUsuariosAsync(tabla, resultado, imp),
                _ => throw new ArgumentException($"No se puede importar '{entidad}'")
            };
        }
    }

    private async Task<ExcelImportResultDto> ImportarVehiculosAsync(TablaExcel tabla, ExcelImportResultDto resultado, Importacion imp)
    {
        var userId = imp.UsuarioId;
        tabla.Requerir("Código");
        var errores = new Errores(resultado);

        var tipos = (await _db.TiposVehiculo.AsNoTracking().Select(t => new { t.Id, t.Nombre }).ToListAsync())
            .Where(t => Enum.IsDefined(typeof(TipoVehiculoEnum), t.Id))
            .Select(t => (t.Nombre, (TipoVehiculoEnum)t.Id))
            .ToList();
        var areas = (await _db.Areas.AsNoTracking().Where(a => a.Activa).Select(a => new { a.Id, a.Nombre }).ToListAsync())
            .Select(a => (a.Nombre, a.Id))
            .ToList();
        var prefijos = await _prefijoService.GetPrefijosActivosAsync();
        var existentes = (await _db.Vehiculos.ToListAsync())
            .GroupBy(v => v.Codigo.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var vistos = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var cambios = new Cambios();

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
                var (t, error) = BuscarPorNombre(tipoTexto, tipos, "tipos", $"El tipo '{tipoTexto}' no existe en el sistema");
                if (error != null) errores.Add(fila.Numero, "Tipo", error);
                else tipo = t;
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
                var (a, error) = BuscarPorNombre(areaTexto, areas, "áreas", $"El área '{areaTexto}' no existe o está inactiva");
                if (error != null) errores.Add(fila.Numero, "Área", error);
                else areaId = a;
            }

            if (marca?.Length > 100) errores.Add(fila.Numero, "Marca", "Máximo 100 caracteres");
            if (modelo?.Length > 100) errores.Add(fila.Numero, "Modelo", "Máximo 100 caracteres");
            if (notas?.Length > 1000) errores.Add(fila.Numero, "Notas", "Máximo 1000 caracteres");

            if (resultado.TotalErrores > erroresAntes) continue;

            if (existente == null)
            {
                cambios.Alta(codigo, () => _db.Vehiculos.Add(new Vehiculo
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
                cambios.Cambio(existente.Codigo, () =>
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

        return await AplicarAsync(resultado, cambios, imp);
    }

    private async Task<ExcelImportResultDto> ImportarInventarioAsync(TablaExcel tabla, ExcelImportResultDto resultado, Importacion imp)
    {
        var userId = imp.UsuarioId;
        tabla.Requerir("Código");
        var errores = new Errores(resultado);

        var existentes = (await _db.Consumibles.ToListAsync())
            .GroupBy(c => c.Codigo.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var vistos = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var cambios = new Cambios();

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
                cambios.Alta(codigo, () => _db.Consumibles.Add(new Consumible
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
                cambios.Cambio(existente.Codigo, () =>
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

        return await AplicarAsync(resultado, cambios, imp);
    }

    private async Task<ExcelImportResultDto> ImportarAreasAsync(TablaExcel tabla, ExcelImportResultDto resultado, Importacion imp)
    {
        tabla.Requerir("Nombre");
        var errores = new Errores(resultado);

        var existentes = await _db.Areas.OrderBy(a => a.Id).ToListAsync();
        // Mismo criterio que al buscar un área por nombre: sin mayúsculas, acentos ni espacios
        var porNombre = existentes
            .GroupBy(a => Compacto(a.Nombre))
            .ToDictionary(g => g.Key, g => g.First());
        var porCodigo = existentes
            .Where(a => !string.IsNullOrWhiteSpace(a.Codigo))
            .GroupBy(a => a.Codigo!.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        var usuarios = await UsuariosParaBuscarAsync();

        var vistos = new Dictionary<string, int>();
        var codigosVistos = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var cambios = new Cambios();

        foreach (var fila in tabla.Filas)
        {
            var nombre = fila.Texto("Nombre");
            var codigo = fila.Texto("Código");
            var descripcion = fila.Texto("Descripción");
            var supervisorTexto = fila.Texto("Supervisor");
            var erroresAntes = resultado.TotalErrores;

            if (string.IsNullOrEmpty(nombre)) { errores.Add(fila.Numero, "Nombre", "El nombre es obligatorio"); continue; }
            var clave = Compacto(nombre);
            if (clave.Length == 0) { errores.Add(fila.Numero, "Nombre", "El nombre debe tener letras o números"); continue; }
            if (nombre.Length > 100) errores.Add(fila.Numero, "Nombre", "Máximo 100 caracteres");
            if (vistos.TryGetValue(clave, out var filaPrevia))
                errores.Add(fila.Numero, "Nombre", $"Área repetida en el archivo (también en la fila {filaPrevia})");
            else
                vistos[clave] = fila.Numero;

            porNombre.TryGetValue(clave, out var existente);

            if (codigo != null)
            {
                if (codigo.Length > 20) errores.Add(fila.Numero, "Código", "Máximo 20 caracteres");
                if (porCodigo.TryGetValue(codigo, out var conCodigo) && conCodigo.Id != existente?.Id)
                    errores.Add(fila.Numero, "Código", $"El código '{codigo}' ya lo tiene el área {conCodigo.Nombre}");
                else if (codigosVistos.TryGetValue(codigo, out var filaCodigo))
                    errores.Add(fila.Numero, "Código", $"Código repetido en el archivo (también en la fila {filaCodigo})");
                codigosVistos.TryAdd(codigo, fila.Numero);
            }
            if (descripcion?.Length > 300) errores.Add(fila.Numero, "Descripción", "Máximo 300 caracteres");

            int? supervisorId = null;
            if (supervisorTexto != null)
            {
                var (id, error) = BuscarUsuario(supervisorTexto, usuarios, existente?.SupervisorId);
                if (error != null) errores.Add(fila.Numero, "Supervisor", error);
                else supervisorId = id;
            }

            if (resultado.TotalErrores > erroresAntes) continue;

            if (existente == null)
            {
                cambios.Alta(nombre, () => _db.Areas.Add(new Area
                {
                    Nombre = nombre,
                    Codigo = codigo,
                    Descripcion = descripcion,
                    SupervisorId = supervisorId,
                    Activa = true,
                    CreatedAt = DateTime.UtcNow
                }));
            }
            else
            {
                cambios.Cambio(existente.Nombre, () =>
                {
                    if (codigo != null) existente.Codigo = codigo;
                    if (descripcion != null) existente.Descripcion = descripcion;
                    if (supervisorId.HasValue) existente.SupervisorId = supervisorId;
                    existente.Activa = true; // está en el archivo: si estaba inactiva, vuelve a usarse
                    existente.UpdatedAt = DateTime.UtcNow;
                });
            }
        }

        return await AplicarAsync(resultado, cambios, imp);
    }

    private async Task<ExcelImportResultDto> ImportarPrefijosAsync(TablaExcel tabla, ExcelImportResultDto resultado, Importacion imp)
    {
        tabla.Requerir("Prefijo");
        var errores = new Errores(resultado);

        var tipos = await _db.TiposVehiculo.AsNoTracking().Select(t => new { t.Id, t.Nombre, t.Activo }).ToListAsync();
        var tiposActivos = tipos.Where(t => t.Activo).Select(t => (t.Nombre, t.Id)).ToList();
        // Si hubiera el mismo prefijo activo e inactivo, se actualiza el activo (el que se usa para detectar)
        var existentes = (await _db.VehiculoPrefijoConfigs.ToListAsync())
            .GroupBy(p => p.PrefijoCodigo.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(p => p.Activo).ThenBy(p => p.Id).First(), StringComparer.OrdinalIgnoreCase);

        var vistos = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var cambios = new Cambios();

        foreach (var fila in tabla.Filas)
        {
            var prefijo = fila.Texto("Prefijo");
            var tipoTexto = fila.Texto("Tipo de vehículo");
            var descripcion = fila.Texto("Descripción");
            var erroresAntes = resultado.TotalErrores;

            if (string.IsNullOrEmpty(prefijo)) { errores.Add(fila.Numero, "Prefijo", "El prefijo es obligatorio"); continue; }
            if (prefijo.Length > 20) errores.Add(fila.Numero, "Prefijo", "Máximo 20 caracteres");
            if (vistos.TryGetValue(prefijo, out var filaPrevia))
                errores.Add(fila.Numero, "Prefijo", $"Prefijo repetido en el archivo (también en la fila {filaPrevia})");
            else
                vistos[prefijo] = fila.Numero;

            existentes.TryGetValue(prefijo, out var existente);

            int? tipoId = null;
            if (tipoTexto != null)
            {
                var (t, error) = BuscarPorNombre(tipoTexto, tiposActivos, "tipos", $"El tipo '{tipoTexto}' no existe o está inactivo");
                // Un archivo exportado trae el tipo actual del prefijo aunque ese tipo esté inactivo: no es un cambio
                var esElActual = existente != null
                    && Compacto(tipos.FirstOrDefault(x => x.Id == existente.TipoVehiculoId)?.Nombre ?? "") == Compacto(tipoTexto);
                if (error == null) tipoId = t;
                else if (!esElActual) errores.Add(fila.Numero, "Tipo de vehículo", error);
            }
            else if (existente == null)
            {
                errores.Add(fila.Numero, "Tipo de vehículo", "El tipo de vehículo es obligatorio para prefijos nuevos");
            }

            if (descripcion?.Length > 100) errores.Add(fila.Numero, "Descripción", "Máximo 100 caracteres");

            if (resultado.TotalErrores > erroresAntes) continue;

            if (existente == null)
            {
                cambios.Alta(prefijo, () => _db.VehiculoPrefijoConfigs.Add(new VehiculoPrefijoConfig
                {
                    PrefijoCodigo = prefijo,
                    TipoVehiculoId = tipoId!.Value,
                    Descripcion = descripcion,
                    Activo = true,
                    CreatedAt = DateTime.UtcNow,
                    CreatedBy = imp.UsuarioId
                }));
            }
            else
            {
                cambios.Cambio(existente.PrefijoCodigo, () =>
                {
                    if (tipoId.HasValue) existente.TipoVehiculoId = tipoId.Value;
                    if (descripcion != null) existente.Descripcion = descripcion;
                    existente.Activo = true; // está en el archivo: si se había quitado, vuelve a usarse
                    existente.UpdatedAt = DateTime.UtcNow;
                    existente.UpdatedBy = imp.UsuarioId;
                });
            }
        }

        return await AplicarAsync(resultado, cambios, imp);
    }

    private async Task<ExcelImportResultDto> ImportarUsuariosAsync(TablaExcel tabla, ExcelImportResultDto resultado, Importacion imp)
    {
        tabla.Requerir("Usuario");
        var errores = new Errores(resultado);

        var roles = await _db.Roles.Where(r => r.Activo).OrderBy(r => r.Id).ToListAsync();
        var opcionesRol = roles.Select(r => (r.Nombre, r.Id)).ToList();
        var areas = await _db.Areas.AsNoTracking().Select(a => new { a.Id, a.Nombre, a.Activa }).ToListAsync();
        var areasActivas = areas.Where(a => a.Activa).Select(a => (a.Nombre, a.Id)).ToList();
        var existentes = (await _db.Users.Include(u => u.Roles).ToListAsync())
            .GroupBy(u => u.Username.Trim(), StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

        var vistos = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        var cambios = new Cambios();

        foreach (var fila in tabla.Filas)
        {
            var username = fila.Texto("Usuario");
            var nombre = fila.Texto("Nombre");
            var numeroEmpleado = fila.Texto("Número de empleado");
            var correo = fila.Texto("Correo");
            var telefono = fila.Texto("Teléfono");
            // La exportación de usuarios llama "Roles" a la columna
            var rolTexto = fila.Texto("Rol") ?? fila.Texto("Roles");
            var areaTexto = fila.Texto("Área");
            var estadoTexto = fila.Texto("Estado");
            var contrasena = fila.Texto("Contraseña");
            var erroresAntes = resultado.TotalErrores;

            if (string.IsNullOrEmpty(username)) { errores.Add(fila.Numero, "Usuario", "El usuario es obligatorio"); continue; }
            if (username.Length > 50) errores.Add(fila.Numero, "Usuario", "Máximo 50 caracteres");
            if (username.Any(char.IsWhiteSpace)) errores.Add(fila.Numero, "Usuario", "El usuario no debe llevar espacios");
            if (vistos.TryGetValue(username, out var filaPrevia))
                errores.Add(fila.Numero, "Usuario", $"Usuario repetido en el archivo (también en la fila {filaPrevia})");
            else
                vistos[username] = fila.Numero;

            existentes.TryGetValue(username, out var existente);
            var esUsuarioActual = existente != null && existente.Id == imp.UsuarioId;

            if (existente == null && string.IsNullOrEmpty(nombre))
                errores.Add(fila.Numero, "Nombre", "El nombre es obligatorio para usuarios nuevos");
            if (nombre?.Length > 100) errores.Add(fila.Numero, "Nombre", "Máximo 100 caracteres");
            if (numeroEmpleado?.Length > 20) errores.Add(fila.Numero, "Número de empleado", "Máximo 20 caracteres");
            if (telefono?.Length > 20) errores.Add(fila.Numero, "Teléfono", "Máximo 20 caracteres");
            if (correo != null)
            {
                if (correo.Length > 100) errores.Add(fila.Numero, "Correo", "Máximo 100 caracteres");
                else if (!CorreoValido(correo)) errores.Add(fila.Numero, "Correo", $"'{correo}' no es un correo válido");
            }

            List<Rol>? rolesFila = null;
            if (rolTexto != null)
            {
                rolesFila = new List<Rol>();
                foreach (var parte in rolTexto.Split(new[] { ',', ';', '/' }, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
                {
                    var (id, error) = BuscarPorNombre(parte, opcionesRol, "roles", $"El rol '{parte}' no existe");
                    if (error != null) errores.Add(fila.Numero, "Rol", error);
                    else if (rolesFila.All(r => r.Id != id)) rolesFila.Add(roles.First(r => r.Id == id));
                }
                if (esUsuarioActual && rolesFila.Count > 0
                    && !rolesFila.Any(r => RolesAdministrador.Contains(r.Nombre, StringComparer.OrdinalIgnoreCase)))
                    errores.Add(fila.Numero, "Rol", "No puedes quitarte a ti mismo el rol de administrador");
            }
            else if (existente == null)
            {
                errores.Add(fila.Numero, "Rol", "El rol es obligatorio para usuarios nuevos");
            }

            int? areaId = null;
            if (areaTexto != null)
            {
                var (id, error) = BuscarPorNombre(areaTexto, areasActivas, "áreas", $"El área '{areaTexto}' no existe o está inactiva");
                // Un archivo exportado trae el área actual aunque esté inactiva: no es un cambio
                var esLaActual = existente?.AreaId != null
                    && Compacto(areas.FirstOrDefault(x => x.Id == existente.AreaId)?.Nombre ?? "") == Compacto(areaTexto);
                if (error == null) areaId = id;
                else if (!esLaActual) errores.Add(fila.Numero, "Área", error);
            }

            UserStatusEnum? estado = null;
            if (estadoTexto != null)
            {
                var (e, error) = BuscarPorNombre(estadoTexto, EstadosUsuario, "estados", $"'{estadoTexto}' no es válido; usa Activo, Desactivado o Suspendido");
                if (error != null) errores.Add(fila.Numero, "Estado", error);
                else if (esUsuarioActual && e != UserStatusEnum.Activo)
                    errores.Add(fila.Numero, "Estado", "No puedes desactivar tu propio usuario");
                else estado = e;
            }

            if (contrasena != null && contrasena.Length < 6)
                errores.Add(fila.Numero, "Contraseña", "La contraseña debe tener al menos 6 caracteres");
            if (contrasena?.Length > 100) errores.Add(fila.Numero, "Contraseña", "Máximo 100 caracteres");

            if (resultado.TotalErrores > erroresAntes) continue;

            if (existente == null)
            {
                cambios.Alta(username, () =>
                {
                    // La contraseña se genera solo al aplicar, para no mostrar una que nunca se guardó
                    var clave = contrasena ?? PasswordHasher.GenerarTemporal();
                    var salt = PasswordHasher.GenerateSalt();
                    _db.Users.Add(new User
                    {
                        Username = username,
                        NombreCompleto = nombre!,
                        NumeroEmpleado = numeroEmpleado,
                        Email = correo,
                        Telefono = telefono,
                        AreaId = areaId,
                        Roles = rolesFila!,
                        Status = estado ?? UserStatusEnum.Activo,
                        PasswordSalt = salt,
                        PasswordHash = PasswordHasher.HashPassword(clave, salt),
                        CreatedAt = DateTime.UtcNow,
                        CreatedBy = imp.UsuarioId
                    });
                    if (contrasena == null)
                        resultado.Credenciales.Add(new ExcelCredencialDto { Usuario = username, Nombre = nombre!, Contrasena = clave });
                });
            }
            else
            {
                cambios.Cambio(existente.Username, () =>
                {
                    if (nombre != null) existente.NombreCompleto = nombre;
                    if (numeroEmpleado != null) existente.NumeroEmpleado = numeroEmpleado;
                    if (correo != null) existente.Email = correo;
                    if (telefono != null) existente.Telefono = telefono;
                    if (areaId.HasValue) existente.AreaId = areaId;
                    if (estado.HasValue) existente.Status = estado.Value;
                    if (rolesFila is { Count: > 0 })
                    {
                        existente.Roles.Clear();
                        foreach (var rol in rolesFila) existente.Roles.Add(rol);
                    }
                    if (contrasena != null)
                    {
                        existente.PasswordSalt = PasswordHasher.GenerateSalt();
                        existente.PasswordHash = PasswordHasher.HashPassword(contrasena, existente.PasswordSalt);
                    }
                    existente.UpdatedAt = DateTime.UtcNow;
                    existente.UpdatedBy = imp.UsuarioId;
                });
            }
        }

        return await AplicarAsync(resultado, cambios, imp);
    }

    private static bool CorreoValido(string correo) =>
        System.Text.RegularExpressions.Regex.IsMatch(correo, @"^[^\s@]+@[^\s@]+\.[^\s@]+$");

    private sealed record UsuarioBusqueda(int Id, string Username, string Nombre, bool Activo);

    private async Task<List<UsuarioBusqueda>> UsuariosParaBuscarAsync() =>
        (await _db.Users.AsNoTracking().Select(u => new { u.Id, u.Username, u.NombreCompleto, u.Status }).ToListAsync())
            .Select(u => new UsuarioBusqueda(u.Id, u.Username.Trim(), u.NombreCompleto, u.Status == UserStatusEnum.Activo))
            .ToList();

    /// <summary>
    /// Una persona por su usuario o por su nombre completo. Sin coincidencias parciales, para no asignar
    /// a otra persona por error. El usuario actualmente asignado se acepta aunque esté desactivado.
    /// </summary>
    private static (int? Id, string? Error) BuscarUsuario(string texto, List<UsuarioBusqueda> usuarios, int? actualId)
    {
        var encontrados = usuarios.Where(u => string.Equals(u.Username, texto, StringComparison.OrdinalIgnoreCase)).ToList();
        if (encontrados.Count == 0)
        {
            var buscado = Compacto(texto);
            encontrados = usuarios.Where(u => Compacto(u.Nombre) == buscado).ToList();
        }
        if (encontrados.Count == 0)
            return (null, $"No existe el usuario '{texto}'; escribe su nombre completo o su usuario");
        if (encontrados.Count > 1)
            return (null, $"Hay {encontrados.Count} personas llamadas '{texto}'; escribe su usuario ({string.Join(", ", encontrados.Select(u => u.Username))})");
        var usuario = encontrados[0];
        if (!usuario.Activo && usuario.Id != actualId)
            return (null, $"El usuario {usuario.Nombre} está desactivado");
        return (usuario.Id, null);
    }

    /// <summary>Altas y cambios válidos; se ejecutan solo al aplicar y sin errores</summary>
    private sealed class Cambios
    {
        public List<Action> Acciones { get; } = new();
        public List<string> Nuevos { get; } = new();
        public List<string> Actualizados { get; } = new();

        public void Alta(string clave, Action accion)
        {
            Nuevos.Add(clave);
            Acciones.Add(accion);
        }

        public void Cambio(string clave, Action accion)
        {
            Actualizados.Add(clave);
            Acciones.Add(accion);
        }
    }

    private async Task<ExcelImportResultDto> AplicarAsync(ExcelImportResultDto resultado, Cambios cambios, Importacion imp)
    {
        resultado.Nuevos = cambios.Nuevos.Count;
        resultado.Actualizados = cambios.Actualizados.Count;
        if (!imp.Aplicar || resultado.TotalErrores > 0 || cambios.Acciones.Count == 0) return resultado;

        using var tx = await _db.Database.BeginTransactionAsync();
        foreach (var cambio in cambios.Acciones) cambio();
        _bitacora.Registrar(imp.UsuarioId, imp.NombreUsuario, EntidadBitacora[imp.Entidad], null, DescripcionBitacora(imp, cambios), "Importar");
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        resultado.Aplicado = true;
        return resultado;
    }

    /// <summary>"Importación desde Excel (archivo.xlsx): 2 nuevo(s) y 1 actualizado(s). Nuevos: A, B. Actualizados: C"</summary>
    private static string DescripcionBitacora(Importacion imp, Cambios cambios)
    {
        const int maxClaves = 15;
        static string Lista(List<string> claves) => claves.Count <= maxClaves
            ? string.Join(", ", claves)
            : $"{string.Join(", ", claves.Take(maxClaves))} y {claves.Count - maxClaves} más";

        var archivo = string.IsNullOrWhiteSpace(imp.Archivo) ? "" : $" ({Path.GetFileName(imp.Archivo)})";
        var partes = new List<string>
        {
            $"Importación desde Excel{archivo}: {cambios.Nuevos.Count} nuevo(s) y {cambios.Actualizados.Count} actualizado(s)"
        };
        if (cambios.Nuevos.Count > 0) partes.Add($"Nuevos: {Lista(cambios.Nuevos)}");
        if (cambios.Actualizados.Count > 0) partes.Add($"Actualizados: {Lista(cambios.Actualizados)}");
        return string.Join(". ", partes);
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

    /// <summary>
    /// Busca un catálogo por nombre como lo escribe la gente: sin importar mayúsculas, acentos, espacios
    /// ni signos ("cassette de costado" = "CassetteDeCostado"). Si no hay coincidencia exacta acepta una
    /// parcial siempre que sea única ("Costado" → "CassetteDeCostado"); si hay varias, es error.
    /// </summary>
    private static (T? Valor, string? Error) BuscarPorNombre<T>(
        string texto, IReadOnlyList<(string Nombre, T Valor)> opciones, string plural, string mensajeNoExiste) where T : struct
    {
        var buscado = Compacto(texto);
        var exacta = opciones.Where(o => Compacto(o.Nombre) == buscado).ToList();
        if (exacta.Count > 0) return (exacta[0].Valor, null);

        var parciales = buscado.Length < 3
            ? new List<(string Nombre, T Valor)>()
            : opciones.Where(o => Compacto(o.Nombre).Contains(buscado)).ToList();
        if (parciales.Count == 1) return (parciales[0].Valor, null);
        if (parciales.Count > 1)
            return (null, $"'{texto}' coincide con varios {plural} ({string.Join(", ", parciales.Select(p => p.Nombre))}); escribe el nombre completo");
        return (null, mensajeNoExiste);
    }

    /// <summary>Solo letras y números, sin acentos y en minúsculas: "Cassette de Costado" → "cassettedecostado"</summary>
    private static string Compacto(string texto) => new(Normalizar(texto).Where(char.IsLetterOrDigit).ToArray());

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
