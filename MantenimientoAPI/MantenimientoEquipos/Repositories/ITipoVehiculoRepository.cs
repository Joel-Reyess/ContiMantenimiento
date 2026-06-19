using MantenimientoEquipos.Models;

namespace MantenimientoEquipos.Repositories
{
    public interface ITipoVehiculoRepository
    {
        Task<IEnumerable<TipoVehiculo>> GetAllAsync();
        Task<TipoVehiculo?> GetByIdAsync(int id);
        Task<int> CountVehiculosByTipoAsync(int tipoVehiculoId);
        Task UpdateAsync(TipoVehiculo tipoVehiculo);
        Task<TipoVehiculo> CreateAsync(TipoVehiculo tipoVehiculo);
        Task DeleteAsync(int id);
    }
}
