using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;

namespace MantenimientoEquipos.Services;

public class DashboardService
{
    private readonly MantenimientoDbContext _db;

    public DashboardService(MantenimientoDbContext db)
    {
        _db = db;
    }

    public async Task<DashboardStatsDto> GetEstadisticasGeneralesAsync()
    {
        var hoy = DateTime.Today;
        var inicioSemana = hoy.AddDays(-(int)hoy.DayOfWeek);

        var stats = new DashboardStatsDto
        {
            // VehÃ­culos
            TotalVehiculos = await _db.Vehiculos.CountAsync(),
            VehiculosOperativos = await _db.Vehiculos.Where(v => v.Estado == EstadoVehiculoEnum.Operativo).CountAsync(),
            VehiculosEnReparacion = await _db.Vehiculos.Where(v => v.Estado == EstadoVehiculoEnum.EnReparacion).CountAsync(),
            VehiculosFueraServicio = await _db.Vehiculos.Where(v => v.Estado == EstadoVehiculoEnum.FueraDeServicio).CountAsync(),

            // Ã“rdenes de trabajo
            OrdenesPendientes = await _db.OrdenesTrabajo.Where(o => o.Estado == EstadoOrdenTrabajoEnum.Pendiente).CountAsync(),
            OrdenesEnProceso = await _db.OrdenesTrabajo.Where(o => o.Estado == EstadoOrdenTrabajoEnum.EnProceso || o.Estado == EstadoOrdenTrabajoEnum.Asignada).CountAsync(),
            OrdenesCompletadasHoy = await _db.OrdenesTrabajo
                .Where(o => (o.Estado == EstadoOrdenTrabajoEnum.Completada || o.Estado == EstadoOrdenTrabajoEnum.Validada))
                .Where(o => o.FechaFinalizacion.HasValue && o.FechaFinalizacion.Value.Date == hoy)
                .CountAsync(),
            OrdenesCompletadasSemana = await _db.OrdenesTrabajo
                .Where(o => (o.Estado == EstadoOrdenTrabajoEnum.Completada || o.Estado == EstadoOrdenTrabajoEnum.Validada))
                .Where(o => o.FechaFinalizacion.HasValue && o.FechaFinalizacion.Value.Date >= inicioSemana)
                .CountAsync(),

            // Reportes
            ReportesNuevosHoy = await _db.ReportesFalla.Where(r => r.FechaReporte.Date == hoy).CountAsync(),
            ReportesSinAtender = await _db.ReportesFalla.Where(r => !r.TieneOrdenTrabajo).CountAsync(),

            // Pagos
            PagosPendientes = await _db.RegistrosPago.Where(p => p.Estado == EstadoPagoEnum.Pendiente || p.Estado == EstadoPagoEnum.EnRevision).CountAsync(),
            MontoPagosPendientes = await _db.RegistrosPago
                .Where(p => p.Estado == EstadoPagoEnum.Pendiente || p.Estado == EstadoPagoEnum.EnRevision || p.Estado == EstadoPagoEnum.Aprobado)
                .SumAsync(p => p.MontoTotal)
        };

        return stats;
    }

