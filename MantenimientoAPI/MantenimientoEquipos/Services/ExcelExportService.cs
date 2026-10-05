using System.Text.RegularExpressions;
using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Services;

/// <summary>
/// Exportación a Excel (requerimiento 12.2): una hoja por módulo, o todas juntas en un solo libro.
/// Las fechas se exportan tal como están guardadas, igual que las muestra la aplicación.
/// </summary>
public class ExcelExportService
{
    public const string ContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    /// <summary>Clave de URL → nombre de la hoja, en el orden del libro "exportar todo"</summary>
    public static readonly IReadOnlyDictionary<string, string> Hojas = new Dictionary<string, string>
    {
        ["vehiculos"] = "Vehículos",
        ["inventario"] = "Inventario",
        ["movimientos-inventario"] = "Movimientos inventario",
        ["reportes"] = "Reportes de falla",
        ["ordenes"] = "Órdenes de trabajo",
        ["pagos"] = "Pagos",
        ["ordenes-compra"] = "Órdenes de compra",
        ["areas"] = "Áreas",
        ["tipos-vehiculo"] = "Tipos de vehículo",
        ["prefijos"] = "Prefijos",
        ["usuarios"] = "Usuarios"
    };

    private readonly MantenimientoDbContext _db;
    private readonly ILogger<ExcelExportService> _logger;

    public ExcelExportService(MantenimientoDbContext db, ILogger<ExcelExportService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<byte[]> ExportarAsync(string entidad, List<TipoVehiculoEnum>? tiposPermitidos = null)
    {
        using var wb = new XLWorkbook();
        await AgregarHojaAsync(wb, entidad, tiposPermitidos);
        return Guardar(wb);
    }

    /// <summary>
    /// Libro con todas las hojas y un resumen al inicio. Si una hoja falla (p. ej. una tabla
    /// que no existe en esa base) se anota en el resumen y se siguen exportando las demás.
    /// </summary>
    public async Task<byte[]> ExportarTodoAsync(string? generadoPor)
    {
        using var wb = new XLWorkbook();
        var resumen = wb.Worksheets.Add("Resumen");
        var estado = new List<(string Hoja, string Resultado)>();

        foreach (var (clave, hoja) in Hojas)
        {
            try
            {
                var filas = await AgregarHojaAsync(wb, clave, null);
                estado.Add((hoja, $"{filas} registro(s)"));
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "No se pudo exportar la hoja {Hoja}", hoja);
                estado.Add((hoja, $"No se pudo exportar: {ex.Message}"));
            }
        }

        resumen.Cell(1, 1).Value = "Exportación completa - Sistema de Mantenimiento Continental";
        resumen.Cell(1, 1).Style.Font.SetBold().Font.SetFontSize(14);
        resumen.Cell(2, 1).Value = $"Generado: {DateTime.Now:dd/MM/yyyy HH:mm}" + (generadoPor != null ? $" por {generadoPor}" : "");
        resumen.Cell(4, 1).Value = "Hoja";
        resumen.Cell(4, 2).Value = "Contenido";
        EstiloEncabezado(resumen.Range(4, 1, 4, 2));
        for (var i = 0; i < estado.Count; i++)
        {
            resumen.Cell(5 + i, 1).Value = estado[i].Hoja;
            resumen.Cell(5 + i, 2).Value = estado[i].Resultado;
        }
        resumen.Columns().AdjustToContents();
        return Guardar(wb);
    }

