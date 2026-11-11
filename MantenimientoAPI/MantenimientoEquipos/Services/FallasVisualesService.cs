using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Services;

/// <summary>
/// FV-03 (documento del 11-nov): las fallas visuales son las actividades del checklist ubicadas en la foto del tipo
/// de vehículo. Las actividades se capturan una sola vez en Checklists; aquí solo se ligan a los puntos.
/// Cada actividad usada en la foto tiene una falla interna (ImageFaults.ChecklistItemId) que guarda su nombre para
/// el historial de los reportes; ya no se capturan fallas a mano.
/// </summary>
public class FallasVisualesService
{
    private readonly MantenimientoDbContext _db;

    public FallasVisualesService(MantenimientoDbContext db)
    {
        _db = db;
    }

    /// <summary>"tipo_7" → 7; otras claves (anteriores) no tienen tipo</summary>
    public static int? TipoDeImageKey(string? imageKey)
    {
        if (string.IsNullOrWhiteSpace(imageKey)) return null;
        var key = imageKey.Trim();
        return key.StartsWith("tipo_", StringComparison.OrdinalIgnoreCase) && int.TryParse(key[5..], out var id) ? id : null;
    }

    /// <summary>Checklist que usan los vehículos de cada tipo: el más reciente si un tipo trae varios</summary>
    private async Task<Dictionary<int, int>> TemplatesVigentesAsync(IEnumerable<int>? tipos = null)
    {
        var query = _db.ChecklistTemplates.AsNoTracking().Where(t => t.Activo && t.TipoVehiculo != null);
        if (tipos != null)
        {
            var lista = tipos.Select(t => (TipoVehiculoEnum)t).Distinct().ToList();
            query = query.Where(t => lista.Contains(t.TipoVehiculo!.Value));
        }
        var activos = await query.Select(t => new { t.Id, t.TipoVehiculo, Fecha = t.UpdatedAt ?? t.CreatedAt }).ToListAsync();
        return activos
            .GroupBy(t => (int)t.TipoVehiculo!.Value)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(t => t.Fecha).ThenByDescending(t => t.Id).First().Id);
    }

    /// <summary>
    /// Actividad que se puede ubicar en la foto indicada: activa y del checklist vigente del tipo de la imagen.
    /// Lanza ArgumentException con un mensaje para el usuario si no.
    /// </summary>
    public async Task<ChecklistItem> ValidarActividadAsync(int? checklistItemId, string imageKey)
    {
        if (checklistItemId is not > 0)
            throw new ArgumentException("Elige la actividad del checklist que vas a ubicar en la foto.");

        var item = await _db.ChecklistItems
            .Include(i => i.ChecklistTemplate)
            .FirstOrDefaultAsync(i => i.Id == checklistItemId.Value);
        if (item == null || !item.Activo || !item.ChecklistTemplate.Activo)
            throw new ArgumentException("La actividad elegida ya no está en el checklist; actualiza la pantalla.");

        var tipo = TipoDeImageKey(imageKey);
        if (tipo.HasValue)
        {
            var vigentes = await TemplatesVigentesAsync(new[] { tipo.Value });
            if (!vigentes.TryGetValue(tipo.Value, out var tplId) || tplId != item.ChecklistTemplateId)
                throw new ArgumentException("La actividad elegida no es del checklist de este tipo de vehículo.");
        }
        return item;
    }

    /// <summary>Nombre con el que se ve la actividad en la foto: su título, o su descripción si no tiene</summary>
    public static string NombreActividad(string? titulo, string pregunta) =>
        string.IsNullOrWhiteSpace(titulo) ? pregunta.Trim() : titulo.Trim();

    /// <summary>Falla interna de la actividad (la crea o le actualiza el nombre). No guarda: lo hace quien llama.</summary>
    public async Task<ImageFault> FallaDeActividadAsync(ChecklistItem item)
    {
        var nombre = Recortar(NombreActividad(item.Titulo, item.Pregunta), 100);
        var descripcion = Recortar(item.Pregunta.Trim(), 500);
        var falla = await _db.ImageFaults.FirstOrDefaultAsync(f => f.ChecklistItemId == item.Id);
        if (falla == null)
        {
            falla = new ImageFault
            {
                Name = nombre,
                Description = descripcion,
                Active = true,
                ChecklistItemId = item.Id,
                CreatedAt = DateTime.UtcNow
            };
            _db.ImageFaults.Add(falla);
        }
        else if (falla.Name != nombre || falla.Description != descripcion || !falla.Active)
        {
            falla.Name = nombre;
            falla.Description = descripcion;
            falla.Active = true;
            falla.UpdatedAt = DateTime.UtcNow;
        }
        return falla;
    }

    /// <summary>Al editar el checklist: las fallas internas toman el título y la descripción nuevos</summary>
    public async Task SincronizarNombresAsync(IEnumerable<ChecklistItem> items)
    {
        var porId = items.Where(i => i.Id > 0).GroupBy(i => i.Id).ToDictionary(g => g.Key, g => g.First());
        if (porId.Count == 0) return;
        var ids = porId.Keys.ToList();
        var fallas = await _db.ImageFaults.Where(f => f.ChecklistItemId != null && ids.Contains(f.ChecklistItemId.Value)).ToListAsync();
        foreach (var falla in fallas)
        {
            var item = porId[falla.ChecklistItemId!.Value];
            var nombre = Recortar(NombreActividad(item.Titulo, item.Pregunta), 100);
            var descripcion = Recortar(item.Pregunta.Trim(), 500);
            if (falla.Name == nombre && falla.Description == descripcion) continue;
            falla.Name = nombre;
            falla.Description = descripcion;
            falla.UpdatedAt = DateTime.UtcNow;
        }
    }

    /// <summary>Cuántos puntos activos de la foto tiene cada actividad (para "En la foto" en Checklists)</summary>
    public async Task<Dictionary<int, int>> PuntosPorActividadAsync()
    {
        var lista = await _db.VehicleImagePoints.AsNoTracking()
            .Where(p => p.Active && p.ChecklistItemId != null)
            .GroupBy(p => p.ChecklistItemId!.Value)
            .Select(g => new { Id = g.Key, Total = g.Count() })
            .ToListAsync();
        return lista.ToDictionary(x => x.Id, x => x.Total);
    }

    /// <summary>
    /// DTO de los puntos con su actividad leída del checklist (si cambia el título o la descripción, el punto lo
    /// refleja). Sin actividad vigente del tipo = SinActividad, y se muestra con el nombre que tenía.
    /// </summary>
    public async Task<List<VehicleImagePointDto>> ADtoAsync(List<VehicleImagePoint> puntos)
    {
        var itemIds = puntos.Where(p => p.ChecklistItemId.HasValue).Select(p => p.ChecklistItemId!.Value).Distinct().ToList();
        var items = itemIds.Count == 0
            ? new Dictionary<int, ActividadInfo>()
            : await _db.ChecklistItems.AsNoTracking()
                .Where(i => itemIds.Contains(i.Id))
                .Select(i => new ActividadInfo(i.Id, i.ChecklistTemplateId, i.Pregunta, i.Titulo, i.CostoEstimado, i.Activo && i.ChecklistTemplate.Activo))
                .ToDictionaryAsync(i => i.Id);
        var tipos = puntos.Select(p => TipoDeImageKey(p.ImageKey)).Where(t => t.HasValue).Select(t => t!.Value).Distinct().ToList();
        var vigentes = tipos.Count == 0 ? new Dictionary<int, int>() : await TemplatesVigentesAsync(tipos);

        return puntos.Select(p =>
        {
            ActividadInfo? actividad = null;
            if (p.ChecklistItemId.HasValue && items.TryGetValue(p.ChecklistItemId.Value, out var a) && a.Activa)
            {
                var tipo = TipoDeImageKey(p.ImageKey);
                if (!tipo.HasValue || (vigentes.TryGetValue(tipo.Value, out var tpl) && tpl == a.TemplateId))
                    actividad = a;
            }

            return new VehicleImagePointDto
            {
                Id = p.Id,
                ImageKey = p.ImageKey,
                XPct = p.XPct,
                YPct = p.YPct,
                RadiusPct = p.RadiusPct,
                ImageFaultId = p.ImageFaultId,
                // Con actividad: su título y descripción; sin ella, el nombre que tenía el componente
                ImageFaultName = actividad != null ? NombreActividad(actividad.Titulo, actividad.Pregunta) : p.ImageFault?.Name,
                ImageFaultDescription = actividad != null
                    ? (string.IsNullOrWhiteSpace(actividad.Titulo) ? null : actividad.Pregunta)
                    : p.ImageFault?.Description,
                ChecklistItemId = actividad?.Id ?? p.ChecklistItemId,
                SinActividad = actividad == null,
                ActividadTitulo = actividad != null ? NombreActividad(actividad.Titulo, actividad.Pregunta) : null,
                ActividadDescripcion = actividad?.Pregunta,
                ActividadCosto = actividad?.Costo,
                Active = p.Active
            };
        }).ToList();
    }

    private sealed record ActividadInfo(int Id, int TemplateId, string Pregunta, string? Titulo, decimal Costo, bool Activa);

    private static string Recortar(string texto, int max) => texto.Length > max ? texto[..max] : texto;
}
