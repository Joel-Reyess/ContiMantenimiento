using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;

namespace MantenimientoEquipos.Services;

public class ChecklistService
{
    private readonly MantenimientoDbContext _db;

    public ChecklistService(MantenimientoDbContext db)
    {
        _db = db;
    }

    // ===== TEMPLATES =====

    public async Task<List<ChecklistTemplateDto>> GetAllTemplatesAsync(TipoVehiculoEnum? tipoVehiculo = null, string? tipoMantenimiento = null)
    {
        var query = _db.ChecklistTemplates
            .Include(t => t.Items.Where(i => i.Activo).OrderBy(i => i.Orden))
            .Where(t => t.Activo)
            .AsQueryable();

        if (tipoVehiculo.HasValue)
            query = query.Where(t => t.TipoVehiculo == tipoVehiculo);

        if (!string.IsNullOrEmpty(tipoMantenimiento))
            query = query.Where(t => t.TipoMantenimiento == tipoMantenimiento);

        return await query
            .OrderBy(t => t.Nombre)
            .Select(t => new ChecklistTemplateDto
            {
                Id = t.Id,
                Nombre = t.Nombre,
                Descripcion = t.Descripcion,
                TipoVehiculo = t.TipoVehiculo,
                TipoVehiculoNombre = t.TipoVehiculo.HasValue ? t.TipoVehiculo.Value.ToString() : "Todos",
                TipoMantenimiento = t.TipoMantenimiento,
                Activo = t.Activo,
                Items = t.Items.Select(i => new ChecklistItemDto
                {
                    Id = i.Id,
                    Orden = i.Orden,
                    Pregunta = i.Pregunta,
                    TipoRespuesta = i.TipoRespuesta,
                    TipoRespuestaNombre = i.TipoRespuesta.ToString(),
                    Opciones = i.Opciones,
                    Obligatorio = i.Obligatorio,
                    RequiereFoto = i.RequiereFoto,
                    CostoEstimado = i.CostoEstimado
                }).ToList()
            }).ToListAsync();
    }

    public async Task<ChecklistTemplateDto?> GetTemplateByIdAsync(int id)
    {
        return await _db.ChecklistTemplates
            .Include(t => t.Items.Where(i => i.Activo).OrderBy(i => i.Orden))
            .Where(t => t.Id == id)
            .Select(t => new ChecklistTemplateDto
            {
                Id = t.Id,
                Nombre = t.Nombre,
                Descripcion = t.Descripcion,
                TipoVehiculo = t.TipoVehiculo,
                TipoVehiculoNombre = t.TipoVehiculo.HasValue ? t.TipoVehiculo.Value.ToString() : "Todos",
                TipoMantenimiento = t.TipoMantenimiento,
                Activo = t.Activo,
                Items = t.Items.Select(i => new ChecklistItemDto
                {
                    Id = i.Id,
                    Orden = i.Orden,
                    Pregunta = i.Pregunta,
                    TipoRespuesta = i.TipoRespuesta,
                    TipoRespuestaNombre = i.TipoRespuesta.ToString(),
                Opciones = i.Opciones,
                Obligatorio = i.Obligatorio,
                RequiereFoto = i.RequiereFoto,
                CostoEstimado = i.CostoEstimado
            }).ToList()
        }).FirstOrDefaultAsync();
    }

    public async Task<ChecklistTemplate> CreateTemplateAsync(ChecklistTemplateCreateRequest request, int userId)
    {
        var template = new ChecklistTemplate
        {
            Nombre = request.Nombre,
            Descripcion = request.Descripcion,
            TipoVehiculo = request.TipoVehiculo,
            TipoMantenimiento = request.TipoMantenimiento,
            Activo = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId
        };

        foreach (var itemReq in request.Items)
        {
            template.Items.Add(new ChecklistItem
            {
                Orden = itemReq.Orden,
                Pregunta = itemReq.Pregunta,
                TipoRespuesta = itemReq.TipoRespuesta,
                Opciones = itemReq.Opciones,
                Obligatorio = itemReq.Obligatorio,
                RequiereFoto = itemReq.RequiereFoto,
                CostoEstimado = itemReq.CostoEstimado ?? 0,
                Activo = true
            });
        }

        _db.ChecklistTemplates.Add(template);
        await _db.SaveChangesAsync();

        return template;
    }

