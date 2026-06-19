using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.DTOs;

namespace MantenimientoEquipos.Services;

public class OrdenTrabajoChecklistItemService
{
    private readonly MantenimientoDbContext _db;

    public OrdenTrabajoChecklistItemService(MantenimientoDbContext db)
    {
        _db = db;
    }

    /// <summary>
    /// Obtiene todos los ítems del checklist asignados a una orden de trabajo específica
    /// </summary>
    public async Task<List<OrdenTrabajoChecklistItemDto>> GetAllByOrdenTrabajoIdAsync(int ordenTrabajoId)
    {
        // 1. Obtener ítems estándar del checklist
        var items = await _db.OrdenesTrabajoChecklistItems
            .Include(x => x.ChecklistItem)
            .Where(x => x.OrdenTrabajoId == ordenTrabajoId)
            .Select(x => new OrdenTrabajoChecklistItemDto
            {
                Id = x.Id,
                OrdenTrabajoId = x.OrdenTrabajoId,
                ChecklistItemId = x.ChecklistItemId,
                ChecklistItemPregunta = x.ChecklistItem.Pregunta,
                FechaAsignacion = x.FechaAsignacion,
                FechaCompletado = x.FechaCompletado,
                Estado = x.Estado,
                Cantidad = x.Cantidad,
                Notas = x.Notas,
                FotoUrl = x.FotoUrl,
                Tipo = "Checklist",
                SolicitudActividadId = null
            })
            .ToListAsync();

        // 2. Obtener actividades adicionales aprobadas y agregarlas como ítems de checklist
        var actividadesAdicionales = await _db.SolicitudesActividadAdicional
            .Where(x => x.OrdenTrabajoId == ordenTrabajoId && x.Estado == "Aprobada")
            .Select(x => new OrdenTrabajoChecklistItemDto
            {
                Id = x.Id, // Usamos el ID de la solicitud, pero el frontend debe distinguir por Tipo
                OrdenTrabajoId = x.OrdenTrabajoId,
                ChecklistItemId = 0, // No tiene checklist item asociado
                ChecklistItemPregunta = "[ACTIVIDAD ADICIONAL] " + x.Descripcion,
                FechaAsignacion = x.FechaRespuesta ?? x.FechaSolicitud,
                FechaCompletado = x.FechaCompletado,
                Estado = x.FechaCompletado.HasValue ? "Completado" : "Pendiente", // Si tiene fecha completado, está completada
                Cantidad = null,
                Notas = x.NotasEjecucion ?? x.Justificacion, // Usar notas de ejecución si existen, si no la justificación
                FotoUrl = x.FotoEjecucionUrl ?? x.FotoUrl,
                Tipo = "ActividadAdicional",
                SolicitudActividadId = x.Id
            })
            .ToListAsync();

        items.AddRange(actividadesAdicionales);

        return items;
    }

    /// <summary>
    /// Crea una nueva asignación de ítem del checklist a una orden de trabajo
    /// </summary>
    public async Task<OrdenTrabajoChecklistItemDto?> CreateAsync(CreateOrdenTrabajoChecklistItemRequest request)
    {
        // Verificar que la orden de trabajo exista
        var ordenTrabajo = await _db.OrdenesTrabajo.FindAsync(request.OrdenTrabajoId);
        if (ordenTrabajo == null)
            return null;

        // Verificar que el ítem del checklist exista
        var checklistItem = await _db.ChecklistItems.FindAsync(request.ChecklistItemId);
        if (checklistItem == null)
            return null;

        // Verificar que no exista ya una asignación del mismo ítem a la misma orden
        var exists = await _db.OrdenesTrabajoChecklistItems
            .AnyAsync(x => x.OrdenTrabajoId == request.OrdenTrabajoId && 
                          x.ChecklistItemId == request.ChecklistItemId);
        if (exists)
            throw new ArgumentException($"El ítem del checklist con ID {request.ChecklistItemId} ya está asignado a la orden de trabajo {request.OrdenTrabajoId}");

        var entity = new OrdenTrabajoChecklistItem
        {
            OrdenTrabajoId = request.OrdenTrabajoId,
            ChecklistItemId = request.ChecklistItemId,
            FechaAsignacion = DateTime.UtcNow,
            Estado = "Pendiente",
            Cantidad = request.Cantidad,
            Notas = request.Notas
        };

        _db.OrdenesTrabajoChecklistItems.Add(entity);
        await _db.SaveChangesAsync();

        return new OrdenTrabajoChecklistItemDto
        {
            Id = entity.Id,
            OrdenTrabajoId = entity.OrdenTrabajoId,
            ChecklistItemId = entity.ChecklistItemId,
            ChecklistItemPregunta = checklistItem.Pregunta,
            FechaAsignacion = entity.FechaAsignacion,
            FechaCompletado = entity.FechaCompletado,
            Estado = entity.Estado,
            Cantidad = entity.Cantidad,
            Notas = entity.Notas,
            FotoUrl = entity.FotoUrl
        };
    }