    private async Task<int> AgregarHojaAsync(XLWorkbook wb, string entidad, List<TipoVehiculoEnum>? tiposPermitidos)
    {
        if (!Hojas.TryGetValue(entidad, out var hoja))
            throw new ArgumentException($"No existe la exportación '{entidad}'");

        switch (entidad)
        {
            case "vehiculos":
            {
                var tipos = await NombresTiposAsync();
                var query = _db.Vehiculos.AsNoTracking();
                if (tiposPermitidos != null && tiposPermitidos.Count > 0)
                    query = query.Where(v => tiposPermitidos.Contains(v.Tipo));
                var filas = await query
                    .OrderBy(v => v.Codigo)
                    .Select(v => new
                    {
                        v.Codigo, v.Tipo, Area = v.Area != null ? v.Area.Nombre : null, v.Estado, v.Ubicacion,
                        v.Marca, v.Modelo, v.NumeroSerie, v.Anio, v.UltimoMantenimiento, v.ProximoMantenimiento,
                        Reportes = v.Reportes.Count,
                        Fotos = _db.VehiculoDocumentos.Count(d => d.VehiculoId == v.Id && d.Tipo == VehiculoDocumentoService.TipoFoto),
                        v.Notas, v.CreatedAt, v.Activo
                    })
                    .ToListAsync();
                // Los encabezados Código/Tipo/Área/Marca/Modelo/Notas coinciden con la plantilla de importación
                return EscribirHoja(wb, hoja, filas,
                    new[] { "Código", "Tipo", "Área", "Estado", "Ubicación", "Marca", "Modelo", "Número de serie", "Año",
                            "Último mantenimiento", "Próximo mantenimiento", "Reportes", "Fotos", "Notas", "Fecha de registro", "Activo" },
                    v => new object?[] { v.Codigo, tipos.GetValueOrDefault((int)v.Tipo, v.Tipo.ToString()), v.Area, Humanizar(v.Estado),
                            Humanizar(v.Ubicacion), v.Marca, v.Modelo, v.NumeroSerie, v.Anio, v.UltimoMantenimiento,
                            v.ProximoMantenimiento, v.Reportes, v.Fotos, v.Notas, v.CreatedAt, v.Activo });
            }
            case "inventario":
            {
                var filas = await _db.Consumibles.AsNoTracking()
                    .OrderBy(c => c.Codigo)
                    .Select(c => new
                    {
                        c.Codigo, c.Nombre, c.Categoria, c.Unidad, c.StockActual, c.StockMinimo, c.StockMaximo,
                        c.CostoUnitario, c.Activo, c.CreatedAt, c.UpdatedAt
                    })
                    .ToListAsync();
                // Los primeros 8 encabezados coinciden con la plantilla de importación
                return EscribirHoja(wb, hoja, filas,
                    new[] { "Código", "Nombre", "Categoría", "Unidad", "Stock actual", "Stock mínimo", "Stock máximo", "Costo unitario",
                            "Valor en inventario", "Bajo mínimo", "Activo", "Fecha de registro", "Última actualización" },
                    c => new object?[] { c.Codigo, c.Nombre, c.Categoria, c.Unidad, c.StockActual, c.StockMinimo, c.StockMaximo,
                            c.CostoUnitario, c.StockActual * c.CostoUnitario, c.StockActual <= c.StockMinimo, c.Activo,
                            c.CreatedAt, c.UpdatedAt });
            }
            case "movimientos-inventario":
            {
                var filas = await _db.ConsumosConsumibles.AsNoTracking()
                    .OrderByDescending(m => m.Fecha)
                    .Select(m => new
                    {
                        m.Fecha, m.Consumible.Codigo, m.Consumible.Nombre, m.TipoMovimiento, m.Cantidad,
                        Orden = m.OrdenTrabajo != null ? m.OrdenTrabajo.Folio : null,
                        Reporte = m.Reporte != null ? m.Reporte.Folio : null,
                        Usuario = m.Usuario != null ? m.Usuario.NombreCompleto : null,
                        m.Comentario
                    })
                    .ToListAsync();
                return EscribirHoja(wb, hoja, filas,
                    new[] { "Fecha", "Código", "Consumible", "Movimiento", "Cantidad", "Orden de trabajo", "Reporte", "Usuario", "Comentario" },
                    m => new object?[] { m.Fecha, m.Codigo, m.Nombre, m.TipoMovimiento, m.Cantidad, m.Orden, m.Reporte, m.Usuario, m.Comentario });
            }
            case "reportes":
            {
                var filas = await _db.ReportesFalla.AsNoTracking()
                    .OrderByDescending(r => r.FechaReporte)
                    .Select(r => new
                    {
                        r.Folio, r.FechaReporte, Vehiculo = r.Vehiculo.Codigo,
                        Categoria = r.CategoriaFalla != null ? r.CategoriaFalla.Nombre : null,
                        r.Prioridad, r.TipoMantenimiento, r.Descripcion, r.Ubicacion, r.PuedeOperar, r.TieneOrdenTrabajo,
                        ReportadoPor = r.ReportadoPor.NombreCompleto
                    })
                    .ToListAsync();
                return EscribirHoja(wb, hoja, filas,
                    new[] { "Folio", "Fecha", "Vehículo", "Categoría", "Prioridad", "Tipo de mantenimiento", "Descripción",
                            "Ubicación", "Puede operar", "Tiene orden de trabajo", "Reportado por" },
                    r => new object?[] { r.Folio, r.FechaReporte, r.Vehiculo, r.Categoria, Humanizar(r.Prioridad), r.TipoMantenimiento,
                            r.Descripcion, r.Ubicacion, r.PuedeOperar, r.TieneOrdenTrabajo, r.ReportadoPor });
            }
            case "ordenes":
            {
                var filas = await _db.OrdenesTrabajo.AsNoTracking()
                    .OrderByDescending(o => o.FechaCreacion)
                    .Select(o => new
                    {
                        o.Folio, Vehiculo = o.Vehiculo.Codigo, Reporte = o.ReporteFalla != null ? o.ReporteFalla.Folio : null,
                        o.TipoMantenimiento, o.Estado, o.Prioridad,
                        Tecnico = o.TecnicoAsignado != null ? o.TecnicoAsignado.NombreCompleto : null,
                        CreadoPor = o.CreadoPor.NombreCompleto,
                        o.FechaCreacion, o.FechaInicio, o.FechaFinalizacion, o.FechaValidacion,
                        o.HorasTrabajadas, o.CostoTotal, o.Descripcion, o.Diagnostico, o.TrabajoRealizado
                    })
                    .ToListAsync();
                return EscribirHoja(wb, hoja, filas,
                    new[] { "Folio", "Vehículo", "Reporte", "Tipo de mantenimiento", "Estado", "Prioridad", "Técnico", "Creada por",
                            "Fecha de creación", "Fecha de inicio", "Fecha de finalización", "Fecha de validación",
                            "Horas trabajadas", "Costo total", "Descripción", "Diagnóstico", "Trabajo realizado" },
                    o => new object?[] { o.Folio, o.Vehiculo, o.Reporte, o.TipoMantenimiento, Humanizar(o.Estado), Humanizar(o.Prioridad),
                            o.Tecnico, o.CreadoPor, o.FechaCreacion, o.FechaInicio, o.FechaFinalizacion, o.FechaValidacion,
                            o.HorasTrabajadas, o.CostoTotal, o.Descripcion, o.Diagnostico, o.TrabajoRealizado });
            }
            case "pagos":
            {
                var filas = await _db.RegistrosPago.AsNoTracking()
                    .OrderByDescending(p => p.FechaRegistro)
                    .Select(p => new
                    {
                        Orden = p.OrdenTrabajo.Folio, Tecnico = p.Tecnico.NombreCompleto, p.HorasTrabajadas, p.TarifaHora,
                        p.CostoManoObra, p.CostoRefacciones, p.OtrosCostos, p.MontoTotal, p.Estado, p.NumeroFactura,
                        OrdenCompra = p.OrdenCompra != null ? p.OrdenCompra.Folio : null,
                        p.FechaRegistro, p.FechaAprobacion, p.FechaPago, p.Notas
                    })
                    .ToListAsync();
                return EscribirHoja(wb, hoja, filas,
                    new[] { "Orden de trabajo", "Técnico", "Horas", "Tarifa por hora", "Mano de obra", "Refacciones", "Otros costos",
                            "Total", "Estado", "Factura", "Orden de compra", "Fecha de registro", "Fecha de aprobación", "Fecha de pago", "Notas" },
                    p => new object?[] { p.Orden, p.Tecnico, p.HorasTrabajadas, p.TarifaHora, p.CostoManoObra, p.CostoRefacciones,
                            p.OtrosCostos, p.MontoTotal, Humanizar(p.Estado), p.NumeroFactura, p.OrdenCompra, p.FechaRegistro,
                            p.FechaAprobacion, p.FechaPago, p.Notas });
            }
            case "ordenes-compra":
            {
                var filas = await _db.OrdenesCompra.AsNoTracking()
                    .OrderByDescending(o => o.FechaRegistro)
                    .Select(o => new { o.Folio, Proveedor = o.Proveedor.NombreCompleto, o.FechaRegistro, o.Estado, o.Total, o.NumeroExterno, Pagos = o.Pagos.Count })
                    .ToListAsync();
                return EscribirHoja(wb, hoja, filas,
                    new[] { "Folio", "Proveedor", "Fecha de registro", "Estado", "Total", "Número externo", "Pagos asociados" },
                    o => new object?[] { o.Folio, o.Proveedor, o.FechaRegistro, o.Estado, o.Total, o.NumeroExterno, o.Pagos });
            }
            case "areas":
            {
                var filas = await _db.Areas.AsNoTracking()
                    .OrderBy(a => a.Nombre)
                    .Select(a => new
                    {
                        a.Nombre, a.Codigo, a.Descripcion, Supervisor = a.Supervisor != null ? a.Supervisor.NombreCompleto : null,
                        a.Activa, Vehiculos = a.Vehiculos.Count
                    })
                    .ToListAsync();
                return EscribirHoja(wb, hoja, filas,
                    new[] { "Nombre", "Código", "Descripción", "Supervisor", "Activa", "Vehículos" },
                    a => new object?[] { a.Nombre, a.Codigo, a.Descripcion, a.Supervisor, a.Activa, a.Vehiculos });
            }
            case "tipos-vehiculo":
            {
                var conteo = await _db.Vehiculos.AsNoTracking()
                    .GroupBy(v => v.Tipo).Select(g => new { Tipo = g.Key, Total = g.Count() })
                    .ToDictionaryAsync(g => (int)g.Tipo, g => g.Total);
                var filas = await _db.TiposVehiculo.AsNoTracking()
                    .OrderBy(t => t.Id)
                    .Select(t => new
                    {
                        t.Id, t.Nombre, t.Descripcion, t.FrecuenciaPreventivoMeses, t.FrecuenciaMantenimientoDias,
                        t.MaxInWorkshop, t.ProgramadosPorSemana, t.Activo
                    })
                    .ToListAsync();
                return EscribirHoja(wb, hoja, filas,
                    new[] { "Nombre", "Descripción", "Frecuencia preventivo (meses)", "Frecuencia mantenimiento (días)",
                            "Máximo en taller", "Programados por semana", "Activo", "Vehículos" },
                    t => new object?[] { t.Nombre, t.Descripcion, t.FrecuenciaPreventivoMeses, t.FrecuenciaMantenimientoDias,
                            t.MaxInWorkshop, t.ProgramadosPorSemana, t.Activo, conteo.GetValueOrDefault(t.Id) });
            }
            case "prefijos":
            {
                var tipos = await NombresTiposAsync();
                var filas = await _db.VehiculoPrefijoConfigs.AsNoTracking()
                    .OrderBy(p => p.PrefijoCodigo)
                    .Select(p => new { p.PrefijoCodigo, p.TipoVehiculoId, p.Descripcion, p.Activo })
                    .ToListAsync();
                return EscribirHoja(wb, hoja, filas,
                    new[] { "Prefijo", "Tipo de vehículo", "Descripción", "Activo" },
                    p => new object?[] { p.PrefijoCodigo, tipos.GetValueOrDefault(p.TipoVehiculoId, p.TipoVehiculoId.ToString()), p.Descripcion, p.Activo });
            }
            case "usuarios":
            {
                // Nunca se exportan contraseñas ni sus hashes
                var filas = await _db.Users.AsNoTracking()
                    .OrderBy(u => u.NombreCompleto)
                    .Select(u => new
                    {
                        u.Username, u.NombreCompleto, u.NumeroEmpleado, u.Email, u.Telefono,
                        Roles = u.Roles.Select(r => r.Nombre).ToList(),
                        Area = u.Area != null ? u.Area.Nombre : null,
                        u.Status, u.TipoTecnico, u.EmpresaExterna, u.UltimoInicioSesion, u.CreatedAt
                    })
                    .ToListAsync();
                return EscribirHoja(wb, hoja, filas,
                    new[] { "Usuario", "Nombre", "Número de empleado", "Correo", "Teléfono", "Roles", "Área", "Estado",
                            "Tipo de técnico", "Empresa externa", "Último inicio de sesión", "Fecha de registro" },
                    u => new object?[] { u.Username, u.NombreCompleto, u.NumeroEmpleado, u.Email, u.Telefono, string.Join(", ", u.Roles),
                            u.Area, Humanizar(u.Status), u.TipoTecnico.HasValue ? Humanizar(u.TipoTecnico.Value) : null,
                            u.EmpresaExterna, u.UltimoInicioSesion, u.CreatedAt });
            }
            default:
                throw new ArgumentException($"No existe la exportación '{entidad}'");
        }
    }

