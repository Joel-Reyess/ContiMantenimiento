using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Repositories;

namespace MantenimientoEquipos.Services;

public class VehiculoService
{
    private readonly MantenimientoDbContext _db;
    private readonly ITipoVehiculoRepository _tipoVehiculoRepository;

    public VehiculoService(MantenimientoDbContext db, ITipoVehiculoRepository tipoVehiculoRepository)
    {
        _db = db;
        _tipoVehiculoRepository = tipoVehiculoRepository;
    }

    public async Task<PaginatedResponse<VehiculoListDto>> GetAllAsync(
        TipoVehiculoEnum? tipo = null, 
        EstadoVehiculoEnum? estado = null, 
        int? areaId = null, 
        UbicacionVehiculoEnum? ubicacion = null,
        List<TipoVehiculoEnum>? tiposPermitidos = null,
        string? busqueda = null,
        int page = 1,
        int pageSize = 10)
    {
        // Iniciamos la query incluyendo las tablas relacionadas para búsqueda y mapeo
        var query = _db.Vehiculos
            .Include(v => v.Area)
            .Include(v => v.Reportes)
            .Where(v => v.Activo);

        if (tiposPermitidos != null && tiposPermitidos.Any())
        {
            query = query.Where(v => tiposPermitidos.Contains(v.Tipo));
        }

        if (tipo.HasValue)
            query = query.Where(v => v.Tipo == tipo.Value);

        if (estado.HasValue)
            query = query.Where(v => v.Estado == estado.Value);

        if (areaId.HasValue)
            query = query.Where(v => v.AreaId == areaId.Value);

        if (ubicacion.HasValue)
            query = query.Where(v => v.Ubicacion == ubicacion.Value);

        if (!string.IsNullOrEmpty(busqueda))
        {
            var term = busqueda.Trim().ToLower();
            
            // Unimos con TiposVehiculo y Areas directamente en la query para una búsqueda robusta en SQL (insensible a mayúsculas)
            query = from v in query
                    join tv in _db.TiposVehiculo on (int)v.Tipo equals tv.Id into tvJoin
                    from tv in tvJoin.DefaultIfEmpty()
                    where v.Codigo.ToLower().Contains(term) ||
                          (v.Marca != null && v.Marca.ToLower().Contains(term)) ||
                          (v.Modelo != null && v.Modelo.ToLower().Contains(term)) ||
                          (v.NumeroSerie != null && v.NumeroSerie.ToLower().Contains(term)) ||
                          (v.Area != null && v.Area.Nombre.ToLower().Contains(term)) ||
                          (tv != null && tv.Nombre.ToLower().Contains(term))
                    select v;
        }

        var totalItems = await query.CountAsync();
        var totalPages = (int)Math.Ceiling(totalItems / (double)pageSize);

        var vehiculos = await query
            .OrderBy(v => v.Codigo)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        var tiposList = await _tipoVehiculoRepository.GetAllAsync();
        var tiposMap = tiposList.ToDictionary(t => (TipoVehiculoEnum)t.Id, t => t.Nombre);
        var tiposImagenMap = tiposList.ToDictionary(t => (TipoVehiculoEnum)t.Id, t => t.ImagenUrl);

        var items = vehiculos.Select(v => new VehiculoListDto
        {
            Id = v.Id,
            Codigo = v.Codigo,
            Tipo = v.Tipo,
            TipoNombre = tiposMap.GetValueOrDefault(v.Tipo, v.Tipo.ToString()),
            TipoImagenUrl = tiposImagenMap.GetValueOrDefault(v.Tipo),
            Marca = v.Marca,
            Modelo = v.Modelo,
            Estado = v.Estado,
            EstadoNombre = v.Estado.ToString(),
            Ubicacion = v.Ubicacion,
            UbicacionNombre = v.Ubicacion.ToString(),
            AreaNombre = v.Area != null ? v.Area.Nombre : null,
            UltimoMantenimiento = v.UltimoMantenimiento,
            TotalReportes = v.Reportes.Count
        }).ToList();

        return new PaginatedResponse<VehiculoListDto>
        {
            Items = items,
            TotalItems = totalItems,
            Page = page,
            PageSize = pageSize,
            TotalPages = totalPages
        };
    }