    /// <summary>
    /// Actualiza el estado o notas de un ítem del checklist en una orden de trabajo
    /// </summary>
    public async Task<bool> UpdateAsync(int id, UpdateOrdenTrabajoChecklistItemRequest request)
    {
        if (request.Tipo == "ActividadAdicional")
        {
            // Actualizar actividad adicional
            var solicitud = await _db.SolicitudesActividadAdicional.FindAsync(id);
            if (solicitud == null)
                return false;

            // Mapear campos de actualización a campos de ejecución de la solicitud
            if (!string.IsNullOrEmpty(request.Notas))
                solicitud.NotasEjecucion = request.Notas;

            if (!string.IsNullOrEmpty(request.FotoUrl))
                solicitud.FotoEjecucionUrl = request.FotoUrl;

            // Manejo de estado
            if (request.Estado?.ToLower() == "completado")
            {
                if (!solicitud.FechaCompletado.HasValue)
                    solicitud.FechaCompletado = request.FechaCompletado ?? DateTime.UtcNow;
            }
            else if (request.Estado?.ToLower() == "pendiente" || request.Estado?.ToLower() == "enproceso")
            {
                // Si se regresa a pendiente/en proceso, limpiamos fecha completado
                solicitud.FechaCompletado = null;
            }
            
            // Nota: No cambiamos el 'Estado' principal de la solicitud ("Aprobada"), 
            // solo actualizamos los campos de ejecución.
            
            await _db.SaveChangesAsync();
            return true;
        }
        else
        {
            // Actualizar ítem estándar de checklist
            var item = await _db.OrdenesTrabajoChecklistItems.FindAsync(id);
            if (item == null)
                return false;

            if (!string.IsNullOrEmpty(request.Estado))
                item.Estado = request.Estado;

            if (!string.IsNullOrEmpty(request.Notas))
                item.Notas = request.Notas;

            if (request.Cantidad.HasValue)
                item.Cantidad = request.Cantidad.Value;

            if (request.FechaCompletado.HasValue)
                item.FechaCompletado = request.FechaCompletado.Value;

            if (!string.IsNullOrEmpty(request.FotoUrl))
                item.FotoUrl = request.FotoUrl;

            if (request.Estado?.ToLower() == "completado" && !item.FechaCompletado.HasValue)
                item.FechaCompletado = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            return true;
        }
    }

    /// <summary>
    /// Elimina una asignación de ítem del checklist a una orden de trabajo
    /// </summary>
    public async Task<bool> DeleteAsync(int id)
    {
        var item = await _db.OrdenesTrabajoChecklistItems.FindAsync(id);
        if (item == null)
            return false;

        _db.OrdenesTrabajoChecklistItems.Remove(item);
        await _db.SaveChangesAsync();
        return true;
    }