    public async Task<KPIsDto> GetKPIsAsync(DateTime? desde = null, DateTime? hasta = null)
    {
        desde ??= DateTime.Today.AddDays(-30);
        hasta ??= DateTime.Today.AddDays(1);

        var ordenesCompletadas = await _db.OrdenesTrabajo
            .Where(o => o.FechaFinalizacion.HasValue)
            .Where(o => o.FechaCreacion >= desde && o.FechaCreacion <= hasta)
            .ToListAsync();

        // Tiempo promedio de resoluciÃ³n
        decimal tiempoPromedio = 0;
        if (ordenesCompletadas.Any())
        {
            tiempoPromedio = (decimal)ordenesCompletadas
                .Where(o => o.FechaFinalizacion.HasValue)
                .Average(o => (o.FechaFinalizacion!.Value - o.FechaCreacion).TotalHours);
        }

        // Disponibilidad de flota
        var totalVehiculos = await _db.Vehiculos.CountAsync();
        var vehiculosOperativos = await _db.Vehiculos.Where(v => v.Estado == EstadoVehiculoEnum.Operativo).CountAsync();
        var disponibilidad = totalVehiculos > 0 ? (decimal)vehiculosOperativos / totalVehiculos * 100 : 0;

        // Fallas por tipo de vehÃ­culo
        var fallasPorTipo = await _db.ReportesFalla
            .Include(r => r.Vehiculo)
            .Where(r => r.FechaReporte >= desde && r.FechaReporte <= hasta)
            .GroupBy(r => r.Vehiculo.Tipo)
            .Select(g => new FallasPorTipoDto
            {
                TipoVehiculo = g.Key,
                TipoNombre = g.Key.ToString(),
                CantidadFallas = g.Count()
            })
            .OrderByDescending(f => f.CantidadFallas)
            .ToListAsync();

        // Fallas mÃ¡s recurrentes por Ã­tem de checklist
        var fallasRecurrentes = await _db.ReportesFallaChecklistItems
            .Include(i => i.ChecklistItem)
            .Where(i => i.ReporteFalla.FechaReporte >= desde && i.ReporteFalla.FechaReporte <= hasta)
            .GroupBy(i => new { i.ChecklistItemId, i.ChecklistItem.Pregunta })
            .Select(g => new FallasRecurrentesChecklistDto
            {
                ChecklistItemId = g.Key.ChecklistItemId,
                Pregunta = g.Key.Pregunta,
                Cantidad = g.Count()
            })
            .OrderByDescending(f => f.Cantidad)
            .Take(10)
            .ToListAsync();

        // Matriz de ubicaciÃ³n (Zona vs Tipo de VehÃ­culo)
        var vehiculosActuales = await _db.Vehiculos
            .Select(v => new
            {
                v.Tipo,
                v.Ubicacion
            })
            .ToListAsync();

        // Clasificar por ubicacion fisica real para reflejar el flujo Piso/Transicion/Taller.
        var vehiculosMatrizClasificados = vehiculosActuales.Select(v => new
        {
            v.Tipo,
            Zona = ResolveZona(v.Ubicacion)
        }).ToList();

        var zonasRequeridas = new[] { "Piso", "Taller", "Transicion" };
        var tiposVehiculoExistentes = vehiculosActuales.Select(v => v.Tipo).Distinct().ToList();

        var matrizUbicacion = zonasRequeridas
            .Select(zona => new UbicacionPorTipoMatrizDto
            {
                Ubicacion = zona,
                StatsPorTipo = tiposVehiculoExistentes
                    .Select(tipo => new StatsPorTipoVehiculoDto
                    {
                        TipoVehiculo = tipo.ToString(),
                        Cantidad = vehiculosMatrizClasificados.Count(v => v.Zona == zona && v.Tipo == tipo),
                        PromedioDias = 0
                    })
                    .ToList()
            })
            .ToList();

        // Ã“rdenes por estado
        var ordenesPorEstado = await _db.OrdenesTrabajo
            .GroupBy(o => o.Estado)
            .Select(g => new OrdenesPorEstadoDto
            {
                Estado = g.Key,
                EstadoNombre = g.Key.ToString(),
                Cantidad = g.Count()
            }).ToListAsync();

        // Costos
        var costoTotal = await _db.OrdenesTrabajo
            .Where(o => o.FechaCreacion >= desde && o.FechaCreacion <= hasta)
            .Where(o => o.CostoTotal.HasValue)
            .SumAsync(o => o.CostoTotal ?? 0);

        var costoManoObra = await _db.RegistrosPago
            .Where(p => p.FechaRegistro >= desde && p.FechaRegistro <= hasta)
            .SumAsync(p => p.CostoManoObra);

        var costoRefacciones = await _db.SolicitudesRefaccion
            .Where(s => s.FechaSolicitud >= desde && s.FechaSolicitud <= hasta && s.Estado == "Entregada")
            .SumAsync(s => s.CostoReal ?? s.CostoEstimado ?? 0);

        return new KPIsDto
        {
            TiempoPromedioResolucion = Math.Round(tiempoPromedio, 2),
            PorcentajeDisponibilidad = Math.Round(disponibilidad, 2),
            FallasPorTipo = fallasPorTipo,
            FallasRecurrentesChecklist = fallasRecurrentes,
            MatrizUbicacion = matrizUbicacion,
            OrdenesPorEstado = ordenesPorEstado,
            CostoTotalPeriodo = costoTotal,
            CostoManoObraPeriodo = costoManoObra,
            CostoRefaccionesPeriodo = costoRefacciones
        };
    }

