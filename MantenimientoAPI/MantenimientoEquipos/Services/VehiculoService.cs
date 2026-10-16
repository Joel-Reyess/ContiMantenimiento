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
    private readonly VehiculoPrefijoConfigService _prefijoConfigService;
    private readonly VehiculoDocumentoService _documentoService;
    private readonly EliminacionService _eliminacion;

    public VehiculoService(
        MantenimientoDbContext db,
        ITipoVehiculoRepository tipoVehiculoRepository,
        VehiculoPrefijoConfigService prefijoConfigService,
        VehiculoDocumentoService documentoService,
        EliminacionService eliminacion)
    {
        _db = db;
        _tipoVehiculoRepository = tipoVehiculoRepository;
        _prefijoConfigService = prefijoConfigService;
        _documentoService = documentoService;
        _eliminacion = eliminacion;
    }

    public async Task<PaginatedResponse<VehiculoListDto>> GetAllAsync(
        TipoVehiculoEnum? tipo = null, 
        EstadoVehiculoEnum? estado = null, 
        int? areaId = null, 
        UbicacionVehiculoEnum? ubicacion = null,
        List<TipoVehiculoEnum>? tiposPermitidos = null,
        string? busqueda = null,
        int page = 1,
        int pageSize = 10,
        TipoVehiculoEnum? excluirTipo = null)
    {
        // Los filtros viven en VehiculoFiltros: la exportación a Excel de "lo que estoy viendo" usa los mismos
        var query = VehiculoFiltros.Aplicar(_db,
            _db.Vehiculos.Include(v => v.Area).Include(v => v.Reportes),
            new FiltroVehiculos
            {
                Tipo = tipo,
                Estado = estado,
                AreaId = areaId,
                Ubicacion = ubicacion,
                TiposPermitidos = tiposPermitidos,
                Busqueda = busqueda,
                ExcluirTipo = excluirTipo
            });

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

        // Primera foto de cada vehículo de la página (la tarjeta la prefiere sobre la imagen del tipo)
        var idsPagina = vehiculos.Select(v => v.Id).ToList();
        var fotosPagina = await _db.VehiculoDocumentos
            .Where(d => idsPagina.Contains(d.VehiculoId) && d.Tipo == VehiculoDocumentoService.TipoFoto)
            .Select(d => new { d.VehiculoId, d.UrlArchivo, d.CreatedAt, d.Id })
            .ToListAsync();
        var fotoPrincipal = fotosPagina
            .GroupBy(f => f.VehiculoId)
            .ToDictionary(g => g.Key, g => g.OrderBy(f => f.CreatedAt).ThenBy(f => f.Id).First().UrlArchivo);

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
            TotalReportes = v.Reportes.Count,
            FotoUrl = fotoPrincipal.GetValueOrDefault(v.Id)
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
            Activo = vehiculo.Activo,
            CreatedAt = DateTime.SpecifyKind(vehiculo.CreatedAt, DateTimeKind.Utc),
            Fotos = await _documentoService.GetFotosAsync(vehiculo.Id)
        };
    }

    /// <summary>
    /// Antes de dar de alta: indica si el código ya existe (con tipo, área y fecha de registro
    /// como referencia) y qué tipo de vehículo le corresponde según los prefijos configurados.
    /// </summary>
    public async Task<ValidarCodigoVehiculoDto> ValidarCodigoAsync(string codigo)
    {
        codigo = (codigo ?? string.Empty).Trim();
        var resultado = new ValidarCodigoVehiculoDto { Codigo = codigo };
        if (codigo.Length == 0) return resultado;

        var tipos = (await _tipoVehiculoRepository.GetAllAsync()).ToDictionary(t => (TipoVehiculoEnum)t.Id, t => t.Nombre);

        var existente = await _db.Vehiculos
            .Include(v => v.Area)
            .FirstOrDefaultAsync(v => v.Codigo == codigo);
        if (existente != null)
        {
            resultado.Existe = true;
            resultado.VehiculoId = existente.Id;
            resultado.TipoNombre = tipos.GetValueOrDefault(existente.Tipo, existente.Tipo.ToString());
            resultado.AreaNombre = existente.Area?.Nombre;
            resultado.FechaRegistro = DateTime.SpecifyKind(existente.CreatedAt, DateTimeKind.Utc);
        }

        var tipoId = await _prefijoConfigService.GetTipoVehiculoIdByCodigoAsync(codigo);
        if (tipoId.HasValue && Enum.IsDefined(typeof(TipoVehiculoEnum), tipoId.Value))
        {
            resultado.TipoDetectado = (TipoVehiculoEnum)tipoId.Value;
            resultado.TipoDetectadoNombre = tipos.GetValueOrDefault(resultado.TipoDetectado.Value, resultado.TipoDetectado.Value.ToString());
        }

        return resultado;
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
            Tipo = request.Tipo ?? throw new ArgumentException("El tipo de vehículo es requerido"),
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
        // AreaId = 0 quita el área asignada
        if (request.AreaId.HasValue) vehiculo.AreaId = request.AreaId.Value > 0 ? request.AreaId.Value : null;
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

    /// <summary>
    /// Elimina definitivamente los vehículos indicados junto con todo su historial
    /// (reportes, órdenes, evidencias, checklist, refacciones, pagos, documentos).
    /// Reportes y órdenes se borran con EliminacionService (mismo criterio que Reportes y Órdenes).
    /// </summary>
    public async Task<EliminarVehiculosResultDto> DeleteManyAsync(List<int> ids, int? usuarioId = null, string? nombreUsuario = null)
    {
        ids = ids.Distinct().ToList();

        var vehiculos = await _db.Vehiculos
            .Where(v => ids.Contains(v.Id))
            .Select(v => new { v.Id, v.Codigo })
            .ToListAsync();
        var vehiculoIds = vehiculos.Select(v => v.Id).ToList();

        if (!vehiculoIds.Any())
            return new EliminarVehiculosResultDto();

        var reportes = await _db.ReportesFalla
            .Where(r => vehiculoIds.Contains(r.VehiculoId))
            .Select(r => new { r.Id, r.Folio, r.VehiculoId })
            .ToListAsync();
        var reporteIds = reportes.Select(r => r.Id).ToList();

        var ordenes = await _db.OrdenesTrabajo
            .Where(o => vehiculoIds.Contains(o.VehiculoId) || (o.ReporteFallaId.HasValue && reporteIds.Contains(o.ReporteFallaId.Value)))
            .Select(o => new { o.Id, o.Folio, o.VehiculoId })
            .ToListAsync();
        var ordenIds = ordenes.Select(o => o.Id).ToList();

        var urlsFotos = await _db.VehiculoDocumentos
            .Where(d => vehiculoIds.Contains(d.VehiculoId) && d.Tipo == VehiculoDocumentoService.TipoFoto)
            .Select(d => d.UrlArchivo)
            .ToListAsync();

        using var tx = await _db.Database.BeginTransactionAsync();

        // Órdenes (incluidas las que vienen de un reporte) y reportes, con todo lo que depende de ellos
        var ordenesEliminadas = await _eliminacion.EliminarOrdenesAsync(ordenIds);
        var (reportesEliminados, _) = await _eliminacion.EliminarReportesAsync(reporteIds);

        await _db.HistorialMantenimiento.Where(h => vehiculoIds.Contains(h.VehiculoId)).ExecuteDeleteAsync();

        // Dependientes directos del vehículo
        await _db.VehiculoDocumentos.Where(d => vehiculoIds.Contains(d.VehiculoId)).ExecuteDeleteAsync();
        await _db.VehiculoChecklistAsignaciones.Where(a => vehiculoIds.Contains(a.VehiculoId)).ExecuteDeleteAsync();
        await _db.SolicitudesCambio.Where(s => vehiculoIds.Contains(s.VehiculoId)).ExecuteDeleteAsync();

        var vehiculosEliminados = await _db.Vehiculos.Where(v => vehiculoIds.Contains(v.Id)).ExecuteDeleteAsync();

        // Bitácora: también deja los folios de reportes y órdenes que se fueron con cada vehículo
        foreach (var v in vehiculos)
        {
            var folios = reportes.Where(r => r.VehiculoId == v.Id).Select(r => r.Folio)
                .Concat(ordenes.Where(o => o.VehiculoId == v.Id).Select(o => o.Folio))
                .ToList();
            _eliminacion.Registrar(usuarioId, nombreUsuario, "Vehiculo", v.Id,
                $"Vehículo {v.Codigo}" + (folios.Count > 0 ? $" con su historial: {string.Join(", ", folios)}" : ""));
        }
        await _db.SaveChangesAsync();

        await tx.CommitAsync();

        foreach (var url in urlsFotos) _documentoService.EliminarArchivo(url);

        return new EliminarVehiculosResultDto
        {
            VehiculosEliminados = vehiculosEliminados,
            ReportesEliminados = reportesEliminados,
            OrdenesEliminadas = ordenesEliminadas
        };
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
