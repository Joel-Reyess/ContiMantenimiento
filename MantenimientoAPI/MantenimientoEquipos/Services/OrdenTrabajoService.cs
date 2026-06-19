using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Utils;

namespace MantenimientoEquipos.Services;

public class OrdenTrabajoService
{
    private readonly MantenimientoDbContext _db;
    private readonly NotificacionService _notificacionService;

    public OrdenTrabajoService(MantenimientoDbContext db, NotificacionService notificacionService)
    {
        _db = db;
        _notificacionService = notificacionService;
    }

    public async Task<List<OrdenTrabajoListDto>> GetAllAsync(
        EstadoOrdenTrabajoEnum? estado = null,
        int? tecnicoId = null,
        int? vehiculoId = null,
        DateTime? desde = null,
        DateTime? hasta = null,
        List<TipoVehiculoEnum>? tiposPermitidos = null)
    {
        var query = _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .Include(o => o.TecnicoAsignado)
            .AsQueryable();

        if (tiposPermitidos != null && tiposPermitidos.Any())
        {
            query = query.Where(o => tiposPermitidos.Contains(o.Vehiculo.Tipo));
        }

        if (estado.HasValue)
            query = query.Where(o => o.Estado == estado.Value);

        if (tecnicoId.HasValue)
            query = query.Where(o => o.TecnicoAsignadoId == tecnicoId.Value);

        if (vehiculoId.HasValue)
            query = query.Where(o => o.VehiculoId == vehiculoId.Value);

        if (desde.HasValue)
            query = query.Where(o => o.FechaCreacion >= desde.Value);

        if (hasta.HasValue)
            query = query.Where(o => o.FechaCreacion <= hasta.Value);

        return await query
            .OrderByDescending(o => o.FechaCreacion)
            .Select(o => new OrdenTrabajoListDto
            {
                Id = o.Id,
                Folio = o.Folio,
                VehiculoCodigo = o.Vehiculo.Codigo,
                VehiculoTipo = o.Vehiculo.Tipo.ToString(),
                TecnicoNombre = o.TecnicoAsignado != null ? o.TecnicoAsignado.NombreCompleto : null,
                Estado = o.Estado,
                EstadoNombre = o.Estado.ToString(),
                VehiculoUbicacion = (int)(
                    (o.Estado == EstadoOrdenTrabajoEnum.Asignada ||
                     o.Estado == EstadoOrdenTrabajoEnum.EnProceso ||
                     o.Estado == EstadoOrdenTrabajoEnum.EsperandoRefacciones) &&
                    o.Vehiculo.Ubicacion == UbicacionVehiculoEnum.Piso
                        ? UbicacionVehiculoEnum.Taller
                        : o.Vehiculo.Ubicacion
                ),
                VehiculoUbicacionNombre = (
                    (o.Estado == EstadoOrdenTrabajoEnum.Asignada ||
                     o.Estado == EstadoOrdenTrabajoEnum.EnProceso ||
                     o.Estado == EstadoOrdenTrabajoEnum.EsperandoRefacciones) &&
                    o.Vehiculo.Ubicacion == UbicacionVehiculoEnum.Piso
                        ? UbicacionVehiculoEnum.Taller
                        : o.Vehiculo.Ubicacion
                ).ToString(),
                Prioridad = o.Prioridad,
                PrioridadNombre = o.Prioridad.ToString(),
                TipoMantenimiento = o.TipoMantenimiento,
                FechaCreacion = o.FechaCreacion,
                FechaFinalizacion = o.FechaFinalizacion
            }).ToListAsync();
    }