    public async Task<DashboardTecnicoDto> GetDashboardTecnicoAsync(int tecnicoId)
    {
        var hoy = DateTime.Today;
        var inicioSemana = hoy.AddDays(-(int)hoy.DayOfWeek);

        var meta = await _db.MetasTecnico
            .Where(m => m.UsuarioId == tecnicoId && m.Mes == hoy.Month && m.Anio == hoy.Year)
            .Select(m => m.MetaMantenimientos)
            .FirstOrDefaultAsync();

        var ordenesActivas = await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .Where(o => o.TecnicoAsignadoId == tecnicoId)
            .Where(o => o.Estado != EstadoOrdenTrabajoEnum.Completada &&
                       o.Estado != EstadoOrdenTrabajoEnum.Validada &&
                       o.Estado != EstadoOrdenTrabajoEnum.Cancelada &&
                       o.Estado != EstadoOrdenTrabajoEnum.Entregado)
            .OrderByDescending(o => o.Prioridad)
            .ThenBy(o => o.FechaCreacion)
            .Select(o => new OrdenTrabajoListDto
            {
                Id = o.Id,
                Folio = o.Folio,
                VehiculoCodigo = o.Vehiculo.Codigo,
                VehiculoTipo = o.Vehiculo.Tipo.ToString(),
                Estado = o.Estado,
                EstadoNombre = o.Estado.ToString(),
                Prioridad = o.Prioridad,
                PrioridadNombre = o.Prioridad.ToString(),
                TipoMantenimiento = o.TipoMantenimiento,
                FechaCreacion = o.FechaCreacion
            }).ToListAsync();

        return new DashboardTecnicoDto
        {
            OrdenesAsignadas = await _db.OrdenesTrabajo
                .Where(o => o.TecnicoAsignadoId == tecnicoId && o.Estado == EstadoOrdenTrabajoEnum.Asignada)
                .CountAsync(),
            OrdenesEnProceso = await _db.OrdenesTrabajo
                .Where(o => o.TecnicoAsignadoId == tecnicoId && o.Estado == EstadoOrdenTrabajoEnum.EnProceso)
                .CountAsync(),
            OrdenesCompletadasHoy = await _db.OrdenesTrabajo
                .Where(o => o.TecnicoAsignadoId == tecnicoId)
                .Where(o => (o.Estado == EstadoOrdenTrabajoEnum.Completada || o.Estado == EstadoOrdenTrabajoEnum.Validada))
                .Where(o => o.FechaFinalizacion.HasValue && o.FechaFinalizacion.Value.Date == hoy)
                .CountAsync(),
            OrdenesCompletadasSemana = await _db.OrdenesTrabajo
                .Where(o => o.TecnicoAsignadoId == tecnicoId)
                .Where(o => (o.Estado == EstadoOrdenTrabajoEnum.Completada || o.Estado == EstadoOrdenTrabajoEnum.Validada))
                .Where(o => o.FechaFinalizacion.HasValue && o.FechaFinalizacion.Value.Date >= inicioSemana)
                .CountAsync(),
            OrdenesActivas = ordenesActivas,
            MetaMensual = meta
        };
    }

