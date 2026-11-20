using System.Globalization;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Services;

/// <summary>
/// Historial de mantenimiento individual por vehículo (Reporte 6, 13-nov-2026, FLT-11 a FLT-16): resumen, lista
/// cronológica de intervenciones, estadísticas de recurrencia, análisis económico y filtros.
///
/// Reglas:
///   * Todo cuelga del vehículo (VehiculoId), no de usuarios ni proveedores: técnicos y empresas desactivados
///     siguen apareciendo con su nombre.
///   * Los importes son los de las órdenes de pago vigentes (no rechazadas), tal como se generaron; nunca se
///     recalculan con tarifas o costos actuales.
///   * Se arma la lista completa de intervenciones del vehículo y los filtros se aplican sobre ella; resumen,
///     estadísticas y análisis económico se calculan con lo filtrado. Las opciones de los filtros salen de todo.
/// </summary>
public class HistorialVehiculoService
{
    private readonly MantenimientoDbContext _db;

    public HistorialVehiculoService(MantenimientoDbContext db)
    {
        _db = db;
    }

    private static readonly Dictionary<string, string> NombresEstado = new()
    {
        [nameof(EstadoOrdenTrabajoEnum.Pendiente)] = "Pendiente de taller",
        [nameof(EstadoOrdenTrabajoEnum.Asignada)] = "En revisión en taller",
        [nameof(EstadoOrdenTrabajoEnum.EnProceso)] = "En reparación",
        [nameof(EstadoOrdenTrabajoEnum.EsperandoRefacciones)] = "Esperando refacciones",
        [nameof(EstadoOrdenTrabajoEnum.Completada)] = "Reparación terminada (por validar)",
        [nameof(EstadoOrdenTrabajoEnum.Validada)] = "Concluida (disponible)",
        [nameof(EstadoOrdenTrabajoEnum.Entregado)] = "Concluida (entregada)",
        [nameof(EstadoOrdenTrabajoEnum.Cancelada)] = "Cancelada",
        ["SinOrden"] = "Reporte sin orden de trabajo"
    };

    private static readonly EstadoOrdenTrabajoEnum[] Concluidas = { EstadoOrdenTrabajoEnum.Validada, EstadoOrdenTrabajoEnum.Entregado };

    /// <summary>
    /// Empresa proveedora de una intervención. ÚNICO lugar donde se decide: la empresa con cuyas tarifas se generó la
    /// orden de pago; sin orden de pago, la que atiende la orden (etapa SELECCIÓN, Reporte 6); y en órdenes de antes,
    /// la empresa actual del técnico asignado.
    /// </summary>
    private static int? EmpresaDeIntervencion(int? empresaPago, int? empresaOrden, int? empresaTecnico) => empresaPago ?? empresaOrden ?? empresaTecnico;