    public async Task<OrdenTrabajoDto?> GetByIdAsync(int id)
    {
        var dto = await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .Include(o => o.TecnicoAsignado)
            .Include(o => o.CreadoPor)
            .Include(o => o.ValidadoPor)
            .Include(o => o.ReporteFalla)
                .ThenInclude(r => r.ItemsChecklist)
                    .ThenInclude(ic => ic.ChecklistItem)
            .Include(o => o.Evidencias)
            .Include(o => o.RespuestasChecklist)
                .ThenInclude(r => r.ChecklistItem)
            .Include(o => o.SolicitudesRefaccion)
            .Include(o => o.SolicitudesActividadAdicional)
            .Include(o => o.ItemsChecklist)
                .ThenInclude(ic => ic.ChecklistItem)
            .AsSplitQuery()
            .Where(o => o.Id == id)
            .Select(o => new OrdenTrabajoDto
            {
                Id = o.Id,
                Folio = o.Folio,
                ReporteFallaId = o.ReporteFallaId,
                ReporteFallaFolio = o.ReporteFalla != null ? o.ReporteFalla.Folio : null,
                VehiculoId = o.VehiculoId,
                VehiculoCodigo = o.Vehiculo.Codigo,
                VehiculoTipo = o.Vehiculo.Tipo.ToString(),
                TecnicoAsignadoId = o.TecnicoAsignadoId,
                TecnicoNombre = o.TecnicoAsignado != null ? o.TecnicoAsignado.NombreCompleto : null,
                FirmadoPorId = o.FirmadoPorId,
                FirmadoPorNombre = o.FirmadoPor != null ? o.FirmadoPor.NombreCompleto : null,
                FirmaAsignacionTexto = o.FirmaAsignacionTexto,
                FechaFirmaAsignacion = o.FechaFirmaAsignacion,
                CreadoPorId = o.CreadoPorId,
                CreadoPorNombre = o.CreadoPor.NombreCompleto,
                Estado = o.Estado,
                EstadoNombre = o.Estado.ToString(),
                VehiculoUbicacion = (int)(
                    (o.Estado == EstadoOrdenTrabajoEnum.Asignada ||
                     o.Estado == EstadoOrdenTrabajoEnum.EnProceso ||
                     o.Estado == EstadoOrdenTrabajoEnum.EsperandoRefacciones) &&
                    o.Vehiculo.Ubicacion == UbicacionVehiculoEnum.Piso
                        ? UbicacionVehiculoEnum.Taller
                        : o.Vehiculo.Ubicacion
                ),
                VehiculoUbicacionNombre = (
                    (o.Estado == EstadoOrdenTrabajoEnum.Asignada ||
                     o.Estado == EstadoOrdenTrabajoEnum.EnProceso ||
                     o.Estado == EstadoOrdenTrabajoEnum.EsperandoRefacciones) &&
                    o.Vehiculo.Ubicacion == UbicacionVehiculoEnum.Piso
                        ? UbicacionVehiculoEnum.Taller
                        : o.Vehiculo.Ubicacion
                ).ToString(),
                Prioridad = o.Prioridad,
                PrioridadNombre = o.Prioridad.ToString(),
                TipoMantenimiento = o.TipoMantenimiento,
                Descripcion = o.Descripcion,
                Diagnostico = o.Diagnostico,
                TrabajoRealizado = o.TrabajoRealizado,
                FechaCreacion = o.FechaCreacion,
                FechaAsignacion = o.FechaAsignacion,
                FechaInicio = o.FechaInicio,
                FechaFinalizacion = o.FechaFinalizacion,
                FechaValidacion = o.FechaValidacion,
                HorasTrabajadas = o.HorasTrabajadas,
                CostoTotal = o.CostoTotal,
                ValidadoPorNombre = o.ValidadoPor != null ? o.ValidadoPor.NombreCompleto : null,
                FirmaLider = o.FirmaLider,
                FirmaLiderNombre = o.FirmaLiderNombre,
                FirmaLiderFecha = o.FirmaLiderFecha,
                FirmaSupervisor = o.FirmaSupervisor,
                FirmaSupervisorNombre = o.FirmaSupervisorNombre,
                FirmaSupervisorFecha = o.FirmaSupervisorFecha,
                EstadoAprobacionLider = o.EstadoAprobacionLider,
                EstadoAprobacionSupervisor = o.EstadoAprobacionSupervisor,
                ComentariosAprobacionLider = o.ComentariosAprobacionLider,
                ComentariosAprobacionSupervisor = o.ComentariosAprobacionSupervisor,
                Notas = o.Notas,
                ChecklistRecepcionJson = o.ChecklistRecepcionJson,
                HerramientasUsadas = o.HerramientasUsadas,
                HorasHerramienta = o.HorasHerramienta,
                TiempoEsperaHoras = o.TiempoEsperaHoras,
                TiempoReparacionHoras = o.TiempoReparacionHoras,
                TiempoTransicionHoras = o.TiempoTransicionHoras,
                Evidencias = o.Evidencias.Select(e => new EvidenciaDto
                {
                    Id = e.Id,
                    UrlImagen = e.UrlImagen,
                    NombreArchivo = e.NombreArchivo,
                    Descripcion = e.Descripcion,
                    TipoEvidencia = e.TipoEvidencia,
                    FechaCaptura = e.FechaCaptura
                }).ToList(),
                RespuestasChecklist = o.RespuestasChecklist.Select(r => new ChecklistRespuestaDto
                {
                    Id = r.Id,
                    ChecklistItemId = r.ChecklistItemId,
                    Pregunta = r.ChecklistItem.Pregunta,
                    Valor = r.Valor,
                    Cantidad = r.Cantidad,
                    FotoUrl = r.FotoUrl,
                    Notas = r.Notas,
                    FechaRespuesta = r.FechaRespuesta,
                    CostoEstimado = r.ChecklistItem.CostoEstimado
                }).ToList(),
                SolicitudesRefaccion = o.SolicitudesRefaccion.Select(s => new SolicitudRefaccionDto
                {
                    Id = s.Id,
                    OrdenTrabajoId = s.OrdenTrabajoId,
                    NombreRefaccion = s.NombreRefaccion,
                    NumeroParte = s.NumeroParte,
                    Cantidad = s.Cantidad,
                    Estado = s.Estado,
                    CostoEstimado = s.CostoEstimado,
                    FechaSolicitud = s.FechaSolicitud
                }).ToList(),
                SolicitudesActividadAdicional = o.SolicitudesActividadAdicional.Select(s => new SolicitudActividadAdicionalDto
                {
                    Id = s.Id,
                    OrdenTrabajoId = s.OrdenTrabajoId,
                    Descripcion = s.Descripcion,
                    Justificacion = s.Justificacion,
                    Estado = s.Estado,
                    SolicitadoPorId = s.SolicitadoPorId,
                    SolicitadoPorNombre = s.SolicitadoPor != null ? s.SolicitadoPor.NombreCompleto : null,
                    FechaSolicitud = s.FechaSolicitud,
                    FechaRespuesta = s.FechaRespuesta,
                    ComentariosResolucion = s.ComentariosResolucion,
                    FotoUrl = s.FotoUrl
                }).ToList(),
                ItemsChecklistReporte = o.ReporteFalla != null
                    ? o.ReporteFalla.ItemsChecklist.Select(ic => new ReporteFallaChecklistItemDto
                    {
                        Id = ic.Id,
                        ReporteFallaId = ic.ReporteFallaId,
                        ChecklistItemId = ic.ChecklistItemId,
                        ChecklistItemPregunta = ic.ChecklistItem.Pregunta,
                        Estado = ic.Estado,
                        Notas = ic.Notas,
                        FechaAsignacion = ic.FechaAsignacion
                    }).ToList()
                    : new List<ReporteFallaChecklistItemDto>(),
                ItemsChecklist = o.ItemsChecklist.Select(ic => new OrdenTrabajoChecklistItemDto
                {
                    Id = ic.Id,
                    OrdenTrabajoId = ic.OrdenTrabajoId,
                    ChecklistItemId = ic.ChecklistItemId,
                    ChecklistItemPregunta = ic.ChecklistItem.Pregunta,
                    FechaAsignacion = ic.FechaAsignacion,
                    FechaCompletado = ic.FechaCompletado,
                    Estado = ic.Estado,
                    Cantidad = ic.Cantidad,
                    Notas = ic.Notas,
                    FotoUrl = ic.FotoUrl,
                    Tipo = "Checklist",
                    SolicitudActividadId = null
                })
                .ToList()
            }).FirstOrDefaultAsync();

        if (dto == null)
            return null;

        // EF Core no traduce de forma confiable la unión de sub-colecciones en una sola proyección.
        // Se agregan en memoria las actividades adicionales aprobadas como ítems ejecutables del checklist.
        var actividadesAprobadas = await _db.SolicitudesActividadAdicional
            .Where(s => s.OrdenTrabajoId == id && s.Estado == "Aprobada")
            .Select(s => new OrdenTrabajoChecklistItemDto
            {
                Id = s.Id,
                OrdenTrabajoId = s.OrdenTrabajoId,
                ChecklistItemId = 0,
                ChecklistItemPregunta = "[ACTIVIDAD ADICIONAL] " + s.Descripcion,
                FechaAsignacion = s.FechaRespuesta ?? s.FechaSolicitud,
                FechaCompletado = s.FechaCompletado,
                Estado = s.FechaCompletado.HasValue ? "Completado" : "Pendiente",
                Cantidad = null,
                Notas = s.NotasEjecucion ?? s.Justificacion,
                FotoUrl = s.FotoEjecucionUrl ?? s.FotoUrl,
                Tipo = "ActividadAdicional",
                SolicitudActividadId = s.Id
            })
            .ToListAsync();

        if (actividadesAprobadas.Count > 0)
            dto.ItemsChecklist.AddRange(actividadesAprobadas);

        return dto;
    }