    public async Task<DashboardResumenDto> GetResumenFlotaAsync()
    {
        var vehiculos = await _db.Vehiculos
            .Include(v => v.Area)
            .OrderBy(v => v.Codigo)
            .Select(v => new
            {
                Id = v.Id,
                Codigo = v.Codigo,
                Tipo = v.Tipo,
                Marca = v.Marca,
                Modelo = v.Modelo,
                NumeroSerie = v.NumeroSerie,
                Anio = v.Anio,
                Estado = v.Estado,
                Ubicacion = v.Ubicacion,
                AreaNombre = v.Area != null ? v.Area.Nombre : null,
                UltimoMantenimiento = v.UltimoMantenimiento,
                ProximoMantenimiento = v.ProximoMantenimiento,
                CapacidadCarga = v.CapacidadCarga,
                HorasOperacion = v.HorasOperacion,
                Kilometraje = v.Kilometraje,
                Activo = v.Activo
            })
            .ToListAsync();

        var vehiculosClasificados = vehiculos.Select(v => {
            var zona = ResolveZona(v.Ubicacion);
            var esPiso = zona == "Piso";
            var esTaller = zona == "Taller";
            var esTransicion = zona == "Transicion";

            return new { Vehiculo = v, EsPiso = esPiso, EsTaller = esTaller, EsTransicion = esTransicion };
        }).ToList();

        var estadosPorTipo = vehiculosClasificados
            .GroupBy(x => x.Vehiculo.Tipo)
            .Select(g => new EstadoPorTipoDto
            {
                Tipo = g.Key.ToString(),
                Total = g.Count(),
                Operativos = g.Count(x => x.EsPiso),
                EnMantenimiento = g.Count(x => x.EsTaller),
                FueraDeServicio = g.Count(x => x.EsTransicion),
                Piso = g.Count(x => x.EsPiso),
                Taller = g.Count(x => x.EsTaller),
                Transicion = g.Count(x => x.EsTransicion)
            })
            .OrderBy(e => e.Tipo)
            .ToList();

        return new DashboardResumenDto
        {
            TotalVehiculos = vehiculos.Count,
            VehiculosOperativos = vehiculosClasificados.Count(x => x.EsPiso),
            VehiculosEnMantenimiento = vehiculosClasificados.Count(x => x.EsTaller),
            VehiculosFueraServicio = vehiculosClasificados.Count(x => x.EsTransicion),
            VehiculosEnPiso = vehiculosClasificados.Count(x => x.EsPiso),
            VehiculosEnTaller = vehiculosClasificados.Count(x => x.EsTaller),
            VehiculosEnTransicion = vehiculosClasificados.Count(x => x.EsTransicion),
            Equipos = vehiculos.Select(v => new VehiculoResumenDto
            {
                Id = v.Id,
                Codigo = v.Codigo,
                TipoNombre = v.Tipo.ToString(),
                Marca = v.Marca,
                Modelo = v.Modelo,
                NumeroSerie = v.NumeroSerie,
                Anio = v.Anio,
                EstadoNombre = v.Estado.ToString(),
                AreaNombre = v.AreaNombre,
                UltimoMantenimiento = v.UltimoMantenimiento,
                ProximoMantenimiento = v.ProximoMantenimiento,
                CapacidadCarga = v.CapacidadCarga,
                HorasOperacion = v.HorasOperacion,
                Kilometraje = v.Kilometraje,
                Activo = v.Activo
            }).ToList(),
            EstadosPorTipo = estadosPorTipo
        };
    }

    public async Task<List<ReporteAnualDto>> GetReporteAnualPorTipoAsync(int? anio = null)
    {
        var year = anio ?? DateTime.Now.Year;
        var startOfYear = new DateTime(year, 1, 1);
        var endOfYear = new DateTime(year, 12, 31);

        var data = await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .Where(o => o.FechaCreacion >= startOfYear && o.FechaCreacion <= endOfYear)
            .GroupBy(o => new { o.FechaCreacion.Month, o.Vehiculo.Tipo })
            .Select(g => new
            {
                Mes = g.Key.Month,
                Tipo = g.Key.Tipo,
                Cantidad = g.Count()
            })
            .ToListAsync();

        var culture = new System.Globalization.CultureInfo("es-MX");

        return data.Select(d => new ReporteAnualDto
        {
            Mes = d.Mes,
            MesNombre = culture.DateTimeFormat.GetMonthName(d.Mes),
            TipoVehiculo = d.Tipo.ToString(),
            Cantidad = d.Cantidad
        }).ToList();
    }

    public async Task<List<OrdenSinFirmaDto>> GetCarrosTerminadosSinFirmaAsync()
    {
        return await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .Include(o => o.TecnicoAsignado)
            .Where(o => (o.Estado == EstadoOrdenTrabajoEnum.Completada || o.Estado == EstadoOrdenTrabajoEnum.Validada) 
                        && o.EstadoAprobacionLider == EstadoAprobacionEnum.Pendiente)
            .OrderByDescending(o => o.FechaFinalizacion)
            .Select(o => new OrdenSinFirmaDto
            {
                Id = o.Id,
                Folio = o.Folio,
                VehiculoCodigo = o.Vehiculo.Codigo,
                Estado = o.Estado.ToString(),
                FechaFinalizacion = o.FechaFinalizacion ?? DateTime.MinValue,
                TecnicoNombre = o.TecnicoAsignado != null ? o.TecnicoAsignado.NombreCompleto : "Sin asignar"
            })
            .ToListAsync();
    }