    /// <summary>Null si el vehículo no existe</summary>
    public async Task<HistorialVehiculoDto?> ObtenerAsync(int vehiculoId, HistorialVehiculoFiltros f, bool verCostos)
    {
        var vehiculo = await _db.Vehiculos.AsNoTracking()
            .Where(v => v.Id == vehiculoId)
            .Select(v => new { v.Id, v.Codigo, v.Tipo })
            .FirstOrDefaultAsync();
        if (vehiculo == null) return null;
        var tipoNombre = await _db.TiposVehiculo.Where(t => t.Id == (int)vehiculo.Tipo).Select(t => t.Nombre).FirstOrDefaultAsync();

        // ---------- Datos crudos del vehículo ----------
        var ordenes = await _db.OrdenesTrabajo.AsNoTracking()
            .Where(o => o.VehiculoId == vehiculoId)
            .Select(o => new
            {
                o.Id, o.Folio, o.ReporteFallaId, o.TipoMantenimiento, o.Descripcion, o.Estado,
                o.FechaCreacion, o.FechaFinalizacion, o.FechaValidacion,
                o.TecnicoAsignadoId, o.EmpresaId,
                Pago = o.RegistroPago == null ? null : new
                {
                    o.RegistroPago.Id, o.RegistroPago.Estado, o.RegistroPago.MontoTotal, o.RegistroPago.EmpresaId, o.RegistroPago.TecnicoId
                }
            })
            .ToListAsync();

        var reportes = await _db.ReportesFalla.AsNoTracking()
            .Where(r => r.VehiculoId == vehiculoId)
            .Select(r => new { r.Id, r.Folio, r.Descripcion, r.TipoMantenimiento, r.FechaReporte, r.EstadoInspeccion })
            .ToListAsync();

        var reporteIds = reportes.Select(r => r.Id).ToList();
        var ordenIds = ordenes.Select(o => o.Id).ToList();
        // Pagos vigentes: los rechazados no cuentan como gasto
        var pagosVigentes = ordenes.Where(o => o.Pago != null && o.Pago.Estado != EstadoPagoEnum.Rechazado)
            .ToDictionary(o => o.Id, o => o.Pago!);
        var pagoIds = pagosVigentes.Values.Select(p => p.Id).ToList();

        var componentesPorReporte = (await _db.ReportImageFaults.AsNoTracking()
                .Where(x => reporteIds.Contains(x.ReporteFallaId))
                .OrderBy(x => x.Id)
                // FLT-17 (Reporte 7): el punto de la foto se nombra con el título de su actividad (FV-03), no con dos textos distintos
                .Select(x => new
                {
                    x.ReporteFallaId,
                    Name = _db.ChecklistItems.Where(c => c.Id == x.ImageFault.ChecklistItemId && c.Titulo != null && c.Titulo != "")
                        .Select(c => c.Titulo).FirstOrDefault() ?? x.ImageFault.Name
                })
                .ToListAsync())
            .GroupBy(x => x.ReporteFallaId)
            .ToDictionary(g => g.Key, g => Distintos(g.Select(x => x.Name)));

        var trabajosPorReporte = (await _db.ReportesFallaChecklistItems.AsNoTracking()
                .Where(x => reporteIds.Contains(x.ReporteFallaId))
                .OrderBy(x => x.Id)
                .Select(x => new { x.ReporteFallaId, Pregunta = x.ChecklistItem.Titulo != null && x.ChecklistItem.Titulo != "" ? x.ChecklistItem.Titulo : x.ChecklistItem.Pregunta })
                .ToListAsync())
            .GroupBy(x => x.ReporteFallaId)
            .ToDictionary(g => g.Key, g => Distintos(g.Select(x => x.Pregunta)));

        var actividadesPorOrden = (await _db.OrdenesTrabajoChecklistItems.AsNoTracking()
                .Where(x => ordenIds.Contains(x.OrdenTrabajoId))
                .OrderBy(x => x.Id)
                .Select(x => new { x.OrdenTrabajoId, Pregunta = x.ChecklistItem.Titulo != null && x.ChecklistItem.Titulo != "" ? x.ChecklistItem.Titulo : x.ChecklistItem.Pregunta, x.Estado, x.Cantidad, x.ReportadoPorTaller })
                .ToListAsync())
            .GroupBy(x => x.OrdenTrabajoId)
            .ToDictionary(g => g.Key, g => g.Select(x => new ActividadIntervencionDto
            {
                Nombre = x.Pregunta.Trim(),
                Cantidad = x.Cantidad is > 0 ? x.Cantidad.Value : 1,
                Completada = x.Estado == "Completado",
                Hallazgo = x.ReportadoPorTaller
            }).ToList());

        var renglonesPago = (await _db.RegistroPagoActividades.AsNoTracking()
                .Where(a => pagoIds.Contains(a.RegistroPagoId))
                .OrderBy(a => a.Orden).ThenBy(a => a.Id)
                .Select(a => new
                {
                    a.RegistroPagoId,
                    // Título de la actividad si sigue existiendo; si no, el texto con el que se cobró
                    Descripcion = _db.ChecklistItems.Where(c => c.Id == a.ChecklistItemId && c.Titulo != null && c.Titulo != "")
                        .Select(c => c.Titulo).FirstOrDefault() ?? a.Descripcion,
                    a.Cantidad, a.Subtotal
                })
                .ToListAsync())
            .GroupBy(a => a.RegistroPagoId)
            .ToDictionary(g => g.Key, g => g.ToList());

        var materialesPorOrden = (await _db.MaterialesOrdenTrabajo.AsNoTracking()
                .Where(m => ordenIds.Contains(m.OrdenTrabajoId))
                .Select(m => new { m.OrdenTrabajoId, m.Consumible.Nombre, m.Cantidad })
                .ToListAsync())
            .GroupBy(m => m.OrdenTrabajoId)
            .ToDictionary(g => g.Key, g => g
                .GroupBy(m => m.Nombre.Trim(), StringComparer.CurrentCultureIgnoreCase)
                .Select(x => new MaterialIntervencionDto { Nombre = x.Key, Cantidad = x.Sum(y => y.Cantidad) })
                .ToList());

        // Técnicos y empresas con su nombre aunque estén desactivados
        var tecnicoIds = ordenes.Select(o => o.TecnicoAsignadoId ?? o.Pago?.TecnicoId).Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        var tecnicos = await _db.Users.AsNoTracking().Where(u => tecnicoIds.Contains(u.Id))
            .Select(u => new { u.Id, u.NombreCompleto, u.Status, u.EmpresaId })
            .ToDictionaryAsync(u => u.Id);

        // Técnico de la intervención: el asignado a la orden o, si ya no lo tiene, el de su orden de pago
        var tecnicoDeOrden = ordenes.ToDictionary(o => o.Id, o => o.TecnicoAsignadoId ?? o.Pago?.TecnicoId);
        var empresaDeOrden = ordenes.ToDictionary(o => o.Id, o =>
        {
            var tid = tecnicoDeOrden[o.Id];
            return EmpresaDeIntervencion(
                pagosVigentes.TryGetValue(o.Id, out var p) ? p.EmpresaId : null,
                o.EmpresaId,
                tid.HasValue && tecnicos.TryGetValue(tid.Value, out var t) ? t.EmpresaId : null);
        });
        var empresaIds = empresaDeOrden.Values.Where(x => x.HasValue).Select(x => x!.Value).Distinct().ToList();
        var empresas = await _db.Empresas.AsNoTracking().Where(e => empresaIds.Contains(e.Id))
            .Select(e => new { e.Id, e.Nombre, e.Activo })
            .ToDictionaryAsync(e => e.Id);

        // ---------- Intervenciones ----------
        var todas = new List<IntervencionDto>();
        var reportesConOrden = ordenes.Where(o => o.ReporteFallaId.HasValue).Select(o => o.ReporteFallaId!.Value).ToHashSet();
        var reportesPorId = reportes.ToDictionary(r => r.Id);

        foreach (var o in ordenes)
        {
            var r = o.ReporteFallaId.HasValue && reportesPorId.TryGetValue(o.ReporteFallaId.Value, out var rr) ? rr : null;
            var tecnicoId = tecnicoDeOrden[o.Id];
            var tecnico = tecnicoId.HasValue && tecnicos.TryGetValue(tecnicoId.Value, out var t) ? t : null;
            var empresaId = empresaDeOrden[o.Id];
            var empresa = empresaId.HasValue && empresas.TryGetValue(empresaId.Value, out var e) ? e : null;
            pagosVigentes.TryGetValue(o.Id, out var pago);

            var actividades = actividadesPorOrden.TryGetValue(o.Id, out var acts) ? acts : new List<ActividadIntervencionDto>();
            // Órdenes sin checklist en la orden: lo cobrado en la orden de pago es lo que se hizo
            if (actividades.Count == 0 && pago != null && renglonesPago.TryGetValue(pago.Id, out var rp))
                actividades = rp.Select(a => new ActividadIntervencionDto
                {
                    Nombre = a.Descripcion.Trim(), Cantidad = a.Cantidad > 0 ? a.Cantidad : 1, Completada = true
                }).ToList();
            var concluida = Concluidas.Contains(o.Estado);
            // En una orden concluida todo lo que quedó en ella se hizo (las anteriores no marcaban cada renglón)
            if (concluida && actividades.All(a => !a.Completada))
                actividades.ForEach(a => a.Completada = true);

            var estado = o.Estado.ToString();
            todas.Add(new IntervencionDto
            {
                ReporteId = r?.Id, ReporteFolio = r?.Folio,
                OrdenId = o.Id, OrdenFolio = o.Folio,
                Fecha = r?.FechaReporte ?? o.FechaCreacion,
                FechaConclusion = concluida ? o.FechaValidacion ?? o.FechaFinalizacion : null,
                TipoMantenimiento = Tipo(string.IsNullOrWhiteSpace(o.TipoMantenimiento) ? r?.TipoMantenimiento : o.TipoMantenimiento),
                DescripcionFalla = r?.Descripcion ?? o.Descripcion,
                FallasReportadas = r == null ? new List<string>() : FallasDe(r.Id, trabajosPorReporte, componentesPorReporte),
                Componentes = r != null && componentesPorReporte.TryGetValue(r.Id, out var comps) ? comps : new List<string>(),
                Actividades = actividades,
                Materiales = materialesPorOrden.TryGetValue(o.Id, out var mats) ? mats : new List<MaterialIntervencionDto>(),
                TecnicoId = tecnicoId, Tecnico = tecnico?.NombreCompleto,
                TecnicoActivo = tecnico == null || tecnico.Status == UserStatusEnum.Activo,
                EmpresaId = empresaId, Empresa = empresa?.Nombre,
                Importe = pago?.MontoTotal,
                PagoFolio = pago != null ? OrdenPagoService.Folio(pago.Id) : null,
                Estado = estado,
                EstadoNombre = NombresEstado.TryGetValue(estado, out var nombre) ? nombre : estado
            });
        }

        // Reportes que no llegaron a orden de trabajo (en inspección, rechazados o cancelados) también son historial
        foreach (var r in reportes.Where(x => !reportesConOrden.Contains(x.Id)))
        {
            todas.Add(new IntervencionDto
            {
                ReporteId = r.Id, ReporteFolio = r.Folio,
                Fecha = r.FechaReporte,
                TipoMantenimiento = Tipo(r.TipoMantenimiento),
                DescripcionFalla = r.Descripcion,
                FallasReportadas = FallasDe(r.Id, trabajosPorReporte, componentesPorReporte),
                Componentes = componentesPorReporte.TryGetValue(r.Id, out var comps) ? comps : new List<string>(),
                Estado = "SinOrden",
                EstadoNombre = r.EstadoInspeccion switch
                {
                    EstadoInspeccionEnum.Cancelado => "Reporte cancelado",
                    EstadoInspeccionEnum.Rechazado => "Reporte rechazado (en corrección)",
                    EstadoInspeccionEnum.Validado => "Reporte validado",
                    _ => "Reporte en inspección"
                }
            });
        }

        // ---------- Opciones de los filtros (de todo el historial) ----------
        var opciones = new HistorialOpcionesFiltroDto
        {
            TiposMantenimiento = todas.Select(i => i.TipoMantenimiento).Distinct().OrderBy(x => x)
                .Select(x => new OpcionFiltroDto { Valor = x, Nombre = x }).ToList(),
            Componentes = Distintos(todas.SelectMany(i => i.Componentes.Concat(i.Actividades.Select(a => a.Nombre))))
                .OrderBy(x => x, StringComparer.CurrentCultureIgnoreCase)
                .Select(x => new OpcionFiltroDto { Valor = x, Nombre = x }).ToList(),
            Empresas = todas.Where(i => i.EmpresaId.HasValue).GroupBy(i => i.EmpresaId!.Value)
                .Select(g => new OpcionFiltroDto
                {
                    Valor = g.Key.ToString(CultureInfo.InvariantCulture), Nombre = g.First().Empresa ?? $"Empresa #{g.Key}",
                    Activo = empresas.TryGetValue(g.Key, out var e) && e.Activo
                })
                .OrderBy(x => x.Nombre).ToList(),
            Tecnicos = todas.Where(i => i.TecnicoId.HasValue).GroupBy(i => i.TecnicoId!.Value)
                .Select(g => new OpcionFiltroDto
                {
                    Valor = g.Key.ToString(CultureInfo.InvariantCulture), Nombre = g.First().Tecnico ?? $"Técnico #{g.Key}",
                    Activo = g.First().TecnicoActivo
                })
                .OrderBy(x => x.Nombre).ToList(),
            Estados = todas.Select(i => i.Estado).Distinct()
                .OrderBy(x => OrdenEstado(x))
                .Select(x => new OpcionFiltroDto { Valor = x, Nombre = NombresEstado.TryGetValue(x, out var n) ? n : x }).ToList()
        };

        // ---------- Filtros ----------
        IEnumerable<IntervencionDto> q = todas;
        if (f.Desde.HasValue) q = q.Where(i => i.Fecha >= f.Desde.Value.Date);
        if (f.Hasta.HasValue) q = q.Where(i => i.Fecha < f.Hasta.Value.Date.AddDays(1));
        if (!string.IsNullOrWhiteSpace(f.TipoMantenimiento))
            q = q.Where(i => string.Equals(i.TipoMantenimiento, f.TipoMantenimiento.Trim(), StringComparison.OrdinalIgnoreCase));
        if (!string.IsNullOrWhiteSpace(f.Componente))
        {
            var c = f.Componente.Trim();
            q = q.Where(i => i.Componentes.Any(x => Igual(x, c)) || i.Actividades.Any(a => Igual(a.Nombre, c)));
        }
        if (f.EmpresaId.HasValue) q = q.Where(i => i.EmpresaId == f.EmpresaId);
        if (f.TecnicoId.HasValue) q = q.Where(i => i.TecnicoId == f.TecnicoId);
        if (!string.IsNullOrWhiteSpace(f.Estado))
        {
            var est = f.Estado.Trim();
            // "Concluida" agrupa Validada y Entregado
            q = est.Equals("Concluida", StringComparison.OrdinalIgnoreCase)
                ? q.Where(i => i.Estado is nameof(EstadoOrdenTrabajoEnum.Validada) or nameof(EstadoOrdenTrabajoEnum.Entregado))
                : q.Where(i => string.Equals(i.Estado, est, StringComparison.OrdinalIgnoreCase));
        }
        var lista = q.OrderByDescending(i => i.Fecha).ThenByDescending(i => i.OrdenId ?? 0).ThenByDescending(i => i.ReporteId ?? 0).ToList();

        // ---------- Resumen ----------
        var conOrden = lista.Where(i => i.OrdenId.HasValue).ToList();
        var conCosto = lista.Where(i => i.Importe.HasValue).ToList();
        var total = conCosto.Sum(i => i.Importe!.Value);
        var porEmpresa = conOrden.Where(i => i.EmpresaId.HasValue && i.Estado != nameof(EstadoOrdenTrabajoEnum.Cancelada))
            .GroupBy(i => i.EmpresaId!.Value)
            .Select(g => new ConteoDto
            {
                Id = g.Key, Nombre = g.First().Empresa ?? $"Empresa #{g.Key}", Eventos = g.Count(),
                Importe = g.Where(i => i.Importe.HasValue).Sum(i => i.Importe!.Value)
            })
            .OrderByDescending(x => x.Eventos).ThenByDescending(x => x.Importe).ThenBy(x => x.Nombre)
            .ToList();

        var resumen = new HistorialResumenDto
        {
            TotalReportes = lista.Count(i => i.ReporteId.HasValue),
            TotalOrdenes = conOrden.Count,
            TotalActividades = conOrden.Sum(i => i.Actividades.Count(a => a.Completada)),
            ImporteAcumulado = verCostos ? total : null,
            FechaUltimoMantenimiento = conOrden.Where(i => i.FechaConclusion.HasValue).Select(i => i.FechaConclusion).Max(),
            FechaUltimoReporte = lista.Where(i => i.ReporteId.HasValue).Select(i => (DateTime?)i.Fecha).Max(),
            EmpresaMayorParticipacion = porEmpresa.Select(x => new ConteoDto
            {
                Id = x.Id, Nombre = x.Nombre, Eventos = x.Eventos, Importe = verCostos ? x.Importe : null
            }).FirstOrDefault(),
            CostoPromedio = verCostos ? Promedio(total, conCosto.Count) : null
        };

        // ---------- Estadísticas ----------
        var vigentes = conOrden.Where(i => i.Estado != nameof(EstadoOrdenTrabajoEnum.Cancelada)).ToList();
        var tipos = Conteo(conOrden.Select(i => i.TipoMantenimiento));
        var estadisticas = new HistorialEstadisticasDto
        {
            ActividadesFrecuentes = Conteo(vigentes.SelectMany(i => i.Actividades.Where(a => a.Completada).Select(a => a.Nombre))),
            ComponentesFrecuentes = Conteo(vigentes.SelectMany(i => i.Componentes)),
            FallasRecurrentes = Conteo(lista.SelectMany(i => i.FallasReportadas)),
            TiposMantenimiento = tipos,
            TipoPredominante = tipos.FirstOrDefault()?.Nombre
        };

        // ---------- Análisis económico ----------
        HistorialEconomicoDto? economico = null;
        if (verCostos)
        {
            var porActividad = new Dictionary<string, ConteoDto>(StringComparer.CurrentCultureIgnoreCase);
            foreach (var i in conCosto)
            {
                var pago = pagosVigentes[i.OrdenId!.Value];
                if (renglonesPago.TryGetValue(pago.Id, out var renglones) && renglones.Count > 0)
                {
                    foreach (var a in renglones)
                        Sumar(porActividad, a.Descripcion.Trim(), a.Subtotal);
                    // Si el total trae algo fuera de los renglones (ajustes de órdenes anteriores), no se pierde
                    var resto = pago.MontoTotal - renglones.Sum(a => a.Subtotal);
                    if (resto != 0) Sumar(porActividad, "Sin detalle por actividad", resto);
                }
                else Sumar(porActividad, "Sin detalle por actividad", pago.MontoTotal);
            }

            economico = new HistorialEconomicoDto
            {
                Total = total,
                IntervencionesConCosto = conCosto.Count,
                Promedio = Promedio(total, conCosto.Count) ?? 0,
                PorActividad = porActividad.Values.OrderByDescending(x => x.Importe).ThenBy(x => x.Nombre).ToList(),
                PorProveedor = conCosto.GroupBy(i => i.EmpresaId)
                    .Select(g => new ConteoDto
                    {
                        Id = g.Key, Nombre = g.Key.HasValue ? g.First().Empresa ?? $"Empresa #{g.Key}" : "Sin empresa",
                        Eventos = g.Count(), Importe = g.Sum(i => i.Importe!.Value)
                    })
                    .OrderByDescending(x => x.Importe).ThenBy(x => x.Nombre).ToList(),
                // El gasto cae en el periodo en que la reparación concluyó (cuando se generó la orden de pago)
                PorPeriodo = Periodos(conCosto, i => (i.FechaConclusion ?? i.Fecha).ToString("yyyy-MM", CultureInfo.InvariantCulture)),
                Comparativo = Periodos(conCosto, i => (i.FechaConclusion ?? i.Fecha).Year.ToString(CultureInfo.InvariantCulture))
            };
        }
        else
        {
            foreach (var i in lista) { i.Importe = null; i.PagoFolio = null; }
        }

        return new HistorialVehiculoDto
        {
            VehiculoId = vehiculo.Id,
            VehiculoCodigo = vehiculo.Codigo,
            VehiculoTipo = tipoNombre ?? vehiculo.Tipo.ToString(),
            VerCostos = verCostos,
            HayFiltros = f.Desde.HasValue || f.Hasta.HasValue || !string.IsNullOrWhiteSpace(f.TipoMantenimiento)
                         || !string.IsNullOrWhiteSpace(f.Componente) || f.EmpresaId.HasValue || f.TecnicoId.HasValue
                         || !string.IsNullOrWhiteSpace(f.Estado),
            Resumen = resumen,
            Intervenciones = lista,
            Estadisticas = estadisticas,
            Economico = economico,
            Filtros = opciones
        };
    }

