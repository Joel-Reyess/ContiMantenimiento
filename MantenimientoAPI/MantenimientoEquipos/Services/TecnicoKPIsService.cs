using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;

namespace MantenimientoEquipos.Services;

public class TecnicoKPIsService
{
    private readonly MantenimientoDbContext _db;

    public TecnicoKPIsService(MantenimientoDbContext db)
    {
        _db = db;
    }

    public async Task<List<TecnicoKpiDto>> GetTecnicoKPIsAsync(int mes, int anio)
    {
        var fechaInicioMes = new DateTime(anio, mes, 1);
        var fechaFinMes = fechaInicioMes.AddMonths(1).AddDays(-1);

        // Obtener todos los usuarios que son técnicos
        var tecnicos = await _db.Users
            .Include(u => u.Roles)
            .Where(u => u.Roles.Any(r => r.Nombre == "Tecnico"))
            .Where(u => u.Status == UserStatusEnum.Activo)
            .ToListAsync();

        // Obtener metas para el mes
        var metas = await _db.MetasTecnico
            .Where(m => m.Mes == mes && m.Anio == anio)
            .ToDictionaryAsync(m => m.UsuarioId, m => m.MetaMantenimientos);

        // Obtener todas las órdenes finalizadas en el mes
        var ordenesCerradas = await _db.OrdenesTrabajo
            .Where(o => o.FechaFinalizacion >= fechaInicioMes && o.FechaFinalizacion <= fechaFinMes)
            .Where(o => o.Estado == EstadoOrdenTrabajoEnum.Completada || o.Estado == EstadoOrdenTrabajoEnum.Validada)
            .ToListAsync();

        // Obtener órdenes activas
        var ordenesActivas = await _db.OrdenesTrabajo
            .Where(o => o.Estado != EstadoOrdenTrabajoEnum.Completada && 
                       o.Estado != EstadoOrdenTrabajoEnum.Validada && 
                       o.Estado != EstadoOrdenTrabajoEnum.Cancelada)
            .ToListAsync();

        var result = new List<TecnicoKpiDto>();

        foreach (var tecnico in tecnicos)
        {
            var ordenesDelTecnico = ordenesCerradas.Where(o => o.TecnicoAsignadoId == tecnico.Id).ToList();
            var activasDelTecnico = ordenesActivas.Where(o => o.TecnicoAsignadoId == tecnico.Id).ToList();
            
            var meta = metas.ContainsKey(tecnico.Id) ? metas[tecnico.Id] : 0;
            var completados = ordenesDelTecnico.Count;

            // Calcular KPI de 7 días
            int aTiempo = 0;
            double sumaDias = 0;
            foreach (var o in ordenesDelTecnico)
            {
                var inicio = o.FechaInicio ?? o.FechaAsignacion ?? o.FechaCreacion;
                var fin = o.FechaFinalizacion ?? DateTime.UtcNow;
                var duracion = (fin - inicio).TotalDays;
                
                if (duracion <= 7) aTiempo++;
                sumaDias += duracion;
            }

            // Órdenes activas vencidas (> 7 días desde creación/inicio)
            int vencidas = activasDelTecnico.Count(o => {
                var inicio = o.FechaInicio ?? o.FechaAsignacion ?? o.FechaCreacion;
                return (DateTime.UtcNow - inicio).TotalDays > 7;
            });

            result.Add(new TecnicoKpiDto
            {
                TecnicoId = tecnico.Id,
                NombreCompleto = tecnico.NombreCompleto,
                MantenimientosCompletados = completados,
                MetaMensual = meta,
                PorcentajeCumplimientoMeta = meta > 0 ? Math.Round((double)completados / meta * 100, 1) : 0,
                PorcentajeMantenimientosATiempo = completados > 0 ? Math.Round((double)aTiempo / completados * 100, 1) : 100,
                TiempoPromedioResolucionDias = completados > 0 ? Math.Round(sumaDias / completados, 1) : 0,
                OrdenesActivas = activasDelTecnico.Count,
                OrdenesVencidas = vencidas
            });
        }

        return result.OrderByDescending(r => r.MantenimientosCompletados).ToList();
    }

