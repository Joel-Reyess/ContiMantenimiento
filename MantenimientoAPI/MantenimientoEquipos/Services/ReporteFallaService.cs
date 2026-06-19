using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Utils;

namespace MantenimientoEquipos.Services;

public class ReporteFallaService
{
    private readonly MantenimientoDbContext _db;
    private readonly VehiculoPrefijoConfigService _prefijoConfigService;

    public ReporteFallaService(MantenimientoDbContext db, VehiculoPrefijoConfigService prefijoConfigService)
    {
        _db = db;
        _prefijoConfigService = prefijoConfigService;
    }

    private static TipoVehiculoEnum MapearTipoEnum(int tipoVehiculoId)
    {
        return Enum.IsDefined(typeof(TipoVehiculoEnum), tipoVehiculoId)
            ? (TipoVehiculoEnum)tipoVehiculoId
            : TipoVehiculoEnum.Carrito;
    }

    private async Task<Vehiculo> ObtenerOCrearVehiculoAsync(string codigoVehiculo, int userId)
    {
        var vehiculo = await _db.Vehiculos.FirstOrDefaultAsync(v => v.Codigo == codigoVehiculo && v.Activo);
        if (vehiculo != null) return vehiculo;

        var tipoPrefijoId = await _prefijoConfigService.GetTipoVehiculoIdByCodigoAsync(codigoVehiculo);
        if (!tipoPrefijoId.HasValue)
            throw new ArgumentException("Vehículo no encontrado y no existe un prefijo configurado para determinar su tipo.");

        vehiculo = new Vehiculo
        {
            Codigo = codigoVehiculo,
            Tipo = MapearTipoEnum(tipoPrefijoId.Value),
            Estado = EstadoVehiculoEnum.Operativo,
            Ubicacion = UbicacionVehiculoEnum.Piso,
            Activo = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId,
            Marca = string.Empty,
            Modelo = string.Empty,
            NumeroSerie = string.Empty
        };

        _db.Vehiculos.Add(vehiculo);
        await _db.SaveChangesAsync();
        return vehiculo;
    }

    public async Task<List<ReporteFallaListDto>> GetAllAsync(
        bool? sinOrden = null, 
        int? vehiculoId = null, 
        DateTime? desde = null, 
        DateTime? hasta = null,
        List<TipoVehiculoEnum>? tiposPermitidos = null)
    {
        var query = _db.ReportesFalla
            .Include(r => r.Vehiculo)
            .Include(r => r.CategoriaFalla)
            .Include(r => r.ReportadoPor)
            .Include(r => r.Evidencias)
            .AsQueryable();

        if (tiposPermitidos != null && tiposPermitidos.Any())
        {
            query = query.Where(r => tiposPermitidos.Contains(r.Vehiculo.Tipo));
        }

        if (sinOrden == true)
            query = query.Where(r => !r.TieneOrdenTrabajo);

        if (vehiculoId.HasValue)
            query = query.Where(r => r.VehiculoId == vehiculoId.Value);

        if (desde.HasValue)
            query = query.Where(r => r.FechaReporte >= desde.Value);

        if (hasta.HasValue)
            query = query.Where(r => r.FechaReporte <= hasta.Value);

        return await query
            .OrderByDescending(r => r.FechaReporte)
            .Select(r => new ReporteFallaListDto
            {
                Id = r.Id,
                Folio = r.Folio,
                VehiculoCodigo = r.Vehiculo.Codigo,
                VehiculoTipo = r.Vehiculo.Tipo.ToString(),
                CategoriaNombre = r.CategoriaFalla != null ? r.CategoriaFalla.Nombre : null,
                Prioridad = r.Prioridad,
                PrioridadNombre = r.Prioridad.ToString(),
                TipoMantenimiento = r.TipoMantenimiento,
                FechaReporte = r.FechaReporte,
                TieneOrdenTrabajo = r.TieneOrdenTrabajo,
                ReportadoPorNombre = r.ReportadoPor.NombreCompleto,
                CantidadEvidencias = r.Evidencias.Count
            }).ToListAsync();
    }

