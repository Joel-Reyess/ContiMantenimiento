using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;

namespace MantenimientoEquipos.Services;

public class VehiculoPrefijoConfigService
{
    private readonly MantenimientoDbContext _context;

    public VehiculoPrefijoConfigService(MantenimientoDbContext context)
    {
        _context = context;
    }

    public async Task<PaginatedResponse<VehiculoPrefijoConfig>> GetAllAsync(bool? activo = null, string? busqueda = null, int page = 1, int pageSize = 10)
    {
        var query = _context.VehiculoPrefijoConfigs
            .Include(vp => vp.TipoVehiculo)
            .AsQueryable();

        // Si se especifica activo, filtrar por ese estado. Si no, mostrar todos (o solo activos si esa es la regla de negocio por defecto, pero aquí permitimos ver todos para gestión)
        if (activo.HasValue)
        {
            query = query.Where(vp => vp.Activo == activo.Value);
        }

        if (!string.IsNullOrEmpty(busqueda))
        {
            query = query.Where(vp => vp.PrefijoCodigo.Contains(busqueda) || (vp.Descripcion != null && vp.Descripcion.Contains(busqueda)));
        }

        var totalItems = await query.CountAsync();
        
        if (page < 1) page = 1;
        if (pageSize < 1) pageSize = 10;

        var items = await query
            .OrderBy(vp => vp.PrefijoCodigo)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return new PaginatedResponse<VehiculoPrefijoConfig>
        {
            Items = items,
            TotalItems = totalItems,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize)
        };
    }

    public async Task<VehiculoPrefijoConfig?> GetByIdAsync(int id)
    {
        return await _context.VehiculoPrefijoConfigs
            .Include(vp => vp.TipoVehiculo)
            .FirstOrDefaultAsync(vp => vp.Id == id && vp.Activo);
    }

    public async Task<VehiculoPrefijoConfig?> GetByPrefijoAsync(string prefijo)
    {
        return await _context.VehiculoPrefijoConfigs
            .Include(vp => vp.TipoVehiculo)
            .Where(vp => vp.Activo)
            .FirstOrDefaultAsync(vp => vp.PrefijoCodigo == prefijo);
    }

    public async Task<VehiculoPrefijoConfig> CreateAsync(VehiculoPrefijoConfig config)
    {
        // Validar tipo de vehículo (si está inactivo lo reactivamos para evitar errores al seleccionar)
        var tipo = await _context.TiposVehiculo.FindAsync(config.TipoVehiculoId);
        if (tipo == null)
        {
            throw new ArgumentException("El tipo de vehículo seleccionado no existe o está inactivo.");
        }
        if (!tipo.Activo)
        {
            tipo.Activo = true;
            _context.TiposVehiculo.Update(tipo);
        }

        // Evitar prefijos duplicados
        var prefijoDuplicado = await _context.VehiculoPrefijoConfigs.AnyAsync(vp => vp.PrefijoCodigo == config.PrefijoCodigo && vp.Activo);
        if (prefijoDuplicado)
        {
            throw new ArgumentException("Ya existe una configuración activa con ese prefijo.");
        }

        _context.VehiculoPrefijoConfigs.Add(config);
        await _context.SaveChangesAsync();
        return config;
    }

    public async Task<VehiculoPrefijoConfig?> UpdateAsync(int id, VehiculoPrefijoConfig config)
    {
        var existing = await _context.VehiculoPrefijoConfigs.FindAsync(id);
        if (existing == null) return null;

        var tipo = await _context.TiposVehiculo.FindAsync(config.TipoVehiculoId);
        if (tipo == null)
        {
            throw new ArgumentException("El tipo de vehículo seleccionado no existe o está inactivo.");
        }
        if (!tipo.Activo)
        {
            tipo.Activo = true;
            _context.TiposVehiculo.Update(tipo);
        }

        var prefijoDuplicado = await _context.VehiculoPrefijoConfigs
            .AnyAsync(vp => vp.Id != id && vp.PrefijoCodigo == config.PrefijoCodigo && vp.Activo);
        if (prefijoDuplicado)
        {
            throw new ArgumentException("Ya existe otra configuración activa con ese prefijo.");
        }

        existing.PrefijoCodigo = config.PrefijoCodigo;
        existing.TipoVehiculoId = config.TipoVehiculoId;
        existing.Descripcion = config.Descripcion;
        existing.Activo = config.Activo;
        existing.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();
        return existing;
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var config = await _context.VehiculoPrefijoConfigs.FindAsync(id);
        if (config == null) return false;

        // Eliminación definitiva (requerimiento 14.1). Para dejar de usar un prefijo
        // sin borrarlo existe Activar/Desactivar. Ninguna tabla referencia a esta.
        _context.VehiculoPrefijoConfigs.Remove(config);
        await _context.SaveChangesAsync();
        return true;
    }

  /// <summary>
  /// Obtiene el tipo de vehículo asociado a un código de vehículo basado en el prefijo
  /// </summary>
  public async Task<int?> GetTipoVehiculoIdByCodigoAsync(string codigoVehiculo)
  {
    if (string.IsNullOrWhiteSpace(codigoVehiculo)) return null;
    return DetectarTipoVehiculoId(codigoVehiculo, await GetPrefijosActivosAsync());
  }

  public async Task<List<(string Prefijo, int TipoVehiculoId)>> GetPrefijosActivosAsync()
  {
    var activos = await _context.VehiculoPrefijoConfigs
        .Where(vp => vp.Activo)
        .Select(vp => new { vp.PrefijoCodigo, vp.TipoVehiculoId })
        .ToListAsync();
    return activos.Select(a => (a.PrefijoCodigo, a.TipoVehiculoId)).ToList();
  }

  /// <summary>
  /// Reglas de detección (en este orden), sin distinguir mayúsculas como la intercalación de SQL Server:
  /// 1. El texto antes del primer guion coincide exacto con un prefijo ("MTC-045" -> "MTC").
  /// 2. Los dígitos iniciales coinciden exacto con un prefijo numérico.
  /// 3. El código empieza con algún prefijo; gana el más largo.
  /// Se usa en memoria para validar muchas filas (importación de Excel) sin una consulta por fila.
  /// </summary>
  public static int? DetectarTipoVehiculoId(string codigoVehiculo, IReadOnlyCollection<(string Prefijo, int TipoVehiculoId)> prefijos)
  {
    if (string.IsNullOrWhiteSpace(codigoVehiculo) || prefijos.Count == 0) return null;
    var cmp = StringComparison.OrdinalIgnoreCase;

    var prefijoPrincipal = codigoVehiculo.Split('-')[0];
    if (prefijoPrincipal.Length > 0)
    {
      var exacto = prefijos.FirstOrDefault(p => string.Equals(p.Prefijo, prefijoPrincipal, cmp));
      if (exacto.Prefijo != null) return exacto.TipoVehiculoId;
    }

    var inicioNumerico = new string(codigoVehiculo.TakeWhile(char.IsDigit).ToArray());
    if (inicioNumerico.Length > 0)
    {
      var numerico = prefijos.FirstOrDefault(p => string.Equals(p.Prefijo, inicioNumerico, cmp));
      if (numerico.Prefijo != null) return numerico.TipoVehiculoId;
    }

    var parcial = prefijos
        .Where(p => !string.IsNullOrEmpty(p.Prefijo) && codigoVehiculo.StartsWith(p.Prefijo, cmp))
        .OrderByDescending(p => p.Prefijo.Length)
        .FirstOrDefault();
    return parcial.Prefijo != null ? parcial.TipoVehiculoId : null;
  }
}