    public async Task<VehiculoDto?> GetByIdAsync(int id)
    {
        var vehiculo = await _db.Vehiculos
            .Include(v => v.Area)
            .Where(v => v.Id == id)
            .FirstOrDefaultAsync();

        if (vehiculo == null) return null;

        var tipos = (await _tipoVehiculoRepository.GetAllAsync()).ToDictionary(t => (TipoVehiculoEnum)t.Id, t => t.Nombre);

        return new VehiculoDto
        {
            Id = vehiculo.Id,
            Codigo = vehiculo.Codigo,
            Tipo = vehiculo.Tipo,
            TipoNombre = tipos.GetValueOrDefault(vehiculo.Tipo, vehiculo.Tipo.ToString()),
            Marca = vehiculo.Marca,
            Modelo = vehiculo.Modelo,
            NumeroSerie = vehiculo.NumeroSerie,
            Anio = vehiculo.Anio,
            Estado = vehiculo.Estado,
            EstadoNombre = vehiculo.Estado.ToString(),
            Ubicacion = vehiculo.Ubicacion,
            UbicacionNombre = vehiculo.Ubicacion.ToString(),
            AreaId = vehiculo.AreaId,
            AreaNombre = vehiculo.Area != null ? vehiculo.Area.Nombre : null,
            FechaAdquisicion = vehiculo.FechaAdquisicion,
            UltimoMantenimiento = vehiculo.UltimoMantenimiento,
            ProximoMantenimiento = vehiculo.ProximoMantenimiento,
            CapacidadCarga = vehiculo.CapacidadCarga,
            HorasOperacion = vehiculo.HorasOperacion,
            Kilometraje = vehiculo.Kilometraje,
            ImagenUrl = vehiculo.ImagenUrl,
            Notas = vehiculo.Notas,
            DocumentacionDibujos = vehiculo.DocumentacionDibujos,
            DocumentacionEspecificaciones = vehiculo.DocumentacionEspecificaciones,
            ListaMateriales = vehiculo.ListaMateriales,
            RegistroModificaciones = vehiculo.RegistroModificaciones,
            Activo = vehiculo.Activo
        };
    }

    public async Task<VehiculoDto?> GetByCodigoAsync(string codigo)
    {
        var vehiculo = await _db.Vehiculos
            .Include(v => v.Area)
            .Where(v => v.Codigo == codigo && v.Activo)
            .FirstOrDefaultAsync();

        if (vehiculo == null) return null;

        var tipos = (await _tipoVehiculoRepository.GetAllAsync()).ToDictionary(t => (TipoVehiculoEnum)t.Id, t => t.Nombre);

        return new VehiculoDto
        {
            Id = vehiculo.Id,
            Codigo = vehiculo.Codigo,
            Tipo = vehiculo.Tipo,
            TipoNombre = tipos.GetValueOrDefault(vehiculo.Tipo, vehiculo.Tipo.ToString()),
            Marca = vehiculo.Marca,
            Modelo = vehiculo.Modelo,
            Estado = vehiculo.Estado,
            EstadoNombre = vehiculo.Estado.ToString(),
            Ubicacion = vehiculo.Ubicacion,
            UbicacionNombre = vehiculo.Ubicacion.ToString(),
            AreaId = vehiculo.AreaId,
            AreaNombre = vehiculo.Area != null ? vehiculo.Area.Nombre : null,
            UltimoMantenimiento = vehiculo.UltimoMantenimiento,
            Activo = vehiculo.Activo
        };
    }

    public async Task<Vehiculo> CreateAsync(VehiculoCreateRequest request, int userId)
    {
        var vehiculo = new Vehiculo
        {
            Codigo = request.Codigo,
            Tipo = request.Tipo,
            Marca = request.Marca,
            Modelo = request.Modelo,
            NumeroSerie = request.NumeroSerie,
            Anio = request.Anio,
            Estado = EstadoVehiculoEnum.Operativo,
            AreaId = request.AreaId,
            FechaAdquisicion = request.FechaAdquisicion,
            CapacidadCarga = request.CapacidadCarga,
            Notas = request.Notas,
            DocumentacionDibujos = request.DocumentacionDibujos,
            DocumentacionEspecificaciones = request.DocumentacionEspecificaciones,
            ListaMateriales = request.ListaMateriales,
            RegistroModificaciones = request.RegistroModificaciones,
            CreatedBy = userId,
            CreatedAt = DateTime.UtcNow
        };

        _db.Vehiculos.Add(vehiculo);
        await _db.SaveChangesAsync();
        return vehiculo;
    }

