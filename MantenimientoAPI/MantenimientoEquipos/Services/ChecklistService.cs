using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Utils;

namespace MantenimientoEquipos.Services;

public class ChecklistService
{
    private readonly MantenimientoDbContext _db;
    private readonly EliminacionService _eliminacion;

    public ChecklistService(MantenimientoDbContext db, EliminacionService eliminacion)
    {
        _db = db;
        _eliminacion = eliminacion;
    }

    // ===== TEMPLATES =====
    // Requerimiento 12.3: un checklist por tipo de vehículo, que usan automáticamente todos los
    // vehículos de ese tipo (ya no hay asignación por vehículo). El nombre es el del tipo en el
    // catálogo. Si por datos anteriores un tipo tiene más de uno, se usa el más reciente ("vigente").

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

        var templates = await query.ToListAsync();
        var nombres = await NombresTipoAsync();
        var vigentes = await IdsVigentesAsync();

        return templates
            .Select(t => ToDto(t, nombres, vigentes))
            .OrderBy(t => t.TipoVehiculo.HasValue ? 0 : 1)
            .ThenBy(t => t.Nombre)
            .ToList();
    }

    public async Task<ChecklistTemplateDto?> GetTemplateByIdAsync(int id)
    {
        var template = await _db.ChecklistTemplates
            .Include(t => t.Items.Where(i => i.Activo).OrderBy(i => i.Orden))
            .FirstOrDefaultAsync(t => t.Id == id);
        if (template == null) return null;

        return ToDto(template, await NombresTipoAsync(), await IdsVigentesAsync());
    }

    /// <summary>Checklist que usan los vehículos del tipo indicado (null si el tipo no tiene)</summary>
    public async Task<ChecklistTemplateDto?> GetVigentePorTipoAsync(int tipoId)
    {
        var tipo = (TipoVehiculoEnum)tipoId;
        var template = await _db.ChecklistTemplates
            .Include(t => t.Items.Where(i => i.Activo).OrderBy(i => i.Orden))
            .Where(t => t.Activo && t.TipoVehiculo == tipo)
            .OrderByDescending(t => t.UpdatedAt ?? t.CreatedAt)
            .ThenByDescending(t => t.Id)
            .FirstOrDefaultAsync();
        if (template == null) return null;

        return ToDto(template, await NombresTipoAsync(), new HashSet<int> { template.Id });
    }

    /// <summary>Checklist del tipo del vehículo indicado (null si no existe o su tipo no tiene)</summary>
    public async Task<ChecklistTemplateDto?> GetVigentePorVehiculoAsync(int vehiculoId)
    {
        var tipo = await _db.Vehiculos
            .Where(v => v.Id == vehiculoId)
            .Select(v => (TipoVehiculoEnum?)v.Tipo)
            .FirstOrDefaultAsync();
        return tipo.HasValue ? await GetVigentePorTipoAsync((int)tipo.Value) : null;
    }

    public async Task<ChecklistTemplate> CreateTemplateAsync(ChecklistTemplateCreateRequest request, int userId)
    {
        var nombreTipo = await ValidarAsync(request, plantillaActual: null);

        var template = new ChecklistTemplate
        {
            Nombre = Recortar(nombreTipo, 100),
            TipoVehiculo = request.TipoVehiculo,
            Activo = true,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = userId
        };

        var orden = 1;
        foreach (var itemReq in ItemsValidos(request))
        {
            template.Items.Add(new ChecklistItem
            {
                Orden = orden++,
                Pregunta = itemReq.Pregunta.Trim(),
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
            .FirstOrDefaultAsync(t => t.Id == id && t.Activo);

        if (template == null) return null;

        var nombreTipo = await ValidarAsync(request, template);

        template.Nombre = Recortar(nombreTipo, 100);
        template.TipoVehiculo = request.TipoVehiculo;
        // Campos que ya no se capturan (12.3.1)
        template.Descripcion = null;
        template.TipoMantenimiento = null;
        template.UpdatedAt = DateTime.UtcNow;

        // Upsert de items evitando romper FK de respuestas existentes
        var existingItems = template.Items.ToList();
        var incomingIds = new HashSet<int>();
        var orden = 1;

        // Actualizar o agregar
        foreach (var itemReq in ItemsValidos(request))
        {
            ChecklistItem? target = null;
            if (itemReq.Id.HasValue)
            {
                target = existingItems.FirstOrDefault(i => i.Id == itemReq.Id.Value);
                if (target != null) incomingIds.Add(target.Id);
            }

            if (target != null)
            {
                target.Orden = orden++;
                target.Pregunta = itemReq.Pregunta.Trim();
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
                    Orden = orden++,
                    Pregunta = itemReq.Pregunta.Trim(),
                    TipoRespuesta = itemReq.TipoRespuesta,
                    Opciones = itemReq.Opciones,
                    Obligatorio = itemReq.Obligatorio,
                    RequiereFoto = itemReq.RequiereFoto,
                    CostoEstimado = itemReq.CostoEstimado ?? 0,
                    Activo = true
                });
            }
        }

        // Los que ya no vienen: se borran, salvo que ya se usaron en reportes, órdenes o
        // respuestas (llaves NO ACTION); esos solo se ocultan para conservar el historial
        var quitados = existingItems.Where(i => !incomingIds.Contains(i.Id)).Select(i => i.Id).ToList();
        var usados = await ItemsUsadosAsync(quitados);
        foreach (var item in existingItems.Where(i => quitados.Contains(i.Id)))
        {
            if (usados.Contains(item.Id)) item.Activo = false;
            else _db.ChecklistItems.Remove(item);
        }

        await _db.SaveChangesAsync();
        return template;
    }

    /// <summary>
    /// Elimina el checklist. Si sus trabajos ya se usaron en reportes u órdenes, se retira
    /// (deja de mostrarse y de usarse) pero se conserva para que ese historial no se pierda.
    /// </summary>
    public async Task<ChecklistEliminadoDto?> EliminarTemplateAsync(int id, int? usuarioId, string? nombreUsuario)
    {
        var template = await _db.ChecklistTemplates
            .Include(t => t.Items)
            .FirstOrDefaultAsync(t => t.Id == id && t.Activo);
        if (template == null) return null;

        var nombre = ToDto(template, await NombresTipoAsync(), new HashSet<int>()).Nombre;
        var trabajos = template.Items.Count(i => i.Activo);
        var usados = await ItemsUsadosAsync(template.Items.Select(i => i.Id).ToList());

        using var tx = await _db.Database.BeginTransactionAsync();
        await _db.VehiculoChecklistAsignaciones.Where(a => a.ChecklistTemplateId == id).ExecuteDeleteAsync();
        if (usados.Count > 0)
        {
            template.Activo = false;
            template.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _db.ChecklistItems.RemoveRange(template.Items);
            _db.ChecklistTemplates.Remove(template);
        }
        _eliminacion.Registrar(usuarioId, nombreUsuario, "ChecklistTemplate", id,
            $"Checklist {nombre} ({trabajos} ítem(s))" + (usados.Count > 0 ? "; retirado, se conserva en el historial" : ""));
        await _db.SaveChangesAsync();
        await tx.CommitAsync();

        return new ChecklistEliminadoDto { Nombre = nombre, ConservadoEnHistorial = usados.Count > 0 };
    }

    /// <summary>Valida tipo, trabajos y que el tipo no tenga ya otro checklist. Devuelve el nombre del tipo.</summary>
    private async Task<string> ValidarAsync(ChecklistTemplateCreateRequest request, ChecklistTemplate? plantillaActual)
    {
        if (!request.TipoVehiculo.HasValue)
            throw new ArgumentException("Selecciona el tipo de vehículo.");

        var tipoId = (int)request.TipoVehiculo.Value;
        var nombreTipo = await _db.TiposVehiculo.Where(t => t.Id == tipoId).Select(t => t.Nombre).FirstOrDefaultAsync()
            ?? throw new ArgumentException("El tipo de vehículo seleccionado no existe.");

        var items = ItemsValidos(request);
        if (items.Count == 0)
            throw new ArgumentException("Agrega al menos un ítem al checklist.");

        var repetido = items.GroupBy(i => i.Pregunta.Trim().ToLowerInvariant()).FirstOrDefault(g => g.Count() > 1);
        if (repetido != null)
            throw new ArgumentException($"El ítem \"{repetido.First().Pregunta.Trim()}\" está repetido.");

        // Al editar sin cambiar de tipo no se revisa: así se pueden corregir tipos que traían duplicados
        var cambiaDeTipo = plantillaActual == null || plantillaActual.TipoVehiculo != request.TipoVehiculo;
        if (cambiaDeTipo && await _db.ChecklistTemplates.AnyAsync(t => t.Activo && t.TipoVehiculo == request.TipoVehiculo))
            throw new InvalidOperationException($"Ya existe el checklist de {nombreTipo}. Edítalo para agregar o quitar ítems.");

        return nombreTipo;
    }

    private static List<ChecklistItemCreateRequest> ItemsValidos(ChecklistTemplateCreateRequest request) =>
        request.Items.Where(i => !string.IsNullOrWhiteSpace(i.Pregunta)).ToList();

    private async Task<HashSet<int>> ItemsUsadosAsync(List<int> itemIds)
    {
        if (itemIds.Count == 0) return new HashSet<int>();
        var usados = await _db.ReportesFallaChecklistItems.Where(x => itemIds.Contains(x.ChecklistItemId)).Select(x => x.ChecklistItemId)
            .Union(_db.OrdenesTrabajoChecklistItems.Where(x => itemIds.Contains(x.ChecklistItemId)).Select(x => x.ChecklistItemId))
            .Union(_db.ChecklistRespuestas.Where(x => itemIds.Contains(x.ChecklistItemId)).Select(x => x.ChecklistItemId))
            .ToListAsync();
        return usados.ToHashSet();
    }

    private async Task<Dictionary<int, string>> NombresTipoAsync() =>
        await _db.TiposVehiculo.ToDictionaryAsync(t => t.Id, t => t.Nombre);

    /// <summary>Id del checklist que usa cada tipo: el más reciente si hay varios</summary>
    private async Task<HashSet<int>> IdsVigentesAsync()
    {
        var activos = await _db.ChecklistTemplates
            .Where(t => t.Activo && t.TipoVehiculo != null)
            .Select(t => new { t.Id, t.TipoVehiculo, Fecha = t.UpdatedAt ?? t.CreatedAt })
            .ToListAsync();
        return activos
            .GroupBy(t => t.TipoVehiculo)
            .Select(g => g.OrderByDescending(t => t.Fecha).ThenByDescending(t => t.Id).First().Id)
            .ToHashSet();
    }

    private static string Recortar(string texto, int max) => texto.Length > max ? texto[..max] : texto;

    private static ChecklistTemplateDto ToDto(ChecklistTemplate t, Dictionary<int, string> nombresTipo, HashSet<int> vigentes)
    {
        string? nombreTipo = null;
        if (t.TipoVehiculo.HasValue)
            nombreTipo = nombresTipo.TryGetValue((int)t.TipoVehiculo.Value, out var n) ? n : t.TipoVehiculo.Value.ToString();

        return new ChecklistTemplateDto
        {
            Id = t.Id,
            // El nombre es el del tipo (si se renombra el tipo, el checklist lo sigue)
            Nombre = nombreTipo ?? t.Nombre,
            Descripcion = t.Descripcion,
            TipoVehiculo = t.TipoVehiculo,
            TipoVehiculoNombre = nombreTipo,
            TipoMantenimiento = t.TipoMantenimiento,
            Activo = t.Activo,
            Vigente = vigentes.Contains(t.Id),
            Items = t.Items.Where(i => i.Activo).OrderBy(i => i.Orden).Select(i => new ChecklistItemDto
            {
                Id = i.Id,
                ChecklistTemplateId = t.Id,
                Orden = i.Orden,
                Pregunta = i.Pregunta,
                TipoRespuesta = i.TipoRespuesta,
                TipoRespuestaNombre = i.TipoRespuesta.ToString(),
                Opciones = i.Opciones,
                Obligatorio = i.Obligatorio,
                RequiereFoto = i.RequiereFoto,
                CostoEstimado = i.CostoEstimado
            }).ToList()
        };
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

        if (orden?.Vehiculo != null && orden.FechaAceptacion != null &&
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
        var folio = await FolioGenerator.SiguienteAsync(_db.OrdenesTrabajo.Select(o => o.Folio), "INS", "yyMMdd", 3);

        var orden = new OrdenTrabajo
        {
            Folio = folio,
            VehiculoId = vehiculoId,
            TecnicoAsignadoId = userId,
            CreadoPorId = userId,
            // Una inspección rápida no es una reparación: queda cerrada para no entrar a las filas de la
            // Zona de Transición ni contar como orden activa del vehículo (flujo de 7 etapas)
            Estado = EstadoOrdenTrabajoEnum.Validada,
            Prioridad = PrioridadEnum.PuedeCircular,
            TipoMantenimiento = "Inspección",
            Descripcion = "Checklist de inspección rápida",
            FechaCreacion = DateTime.UtcNow,
            FechaAsignacion = DateTime.UtcNow,
            FechaInicio = DateTime.UtcNow,
            FechaFinalizacion = DateTime.UtcNow,
            FechaValidacion = DateTime.UtcNow,
            ValidadoPorId = userId,
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