    // ---------- Utilidades ----------

    private static string Tipo(string? tipo) => string.IsNullOrWhiteSpace(tipo) ? "Correctivo" : tipo.Trim();

    private static bool Igual(string a, string b) => string.Equals(a.Trim(), b, StringComparison.CurrentCultureIgnoreCase);

    private static List<string> Distintos(IEnumerable<string?> nombres) => nombres
        .Where(n => !string.IsNullOrWhiteSpace(n))
        .Select(n => n!.Trim())
        .Distinct(StringComparer.CurrentCultureIgnoreCase)
        .ToList();

    /// <summary>Lo que señaló quien reportó: trabajos del checklist y componentes marcados en la foto</summary>
    private static List<string> FallasDe(int reporteId, Dictionary<int, List<string>> trabajos, Dictionary<int, List<string>> componentes) =>
        Distintos((trabajos.TryGetValue(reporteId, out var t) ? t : new List<string>())
            .Concat(componentes.TryGetValue(reporteId, out var c) ? c : new List<string>()));

    private static List<ConteoDto> Conteo(IEnumerable<string> nombres) => nombres
        .Where(n => !string.IsNullOrWhiteSpace(n))
        .GroupBy(n => n.Trim(), StringComparer.CurrentCultureIgnoreCase)
        .Select(g => new ConteoDto { Nombre = g.First().Trim(), Eventos = g.Count() })
        .OrderByDescending(x => x.Eventos).ThenBy(x => x.Nombre, StringComparer.CurrentCultureIgnoreCase)
        .ToList();