    public async Task<bool> UpdateAsync(int id, VehiculoUpdateRequest request, int userId)
    {
        var vehiculo = await _db.Vehiculos.FindAsync(id);
        if (vehiculo == null) return false;

        if (request.Marca != null) vehiculo.Marca = request.Marca;
        if (request.Modelo != null) vehiculo.Modelo = request.Modelo;
        if (request.NumeroSerie != null) vehiculo.NumeroSerie = request.NumeroSerie;
        if (request.Anio.HasValue) vehiculo.Anio = request.Anio.Value;
        if (request.Estado.HasValue) vehiculo.Estado = request.Estado.Value;
        if (request.AreaId.HasValue) vehiculo.AreaId = request.AreaId.Value;
        if (request.ProximoMantenimiento.HasValue) vehiculo.ProximoMantenimiento = request.ProximoMantenimiento.Value;
        if (request.CapacidadCarga.HasValue) vehiculo.CapacidadCarga = request.CapacidadCarga.Value;
        if (request.HorasOperacion.HasValue) vehiculo.HorasOperacion = request.HorasOperacion.Value;
        if (request.Kilometraje.HasValue) vehiculo.Kilometraje = request.Kilometraje.Value;
        if (request.ImagenUrl != null) vehiculo.ImagenUrl = request.ImagenUrl;
        if (request.Notas != null) vehiculo.Notas = request.Notas;
        if (request.DocumentacionDibujos != null) vehiculo.DocumentacionDibujos = request.DocumentacionDibujos;
        if (request.DocumentacionEspecificaciones != null) vehiculo.DocumentacionEspecificaciones = request.DocumentacionEspecificaciones;
        if (request.ListaMateriales != null) vehiculo.ListaMateriales = request.ListaMateriales;
        if (request.RegistroModificaciones != null) vehiculo.RegistroModificaciones = request.RegistroModificaciones;
        if (request.Activo.HasValue) vehiculo.Activo = request.Activo.Value;
        if (request.Tipo.HasValue) vehiculo.Tipo = request.Tipo.Value;
        if (request.Ubicacion.HasValue) vehiculo.Ubicacion = request.Ubicacion.Value;

        vehiculo.UpdatedAt = DateTime.UtcNow;
        vehiculo.UpdatedBy = userId;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> CambiarEstadoAsync(int id, EstadoVehiculoEnum nuevoEstado, int userId)
    {
        var vehiculo = await _db.Vehiculos.FindAsync(id);
        if (vehiculo == null) return false;

        vehiculo.Estado = nuevoEstado;
        vehiculo.UpdatedAt = DateTime.UtcNow;
        vehiculo.UpdatedBy = userId;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> ExisteCodigoAsync(string codigo, int? excludeId = null)
    {
        var query = _db.Vehiculos.Where(v => v.Codigo == codigo);
        if (excludeId.HasValue)
            query = query.Where(v => v.Id != excludeId.Value);
        return await query.AnyAsync();
    }

    public async Task<bool> CambiarUbicacionAsync(int id, UbicacionVehiculoEnum nuevaUbicacion, int userId)
    {
        var vehiculo = await _db.Vehiculos.FindAsync(id);
        if (vehiculo == null) return false;

        vehiculo.Ubicacion = nuevaUbicacion;
        vehiculo.UpdatedAt = DateTime.UtcNow;
        vehiculo.UpdatedBy = userId;

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<List<HistorialMantenimientoDto>> GetHistorialAsync(int vehiculoId)
    {
        var ordenes = await _db.OrdenesTrabajo
            .Include(o => o.TecnicoAsignado)
            .Include(o => o.ReporteFalla)
            .Where(o => o.VehiculoId == vehiculoId)
            .Where(o => o.Estado == EstadoOrdenTrabajoEnum.Completada || o.Estado == EstadoOrdenTrabajoEnum.Validada)
            .OrderByDescending(o => o.FechaFinalizacion)
            .Select(o => new HistorialMantenimientoDto
            {
                Id = o.Id,
                OrdenTrabajoId = o.Id,
                FolioOrden = o.Folio,
                TipoMantenimiento = o.TipoMantenimiento,
                Descripcion = o.Descripcion,
                TecnicoNombre = o.TecnicoAsignado != null ? o.TecnicoAsignado.NombreCompleto : "Sin asignar",
                FechaFinalizacion = o.FechaFinalizacion ?? o.UpdatedAt ?? DateTime.MinValue,
                CostoTotal = o.CostoTotal ?? 0,
                Estado = o.Estado.ToString(),
                // Timeline
                FechaReporteFalla = o.ReporteFalla != null ? o.ReporteFalla.FechaReporte : null,
                FechaRecepcion = o.FechaCreacion, // Usualmente coincide con la creación si es correctivo
                FechaChecklistCompletado = o.FechaFinalizacion, // Aproximación
                FechaFirmaAsignacion = o.FechaFirmaAsignacion,
                FechaInicioTrabajo = o.FechaInicio,
                FechaFirmaLider = o.FirmaLiderFecha
            })
            .ToListAsync();

        return ordenes;
    }
}