    /// <summary>
    /// Asigna múltiples ítems del checklist a una orden de trabajo
    /// </summary>
    public async Task<List<OrdenTrabajoChecklistItemDto>> AsignarMultiplesItemsAsync(AsignarChecklistItemsRequest request)
    {
        var resultado = new List<OrdenTrabajoChecklistItemDto>();

        // Verificar que la orden de trabajo exista
        var ordenTrabajo = await _db.OrdenesTrabajo.FindAsync(request.OrdenTrabajoId);
        if (ordenTrabajo == null)
            throw new ArgumentException($"Orden de trabajo con ID {request.OrdenTrabajoId} no encontrada");

        // Verificar que los ítems del checklist existan
        var checklistItemIds = request.ChecklistItemIds.Distinct().ToList();
        var checklistItems = await _db.ChecklistItems
            .Where(x => checklistItemIds.Contains(x.Id))
            .ToListAsync();

        if (checklistItems.Count != checklistItemIds.Count)
        {
            var idsExistentes = checklistItems.Select(x => x.Id).ToHashSet();
            var idsFaltantes = checklistItemIds.Except(idsExistentes).ToList();
            throw new ArgumentException($"Algunos ítems del checklist no existen: {string.Join(", ", idsFaltantes)}");
        }

        // Verificar que no existan duplicados en la asignación actual
        var itemsExistentes = await _db.OrdenesTrabajoChecklistItems
            .Where(x => x.OrdenTrabajoId == request.OrdenTrabajoId && 
                       checklistItemIds.Contains(x.ChecklistItemId))
            .ToListAsync();

        if (itemsExistentes.Any())
        {
            var idsExistentes = itemsExistentes.Select(x => x.ChecklistItemId).ToList();
            throw new ArgumentException($"Algunos ítems ya están asignados a esta orden: {string.Join(", ", idsExistentes)}");
        }

        // Crear las asignaciones
        foreach (var itemId in checklistItemIds)
        {
            var entity = new OrdenTrabajoChecklistItem
            {
                OrdenTrabajoId = request.OrdenTrabajoId,
                ChecklistItemId = itemId,
                FechaAsignacion = DateTime.UtcNow,
                Estado = "Pendiente",
                Notas = request.Notas
            };

            _db.OrdenesTrabajoChecklistItems.Add(entity);
            await _db.SaveChangesAsync();

            var checklistItem = checklistItems.First(x => x.Id == itemId);

            resultado.Add(new OrdenTrabajoChecklistItemDto
            {
                Id = entity.Id,
                OrdenTrabajoId = entity.OrdenTrabajoId,
                ChecklistItemId = entity.ChecklistItemId,
                ChecklistItemPregunta = checklistItem.Pregunta,
                FechaAsignacion = entity.FechaAsignacion,
                FechaCompletado = entity.FechaCompletado,
                Estado = entity.Estado,
                Notas = request.Notas,
                FotoUrl = entity.FotoUrl
            });
        }

        return resultado;
    }