    public async Task<List<VehiculoEnTallerDto>> GetVehiculosEnTallerAsync()
    {
        var ahoraUtc = DateTime.UtcNow;

        var ordenesEnTaller = await _db.OrdenesTrabajo
            .Where(o => o.Vehiculo.Ubicacion == UbicacionVehiculoEnum.Taller
                     && o.Estado != EstadoOrdenTrabajoEnum.Cancelada)
            .Select(o => new
            {
                o.Id,
                o.Folio,
                o.VehiculoId,
                o.TipoMantenimiento,
                o.Estado,
                FechaIngreso = o.FechaInicio ?? o.FechaAsignacion ?? o.FechaCreacion,
                VehiculoCodigo = o.Vehiculo.Codigo,
                VehiculoTipo = o.Vehiculo.Tipo,
                TecnicoNombre = o.TecnicoAsignado != null ? o.TecnicoAsignado.NombreCompleto : "Sin asignar"
            })
            .ToListAsync();

        var ultimaOrdenPorVehiculo = ordenesEnTaller
            .GroupBy(o => o.VehiculoId)
            .Select(g => g
                .OrderByDescending(x => x.FechaIngreso)
                .ThenByDescending(x => x.Id)
                .First())
            .ToList();

        return ultimaOrdenPorVehiculo
            .Select(o => new VehiculoEnTallerDto
            {
                VehiculoId = o.VehiculoId,
                Codigo = o.VehiculoCodigo,
                Tipo = o.VehiculoTipo.ToString(),
                TipoMantenimiento = o.TipoMantenimiento,
                TecnicoNombre = o.TecnicoNombre,
                FechaIngreso = o.FechaIngreso,
                DiasEnTaller = Math.Round((ahoraUtc - o.FechaIngreso).TotalDays, 1),
                EstadoOrden = o.Estado.ToString(),
                FolioOrden = o.Folio,
                OrdenId = o.Id
            })
            .OrderByDescending(v => v.DiasEnTaller)
            .ToList();
    }

    public async Task<List<OrdenSinPagoDto>> GetOrdenesSinPagoAsync()
    {
        return await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .Include(o => o.TecnicoAsignado)
            .Include(o => o.RegistroPago)
            .Where(o => (o.Estado == EstadoOrdenTrabajoEnum.Completada || o.Estado == EstadoOrdenTrabajoEnum.Validada)
                        && (o.RegistroPago == null || o.RegistroPago.Estado != EstadoPagoEnum.Aprobado))
            .OrderByDescending(o => o.FechaFinalizacion)
            .Select(o => new OrdenSinPagoDto
            {
                OrdenId = o.Id,
                Folio = o.Folio,
                Vehiculo = o.Vehiculo.Codigo,
                Tecnico = o.TecnicoAsignado != null ? o.TecnicoAsignado.NombreCompleto : "Sin asignar",
                FechaFinalizacion = o.FechaFinalizacion ?? DateTime.MinValue,
                CostoTotal = o.CostoTotal ?? 0,
                EstadoPago = o.RegistroPago != null ? o.RegistroPago.Estado.ToString() : "Sin Registro"
            })
            .ToListAsync();
    }

    public async Task<List<EstadisticaDiariaDto>> GetOrdenesPorDiaAsync(int dias = 7)
    {
        var hoy = DateTime.Today;
        var inicio = hoy.AddDays(-(dias - 1));

        var reportes = await _db.ReportesFalla
            .Where(r => r.FechaReporte >= inicio)
            .GroupBy(r => r.FechaReporte.Date)
            .Select(g => new { Fecha = g.Key, Cantidad = g.Count() })
            .ToListAsync();

        var completadas = await _db.OrdenesTrabajo
            .Where(o => o.FechaFinalizacion.HasValue && o.FechaFinalizacion.Value >= inicio)
            .GroupBy(o => o.FechaFinalizacion!.Value.Date)
            .Select(g => new { Fecha = g.Key, Cantidad = g.Count() })
            .ToListAsync();

        var resultado = new List<EstadisticaDiariaDto>();
        for (int i = 0; i < dias; i++)
        {
            var fecha = inicio.AddDays(i);
            resultado.Add(new EstadisticaDiariaDto
            {
                Fecha = fecha,
                DiaSemana = fecha.ToString("ddd", new System.Globalization.CultureInfo("es-MX")),
                ReportesCreados = reportes.FirstOrDefault(r => r.Fecha == fecha)?.Cantidad ?? 0,
                OrdenesCreadas = 0,
                OrdenesCompletadas = completadas.FirstOrDefault(c => c.Fecha == fecha)?.Cantidad ?? 0
            });
        }

        return resultado;
    }

