using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;

namespace MantenimientoEquipos.Services;

public class VehiculoDocumentoService
{
    private readonly MantenimientoDbContext _db;
    private readonly IWebHostEnvironment _env;

    public VehiculoDocumentoService(MantenimientoDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    public async Task<List<VehiculoDocumentoDto>> GetByVehiculoAsync(int vehiculoId)
    {
        return await _db.VehiculoDocumentos
            .Where(d => d.VehiculoId == vehiculoId)
            .OrderByDescending(d => d.CreatedAt)
            .Select(d => new VehiculoDocumentoDto
            {
                Id = d.Id,
                VehiculoId = d.VehiculoId,
                Nombre = d.Nombre,
                Tipo = d.Tipo,
                Descripcion = d.Descripcion,
                UrlArchivo = d.UrlArchivo,
                CreatedAt = d.CreatedAt
            }).ToListAsync();
    }

    public async Task<VehiculoDocumentoDto> CreateAsync(VehiculoDocumentoCreateRequest request, IFormFile? archivo)
    {
        var vehiculo = await _db.Vehiculos.FindAsync(request.VehiculoId);
        if (vehiculo == null) throw new ArgumentException("Vehiculo no encontrado");
        var tipo = request.Tipo?.Trim() ?? string.Empty;
        var archivoOpcional = tipo.Equals("bom", StringComparison.OrdinalIgnoreCase)
            || tipo.Equals("especificacion", StringComparison.OrdinalIgnoreCase)
            || tipo.Equals("modificacion", StringComparison.OrdinalIgnoreCase);

        if ((archivo == null || archivo.Length == 0) && !archivoOpcional)
            throw new ArgumentException("Archivo requerido");

        string relativePath = string.Empty;
        if (archivo != null && archivo.Length > 0)
        {
            var uploadsPath = Path.Combine(_env.WebRootPath ?? "wwwroot", "uploads", "vehiculos");
            Directory.CreateDirectory(uploadsPath);
            var fileName = $"{Guid.NewGuid()}{Path.GetExtension(archivo.FileName)}";
            var fullPath = Path.Combine(uploadsPath, fileName);
            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await archivo.CopyToAsync(stream);
            }
            relativePath = $"/uploads/vehiculos/{fileName}";
        }

        var doc = new VehiculoDocumento
        {
            VehiculoId = request.VehiculoId,
            Nombre = request.Nombre,
            Tipo = string.IsNullOrWhiteSpace(request.Tipo) ? "Plano" : request.Tipo,
            Descripcion = request.Descripcion,
            UrlArchivo = relativePath,
            CreatedAt = DateTime.UtcNow
        };

        _db.VehiculoDocumentos.Add(doc);
        await _db.SaveChangesAsync();

        return new VehiculoDocumentoDto
        {
            Id = doc.Id,
            VehiculoId = doc.VehiculoId,
            Nombre = doc.Nombre,
            Tipo = doc.Tipo,
            Descripcion = doc.Descripcion,
            UrlArchivo = doc.UrlArchivo,
            CreatedAt = doc.CreatedAt
        };
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var doc = await _db.VehiculoDocumentos.FindAsync(id);
        if (doc == null) return false;
        _db.VehiculoDocumentos.Remove(doc);
        await _db.SaveChangesAsync();
        return true;
    }
}