    public async Task<OrdenTrabajo> CreateAsync(OrdenTrabajoCreateRequest request, int userId, bool force = false)
    {
        // Validar que no exista una orden activa para el vehículo
        var ordenActiva = await _db.OrdenesTrabajo
            .Where(o => o.VehiculoId == request.VehiculoId &&
                           (o.Estado == EstadoOrdenTrabajoEnum.Pendiente ||
                            o.Estado == EstadoOrdenTrabajoEnum.Asignada ||
                            o.Estado == EstadoOrdenTrabajoEnum.EnProceso))
            .FirstOrDefaultAsync();

        if (ordenActiva != null && !force)
        {
            throw new DuplicateActiveOrderException(ordenActiva.Folio!, ordenActiva.Id);
        }

        // Obtener vehículo
        var vehiculo = await _db.Vehiculos
            .FirstOrDefaultAsync(v => v.Id == request.VehiculoId);

        var tecnicoId = request.TecnicoAsignadoId;
        
        // Asignación automática de proveedor (técnico) basado en el tipo de vehículo configurado en la tabla TipoVehiculo
        if (!tecnicoId.HasValue && vehiculo != null)
        {
            var tipoId = (int)vehiculo.Tipo;
            var tipoVehiculo = await _db.TiposVehiculo.FindAsync(tipoId);
            if (tipoVehiculo?.ProveedorId.HasValue == true)
            {
                tecnicoId = tipoVehiculo.ProveedorId;
            }
        }

        // Generar folio
        var hoy = DateTime.Today;
        var secuencia = await _db.OrdenesTrabajo
            .Where(o => o.FechaCreacion.Date == hoy)
            .CountAsync() + 1;

        var orden = new OrdenTrabajo
        {
            Folio = FolioGenerator.GenerarFolioOrden(secuencia),
            ReporteFallaId = request.ReporteFallaId,
            VehiculoId = request.VehiculoId,
            TecnicoAsignadoId = tecnicoId,
            CreadoPorId = userId,
            Estado = tecnicoId.HasValue ? EstadoOrdenTrabajoEnum.Asignada : EstadoOrdenTrabajoEnum.Pendiente,
            Prioridad = request.Prioridad,
            TipoMantenimiento = request.TipoMantenimiento,
            Descripcion = request.Descripcion,
            Notas = request.Notas,
            FechaCreacion = DateTime.UtcNow,
            FechaAsignacion = tecnicoId.HasValue ? DateTime.UtcNow : null,
            CreatedAt = DateTime.UtcNow
        };

        _db.OrdenesTrabajo.Add(orden);

        // Marcar reporte como atendido y copiar ítems del checklist
        if (request.ReporteFallaId.HasValue)
        {
            var reporte = await _db.ReportesFalla
                .Include(r => r.ItemsChecklist)
                .FirstOrDefaultAsync(r => r.Id == request.ReporteFallaId.Value);

            if (reporte != null)
            {
                reporte.TieneOrdenTrabajo = true;

                // Copiar items del checklist del reporte a la orden de trabajo
                if (reporte.ItemsChecklist != null && reporte.ItemsChecklist.Any())
                {
                    var itemsOrden = reporte.ItemsChecklist.Select(ri => new OrdenTrabajoChecklistItem
                    {
                        OrdenTrabajoId = orden.Id, // Se asignará correctamente al guardar (EF Core)
                        OrdenTrabajo = orden,
                        ChecklistItemId = ri.ChecklistItemId,
                        FechaAsignacion = DateTime.UtcNow,
                        Estado = "Pendiente",
                        Cantidad = ri.Cantidad,
                        Notas = ri.Notas
                    }).ToList();

                    _db.OrdenesTrabajoChecklistItems.AddRange(itemsOrden);
                }
            }
        }

        // Cambiar estado y ubicación del vehículo (ya cargado arriba con el Include)
        if (vehiculo != null)
        {
            vehiculo.Estado = EstadoVehiculoEnum.EnReparacion;
            vehiculo.Ubicacion = UbicacionVehiculoEnum.TransicionPorReparar;
        }

        await _db.SaveChangesAsync();

        // Notificar si es preventivo
        if (orden.TipoMantenimiento == "Preventivo")
        {
            await _notificacionService.CrearNotificacionRolesAsync(
                TipoNotificacionEnum.OrdenActualizada,
                "Mantenimiento Preventivo Programado",
                $"Se ha generado la orden de mantenimiento preventivo {orden.Folio} para el vehículo {vehiculo?.Codigo ?? ""}",
                new[] { "Administrador", "Supervisor", "Lider" },
                orden.Id,
                "OrdenTrabajo",
                $"/ordenes/{orden.Id}"
            );
        }

        return orden;
    }