    public async Task<List<MantenimientoPreventivoProgramadoDto>> GetMantenimientosPreventivosProgramadosAsync()
    {
        var hoy = DateTime.Today;

        var tiposProgramados = await _db.TiposVehiculo
            .Where(t => (t.FrecuenciaPreventivoMeses.HasValue && t.FrecuenciaPreventivoMeses > 0)
                     || (t.FrecuenciaMantenimientoDias.HasValue && t.FrecuenciaMantenimientoDias > 0))
            .Select(t => new TipoProgramacionConfig
            {
                Id = t.Id,
                Nombre = t.Nombre,
                FrecuenciaPreventivoMeses = t.FrecuenciaPreventivoMeses,
                FrecuenciaMantenimientoDias = t.FrecuenciaMantenimientoDias,
                ProgramadosPorSemana = t.ProgramadosPorSemana
            })
            .ToListAsync();

        if (tiposProgramados.Count == 0)
            return new List<MantenimientoPreventivoProgramadoDto>();

        var tipoPorId = tiposProgramados.ToDictionary(t => t.Id, t => t);
        var tipoPorNombreEstricto = tiposProgramados
            .GroupBy(t => NormalizeTipoKey(t.Nombre))
            .ToDictionary(g => g.Key, g => g.First());
        var tipoPorNombreCanonico = tiposProgramados
            .GroupBy(t => NormalizeTipoKeySinConectores(t.Nombre))
            .ToDictionary(g => g.Key, g => g.First());

        var vehiculos = await _db.Vehiculos
            .Where(v => v.Activo)
            .Select(v => new
            {
                v.Id,
                v.Codigo,
                v.Tipo,
                v.ProximoMantenimiento,
                v.UltimoMantenimiento
            })
            .ToListAsync();

        if (vehiculos.Count == 0)
        {
            vehiculos = await _db.Vehiculos
                .Select(v => new
                {
                    v.Id,
                    v.Codigo,
                    v.Tipo,
                    v.ProximoMantenimiento,
                    v.UltimoMantenimiento
                })
                .ToListAsync();
        }

        // No listar equipos que ya tienen una orden preventiva activa para evitar duplicados
        // en "mantenimientos por realizar".
        var vehiculosConPreventivoActivo = new HashSet<int>(
            await _db.OrdenesTrabajo
                .Where(o => o.TipoMantenimiento == "Preventivo")
                .Where(o => o.Estado != EstadoOrdenTrabajoEnum.Completada
                         && o.Estado != EstadoOrdenTrabajoEnum.Cancelada
                         && o.Estado != EstadoOrdenTrabajoEnum.Validada
                         && o.Estado != EstadoOrdenTrabajoEnum.Entregado)
                .Select(o => o.VehiculoId)
                .Distinct()
                .ToListAsync()
        );

        // También excluir equipos con reporte preventivo pendiente de check-in
        // (aún sin orden), para evitar que se vuelvan a programar en la lista.
        var vehiculosConReportePreventivoPendiente = new HashSet<int>(
            await _db.ReportesFalla
                .Where(r => r.TipoMantenimiento == "Preventivo" && !r.TieneOrdenTrabajo)
                .Select(r => r.VehiculoId)
                .Distinct()
                .ToListAsync()
        );

        var programacionRaw = new List<(int TipoId, string TipoNombre, int VehiculoId, string VehiculoCodigo, DateTime? UltimaFecha, DateTime ProximaFecha, int DiasRestantes, string Estado)>();

        var configFallbackGlobal = ResolveConfigFallback(tiposProgramados);

        foreach (var v in vehiculos)
        {
            if (vehiculosConPreventivoActivo.Contains(v.Id) || vehiculosConReportePreventivoPendiente.Contains(v.Id))
                continue;

            var cfg = ResolveTipoProgramado(v.Tipo, tipoPorId, tipoPorNombreEstricto, tipoPorNombreCanonico);
            var usaFallback = false;
            if (cfg == null)
            {
                cfg = configFallbackGlobal;
                usaFallback = cfg != null;
            }

            if (cfg == null)
                continue;

            var frecuenciaMeses = cfg.FrecuenciaPreventivoMeses.GetValueOrDefault();
            var frecuenciaDias = cfg.FrecuenciaMantenimientoDias.GetValueOrDefault();
            if (frecuenciaMeses <= 0 && frecuenciaDias <= 0)
            {
                if (configFallbackGlobal == null)
                    continue;

                cfg = configFallbackGlobal;
                usaFallback = true;
                frecuenciaMeses = cfg.FrecuenciaPreventivoMeses.GetValueOrDefault();
                frecuenciaDias = cfg.FrecuenciaMantenimientoDias.GetValueOrDefault();
                if (frecuenciaMeses <= 0 && frecuenciaDias <= 0)
                    continue;
            }

            DateTime proximaFecha;
            if (v.UltimoMantenimiento.HasValue)
            {
                var ultimaFecha = v.UltimoMantenimiento.Value.Date;
                var proximaCalculada = frecuenciaMeses > 0
                    ? ultimaFecha.AddMonths(frecuenciaMeses)
                    : ultimaFecha.AddDays(frecuenciaDias);

                if (v.ProximoMantenimiento.HasValue)
                {
                    var proximaGuardada = v.ProximoMantenimiento.Value.Date;
                    // Si la fecha guardada es anterior/igual al ultimo mantenimiento,
                    // se considera desfasada y se recalcula.
                    proximaFecha = proximaGuardada <= ultimaFecha
                        ? proximaCalculada
                        : proximaGuardada;
                }
                else
                {
                    proximaFecha = proximaCalculada;
                }
            }
            else if (v.ProximoMantenimiento.HasValue)
            {
                proximaFecha = v.ProximoMantenimiento.Value.Date;
            }
            else
            {
                proximaFecha = frecuenciaMeses > 0 ? hoy.AddMonths(frecuenciaMeses) : hoy.AddDays(frecuenciaDias);
            }

            var diasRestantes = (int)(proximaFecha - hoy).TotalDays;
            programacionRaw.Add((
                cfg.Id,
                usaFallback ? v.Tipo.ToString() : cfg.Nombre,
                v.Id,
                v.Codigo,
                v.UltimoMantenimiento,
                proximaFecha,
                diasRestantes,
                diasRestantes < 0 ? "Vencido" : (diasRestantes <= 7 ? "Proximo" : "Programado")
            ));
        }

        // Recordatorio recurrente semanal:
        // de cada tipo se muestran los N mas proximos, donde N es ProgramadosPorSemana
        // (si no esta definido, se calcula automaticamente de forma razonable).
        var programacion = new List<MantenimientoPreventivoProgramadoDto>();

        foreach (var grupo in programacionRaw.GroupBy(x => x.TipoId))
        {
            var cfg = tiposProgramados.First(t => t.Id == grupo.Key);
            var cuota = cfg.ProgramadosPorSemana.GetValueOrDefault();
            if (cuota <= 0)
            {
                cuota = CalcularCuotaSemanalAutomatica(
                    grupo.Count(),
                    cfg.FrecuenciaPreventivoMeses.GetValueOrDefault(),
                    cfg.FrecuenciaMantenimientoDias.GetValueOrDefault());
            }
            if (cuota <= 0)
            {
                continue;
            }

            foreach (var item in grupo.OrderBy(x => x.ProximaFecha).ThenBy(x => x.VehiculoCodigo).Take(cuota))
            {
                programacion.Add(new MantenimientoPreventivoProgramadoDto
                {
                    VehiculoId = item.VehiculoId,
                    VehiculoCodigo = item.VehiculoCodigo,
                    TipoVehiculo = item.TipoNombre,
                    UltimaFecha = item.UltimaFecha,
                    ProximaFecha = item.ProximaFecha,
                    DiasRestantes = item.DiasRestantes,
                    Estado = item.Estado
                });
            }
        }

        return programacion
            .OrderBy(p => p.ProximaFecha)
            .ThenBy(p => p.VehiculoCodigo)
            .ToList();
    }