    public async Task<ChecklistTemplate?> UpdateTemplateAsync(int id, ChecklistTemplateUpdateRequest request, int userId)
    {
        var template = await _db.ChecklistTemplates
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (template == null) return null;

        template.Nombre = request.Nombre;
        template.Descripcion = request.Descripcion;
        template.TipoVehiculo = request.TipoVehiculo;
        template.TipoMantenimiento = request.TipoMantenimiento;
        template.UpdatedAt = DateTime.UtcNow;

        // Upsert de items evitando romper FK de respuestas existentes
        var existingItems = template.Items.ToList();
        var incomingIds = new HashSet<int>();

        // Actualizar o agregar
        foreach (var itemReq in request.Items)
        {
            ChecklistItem? target = null;
            if (itemReq.Id.HasValue)
            {
                target = existingItems.FirstOrDefault(i => i.Id == itemReq.Id.Value);
                if (target != null) incomingIds.Add(target.Id);
            }

            if (target != null)
            {
                target.Orden = itemReq.Orden;
                target.Pregunta = itemReq.Pregunta;
                target.TipoRespuesta = itemReq.TipoRespuesta;
                target.Opciones = itemReq.Opciones;
                target.Obligatorio = itemReq.Obligatorio;
                target.RequiereFoto = itemReq.RequiereFoto;
                target.CostoEstimado = itemReq.CostoEstimado ?? 0;
                target.Activo = true;
            }
            else
            {
                template.Items.Add(new ChecklistItem
                {
                    Orden = itemReq.Orden,
                    Pregunta = itemReq.Pregunta,
                    TipoRespuesta = itemReq.TipoRespuesta,
                    Opciones = itemReq.Opciones,
                    Obligatorio = itemReq.Obligatorio,
                    RequiereFoto = itemReq.RequiereFoto,
                    CostoEstimado = itemReq.CostoEstimado ?? 0,
                    Activo = true
                });
            }
        }

        // Desactivar o eliminar los que ya no vienen
        foreach (var item in existingItems)
        {
            if (incomingIds.Contains(item.Id)) continue;

            var tieneRespuestas = await _db.ChecklistRespuestas.AnyAsync(r => r.ChecklistItemId == item.Id);
            if (tieneRespuestas)
            {
                item.Activo = false;
            }
            else
            {
                _db.ChecklistItems.Remove(item);
            }
        }

        await _db.SaveChangesAsync();
        return template;
    }

    // ===== RESPUESTAS =====

    public async Task<List<ChecklistRespuestaDto>> GetRespuestasByOrdenAsync(int ordenTrabajoId)
    {
        return await _db.ChecklistRespuestas
            .Include(r => r.ChecklistItem)
            .Where(r => r.OrdenTrabajoId == ordenTrabajoId)
            .OrderBy(r => r.ChecklistItem.Orden)
            .Select(r => new ChecklistRespuestaDto
            {
                Id = r.Id,
                ChecklistItemId = r.ChecklistItemId,
                Pregunta = r.ChecklistItem.Pregunta,
                Valor = r.Valor,
                FotoUrl = r.FotoUrl,
                Notas = r.Notas,
                Cantidad = r.Cantidad,
                FechaRespuesta = r.FechaRespuesta
            }).ToListAsync();
    }

