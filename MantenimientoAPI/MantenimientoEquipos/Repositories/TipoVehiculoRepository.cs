using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Repositories
{
    public class TipoVehiculoRepository : ITipoVehiculoRepository
    {
        private readonly MantenimientoDbContext _context;

        public TipoVehiculoRepository(MantenimientoDbContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<TipoVehiculo>> GetAllAsync()
        {
            var tipos = await _context.TiposVehiculo
                .Include(t => t.Proveedor)
                .OrderBy(t => t.Nombre)
                .ToListAsync();

            // Fetch vehicle types only to count in memory to avoid EF Core Enum grouping issues
            var vehiculoTipos = await _context.Vehiculos
                .Where(v => v.Activo)
                .Select(v => v.Tipo)
                .ToListAsync();
            if (vehiculoTipos.Count == 0)
            {
                vehiculoTipos = await _context.Vehiculos
                    .Select(v => v.Tipo)
                    .ToListAsync();
            }

            var counts = vehiculoTipos
                .GroupBy(t => (int)t)
                .ToDictionary(g => g.Key, g => g.Count());

            var enumKeysById = Enum.GetValues<TipoVehiculoEnum>()
                .ToDictionary(e => (int)e, e => NormalizeTipoKeySinConectores(e.ToString()));

            foreach (var tipo in tipos)
            {
                if (counts.TryGetValue(tipo.Id, out var count))
                {
                    tipo.TotalVehiculos = count;
                }
                else
                {
                    var tipoKey = NormalizeTipoKeySinConectores(tipo.Nombre);
                    if (string.IsNullOrWhiteSpace(tipoKey))
                    {
                        tipo.TotalVehiculos = 0;
                        continue;
                    }
                    var idsCoincidentes = enumKeysById
                        .Where(kvp =>
                            kvp.Value == tipoKey ||
                            kvp.Value.Contains(tipoKey) ||
                            tipoKey.Contains(kvp.Value))
                        .Select(kvp => kvp.Key)
                        .Distinct();

                    tipo.TotalVehiculos = idsCoincidentes.Sum(enumId => counts.GetValueOrDefault(enumId));
                }
            }

            return tipos;
        }

        public async Task<TipoVehiculo?> GetByIdAsync(int id)
        {
            return await _context.TiposVehiculo
                .Include(t => t.Proveedor)
                .FirstOrDefaultAsync(t => t.Id == id);
        }

        public async Task<int> CountVehiculosByTipoAsync(int tipoVehiculoId)
        {
            var conteoPorId = await _context.Vehiculos
                .Where(v => v.Activo && (int)v.Tipo == tipoVehiculoId)
                .CountAsync();
            if (conteoPorId > 0)
            {
                return conteoPorId;
            }

            var conteoTotalPorId = await _context.Vehiculos
                .Where(v => (int)v.Tipo == tipoVehiculoId)
                .CountAsync();
            if (conteoTotalPorId > 0)
            {
                return conteoTotalPorId;
            }

            var tipo = await _context.TiposVehiculo
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.Id == tipoVehiculoId);
            if (tipo == null)
            {
                return 0;
            }

            var tipoKey = NormalizeTipoKeySinConectores(tipo.Nombre);
            if (string.IsNullOrWhiteSpace(tipoKey))
            {
                return 0;
            }

            var idsCoincidentes = Enum.GetValues<TipoVehiculoEnum>()
                .Where(e =>
                {
                    var key = NormalizeTipoKeySinConectores(e.ToString());
                    return key == tipoKey || key.Contains(tipoKey) || tipoKey.Contains(key);
                })
                .Select(e => (int)e)
                .ToHashSet();

            if (idsCoincidentes.Count == 0)
            {
                return 0;
            }

            var tiposVehiculoActivos = await _context.Vehiculos
                .Where(v => v.Activo)
                .Select(v => (int)v.Tipo)
                .ToListAsync();
            if (tiposVehiculoActivos.Count == 0)
            {
                tiposVehiculoActivos = await _context.Vehiculos
                    .Select(v => (int)v.Tipo)
                    .ToListAsync();
            }

            return tiposVehiculoActivos.Count(idsCoincidentes.Contains);
        }

        public async Task UpdateAsync(TipoVehiculo tipoVehiculo)
        {
            _context.TiposVehiculo.Update(tipoVehiculo);
            await _context.SaveChangesAsync();
        }

        public async Task<TipoVehiculo> CreateAsync(TipoVehiculo tipoVehiculo)
        {
            _context.TiposVehiculo.Add(tipoVehiculo);
            await _context.SaveChangesAsync();
            return tipoVehiculo;
        }

        public async Task DeleteAsync(int id)
        {
            var tipo = await _context.TiposVehiculo.FindAsync(id);
            if (tipo != null)
            {
                // Soft delete
                tipo.Activo = false;
                tipo.UpdatedAt = DateTime.UtcNow;
                _context.TiposVehiculo.Update(tipo);
                await _context.SaveChangesAsync();
            }
        }

        private static readonly HashSet<string> TipoConectores = new(StringComparer.OrdinalIgnoreCase)
        {
            "de", "del", "la", "las", "el", "los", "y", "para", "por"
        };

        private static string NormalizeTipoKeySinConectores(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            var separadoCamelCase = System.Text.RegularExpressions.Regex.Replace(value, "([a-z0-9])([A-Z])", "$1 $2");
            var sinAcentos = separadoCamelCase.Normalize(System.Text.NormalizationForm.FormD);
            var limpio = new string(sinAcentos
                .Where(c => System.Globalization.CharUnicodeInfo.GetUnicodeCategory(c) != System.Globalization.UnicodeCategory.NonSpacingMark)
                .ToArray());

            var tokens = System.Text.RegularExpressions.Regex
                .Split(limpio, "[^A-Za-z0-9]+")
                .Where(t => !string.IsNullOrWhiteSpace(t))
                .Select(t => t.ToLowerInvariant())
                .Where(t => !TipoConectores.Contains(t));

            return string.Concat(tokens);
        }
    }
}