    private static TipoProgramacionConfig? ResolveTipoProgramado(
        TipoVehiculoEnum tipoVehiculoEnum,
        IReadOnlyDictionary<int, TipoProgramacionConfig> tipoPorId,
        IReadOnlyDictionary<string, TipoProgramacionConfig> tipoPorNombreEstricto,
        IReadOnlyDictionary<string, TipoProgramacionConfig> tipoPorNombreCanonico)
    {
        var tipoId = (int)tipoVehiculoEnum;
        if (tipoPorId.TryGetValue(tipoId, out var cfg))
            return cfg;

        var keyEstricto = NormalizeTipoKey(tipoVehiculoEnum.ToString());
        if (!string.IsNullOrEmpty(keyEstricto))
        {
            if (tipoPorNombreEstricto.TryGetValue(keyEstricto, out cfg))
                return cfg;

            cfg = tipoPorNombreEstricto
                .Where(kvp => keyEstricto.Contains(kvp.Key) || kvp.Key.Contains(keyEstricto))
                .Select(kvp => kvp.Value)
                .FirstOrDefault();
            if (cfg != null)
                return cfg;
        }

        var keyCanonico = NormalizeTipoKeySinConectores(tipoVehiculoEnum.ToString());
        if (!string.IsNullOrEmpty(keyCanonico))
        {
            if (tipoPorNombreCanonico.TryGetValue(keyCanonico, out cfg))
                return cfg;

            cfg = tipoPorNombreCanonico
                .Where(kvp => keyCanonico.Contains(kvp.Key) || kvp.Key.Contains(keyCanonico))
                .Select(kvp => kvp.Value)
                .FirstOrDefault();
            if (cfg != null)
                return cfg;
        }

        return null;
    }