    /// <summary>
    /// Obtiene los ítems del checklist más parecidos al nombre del vehículo
    /// </summary>
    public async Task<List<ChecklistItemDto>> GetChecklistItemsSimilaresPorVehiculoAsync(string nombreVehiculo)
    {
        // Buscar plantillas de checklist que coincidan con el tipo de vehículo o nombre
        var templates = await _db.ChecklistTemplates
            .Where(ct => ct.Activo &&
                        (EF.Functions.Like(ct.Nombre.ToLower(), $"%{nombreVehiculo.ToLower()}%") ||
                         EF.Functions.Like(ct.Nombre.ToLower(), $"%{GetTipoVehiculoSimilar(nombreVehiculo)}%")))
            .ToListAsync();

        if (!templates.Any())
        {
            // Si no encontramos por nombre, intentamos encontrar por tipo de vehículo genérico
            templates = await _db.ChecklistTemplates
                .Where(ct => ct.Activo &&
                            (ct.TipoVehiculo.HasValue &&
                             (nombreVehiculo.ToLower().Contains("carrito") && ct.TipoVehiculo == Models.Enums.TipoVehiculoEnum.Carrito ||
                              nombreVehiculo.ToLower().Contains("tugger") && ct.TipoVehiculo == Models.Enums.TipoVehiculoEnum.Tugger ||
                              nombreVehiculo.ToLower().Contains("montacargas") && ct.TipoVehiculo == Models.Enums.TipoVehiculoEnum.Montacargas ||
                              nombreVehiculo.ToLower().Contains("carropolvos") && ct.TipoVehiculo == Models.Enums.TipoVehiculoEnum.CarroDePolvos ||
                              nombreVehiculo.ToLower().Contains("carrolibro") && ct.TipoVehiculo == Models.Enums.TipoVehiculoEnum.CarroLibro ||
                              nombreVehiculo.ToLower().Contains("cassette") && ct.TipoVehiculo == Models.Enums.TipoVehiculoEnum.CassetteDeCojin ||
                              nombreVehiculo.ToLower().Contains("tambo") && ct.TipoVehiculo == Models.Enums.TipoVehiculoEnum.Tambo ||
                              nombreVehiculo.ToLower().Contains("pinrack") && ct.TipoVehiculo == Models.Enums.TipoVehiculoEnum.PinRack ||
                              nombreVehiculo.ToLower().Contains("conti") && ct.TipoVehiculo == Models.Enums.TipoVehiculoEnum.Conti ||
                              nombreVehiculo.ToLower().Contains("jaula") && ct.TipoVehiculo == Models.Enums.TipoVehiculoEnum.JaulaDeCuarentena ||
                              nombreVehiculo.ToLower().Contains("flat") && ct.TipoVehiculo == Models.Enums.TipoVehiculoEnum.FlatStorage ||
                              nombreVehiculo.ToLower().Contains("circulo") && ct.TipoVehiculo == Models.Enums.TipoVehiculoEnum.Circulo)))
                .ToListAsync();
        }

        if (!templates.Any())
        {
            // Si no encontramos por tipo específico, buscamos plantillas genéricas
            templates = await _db.ChecklistTemplates
                .Where(ct => ct.Activo && ct.TipoVehiculo == null)
                .ToListAsync();
        }

        if (!templates.Any())
        {
            // Si no hay plantillas genéricas, tomamos la primera disponible
            templates = await _db.ChecklistTemplates
                .Where(ct => ct.Activo)
                .Take(1)
                .ToListAsync();
        }

        var items = new List<ChecklistItemDto>();

        foreach (var template in templates)
        {
            var templateItems = await _db.ChecklistItems
                .Where(ci => ci.ChecklistTemplateId == template.Id && ci.Activo)
                .OrderBy(ci => ci.Orden)
                .Select(ci => new ChecklistItemDto
                {
                    Id = ci.Id,
                    ChecklistTemplateId = ci.ChecklistTemplateId,
                    Orden = ci.Orden,
                    Pregunta = ci.Pregunta,
                    TipoRespuesta = ci.TipoRespuesta,
                    TipoRespuestaNombre = ci.TipoRespuesta.ToString(),
                    Opciones = ci.Opciones,
                    Obligatorio = ci.Obligatorio,
                    RequiereFoto = ci.RequiereFoto,
                    CostoEstimado = ci.CostoEstimado
                })
                .ToListAsync();

            items.AddRange(templateItems);
        }

        return items;
    }

    /// <summary>
    /// Método auxiliar para encontrar un tipo de vehículo similar basado en el nombre
    /// </summary>
    private string GetTipoVehiculoSimilar(string nombreVehiculo)
    {
        var lowerNombre = nombreVehiculo.ToLower();
        if (lowerNombre.Contains("carrito") || lowerNombre.Contains("cart"))
            return "Carrito";
        if (lowerNombre.Contains("tugger") || lowerNombre.Contains("tugg"))
            return "Tugger";
        if (lowerNombre.Contains("montacargas") || lowerNombre.Contains("forlift"))
            return "Montacargas";
        if (lowerNombre.Contains("polvos") || lowerNombre.Contains("powder"))
            return "CarroDePolvos";
        if (lowerNombre.Contains("libro") || lowerNombre.Contains("book"))
            return "CarroLibro";
        if (lowerNombre.Contains("cassette"))
            return "Cassette";
        if (lowerNombre.Contains("tambo"))
            return "Tambo";
        if (lowerNombre.Contains("pin") || lowerNombre.Contains("rack"))
            return "PinRack";
        if (lowerNombre.Contains("conti"))
            return "Conti";
        if (lowerNombre.Contains("jaula") || lowerNombre.Contains("cuarentena"))
            return "JaulaDeCuarentena";
        if (lowerNombre.Contains("flat"))
            return "FlatStorage";
        if (lowerNombre.Contains("circulo"))
            return "Circulo";
        
        return "";
    }
}
