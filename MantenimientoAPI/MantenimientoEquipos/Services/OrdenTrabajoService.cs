using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Utils;

namespace MantenimientoEquipos.Services;

public class OrdenTrabajoService
{
    /// <summary>
    /// Estados en los que una orden sigue "abierta" para su vehículo (avisos de duplicado al crear reportes u órdenes).
    /// Incluye esperando refacciones y completada sin validar: el vehículo todavía no regresa al piso.
    /// </summary>
    public static readonly EstadoOrdenTrabajoEnum[] EstadosOrdenActiva =
    {
        EstadoOrdenTrabajoEnum.Pendiente,
        EstadoOrdenTrabajoEnum.Asignada,
        EstadoOrdenTrabajoEnum.EnProceso,
        EstadoOrdenTrabajoEnum.EsperandoRefacciones,
        EstadoOrdenTrabajoEnum.Completada
    };

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
        List<TipoVehiculoEnum>? tiposPermitidos = null,
        string? busqueda = null,
        PrioridadEnum? prioridad = null)
    {
        var query = _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .Include(o => o.TecnicoAsignado)
            .AsQueryable();

        // Búsqueda y prioridad de la pantalla de Órdenes (antes se enviaban pero no se aplicaban)
        if (!string.IsNullOrWhiteSpace(busqueda))
        {
            var texto = busqueda.Trim();
            query = query.Where(o => o.Folio.Contains(texto)
                || o.Vehiculo.Codigo.Contains(texto)
                || o.Descripcion.Contains(texto)
                || (o.TecnicoAsignado != null && o.TecnicoAsignado.NombreCompleto.Contains(texto)));
        }

        if (prioridad.HasValue)
            query = query.Where(o => o.Prioridad == prioridad.Value);

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
                VehiculoTipo = _db.TiposVehiculo.Where(t => t.Id == (int)o.Vehiculo.Tipo).Select(t => t.Nombre).FirstOrDefault() ?? o.Vehiculo.Tipo.ToString(),
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
                FechaFinalizacion = o.FechaFinalizacion,
                EstadoAprobacionLider = o.EstadoAprobacionLider,
                EstadoAprobacionSupervisor = o.EstadoAprobacionSupervisor,
                PorEntregarEnZona = o.Estado == EstadoOrdenTrabajoEnum.Completada && o.FechaTrasladoRetorno == null
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
            .Include(o => o.ReporteFalla)
                .ThenInclude(r => r.ImageFaults)
                    .ThenInclude(rif => rif.ImageFault)
            .Include(o => o.ReporteFalla)
                .ThenInclude(r => r.ImageFaults)
                    .ThenInclude(rif => rif.VehicleImagePoint)
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
                VehiculoTipo = _db.TiposVehiculo.Where(t => t.Id == (int)o.Vehiculo.Tipo).Select(t => t.Nombre).FirstOrDefault() ?? o.Vehiculo.Tipo.ToString(),
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
                ImageFaults = o.ReporteFalla != null
                    ? o.ReporteFalla.ImageFaults
                        .OrderBy(rif => rif.Id)
                        .Select(rif => new ReportImageFaultDto
                        {
                            Id = rif.Id,
                            ReporteFallaId = rif.ReporteFallaId,
                            ImageFaultId = rif.ImageFaultId,
                            ImageFaultName = rif.ImageFault.Name,
                            VehicleImagePointId = rif.VehicleImagePointId,
                            XPct = rif.VehicleImagePoint != null ? rif.VehicleImagePoint.XPct : null,
                            YPct = rif.VehicleImagePoint != null ? rif.VehicleImagePoint.YPct : null
                        }).ToList()
                    : new List<ReportImageFaultDto>(),
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
        // Un reporte solo puede tener una orden (p. ej. dos clics o dos usuarios a la vez); esto no se puede forzar
        if (request.ReporteFallaId.HasValue)
        {
            var ordenDelReporte = await _db.OrdenesTrabajo
                .Where(o => o.ReporteFallaId == request.ReporteFallaId)
                .Select(o => new { o.Folio })
                .FirstOrDefaultAsync();
            if (ordenDelReporte != null)
                throw new InvalidOperationException($"Este reporte ya tiene la orden de trabajo {ordenDelReporte.Folio}.");
        }

        // Validar que no exista una orden activa para el vehículo
        var ordenActiva = await _db.OrdenesTrabajo
            .Where(o => o.VehiculoId == request.VehiculoId && EstadosOrdenActiva.Contains(o.Estado))
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
        var folio = await FolioGenerator.SiguienteAsync(_db.OrdenesTrabajo.Select(o => o.Folio), "OT");

        var orden = new OrdenTrabajo
        {
            Folio = folio,
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
                // La orden de un reporte nace de su validación (INSPECCIÓN); no se puede crear antes
                if (reporte.EstadoInspeccion == EstadoInspeccionEnum.Rechazado)
                    throw new InvalidOperationException("El reporte fue rechazado en la inspección: el Líder debe corregirlo y reenviarlo.");
                if (reporte.EstadoInspeccion == EstadoInspeccionEnum.Pendiente)
                    throw new InvalidOperationException("El reporte aún no se valida: el Líder debe validarlo en la inspección y con eso se genera la orden.");
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

        // El vehículo queda en reparación; su ubicación cambia hasta que se confirma el traslado a la Zona de Transición
        if (vehiculo != null)
        {
            vehiculo.Estado = EstadoVehiculoEnum.EnReparacion;
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
        if (orden.Estado != EstadoOrdenTrabajoEnum.Pendiente && orden.Estado != EstadoOrdenTrabajoEnum.Asignada
            && orden.Estado != EstadoOrdenTrabajoEnum.EnProceso && orden.Estado != EstadoOrdenTrabajoEnum.EsperandoRefacciones)
            throw new InvalidOperationException("Solo se puede asignar técnico a una orden que no se ha terminado.");

        orden.TecnicoAsignadoId = tecnicoId;
        // Cambiar de técnico no regresa la orden de etapa (si ya estaba en revisión o en proceso, sigue igual)
        if (orden.Estado == EstadoOrdenTrabajoEnum.Pendiente)
            orden.Estado = EstadoOrdenTrabajoEnum.Asignada;
        orden.FechaAsignacion = DateTime.UtcNow;
        orden.FirmaAsignacionTexto = firmaAsignacionTexto;
        orden.FechaFirmaAsignacion = DateTime.UtcNow;
        orden.FirmadoPorId = userId;
        orden.UpdatedAt = DateTime.UtcNow;
        // La unidad pasa al taller cuando el técnico acepta la orden (flujo de 7 etapas), no al asignarla
        await FlujoHistorial.AgregarAsync(_db, orden.ReporteFallaId, orden.Id, "TALLER", "Asignada", userId, "Técnico asignado");

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> IniciarTrabajoAsync(int ordenId, string? diagnostico, int userId)
    {
        var orden = await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .FirstOrDefaultAsync(o => o.Id == ordenId);
        if (orden == null) return false;
        if (orden.FechaAceptacion == null)
            throw new InvalidOperationException("El técnico debe aceptar la orden antes de iniciar la reparación.");
        if (orden.Estado != EstadoOrdenTrabajoEnum.Asignada && orden.Estado != EstadoOrdenTrabajoEnum.EsperandoRefacciones)
            throw new InvalidOperationException("La orden no está en revisión: no se puede iniciar.");

        orden.Estado = EstadoOrdenTrabajoEnum.EnProceso;
        orden.FechaInicio ??= DateTime.UtcNow;
        orden.Diagnostico = diagnostico;
        orden.UpdatedAt = DateTime.UtcNow;
        await FlujoHistorial.AgregarAsync(_db, orden.ReporteFallaId, orden.Id, "TALLER", "Iniciada", userId,
            string.IsNullOrWhiteSpace(diagnostico) ? "Reparación en proceso" : $"Reparación en proceso. Diagnóstico: {diagnostico}");

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
        if (orden.FechaAceptacion == null
            || (orden.Estado != EstadoOrdenTrabajoEnum.Asignada && orden.Estado != EstadoOrdenTrabajoEnum.EnProceso && orden.Estado != EstadoOrdenTrabajoEnum.EsperandoRefacciones))
            throw new InvalidOperationException("Solo se puede terminar una orden aceptada y en reparación.");

        // No permitir completar si hay refacciones pendientes de entrega
        var refaccionesPendientes = await _db.SolicitudesRefaccion
            .AnyAsync(s => s.OrdenTrabajoId == ordenId && s.Estado != "Entregada" && s.Estado != "Rechazada");
        if (refaccionesPendientes)
            throw new InvalidOperationException("No se puede completar la orden: hay refacciones pendientes por entregar.");

        orden.Estado = EstadoOrdenTrabajoEnum.Completada;
        orden.FechaInicio ??= DateTime.UtcNow;
        orden.FechaFinalizacion = DateTime.UtcNow;
        orden.TrabajoRealizado = request.TrabajoRealizado;
        orden.HorasTrabajadas = request.HorasTrabajadas ?? 0;
        orden.Notas = request.Notas;
        orden.UpdatedAt = DateTime.UtcNow;

        // Verificar garantía/mantenimiento reciente (< 6 meses)
        // Se usa la fecha de último mantenimiento ANTES de actualizarla
        // (sin contar el que dejó esta misma orden si se terminó antes y la validación la regresó al taller)
        var inicioDeEstaOrden = orden.FechaAceptacion ?? orden.FechaCreacion;
        var aplicaGarantia = orden.Vehiculo != null && 
                             orden.Vehiculo.UltimoMantenimiento.HasValue &&
                             orden.Vehiculo.UltimoMantenimiento.Value > DateTime.UtcNow.AddMonths(-6) &&
                             orden.Vehiculo.UltimoMantenimiento.Value < inicioDeEstaOrden;

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

        // La unidad sigue en el taller hasta que el técnico confirma su entrega en la zona de reparados;
        // vuelve a estar operativa cuando se valida la reparación (DISPONIBLE)
        if (orden.Vehiculo != null)
        {
            orden.Vehiculo.UltimoMantenimiento = DateTime.UtcNow;

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

        await FlujoHistorial.AgregarAsync(_db, orden.ReporteFallaId, orden.Id, "TALLER", "Terminada", userId,
            string.IsNullOrWhiteSpace(request.TrabajoRealizado) ? "Reparación concluida" : $"Reparación concluida: {request.TrabajoRealizado}");
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