    private static TipoProgramacionConfig? ResolveConfigFallback(IReadOnlyCollection<TipoProgramacionConfig> tiposProgramados)
    {
        return tiposProgramados
            .Where(t =>
                (t.FrecuenciaPreventivoMeses.HasValue && t.FrecuenciaPreventivoMeses.Value > 0) ||
                (t.FrecuenciaMantenimientoDias.HasValue && t.FrecuenciaMantenimientoDias.Value > 0))
            .OrderBy(t => GetDuracionCicloDias(t.FrecuenciaPreventivoMeses, t.FrecuenciaMantenimientoDias))
            .FirstOrDefault();
    }

    private static int GetDuracionCicloDias(int? frecuenciaMeses, int? frecuenciaDias)
    {
        if (frecuenciaMeses.HasValue && frecuenciaMeses.Value > 0)
            return frecuenciaMeses.Value * 30;

        if (frecuenciaDias.HasValue && frecuenciaDias.Value > 0)
            return frecuenciaDias.Value;

        return int.MaxValue;
    }

    private static string NormalizeTipoKey(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var normalized = value.Normalize(System.Text.NormalizationForm.FormD);
        return new string(normalized
            .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
            .Where(char.IsLetterOrDigit)
            .Select(char.ToLowerInvariant)
            .ToArray());
    }

    private static readonly HashSet<string> TipoConectores = new(StringComparer.OrdinalIgnoreCase)
    {
        "de", "del", "la", "las", "el", "los", "y", "para", "por"
    };

    private static string NormalizeTipoKeySinConectores(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var separadoCamelCase = System.Text.RegularExpressions.Regex.Replace(value, "([a-z0-9])([A-Z])", "$1 $2");
        var sinAcentos = separadoCamelCase.Normalize(System.Text.NormalizationForm.FormD);
        var limpio = new string(sinAcentos
            .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
            .ToArray());

        var tokens = System.Text.RegularExpressions.Regex
            .Split(limpio, "[^A-Za-z0-9]+")
            .Where(t => !string.IsNullOrWhiteSpace(t))
            .Select(t => t.ToLowerInvariant())
            .Where(t => !TipoConectores.Contains(t));

        return string.Concat(tokens);
    }

    private sealed class TipoProgramacionConfig
    {
        public int Id { get; set; }
        public string Nombre { get; set; } = string.Empty;
        public int? FrecuenciaPreventivoMeses { get; set; }
        public int? FrecuenciaMantenimientoDias { get; set; }
        public int? ProgramadosPorSemana { get; set; }
    }

    private static int CalcularCuotaSemanalAutomatica(int totalVehiculos, int frecuenciaMeses, int frecuenciaDias)
    {
        if (totalVehiculos <= 0)
            return 0;

        var semanasCiclo = frecuenciaMeses > 0
            ? frecuenciaMeses * 4.345
            : Math.Max(1.0, frecuenciaDias / 7.0);

        var cuota = (int)Math.Ceiling(totalVehiculos / semanasCiclo);
        return Math.Clamp(cuota, 1, totalVehiculos);
    }
    private static string ResolveZona(UbicacionVehiculoEnum ubicacion)
    {
        return ubicacion switch
        {
            UbicacionVehiculoEnum.Taller => "Taller",
            UbicacionVehiculoEnum.Transicion => "Transicion",
            UbicacionVehiculoEnum.TransicionPorReparar => "Transicion",
            UbicacionVehiculoEnum.TransicionReparado => "Transicion",
            _ => "Piso"
        };
    }
}

