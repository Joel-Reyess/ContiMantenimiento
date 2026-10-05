using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Models;

namespace MantenimientoEquipos.Services;

public class VehiculoDocumentoService
{
    /// <summary>
    /// Las fotografías del vehículo (requerimiento 8.4) se guardan como documentos de este tipo.
    /// No aparecen en Archivo Técnico; se manejan con /api/vehiculos/{id}/fotos.
    /// </summary>
    public const string TipoFoto = "Foto";
    public const long TamanoMaximoFoto = 10 * 1024 * 1024;
    private static readonly string[] ExtensionesFoto = { ".jpg", ".jpeg", ".png", ".webp" };

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
            .Where(d => d.VehiculoId == vehiculoId && d.Tipo != TipoFoto)
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

    public async Task<List<VehiculoFotoDto>> GetFotosAsync(int vehiculoId)
    {
        var fotos = await _db.VehiculoDocumentos
            .Where(d => d.VehiculoId == vehiculoId && d.Tipo == TipoFoto)
            .OrderBy(d => d.CreatedAt)
            .ThenBy(d => d.Id)
            .ToListAsync();
        return fotos.Select(ToFotoDto).ToList();
    }

    public async Task<VehiculoFotoDto> AddFotoAsync(int vehiculoId, IFormFile? archivo)
    {
        if (!await _db.Vehiculos.AnyAsync(v => v.Id == vehiculoId))
            throw new KeyNotFoundException("Vehículo no encontrado");
        if (archivo == null || archivo.Length == 0)
            throw new ArgumentException("No se recibió ninguna imagen");
        if (archivo.Length > TamanoMaximoFoto)
            throw new ArgumentException($"La imagen {archivo.FileName} pesa más de {TamanoMaximoFoto / (1024 * 1024)} MB");

        var extension = Path.GetExtension(archivo.FileName).ToLowerInvariant();
        if (!ExtensionesFoto.Contains(extension))
            throw new ArgumentException($"Formato no permitido ({extension}). Usa JPG, PNG o WEBP");

        // Misma carpeta base que sirve Program.cs en /uploads
        var carpeta = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "vehiculos", "fotos");
        Directory.CreateDirectory(carpeta);
        var fileName = $"{Guid.NewGuid()}{extension}";
        using (var stream = new FileStream(Path.Combine(carpeta, fileName), FileMode.Create))
        {
            await archivo.CopyToAsync(stream);
        }

        var nombre = Path.GetFileName(archivo.FileName);
        var foto = new VehiculoDocumento
        {
            VehiculoId = vehiculoId,
            Nombre = nombre.Length > 200 ? nombre[..200] : nombre,
            Tipo = TipoFoto,
            UrlArchivo = $"/uploads/vehiculos/fotos/{fileName}",
            CreatedAt = DateTime.UtcNow
        };
        _db.VehiculoDocumentos.Add(foto);
        await _db.SaveChangesAsync();
        return ToFotoDto(foto);
    }

    public async Task<bool> DeleteFotoAsync(int vehiculoId, int fotoId)
    {
        var foto = await _db.VehiculoDocumentos
            .FirstOrDefaultAsync(d => d.Id == fotoId && d.VehiculoId == vehiculoId && d.Tipo == TipoFoto);
        if (foto == null) return false;

        _db.VehiculoDocumentos.Remove(foto);
        await _db.SaveChangesAsync();
        EliminarArchivo(foto.UrlArchivo);
        return true;
    }

    /// <summary>
    /// Borra del disco un archivo subido (/uploads/...). Si falla, solo queda el archivo huérfano.
    /// </summary>
    public void EliminarArchivo(string? url)
    {
        if (string.IsNullOrWhiteSpace(url) || !url.StartsWith("/uploads/")) return;
        try
        {
            var relativa = url.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var ruta = Path.GetFullPath(Path.Combine(_env.ContentRootPath, "wwwroot", relativa));
            var raiz = Path.GetFullPath(Path.Combine(_env.ContentRootPath, "wwwroot", "uploads"));
            if (ruta.StartsWith(raiz) && File.Exists(ruta)) File.Delete(ruta);
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private static VehiculoFotoDto ToFotoDto(VehiculoDocumento d) => new()
    {
        Id = d.Id,
        Url = d.UrlArchivo,
        Nombre = d.Nombre,
        CreatedAt = DateTime.SpecifyKind(d.CreatedAt, DateTimeKind.Utc)
    };

    public async Task<bool> DeleteAsync(int id)
    {
        var doc = await _db.VehiculoDocumentos.FindAsync(id);
        if (doc == null) return false;
        _db.VehiculoDocumentos.Remove(doc);
        await _db.SaveChangesAsync();
        return true;
    }
}