    private static void Sumar(Dictionary<string, ConteoDto> d, string nombre, decimal importe)
    {
        if (!d.TryGetValue(nombre, out var c)) d[nombre] = c = new ConteoDto { Nombre = nombre, Importe = 0 };
        c.Eventos++;
        c.Importe += importe;
    }

    private static decimal? Promedio(decimal total, int n) => n == 0 ? null : Math.Round(total / n, 2);

    private static List<PeriodoCostoDto> Periodos(IEnumerable<IntervencionDto> conCosto, Func<IntervencionDto, string> clave)
    {
        var lista = conCosto.GroupBy(clave)
            .Select(g => new PeriodoCostoDto
            {
                Periodo = g.Key, Intervenciones = g.Count(), Importe = g.Sum(i => i.Importe!.Value),
            })
            .OrderBy(p => p.Periodo, StringComparer.Ordinal)
            .ToList();
        for (var i = 0; i < lista.Count; i++)
        {
            lista[i].Promedio = Promedio(lista[i].Importe, lista[i].Intervenciones) ?? 0;
            if (i > 0 && lista[i - 1].Importe != 0)
                lista[i].VariacionPct = Math.Round((lista[i].Importe - lista[i - 1].Importe) * 100m / lista[i - 1].Importe, 1);
        }
        return lista;
    }

    private static int OrdenEstado(string estado) => estado switch
    {
        nameof(EstadoOrdenTrabajoEnum.Pendiente) => 1,
        nameof(EstadoOrdenTrabajoEnum.Asignada) => 2,
        nameof(EstadoOrdenTrabajoEnum.EnProceso) => 3,
        nameof(EstadoOrdenTrabajoEnum.EsperandoRefacciones) => 4,
        nameof(EstadoOrdenTrabajoEnum.Completada) => 5,
        nameof(EstadoOrdenTrabajoEnum.Validada) => 6,
        nameof(EstadoOrdenTrabajoEnum.Entregado) => 7,
        nameof(EstadoOrdenTrabajoEnum.Cancelada) => 8,
        _ => 9
    };
}