    public async Task<bool> GuardarRespuestasAsync(GuardarRespuestasChecklistRequest request, int userId)
    {
        // Eliminar respuestas existentes para esta orden
        var respuestasExistentes = await _db.ChecklistRespuestas
            .Where(r => r.OrdenTrabajoId == request.OrdenTrabajoId)
            .ToListAsync();

        _db.ChecklistRespuestas.RemoveRange(respuestasExistentes);

        // Agregar nuevas respuestas
        foreach (var resp in request.Respuestas)
        {
            _db.ChecklistRespuestas.Add(new ChecklistRespuesta
            {
                OrdenTrabajoId = request.OrdenTrabajoId,
                ChecklistItemId = resp.ChecklistItemId,
                Valor = resp.Valor,
                FotoUrl = resp.FotoUrl,
                Notas = resp.Notas,
                Cantidad = resp.Cantidad ?? 1,
                FechaRespuesta = DateTime.UtcNow,
                RespondidoPorId = userId
            });
        }

        // Sincronizacion defensiva de ubicacion:
        // si una orden activa recibe respuestas de checklist, debe estar en Taller.
        var orden = await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .FirstOrDefaultAsync(o => o.Id == request.OrdenTrabajoId);

        if (orden?.Vehiculo != null &&
            (orden.Estado == EstadoOrdenTrabajoEnum.Asignada ||
             orden.Estado == EstadoOrdenTrabajoEnum.EnProceso ||
             orden.Estado == EstadoOrdenTrabajoEnum.EsperandoRefacciones))
        {
            if (orden.Vehiculo.Ubicacion != UbicacionVehiculoEnum.Taller)
            {
                orden.Vehiculo.Ubicacion = UbicacionVehiculoEnum.Taller;
                orden.Vehiculo.Estado = EstadoVehiculoEnum.EnReparacion;
                orden.Vehiculo.UpdatedAt = DateTime.UtcNow;
                orden.UpdatedAt = DateTime.UtcNow;
            }
        }

        await _db.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Crea un checklist de inspección rápida para un vehículo (sin orden de trabajo)
    /// </summary>
    public async Task<int> CrearInspeccionRapidaAsync(int vehiculoId, int checklistTemplateId, List<RespuestaItemRequest> respuestas, int userId)
    {
        // Obtener vehículo
        var vehiculo = await _db.Vehiculos.FindAsync(vehiculoId);
        if (vehiculo == null)
            throw new ArgumentException("Vehículo no encontrado");

        // Crear una orden de trabajo de tipo inspección
        var hoy = DateTime.Today;
        var secuencia = await _db.OrdenesTrabajo
            .Where(o => o.FechaCreacion.Date == hoy)
            .CountAsync() + 1;

        var orden = new OrdenTrabajo
        {
            Folio = $"INS-{hoy:yyMMdd}-{secuencia:D3}",
            VehiculoId = vehiculoId,
            TecnicoAsignadoId = userId,
            CreadoPorId = userId,
            Estado = EstadoOrdenTrabajoEnum.Completada,
            Prioridad = PrioridadEnum.PuedeCircular,
            TipoMantenimiento = "Inspección",
            Descripcion = "Checklist de inspección rápida",
            FechaCreacion = DateTime.UtcNow,
            FechaAsignacion = DateTime.UtcNow,
            FechaInicio = DateTime.UtcNow,
            FechaFinalizacion = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        _db.OrdenesTrabajo.Add(orden);
        await _db.SaveChangesAsync();

        // Guardar respuestas
        foreach (var resp in respuestas)
        {
            _db.ChecklistRespuestas.Add(new ChecklistRespuesta
            {
                OrdenTrabajoId = orden.Id,
                ChecklistItemId = resp.ChecklistItemId,
                Valor = resp.Valor,
                FotoUrl = resp.FotoUrl,
                Notas = resp.Notas,
                FechaRespuesta = DateTime.UtcNow,
                RespondidoPorId = userId
            });
        }

        // Actualizar último mantenimiento del vehículo
        vehiculo.UltimoMantenimiento = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return orden.Id;
    }

    // ===== ASIGNACIONES POR VEHICULO =====

    public async Task<List<ChecklistAsignacionDto>> GetAsignacionesAsync(int? vehiculoId = null)
    {
        var query = _db.VehiculoChecklistAsignaciones
            .Include(a => a.Vehiculo)
            .Include(a => a.ChecklistTemplate)
            .Include(a => a.AsignadoPor)
            .AsQueryable();

        if (vehiculoId.HasValue)
            query = query.Where(a => a.VehiculoId == vehiculoId.Value);

        return await query
            .Select(a => new ChecklistAsignacionDto
            {
                Id = a.Id,
                VehiculoId = a.VehiculoId,
                VehiculoCodigo = a.Vehiculo.Codigo,
                ChecklistTemplateId = a.ChecklistTemplateId,
                ChecklistNombre = a.ChecklistTemplate.Nombre,
                FechaAsignacion = a.FechaAsignacion,
                AsignadoPorId = a.AsignadoPorId,
                AsignadoPorNombre = a.AsignadoPor != null ? a.AsignadoPor.NombreCompleto : null
            }).ToListAsync();
    }

    public async Task<ChecklistAsignacionDto?> AsignarChecklistVehiculoAsync(int vehiculoId, int? checklistTemplateId, int userId)
    {
        var vehiculo = await _db.Vehiculos.FindAsync(vehiculoId);
        if (vehiculo == null) throw new ArgumentException("VehA-culo no encontrado");

        var asignacion = await _db.VehiculoChecklistAsignaciones.FirstOrDefaultAsync(a => a.VehiculoId == vehiculoId);

        if (!checklistTemplateId.HasValue)
        {
            if (asignacion != null)
            {
                _db.VehiculoChecklistAsignaciones.Remove(asignacion);
                await _db.SaveChangesAsync();
            }
            return null;
        }

        var checklist = await _db.ChecklistTemplates.FindAsync(checklistTemplateId.Value);
        if (checklist == null) throw new ArgumentException("Checklist no encontrado");

        if (asignacion == null)
        {
            asignacion = new VehiculoChecklistAsignacion
            {
                VehiculoId = vehiculoId,
                ChecklistTemplateId = checklistTemplateId.Value,
                AsignadoPorId = userId,
                FechaAsignacion = DateTime.UtcNow,
                Activo = true
            };
            _db.VehiculoChecklistAsignaciones.Add(asignacion);
        }
        else
        {
            asignacion.ChecklistTemplateId = checklistTemplateId.Value;
            asignacion.AsignadoPorId = userId;
            asignacion.FechaAsignacion = DateTime.UtcNow;
            asignacion.Activo = true;
            _db.VehiculoChecklistAsignaciones.Update(asignacion);
        }

        await _db.SaveChangesAsync();

        return new ChecklistAsignacionDto
        {
            Id = asignacion.Id,
            VehiculoId = asignacion.VehiculoId,
            VehiculoCodigo = vehiculo.Codigo,
            ChecklistTemplateId = asignacion.ChecklistTemplateId,
            ChecklistNombre = checklist.Nombre,
            FechaAsignacion = asignacion.FechaAsignacion,
            AsignadoPorId = asignacion.AsignadoPorId,
            AsignadoPorNombre = null
        };
    }
}