    public async Task<bool> AsignarTecnicoAsync(int ordenId, int tecnicoId, int userId, string? firmaAsignacionTexto = null)
    {
        var orden = await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .FirstOrDefaultAsync(o => o.Id == ordenId);
            
        if (orden == null) return false;

        orden.TecnicoAsignadoId = tecnicoId;
        orden.Estado = EstadoOrdenTrabajoEnum.Asignada;
        orden.FechaAsignacion = DateTime.UtcNow;
        orden.FirmaAsignacionTexto = firmaAsignacionTexto;
        orden.FechaFirmaAsignacion = DateTime.UtcNow;
        orden.FirmadoPorId = userId;
        orden.UpdatedAt = DateTime.UtcNow;

        // Actualizar ubicación del vehículo a Taller
        if (orden.Vehiculo != null)
        {
            orden.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Taller;
        }

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> IniciarTrabajoAsync(int ordenId, string? diagnostico, int userId)
    {
        var orden = await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .FirstOrDefaultAsync(o => o.Id == ordenId);
        if (orden == null) return false;

        orden.Estado = EstadoOrdenTrabajoEnum.EnProceso;
        orden.FechaInicio = DateTime.UtcNow;
        orden.Diagnostico = diagnostico;
        orden.UpdatedAt = DateTime.UtcNow;

        // Actualizar ubicación del vehículo al iniciar trabajo
        if (orden.Vehiculo != null)
        {
            orden.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Taller;
        }

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> CompletarTrabajoAsync(int ordenId, CompletarTrabajoRequest request, int userId)
    {
        var orden = await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .FirstOrDefaultAsync(o => o.Id == ordenId);
        if (orden == null) return false;

        // No permitir completar si hay refacciones pendientes de entrega
        var refaccionesPendientes = await _db.SolicitudesRefaccion
            .AnyAsync(s => s.OrdenTrabajoId == ordenId && s.Estado != "Entregada" && s.Estado != "Rechazada");
        if (refaccionesPendientes)
            throw new InvalidOperationException("No se puede completar la orden: hay refacciones pendientes por entregar.");

        orden.Estado = EstadoOrdenTrabajoEnum.Completada;
        orden.FechaFinalizacion = DateTime.UtcNow;
        orden.TrabajoRealizado = request.TrabajoRealizado;
        orden.HorasTrabajadas = request.HorasTrabajadas ?? 0;
        orden.Notas = request.Notas;
        orden.UpdatedAt = DateTime.UtcNow;

        // Verificar garantía/mantenimiento reciente (< 6 meses)
        // Se usa la fecha de último mantenimiento ANTES de actualizarla
        var aplicaGarantia = orden.Vehiculo != null && 
                             orden.Vehiculo.UltimoMantenimiento.HasValue &&
                             orden.Vehiculo.UltimoMantenimiento.Value > DateTime.UtcNow.AddMonths(-6);

        // Calcular costo al completar: checklist + refacciones entregadas
        var costoChecklist = await _db.ChecklistRespuestas
            .Include(r => r.ChecklistItem)
            .Where(r => r.OrdenTrabajoId == ordenId && !string.IsNullOrWhiteSpace(r.Valor))
            .SumAsync(r => r.ChecklistItem.CostoEstimado * (r.Cantidad == 0 ? 1 : r.Cantidad));

        var costoRefacciones = await _db.SolicitudesRefaccion
            .Where(s => s.OrdenTrabajoId == ordenId && s.Estado == "Entregada")
            .SumAsync(s => s.CostoReal ?? s.CostoEstimado ?? 0);

        // Si aplica garantía, el costo de las refacciones (y checklist) es 0 para fines de cobro
        if (aplicaGarantia)
        {
            orden.CostoTotal = 0;
            // Opcional: Podríamos dejar costoChecklist si corresponde a mano de obra, 
            // pero el requerimiento dice "las refacciones no tendrán costo... no se mostrará en el cálculo de pagos"
            // Asumiremos que el costo total de la orden será 0 en este caso.
        }
        else
        {
            orden.CostoTotal = costoChecklist + costoRefacciones;
        }

        // Actualizar vehículo - Pasa a zona de transición de reparados
        if (orden.Vehiculo != null)
        {
            orden.Vehiculo.Estado = EstadoVehiculoEnum.Operativo;
            orden.Vehiculo.UltimoMantenimiento = DateTime.UtcNow;
            orden.Vehiculo.Ubicacion = UbicacionVehiculoEnum.TransicionReparado;

            // Si fue mantenimiento preventivo, mover la siguiente fecha al siguiente ciclo.
            if (string.Equals(orden.TipoMantenimiento, "Preventivo", StringComparison.OrdinalIgnoreCase))
            {
                var tipoVehiculoId = (int)orden.Vehiculo.Tipo;
                var configTipo = await _db.TiposVehiculo
                    .Where(t => t.Id == tipoVehiculoId)
                    .Select(t => new { t.FrecuenciaPreventivoMeses, t.FrecuenciaMantenimientoDias })
                    .FirstOrDefaultAsync();

                var frecuenciaMeses = configTipo?.FrecuenciaPreventivoMeses ?? 0;
                var frecuenciaDias = configTipo?.FrecuenciaMantenimientoDias ?? 0;

                if (frecuenciaMeses > 0 || frecuenciaDias > 0)
                {
                    var baseDate = orden.Vehiculo.UltimoMantenimiento.Value.Date;
                    orden.Vehiculo.ProximoMantenimiento = frecuenciaMeses > 0
                        ? baseDate.AddMonths(frecuenciaMeses)
                        : baseDate.AddDays(frecuenciaDias);
                }
                else
                {
                    // Evita arrastrar una fecha antigua que lo mantenga en alertas por error.
                    orden.Vehiculo.ProximoMantenimiento = null;
                }
            }
        }

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ValidarOrdenAsync(int ordenId, bool aprobado, string? observaciones, int userId)
    {
        var orden = await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .FirstOrDefaultAsync(o => o.Id == ordenId);
        if (orden == null) return false;

        orden.Estado = aprobado ? EstadoOrdenTrabajoEnum.Validada : EstadoOrdenTrabajoEnum.EnProceso;
        orden.FechaValidacion = aprobado ? DateTime.UtcNow : null;
        orden.ValidadoPorId = userId;
        if (!string.IsNullOrEmpty(observaciones))
            orden.Notas = observaciones;
        orden.UpdatedAt = DateTime.UtcNow;

        // Si se valida positivamente, el vehículo regresa a Piso (Disponible)
        if (aprobado && orden.Vehiculo != null)
        {
            orden.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Piso;
        }
        else if (!aprobado && orden.Vehiculo != null)
        {
            // Si se devuelve, regresa al taller
            orden.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Taller;
        }

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<int> ContarOrdenesPorEstadoAsync(EstadoOrdenTrabajoEnum estado)
    {
        return await _db.OrdenesTrabajo.Where(o => o.Estado == estado).CountAsync();
    }

    public async Task<int> ContarOrdenesCompletadasHoyAsync()
    {
        var hoy = DateTime.Today;
        return await _db.OrdenesTrabajo
            .Where(o => o.Estado == EstadoOrdenTrabajoEnum.Completada || o.Estado == EstadoOrdenTrabajoEnum.Validada)
            .Where(o => o.FechaFinalizacion.HasValue && o.FechaFinalizacion.Value.Date == hoy)
            .CountAsync();
    }

    public async Task<EvidenciaFotografica?> AgregarEvidenciaAsync(int ordenId, string urlImagen, string? nombreArchivo, string? descripcion, string? tipoEvidencia, int userId)
    {
        var orden = await _db.OrdenesTrabajo.FindAsync(ordenId);
        if (orden == null) return null;

        var evidencia = new EvidenciaFotografica
        {
            OrdenTrabajoId = ordenId,
            UrlImagen = urlImagen,
            NombreArchivo = nombreArchivo,
            Descripcion = descripcion,
            TipoEvidencia = string.IsNullOrWhiteSpace(tipoEvidencia) ? "inicial" : tipoEvidencia,
            FechaCaptura = DateTime.UtcNow,
            SubidoPorId = userId
        };

        _db.EvidenciasFotograficas.Add(evidencia);
        await _db.SaveChangesAsync();
        return evidencia;
    }

    public async Task<bool> AprobarOrdenAsync(int ordenId, AprobarOrdenRequest request, int userId)
    {
        var orden = await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .FirstOrDefaultAsync(o => o.Id == ordenId);
        if (orden == null) return false;

        var estadoAprobacion = request.Aprobado ? EstadoAprobacionEnum.Aprobado : EstadoAprobacionEnum.Rechazado;
        var user = await _db.Users.FindAsync(userId);
        var nombreUsuario = user?.NombreCompleto ?? "Usuario";

        if (request.RolAprobador == "Lider")
        {
            orden.EstadoAprobacionLider = estadoAprobacion;
            orden.ComentariosAprobacionLider = request.Comentarios;
            orden.FirmaLider = request.Aprobado ? "Aprobado digitalmente" : "Rechazado";
            orden.FirmaLiderNombre = nombreUsuario;
            orden.FirmaLiderFecha = DateTime.UtcNow;
        }
        else if (request.RolAprobador == "Supervisor")
        {
            orden.EstadoAprobacionSupervisor = estadoAprobacion;
            orden.ComentariosAprobacionSupervisor = request.Comentarios;
            orden.FirmaSupervisor = request.Aprobado ? "Aprobado digitalmente" : "Rechazado";
            orden.FirmaSupervisorNombre = nombreUsuario;
            orden.FirmaSupervisorFecha = DateTime.UtcNow;
        }

        if (request.Aprobado
            && orden.EstadoAprobacionLider == EstadoAprobacionEnum.Aprobado
            && orden.EstadoAprobacionSupervisor == EstadoAprobacionEnum.Aprobado)
        {
            orden.Estado = EstadoOrdenTrabajoEnum.Validada;
            orden.FechaValidacion = DateTime.UtcNow;
            orden.ValidadoPorId = userId;
            if (orden.Vehiculo != null)
            {
                orden.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Piso;
            }
        }

        orden.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<int> GenerarOrdenesPreventivasAsync(int tipoVehiculoId, int userId)
    {
        var tipoVehiculo = await _db.TiposVehiculo.FindAsync(tipoVehiculoId);
        if (tipoVehiculo == null)
            throw new ArgumentException("Tipo de vehiculo no encontrado");

        var frecuenciaMeses = tipoVehiculo.FrecuenciaPreventivoMeses.GetValueOrDefault();
        var frecuenciaDias = tipoVehiculo.FrecuenciaMantenimientoDias.GetValueOrDefault();
        if (frecuenciaMeses <= 0 && frecuenciaDias <= 0)
            throw new InvalidOperationException("El tipo de vehiculo no tiene configurada la frecuencia preventiva (meses o dias)");

        var programadosPorSemana = tipoVehiculo.ProgramadosPorSemana ?? 0;
        if (programadosPorSemana <= 0)
            throw new InvalidOperationException("El tipo de vehiculo no tiene configurada la cantidad de programados por semana");

        // 1. Identificar vehiculos candidatos (vencidos o proximos)
        var hoy = DateTime.Today;
        var fechaLimite = hoy.AddDays(7); // candidatos: vencidos o que vencen en la proxima semana

        var keyTipo = NormalizeTipoKey(tipoVehiculo.Nombre);
        var vehiculosActivos = await _db.Vehiculos
            .Where(v => v.Activo)
            .Select(v => new
            {
                v.Id,
                v.Codigo,
                v.Tipo,
                v.UltimoMantenimiento
            })
            .ToListAsync();

        var vehiculosCandidatos = vehiculosActivos
            .Where(v => (int)v.Tipo == tipoVehiculoId
                     || NormalizeTipoKey(v.Tipo.ToString()) == keyTipo)
            .Where(v =>
            {
                if (!v.UltimoMantenimiento.HasValue)
                    return true;

                var proxima = frecuenciaMeses > 0
                    ? v.UltimoMantenimiento.Value.AddMonths(frecuenciaMeses)
                    : v.UltimoMantenimiento.Value.AddDays(frecuenciaDias);
                return proxima <= fechaLimite;
            })
            .ToList();

        // 2. Filtrar los que ya tienen orden activa
        var ordenesActivasIds = await _db.OrdenesTrabajo
            .Where(o => o.Estado != EstadoOrdenTrabajoEnum.Completada
                     && o.Estado != EstadoOrdenTrabajoEnum.Cancelada
                     && o.Estado != EstadoOrdenTrabajoEnum.Validada
                     && o.Estado != EstadoOrdenTrabajoEnum.Entregado)
            .Select(o => o.VehiculoId)
            .ToListAsync();

        var vehiculosSinOrden = vehiculosCandidatos
            .Where(v => !ordenesActivasIds.Contains(v.Id))
            .OrderBy(v => v.UltimoMantenimiento) // Priorizar los que llevan mas tiempo sin mantenimiento
            .Take(programadosPorSemana)
            .ToList();

        if (!vehiculosSinOrden.Any())
            return 0;

        // 3. Crear las ordenes
        int creadas = 0;
        var ordenesCreadasNombres = new List<string>();

        foreach (var vehiculo in vehiculosSinOrden)
        {
            var request = new OrdenTrabajoCreateRequest
            {
                VehiculoId = vehiculo.Id,
                TipoMantenimiento = "Preventivo",
                Prioridad = PrioridadEnum.Media,
                Descripcion = $"Mantenimiento Preventivo Programado - {tipoVehiculo.Nombre}",
                Notas = "Generado automaticamente por programacion preventiva."
            };

            await CreateAsync(request, userId, force: false);
            creadas++;
            ordenesCreadasNombres.Add(vehiculo.Codigo);
        }

        // 4. Enviar notificacion resumen
        if (creadas > 0)
        {
            var resumen = $"Se han generado {creadas} ordenes preventivas para: {string.Join(", ", ordenesCreadasNombres)}";
            await _notificacionService.CrearNotificacionRolesAsync(
                TipoNotificacionEnum.OrdenActualizada,
                "Programacion Preventiva Ejecutada",
                resumen,
                new[] { "Administrador", "Supervisor" },
                null,
                "ProgramacionPreventiva"
            );
        }

        return creadas;
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
}