    public async Task<ReporteFallaDto?> GetByIdAsync(int id)
    {
        return await _db.ReportesFalla
            .Include(r => r.Vehiculo)
            .Include(r => r.CategoriaFalla)
            .Include(r => r.ReportadoPor)
            .Include(r => r.Evidencias)
            .Include(r => r.OrdenTrabajo)
            .Include(r => r.ItemsChecklist)
            .ThenInclude(ic => ic.ChecklistItem)
            .Include(r => r.ImageFaults)
            .ThenInclude(rif => rif.ImageFault)
            .Include(r => r.ImageFaults)
            .ThenInclude(rif => rif.VehicleImagePoint)
            .Where(r => r.Id == id)
            .Select(r => new ReporteFallaDto
            {
                Id = r.Id,
                Folio = r.Folio,
                VehiculoId = r.VehiculoId,
                VehiculoCodigo = r.Vehiculo.Codigo,
                VehiculoTipo = r.Vehiculo.Tipo.ToString(),
                CategoriaFallaId = r.CategoriaFallaId,
                CategoriaNombre = r.CategoriaFalla != null ? r.CategoriaFalla.Nombre : null,
                ReportadoPorId = r.ReportadoPorId,
                ReportadoPorNombre = r.ReportadoPor.NombreCompleto,
                Prioridad = r.Prioridad,
                PrioridadNombre = r.Prioridad.ToString(),
                TipoMantenimiento = r.TipoMantenimiento,
                Descripcion = r.Descripcion,
                Ubicacion = r.Ubicacion,
                PuedeOperar = r.PuedeOperar,
                FechaReporte = r.FechaReporte,
                TieneOrdenTrabajo = r.TieneOrdenTrabajo,
                OrdenTrabajoId = r.OrdenTrabajo != null ? r.OrdenTrabajo.Id : null,
                Evidencias = r.Evidencias.Select(e => new EvidenciaDto
                {
                    Id = e.Id,
                    UrlImagen = e.UrlImagen,
                    NombreArchivo = e.NombreArchivo,
                    Descripcion = e.Descripcion,
                    TipoEvidencia = e.TipoEvidencia,
                    FechaCaptura = e.FechaCaptura
                }).ToList(),
                ItemsChecklist = r.ItemsChecklist.Select(ic => new ReporteFallaChecklistItemDto
                {
                    Id = ic.Id,
                    ReporteFallaId = ic.ReporteFallaId,
                    ChecklistItemId = ic.ChecklistItemId,
                    ChecklistItemPregunta = ic.ChecklistItem.Pregunta,
                    Estado = ic.Estado,
                    Notas = ic.Notas,
                    Cantidad = ic.Cantidad,
                    FechaAsignacion = ic.FechaAsignacion
                }).ToList(),
                ImageFaults = r.ImageFaults
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
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync();
    }

    public async Task<ReporteFalla> CreateAsync(ReporteFallaCreateRequest request, int userId, bool force = false)
    {
        var vehiculo = await ObtenerOCrearVehiculoAsync(request.CodigoVehiculo, userId);

        if (!force)
        {
            var ordenActiva = await _db.OrdenesTrabajo
                .Where(o => o.VehiculoId == vehiculo.Id &&
                            (o.Estado == EstadoOrdenTrabajoEnum.Pendiente ||
                             o.Estado == EstadoOrdenTrabajoEnum.Asignada ||
                             o.Estado == EstadoOrdenTrabajoEnum.EnProceso))
                .FirstOrDefaultAsync();

            if (ordenActiva != null)
            {
                throw new DuplicateActiveOrderException(ordenActiva.Folio, ordenActiva.Id);
            }
        }

        var itemsToProcess = new List<ChecklistItemSelectionDto>();
        if (request.ChecklistItems != null && request.ChecklistItems.Any())
        {
            itemsToProcess = request.ChecklistItems;
        }
        else if (request.ChecklistItemIds != null && request.ChecklistItemIds.Any())
        {
            itemsToProcess = request.ChecklistItemIds.Select(id => new ChecklistItemSelectionDto { Id = id }).ToList();
        }

        if (itemsToProcess.Any())
        {
            var checklistItemsIds = itemsToProcess.Select(x => x.Id).Distinct().ToList();
            var existingItems = await _db.ChecklistItems
                .Where(ci => checklistItemsIds.Contains(ci.Id))
                .Select(ci => ci.Id)
                .ToListAsync();

            var nonExistentItems = checklistItemsIds.Except(existingItems);
            if (nonExistentItems.Any())
            {
                throw new ArgumentException($"No se encontraron los siguientes items del checklist: {string.Join(", ", nonExistentItems)}");
            }
        }

        var imageFaultsToProcess = await ValidateImageFaultSelectionsAsync(request.ImageFaults);

        var hoy = DateTime.Today;
        var secuencia = await _db.ReportesFalla
            .Where(r => r.FechaReporte.Date == hoy)
            .CountAsync() + 1;

        var reporte = new ReporteFalla
        {
            Folio = FolioGenerator.GenerarFolioReporte(secuencia),
            VehiculoId = vehiculo.Id,
            CategoriaFallaId = request.CategoriaFallaId,
            ReportadoPorId = userId,
            Prioridad = request.Prioridad,
            TipoMantenimiento = string.IsNullOrWhiteSpace(request.TipoMantenimiento) ? "Correctivo" : request.TipoMantenimiento,
            Descripcion = request.Descripcion,
            Ubicacion = request.Ubicacion,
            PuedeOperar = request.PuedeOperar,
            FechaReporte = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        _db.ReportesFalla.Add(reporte);
        await _db.SaveChangesAsync();

        if (itemsToProcess.Any())
        {
            var itemsChecklist = itemsToProcess
                .Select(item => new ReporteFallaChecklistItem
                {
                    ReporteFallaId = reporte.Id,
                    ChecklistItemId = item.Id,
                    FechaAsignacion = DateTime.UtcNow,
                    Estado = "Pendiente",
                    Cantidad = item.Cantidad
                })
                .ToList();

            _db.ReportesFallaChecklistItems.AddRange(itemsChecklist);
        }

        if (imageFaultsToProcess.Any())
        {
            var reportImageFaults = imageFaultsToProcess
                .Select(f => new ReportImageFault
                {
                    ReporteFallaId = reporte.Id,
                    ImageFaultId = f.ImageFaultId,
                    VehicleImagePointId = f.VehicleImagePointId,
                    CreatedAt = DateTime.UtcNow
                })
                .ToList();

            _db.ReportImageFaults.AddRange(reportImageFaults);
        }

        if (!request.PuedeOperar)
        {
            vehiculo.Estado = EstadoVehiculoEnum.FueraDeServicio;
        }

        await _db.SaveChangesAsync();
        return reporte;
    }

    public async Task<ReporteFalla> CreateWithAutoChecklistAsync(ReporteFallaCreateRequest request, int userId, bool force = false)
    {
        var vehiculo = await ObtenerOCrearVehiculoAsync(request.CodigoVehiculo, userId);

        if (!force)
        {
            var ordenActiva = await _db.OrdenesTrabajo
                .Where(o => o.VehiculoId == vehiculo.Id &&
                            (o.Estado == EstadoOrdenTrabajoEnum.Pendiente ||
                             o.Estado == EstadoOrdenTrabajoEnum.Asignada ||
                             o.Estado == EstadoOrdenTrabajoEnum.EnProceso))
                .FirstOrDefaultAsync();

            if (ordenActiva != null)
            {
                throw new DuplicateActiveOrderException(ordenActiva.Folio, ordenActiva.Id);
            }
        }

        var itemsToProcess = new List<ChecklistItemSelectionDto>();
        if (request.ChecklistItems != null && request.ChecklistItems.Any())
        {
            itemsToProcess = request.ChecklistItems;
        }
        else if (request.ChecklistItemIds != null && request.ChecklistItemIds.Any())
        {
            itemsToProcess = request.ChecklistItemIds.Select(id => new ChecklistItemSelectionDto { Id = id }).ToList();
        }

        if (itemsToProcess.Any())
        {
            var checklistItemsIds = itemsToProcess.Select(x => x.Id).Distinct().ToList();
            var existingItems = await _db.ChecklistItems
                .Where(ci => checklistItemsIds.Contains(ci.Id))
                .Select(ci => ci.Id)
                .ToListAsync();

            var nonExistentItems = checklistItemsIds.Except(existingItems);
            if (nonExistentItems.Any())
            {
                throw new ArgumentException($"No se encontraron los siguientes items del checklist: {string.Join(", ", nonExistentItems)}");
            }
        }

        var imageFaultsToProcess = await ValidateImageFaultSelectionsAsync(request.ImageFaults);

        var hoy = DateTime.Today;
        var secuencia = await _db.ReportesFalla
            .Where(r => r.FechaReporte.Date == hoy)
            .CountAsync() + 1;

        var reporte = new ReporteFalla
        {
            Folio = FolioGenerator.GenerarFolioReporte(secuencia),
            VehiculoId = vehiculo.Id,
            CategoriaFallaId = request.CategoriaFallaId,
            ReportadoPorId = userId,
            Prioridad = request.Prioridad,
            TipoMantenimiento = string.IsNullOrWhiteSpace(request.TipoMantenimiento) ? "Correctivo" : request.TipoMantenimiento,
            Descripcion = request.Descripcion,
            Ubicacion = request.Ubicacion,
            PuedeOperar = request.PuedeOperar,
            FechaReporte = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        _db.ReportesFalla.Add(reporte);
        await _db.SaveChangesAsync();

        var checklistItemsToAdd = new List<ReporteFallaChecklistItem>();

        if (itemsToProcess.Any())
        {
            checklistItemsToAdd = itemsToProcess.Select(item => new ReporteFallaChecklistItem
            {
                ReporteFallaId = reporte.Id,
                ChecklistItemId = item.Id,
                FechaAsignacion = DateTime.UtcNow,
                Estado = "Pendiente",
                Cantidad = item.Cantidad
            }).ToList();
        }
        else
        {
            var asignacion = await _db.VehiculoChecklistAsignaciones
                .Include(a => a.ChecklistTemplate)
                .ThenInclude(t => t.Items.Where(i => i.Activo))
                .FirstOrDefaultAsync(a => a.VehiculoId == vehiculo.Id && a.Activo);

            if (asignacion != null && asignacion.ChecklistTemplate != null)
            {
                 checklistItemsToAdd = asignacion.ChecklistTemplate.Items
                    .Where(i => i.Activo)
                    .Select(item => new ReporteFallaChecklistItem
                    {
                        ReporteFallaId = reporte.Id,
                        ChecklistItemId = item.Id,
                        FechaAsignacion = DateTime.UtcNow,
                        Estado = "Pendiente"
                    })
                    .ToList();
            }
            else
            {
                var tipoMant = request.TipoMantenimiento ?? string.Empty;
                var tipoVehiculoEnum = vehiculo.Tipo;

                var template = await _db.ChecklistTemplates
                    .Include(t => t.Items.Where(i => i.Activo))
                    .Where(t =>
                        t.Activo &&
                        t.TipoVehiculo == tipoVehiculoEnum &&
                        (string.IsNullOrWhiteSpace(tipoMant) ? true : (t.TipoMantenimiento == null || t.TipoMantenimiento == tipoMant)))
                    .OrderByDescending(t => t.Id)
                    .FirstOrDefaultAsync();

                if (template != null)
                {
                    checklistItemsToAdd = template.Items
                        .Where(i => i.Activo)
                        .Select(item => new ReporteFallaChecklistItem
                        {
                            ReporteFallaId = reporte.Id,
                            ChecklistItemId = item.Id,
                            FechaAsignacion = DateTime.UtcNow,
                            Estado = "Pendiente"
                        })
                        .ToList();
                }
            }
        }

        if (checklistItemsToAdd.Any())
        {
            _db.ReportesFallaChecklistItems.AddRange(checklistItemsToAdd);
        }

        if (imageFaultsToProcess.Any())
        {
            var reportImageFaults = imageFaultsToProcess
                .Select(f => new ReportImageFault
                {
                    ReporteFallaId = reporte.Id,
                    ImageFaultId = f.ImageFaultId,
                    VehicleImagePointId = f.VehicleImagePointId,
                    CreatedAt = DateTime.UtcNow
                })
                .ToList();

            _db.ReportImageFaults.AddRange(reportImageFaults);
        }

        if (!request.PuedeOperar)
        {
            vehiculo.Estado = EstadoVehiculoEnum.FueraDeServicio;
        }

        await _db.SaveChangesAsync();
        return reporte;
    }

    public async Task<EvidenciaFotografica> AgregarEvidenciaAsync(int reporteId, string urlImagen, string? nombreArchivo, string? descripcion, string? tipoEvidencia, int userId)
    {
        var evidencia = new EvidenciaFotografica
        {
            ReporteFallaId = reporteId,
            UrlImagen = urlImagen,
            NombreArchivo = nombreArchivo,
            Descripcion = descripcion,
            TipoEvidencia = tipoEvidencia ?? "antes",
            FechaCaptura = DateTime.UtcNow,
            SubidoPorId = userId
        };

        _db.EvidenciasFotograficas.Add(evidencia);
        await _db.SaveChangesAsync();
        return evidencia;
    }

    public async Task<int> ContarReportesHoyAsync()
    {
        var hoy = DateTime.Today;
        return await _db.ReportesFalla
            .Where(r => r.FechaReporte.Date == hoy)
            .CountAsync();
    }

    public async Task<int> ContarReportesSinAtenderAsync()
    {
        return await _db.ReportesFalla
            .Where(r => !r.TieneOrdenTrabajo)
            .CountAsync();
    }

    private async Task<List<ReportImageFaultCreateDto>> ValidateImageFaultSelectionsAsync(List<ReportImageFaultCreateDto>? imageFaultSelections)
    {
        if (imageFaultSelections == null || imageFaultSelections.Count == 0)
        {
            return new List<ReportImageFaultCreateDto>();
        }

        if (imageFaultSelections.Any(f => f.ImageFaultId <= 0))
        {
            throw new ArgumentException("Cada falla visual debe incluir un ImageFaultId valido");
        }

        var distinctSelections = imageFaultSelections
            .GroupBy(f => new { f.ImageFaultId, f.VehicleImagePointId })
            .Select(g => g.First())
            .ToList();

        var imageFaultIds = distinctSelections
            .Select(f => f.ImageFaultId)
            .Distinct()
            .ToList();

        var existingImageFaultIds = await _db.ImageFaults
            .Where(f => imageFaultIds.Contains(f.Id))
            .Select(f => f.Id)
            .ToListAsync();

        var nonExistentImageFaults = imageFaultIds.Except(existingImageFaultIds).ToList();
        if (nonExistentImageFaults.Any())
        {
            throw new ArgumentException($"No se encontraron las siguientes fallas visuales: {string.Join(", ", nonExistentImageFaults)}");
        }

        var pointIds = distinctSelections
            .Where(f => f.VehicleImagePointId.HasValue)
            .Select(f => f.VehicleImagePointId!.Value)
            .Distinct()
            .ToList();

        if (pointIds.Count == 0)
        {
            return distinctSelections;
        }

        var points = await _db.VehicleImagePoints
            .Where(p => pointIds.Contains(p.Id))
            .Select(p => new
            {
                p.Id,
                p.ImageFaultId
            })
            .ToListAsync();

        var existingPointIds = points.Select(p => p.Id).ToList();
        var nonExistentPoints = pointIds.Except(existingPointIds).ToList();
        if (nonExistentPoints.Any())
        {
            throw new ArgumentException($"No se encontraron los siguientes puntos de imagen: {string.Join(", ", nonExistentPoints)}");
        }

        var pointFaultMap = points.ToDictionary(p => p.Id, p => p.ImageFaultId);
        foreach (var selection in distinctSelections.Where(f => f.VehicleImagePointId.HasValue))
        {
            var pointId = selection.VehicleImagePointId!.Value;
            if (pointFaultMap[pointId] != selection.ImageFaultId)
            {
                throw new ArgumentException($"El punto {pointId} no corresponde a la falla visual {selection.ImageFaultId}");
            }
        }

        return distinctSelections;
    }
}