    public async Task<bool> UpsertMetaAsync(UpsertMetaTecnicoDto dto, int currentUserId)
    {
        var meta = await _db.MetasTecnico
            .FirstOrDefaultAsync(m => m.UsuarioId == dto.TecnicoId && m.Mes == dto.Mes && m.Anio == dto.Anio);

        if (meta == null)
        {
            meta = new MetaTecnico
            {
                UsuarioId = dto.TecnicoId,
                Mes = dto.Mes,
                Anio = dto.Anio,
                MetaMantenimientos = dto.MetaMantenimientos,
                CreatedBy = currentUserId,
                CreatedAt = DateTime.UtcNow
            };
            _db.MetasTecnico.Add(meta);
        }
        else
        {
            meta.MetaMantenimientos = dto.MetaMantenimientos;
            meta.UpdatedAt = DateTime.UtcNow;
        }

        await _db.SaveChangesAsync();
        return true;
    }

    public async Task<TecnicoKpiDto> GetDetalleKPIAsync(int tecnicoId, int mes, int anio)
    {
        var fechaInicioMes = new DateTime(anio, mes, 1);
        var fechaFinMes = fechaInicioMes.AddMonths(1).AddDays(-1);

        var tecnico = await _db.Users
            .FirstOrDefaultAsync(u => u.Id == tecnicoId) 
            ?? throw new Exception("Técnico no encontrado");

        var meta = await _db.MetasTecnico
            .Where(m => m.UsuarioId == tecnicoId && m.Mes == mes && m.Anio == anio)
            .Select(m => m.MetaMantenimientos)
            .FirstOrDefaultAsync();

        var ordenesDelMes = await _db.OrdenesTrabajo
            .Include(o => o.Vehiculo)
            .Where(o => o.TecnicoAsignadoId == tecnicoId)
            .Where(o => o.FechaFinalizacion >= fechaInicioMes && o.FechaFinalizacion <= fechaFinMes)
            .Where(o => o.Estado == EstadoOrdenTrabajoEnum.Completada || o.Estado == EstadoOrdenTrabajoEnum.Validada)
            .OrderByDescending(o => o.FechaFinalizacion)
            .ToListAsync();

        var activas = await _db.OrdenesTrabajo
            .Where(o => o.TecnicoAsignadoId == tecnicoId)
            .Where(o => o.Estado != EstadoOrdenTrabajoEnum.Completada && 
                       o.Estado != EstadoOrdenTrabajoEnum.Validada && 
                       o.Estado != EstadoOrdenTrabajoEnum.Cancelada)
            .ToListAsync();

        int aTiempo = 0;
        double sumaDias = 0;
        var detalleMantenimientos = new List<OrdenTrabajoResumenKpiDto>();

        foreach (var o in ordenesDelMes)
        {
            var inicio = o.FechaInicio ?? o.FechaAsignacion ?? o.FechaCreacion;
            var fin = o.FechaFinalizacion!.Value;
            var duracion = (fin - inicio).TotalDays;
            
            if (duracion <= 7) aTiempo++;
            sumaDias += duracion;

            detalleMantenimientos.Add(new OrdenTrabajoResumenKpiDto
            {
                Id = o.Id,
                Folio = o.Folio,
                VehiculoCodigo = o.Vehiculo.Codigo,
                TipoMantenimiento = o.TipoMantenimiento ?? "N/D",
                FechaFinalizacion = fin,
                DiasTranscurridos = Math.Round(duracion, 1)
            });
        }

        int vencidas = activas.Count(o => {
            var inicio = o.FechaInicio ?? o.FechaAsignacion ?? o.FechaCreacion;
            return (DateTime.UtcNow - inicio).TotalDays > 7;
        });

        return new TecnicoKpiDto
        {
            TecnicoId = tecnico.Id,
            NombreCompleto = tecnico.NombreCompleto,
            MantenimientosCompletados = ordenesDelMes.Count,
            MetaMensual = meta,
            PorcentajeCumplimientoMeta = meta > 0 ? Math.Round((double)ordenesDelMes.Count / meta * 100, 1) : 0,
            PorcentajeMantenimientosATiempo = ordenesDelMes.Count > 0 ? Math.Round((double)aTiempo / ordenesDelMes.Count * 100, 1) : 100,
            TiempoPromedioResolucionDias = ordenesDelMes.Count > 0 ? Math.Round(sumaDias / ordenesDelMes.Count, 1) : 0,
            OrdenesActivas = activas.Count,
            OrdenesVencidas = vencidas,
            MantenimientosDetalle = detalleMantenimientos
        };
    }
}