    private async Task<Dictionary<int, string>> NombresTiposAsync() =>
        await _db.TiposVehiculo.AsNoTracking().Select(t => new { t.Id, t.Nombre }).ToDictionaryAsync(t => t.Id, t => t.Nombre);

    /// <summary>Escribe encabezados + filas, con formato de fecha/moneda, filtros y encabezado fijo.</summary>
    private static int EscribirHoja<T>(XLWorkbook wb, string nombre, IReadOnlyList<T> filas, string[] titulos, Func<T, object?[]> valores)
    {
        var ws = wb.Worksheets.Add(nombre);
        for (var c = 0; c < titulos.Length; c++) ws.Cell(1, c + 1).Value = titulos[c];

        for (var r = 0; r < filas.Count; r++)
        {
            var fila = valores(filas[r]);
            for (var c = 0; c < fila.Length; c++)
            {
                var cell = ws.Cell(r + 2, c + 1);
                switch (fila[c])
                {
                    case null:
                        break;
                    case bool b:
                        cell.Value = b ? "Sí" : "No";
                        break;
                    case DateTime d:
                        cell.Value = d;
                        cell.Style.DateFormat.Format = d.TimeOfDay == TimeSpan.Zero ? "dd/mm/yyyy" : "dd/mm/yyyy hh:mm";
                        break;
                    case decimal m:
                        cell.Value = m;
                        cell.Style.NumberFormat.Format = "#,##0.00";
                        break;
                    case string s:
                        // Como texto, para que códigos numéricos largos no se vuelvan notación científica
                        cell.Value = s;
                        break;
                    case var otro:
                        cell.Value = XLCellValue.FromObject(otro);
                        break;
                }
            }
        }

        EstiloEncabezado(ws.Range(1, 1, 1, titulos.Length));
        ws.SheetView.FreezeRows(1);
        ws.Range(1, 1, Math.Max(1, filas.Count + 1), titulos.Length).SetAutoFilter();
        ws.Columns(1, titulos.Length).AdjustToContents(1, Math.Min(filas.Count + 1, 500));
        foreach (var col in ws.Columns(1, titulos.Length))
            if (col.Width > 60) col.Width = 60;
        return filas.Count;
    }

    internal static void EstiloEncabezado(IXLRange rango)
    {
        rango.Style.Font.SetBold();
        rango.Style.Font.SetFontColor(XLColor.White);
        rango.Style.Fill.SetBackgroundColor(XLColor.FromHtml("#E97300"));
    }

    private static byte[] Guardar(XLWorkbook wb)
    {
        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return ms.ToArray();
    }

    /// <summary>"EnReparacion" → "En Reparacion"</summary>
    internal static string Humanizar(Enum valor) => Regex.Replace(valor.ToString(), "(?<=[a-z])(?=[A-Z])", " ");
}
