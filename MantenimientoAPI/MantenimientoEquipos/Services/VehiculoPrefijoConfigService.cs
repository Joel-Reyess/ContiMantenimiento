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

        config.Activo = false; // Soft delete
        await _context.SaveChangesAsync();
        return true;
    }

  /// <summary>
  /// Obtiene el tipo de vehículo asociado a un código de vehículo basado en el prefijo
  /// </summary>
  public async Task<int?> GetTipoVehiculoIdByCodigoAsync(string codigoVehiculo)
  {
    if (string.IsNullOrWhiteSpace(codigoVehiculo)) return null;

    // Buscar configuraciones activas que coincidan con el código del vehículo
    // Probamos diferentes estrategias de coincidencia:
    
    // 1. Coincidencia exacta con el prefijo (ya sea alfabético o numérico)
    var partes = codigoVehiculo.Split('-');
    string prefijoPrincipal = "";
    if (partes.Length > 0) {
        prefijoPrincipal = partes[0]; // Por ejemplo, de "MTC-045" o "123-ABC" tomaría "MTC" o "123"
    }

    // Buscar configuraciones que coincidan con el prefijo principal (antes del guion)
    if (!string.IsNullOrEmpty(prefijoPrincipal)) {
        var configPorPrefijo = await _context.VehiculoPrefijoConfigs
            .Where(vp => vp.Activo && vp.PrefijoCodigo == prefijoPrincipal)
            .OrderByDescending(vp => vp.PrefijoCodigo.Length) // Más específico primero
            .FirstOrDefaultAsync();
            
        if (configPorPrefijo != null) {
            return configPorPrefijo.TipoVehiculoId;
        }
    }

    // 2. Coincidencia con prefijos numéricos dentro del código (por si el formato es diferente)
    // Extraer parte numérica al inicio del código si existe
    var inicioNumerico = "";
    for (int i = 0; i < codigoVehiculo.Length; i++) {
        if (char.IsDigit(codigoVehiculo[i])) {
            inicioNumerico += codigoVehiculo[i];
        } else {
            break;
        }
    }

    if (!string.IsNullOrEmpty(inicioNumerico)) {
        var configPorNumero = await _context.VehiculoPrefijoConfigs
            .Where(vp => vp.Activo && vp.PrefijoCodigo == inicioNumerico)
            .OrderByDescending(vp => vp.PrefijoCodigo.Length) // Más específico primero
            .FirstOrDefaultAsync();
            
        if (configPorNumero != null) {
            return configPorNumero.TipoVehiculoId;
        }
    }

    // 3. Coincidencia de prefijo parcial (más amplia)
    var configPorStartsWith = await _context.VehiculoPrefijoConfigs
        .Where(vp => vp.Activo && codigoVehiculo.StartsWith(vp.PrefijoCodigo))
        .OrderByDescending(vp => vp.PrefijoCodigo.Length) // El más largo primero para coincidencias más específicas
        .FirstOrDefaultAsync();

    return configPorStartsWith?.TipoVehiculoId;
  }
}
