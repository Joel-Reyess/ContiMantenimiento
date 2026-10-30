using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Services;

/// <summary>Filtros de la flota (pantalla Flota de Contenedores)</summary>
public class FiltroVehiculos
{
    public TipoVehiculoEnum? Tipo { get; set; }
    public EstadoVehiculoEnum? Estado { get; set; }
    public int? AreaId { get; set; }
    public UbicacionVehiculoEnum? Ubicacion { get; set; }
    /// <summary>Líder/Supervisor: solo los tipos que tiene asignados</summary>
    public List<TipoVehiculoEnum>? TiposPermitidos { get; set; }
    public string? Busqueda { get; set; }
    /// <summary>Prefijo del código (catálogo de prefijos), con el mismo criterio que la detección del tipo</summary>
    public string? Prefijo { get; set; }
    /// <summary>La pestaña "Contenedores" deja fuera a los Tuggers (tienen su propia pestaña)</summary>
    public TipoVehiculoEnum? ExcluirTipo { get; set; }
    public bool SoloActivos { get; set; } = true;
}

/// <summary>
/// Un solo lugar para filtrar la flota: lo usan el listado y la exportación a Excel de "lo que estoy
/// viendo", para que el archivo traiga exactamente los mismos vehículos que la pantalla.
/// </summary>
public static class VehiculoFiltros
{
    public static IQueryable<Vehiculo> Aplicar(MantenimientoDbContext db, IQueryable<Vehiculo> query, FiltroVehiculos f)
    {
        if (f.SoloActivos)
            query = query.Where(v => v.Activo);

        if (f.TiposPermitidos != null && f.TiposPermitidos.Any())
        {
            var permitidos = f.TiposPermitidos;
            query = query.Where(v => permitidos.Contains(v.Tipo));
        }

        if (f.Tipo.HasValue)
            query = query.Where(v => v.Tipo == f.Tipo.Value);

        if (f.ExcluirTipo.HasValue)
            query = query.Where(v => v.Tipo != f.ExcluirTipo.Value);

        if (f.Estado.HasValue)
            query = query.Where(v => v.Estado == f.Estado.Value);

        if (f.AreaId.HasValue)
            query = query.Where(v => v.AreaId == f.AreaId.Value);

        if (f.Ubicacion.HasValue)
            query = query.Where(v => v.Ubicacion == f.Ubicacion.Value);

        if (!string.IsNullOrWhiteSpace(f.Prefijo))
        {
            // El código empieza con el prefijo y no con otro prefijo activo más largo que también empiece así
            // ("CDC-001" es de CDC, no de CD): gana el más largo, igual que al detectar el tipo
            var prefijo = f.Prefijo.Trim();
            query = query.Where(v => v.Codigo.StartsWith(prefijo) &&
                !db.VehiculoPrefijoConfigs.Any(p => p.Activo && p.PrefijoCodigo.Length > prefijo.Length &&
                    p.PrefijoCodigo.StartsWith(prefijo) && v.Codigo.StartsWith(p.PrefijoCodigo)));
        }

        if (!string.IsNullOrEmpty(f.Busqueda))
        {
            var term = f.Busqueda.Trim().ToLower();

            // Unimos con TiposVehiculo y Areas directamente en la query para una búsqueda robusta en SQL (insensible a mayúsculas)
            query = from v in query
                    join tv in db.TiposVehiculo on (int)v.Tipo equals tv.Id into tvJoin
                    from tv in tvJoin.DefaultIfEmpty()
                    where v.Codigo.ToLower().Contains(term) ||
                          (v.Marca != null && v.Marca.ToLower().Contains(term)) ||
                          (v.Modelo != null && v.Modelo.ToLower().Contains(term)) ||
                          (v.NumeroSerie != null && v.NumeroSerie.ToLower().Contains(term)) ||
                          (v.Area != null && v.Area.Nombre.ToLower().Contains(term)) ||
                          (tv != null && tv.Nombre.ToLower().Contains(term))
                    select v;
        }

        return query;
    }
}
