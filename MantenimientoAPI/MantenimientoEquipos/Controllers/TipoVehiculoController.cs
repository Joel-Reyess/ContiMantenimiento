using Microsoft.AspNetCore.Mvc;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Repositories;

namespace MantenimientoEquipos.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TipoVehiculoController : ControllerBase
    {
        private readonly ITipoVehiculoRepository _tipoVehiculoRepository;

        public TipoVehiculoController(ITipoVehiculoRepository tipoVehiculoRepository)
        {
            _tipoVehiculoRepository = tipoVehiculoRepository;
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<IEnumerable<TipoVehiculoDto>>>> GetTiposVehiculo()
        {
            var tipos = await _tipoVehiculoRepository.GetAllAsync();
            var tiposDto = tipos.Select(t => new TipoVehiculoDto
            {
                Id = t.Id,
                Nombre = t.Nombre,
                Descripcion = t.Descripcion,
                ImagenUrl = t.ImagenUrl,
                ImagenFallasUrl = t.ImagenFallasUrl,
                MaxInWorkshop = t.MaxInWorkshop,
                FrecuenciaMantenimientoDias = t.FrecuenciaMantenimientoDias,
                FrecuenciaPreventivoMeses = t.FrecuenciaPreventivoMeses,
                ProgramadosPorSemana = t.ProgramadosPorSemana,
                FechaProximoMantenimiento = t.FechaProximoMantenimiento,
                Activo = t.Activo,
                ProveedorId = t.ProveedorId,
                ProveedorNombre = t.Proveedor?.NombreCompleto,
                TotalVehiculos = t.TotalVehiculos
            });
            
            return Ok(ApiResponse<IEnumerable<TipoVehiculoDto>>.Ok(tiposDto, "Operación exitosa"));
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<TipoVehiculoDto>> GetTipoVehiculo(int id)
        {
            var tipo = await _tipoVehiculoRepository.GetByIdAsync(id);
            
            if (tipo == null)
            {
                return NotFound();
            }
            
            var tipoDto = new TipoVehiculoDto
            {
                Id = tipo.Id,
                Nombre = tipo.Nombre,
                Descripcion = tipo.Descripcion,
                ImagenUrl = tipo.ImagenUrl,
                ImagenFallasUrl = tipo.ImagenFallasUrl,
                MaxInWorkshop = tipo.MaxInWorkshop,
                FrecuenciaMantenimientoDias = tipo.FrecuenciaMantenimientoDias,
                FrecuenciaPreventivoMeses = tipo.FrecuenciaPreventivoMeses,
                ProgramadosPorSemana = tipo.ProgramadosPorSemana,
                FechaProximoMantenimiento = tipo.FechaProximoMantenimiento,
                Activo = tipo.Activo,
                ProveedorId = tipo.ProveedorId,
                ProveedorNombre = tipo.Proveedor?.NombreCompleto
            };
            
            return Ok(tipoDto);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateTipoVehiculo(int id, TipoVehiculoDto tipoDto)
        {
            if (id != tipoDto.Id)
            {
                return BadRequest();
            }

            var validacionPreventivo = ValidarProgramacionPreventiva(tipoDto);
            if (validacionPreventivo != null)
            {
                return BadRequest(ApiResponse<object>.Error(validacionPreventivo));
            }

            var tipo = await _tipoVehiculoRepository.GetByIdAsync(id);
            if (tipo == null)
            {
                return NotFound();
            }

            tipo.Nombre = tipoDto.Nombre;
            tipo.Descripcion = tipoDto.Descripcion;
            if (tipoDto.ImagenUrl != null)
            {
                tipo.ImagenUrl = tipoDto.ImagenUrl;
            }
            if (tipoDto.ImagenFallasUrl != null)
            {
                tipo.ImagenFallasUrl = tipoDto.ImagenFallasUrl;
            }
            tipo.MaxInWorkshop = tipoDto.MaxInWorkshop;
            tipo.FrecuenciaMantenimientoDias = tipoDto.FrecuenciaMantenimientoDias;
            tipo.FrecuenciaPreventivoMeses = tipoDto.FrecuenciaPreventivoMeses;
            tipo.ProgramadosPorSemana = await CalcularProgramadosPorSemanaAsync(id, tipoDto);
            tipo.FechaProximoMantenimiento = tipoDto.FechaProximoMantenimiento;
            tipo.Activo = tipoDto.Activo;
            tipo.ProveedorId = tipoDto.ProveedorId;
            tipo.UpdatedAt = DateTime.UtcNow;

            await _tipoVehiculoRepository.UpdateAsync(tipo);

            return NoContent();
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<TipoVehiculoDto>>> Create(TipoVehiculoDto tipoDto)
        {
            var validacionPreventivo = ValidarProgramacionPreventiva(tipoDto);
            if (validacionPreventivo != null)
            {
                return BadRequest(ApiResponse<TipoVehiculoDto>.Error(validacionPreventivo));
            }

            var tipo = new TipoVehiculo
            {
                Nombre = tipoDto.Nombre,
                Descripcion = tipoDto.Descripcion,
                ImagenUrl = tipoDto.ImagenUrl,
                ImagenFallasUrl = tipoDto.ImagenFallasUrl,
                MaxInWorkshop = tipoDto.MaxInWorkshop,
                FrecuenciaMantenimientoDias = tipoDto.FrecuenciaMantenimientoDias,
                FrecuenciaPreventivoMeses = tipoDto.FrecuenciaPreventivoMeses,
                ProgramadosPorSemana = null,
                FechaProximoMantenimiento = tipoDto.FechaProximoMantenimiento,
                Activo = true,
                ProveedorId = tipoDto.ProveedorId,
                CreatedAt = DateTime.UtcNow
            };

            await _tipoVehiculoRepository.CreateAsync(tipo);

            tipo.ProgramadosPorSemana = await CalcularProgramadosPorSemanaAsync(tipo.Id, tipoDto);
            tipo.UpdatedAt = DateTime.UtcNow;
            await _tipoVehiculoRepository.UpdateAsync(tipo);
            
            tipoDto.Id = tipo.Id;
            tipoDto.Activo = tipo.Activo;
            tipoDto.ProgramadosPorSemana = tipo.ProgramadosPorSemana;

            return CreatedAtAction(nameof(GetTipoVehiculo), new { id = tipo.Id }, ApiResponse<TipoVehiculoDto>.Ok(tipoDto, "Tipo de vehículo creado exitosamente"));
        }

        [HttpDelete("{id}")]
        public async Task<ActionResult<ApiResponse<object>>> Delete(int id)
        {
            var tipo = await _tipoVehiculoRepository.GetByIdAsync(id);
            if (tipo == null)
            {
                return NotFound(ApiResponse<object>.Error("Tipo de vehículo no encontrado"));
            }

            await _tipoVehiculoRepository.DeleteAsync(id);
            return Ok(ApiResponse<object>.Ok(null, "Tipo de vehículo eliminado exitosamente"));
        }

        [HttpPost("{id}/imagen")]
        public async Task<ActionResult<ApiResponse<object>>> UploadImagen(int id, IFormFile file)
        {
            var tipo = await _tipoVehiculoRepository.GetByIdAsync(id);
            if (tipo == null)
            {
                return NotFound(ApiResponse<object>.Error("Tipo de vehículo no encontrado"));
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(ApiResponse<object>.Error("No se proporcionó un archivo válido"));
            }

            try
            {
                var fileName = $"tipov_image_{id}{Path.GetExtension(file.FileName)}";
                var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "tiposvehiculo");
                
                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                }

                var filePath = Path.Combine(uploadsFolder, fileName);
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                // Generar URL relativa para guardar en BD
                var imageUrl = $"/uploads/tiposvehiculo/{fileName}";
                // Guardar la URL sin el slash inicial para evitar confusiones de ruta si es necesario, 
                // pero como usamos UseStaticFiles, el path desde la raíz es correcto.
                tipo.ImagenUrl = imageUrl; 
                tipo.UpdatedAt = DateTime.UtcNow;
                await _tipoVehiculoRepository.UpdateAsync(tipo);

                return Ok(ApiResponse<object>.Ok(new { imagenUrl = imageUrl }, "Imagen subida exitosamente"));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.Error($"Error interno: {ex.Message}"));
            }
        }

        [HttpPost("{id}/imagen-fallas")]
        public async Task<ActionResult<ApiResponse<object>>> UploadImagenFallas(int id, IFormFile file)
        {
            var tipo = await _tipoVehiculoRepository.GetByIdAsync(id);
            if (tipo == null)
            {
                return NotFound(ApiResponse<object>.Error("Tipo de vehÃ­culo no encontrado"));
            }

            if (file == null || file.Length == 0)
            {
                return BadRequest(ApiResponse<object>.Error("No se proporcionÃ³ un archivo vÃ¡lido"));
            }

            try
            {
                var fileName = $"tipov_fallas_{id}{Path.GetExtension(file.FileName)}";
                var uploadsFolder = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads", "tiposvehiculo");

                if (!Directory.Exists(uploadsFolder))
                {
                    Directory.CreateDirectory(uploadsFolder);
                }

                var filePath = Path.Combine(uploadsFolder, fileName);
                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var imageUrl = $"/uploads/tiposvehiculo/{fileName}";
                tipo.ImagenFallasUrl = imageUrl;
                tipo.UpdatedAt = DateTime.UtcNow;
                await _tipoVehiculoRepository.UpdateAsync(tipo);

                return Ok(ApiResponse<object>.Ok(new { imagenFallasUrl = imageUrl }, "Imagen de fallas subida exitosamente"));
            }
            catch (Exception ex)
            {
                return StatusCode(500, ApiResponse<object>.Error($"Error interno: {ex.Message}"));
            }
        }

        private static string? ValidarProgramacionPreventiva(TipoVehiculoDto tipoDto)
        {
            var frecuenciaMeses = tipoDto.FrecuenciaPreventivoMeses;

            if (frecuenciaMeses.HasValue && frecuenciaMeses.Value <= 0)
            {
                return "La frecuencia preventiva en meses debe ser mayor a cero.";
            }

            return null;
        }

        private async Task<int?> CalcularProgramadosPorSemanaAsync(int tipoVehiculoId, TipoVehiculoDto tipoDto)
        {
            var frecuenciaMeses = tipoDto.FrecuenciaPreventivoMeses.GetValueOrDefault();
            var frecuenciaDias = tipoDto.FrecuenciaMantenimientoDias.GetValueOrDefault();

            if (frecuenciaMeses <= 0 && frecuenciaDias <= 0)
            {
                return null;
            }

            var totalVehiculos = await _tipoVehiculoRepository.CountVehiculosByTipoAsync(tipoVehiculoId);
            if (totalVehiculos <= 0)
            {
                return 0;
            }

            var semanasCiclo = frecuenciaMeses > 0
                ? frecuenciaMeses * 4.345
                : Math.Max(1.0, frecuenciaDias / 7.0);

            var porSemana = (int)Math.Ceiling(totalVehiculos / semanasCiclo);
            return Math.Clamp(porSemana, 1, totalVehiculos);
        }
    }
}
