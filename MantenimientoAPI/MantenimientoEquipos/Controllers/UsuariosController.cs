using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Utils;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UsuariosController : ControllerBase
{
    private readonly MantenimientoDbContext _db;
    private const string TempPasswordChars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    public UsuariosController(MantenimientoDbContext db)
    {
        _db = db;
    }

    private static string GenerateTemporaryPassword(int length = 10)
    {
        var chars = new char[length];
        for (var i = 0; i < length; i++)
        {
            chars[i] = TempPasswordChars[RandomNumberGenerator.GetInt32(TempPasswordChars.Length)];
        }

        return $"Temp-{new string(chars)}";
    }

    [HttpGet]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 100, [FromQuery] int? rolId = null, [FromQuery] bool? activo = null)
    {
        var query = _db.Users
            .Include(u => u.Roles)
            .AsQueryable();

        if (rolId.HasValue)
            query = query.Where(u => u.Roles.Any(r => r.Id == rolId.Value));
        if (activo.HasValue)
            query = query.Where(u => u.Status == (activo.Value ? UserStatusEnum.Activo : UserStatusEnum.Desactivado));

        var total = await query.CountAsync();
        var items = await query
            .OrderBy(u => u.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new
            {
                u.Id,
                u.NombreCompleto,
                u.Username,
                u.Email,
                u.Telefono,
                u.AreaId,
                AreaNombre = u.Area != null ? u.Area.Nombre : null,
                u.NumeroEmpleado,
                RolNombre = u.Roles.Select(r => r.Nombre).FirstOrDefault(),
                Activo = u.Status == UserStatusEnum.Activo
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(new
        {
          Items = items,
          TotalItems = total,
          Page = page,
          PageSize = pageSize
        }));
    }

    [HttpGet("tecnicos")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico")]
    public async Task<IActionResult> GetTecnicos()
    {
        // Buscar el rol "Tecnico" en la base de datos
        var tecnicoRole = await _db.Roles.FirstOrDefaultAsync(r => r.Nombre.ToLower() == "tecnico");
        if (tecnicoRole == null)
        {
            return Ok(ApiResponse<object>.Ok(new { Items = new List<object>() }));
        }

        var tecnicos = await _db.Users
            .Where(u => u.Roles.Any(r => r.Id == tecnicoRole.Id) && u.Status == UserStatusEnum.Activo)
            .Select(u => new
            {
                u.Id,
                u.NombreCompleto,
                u.Username,
                u.NumeroEmpleado
            })
            .ToListAsync();

        return Ok(ApiResponse<object>.Ok(new { Items = tecnicos }));
    }

    [HttpPost("{id}/reset-password")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> ResetPassword(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null)
            return NotFound(ApiResponse<string>.Error("Usuario no encontrado"));

        // Generar contraseña temporal
        var passwordTemporal = GenerateTemporaryPassword();
        
        var salt = PasswordHasher.GenerateSalt();
        var hash = PasswordHasher.HashPassword(passwordTemporal, salt);

        user.PasswordSalt = salt;
        user.PasswordHash = hash;
        user.Status = UserStatusEnum.Activo;
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<object>.Ok(new { passwordTemporal }, "Contraseña restablecida correctamente"));
    }

    [HttpPut("{id}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> Update(int id, [FromBody] UserUpdateRequest request)
    {
        var user = await _db.Users
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null)
            return NotFound(ApiResponse<string>.Error("Usuario no encontrado"));

        user.NombreCompleto = request.NombreCompleto;
        user.Email = request.Email;
        user.Telefono = request.Telefono;
        user.AreaId = request.AreaId;
        user.UpdatedAt = DateTime.UtcNow;

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            var salt = PasswordHasher.GenerateSalt();
            user.PasswordSalt = salt;
            user.PasswordHash = PasswordHasher.HashPassword(request.Password, salt);
        }

        if (request.RolId > 0)
        {
            var role = await _db.Roles.FindAsync(request.RolId);
            if (role != null)
            {
                user.Roles.Clear();
                user.Roles.Add(role);
            }
        }

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok("Usuario actualizado correctamente"));
    }

    [HttpPost("{id}/activar")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> Activar(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound(ApiResponse<string>.Error("Usuario no encontrado"));

        user.Status = UserStatusEnum.Activo;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<string>.Ok("Usuario activado"));
    }

    [HttpPost("{id}/desactivar")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> Desactivar(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound(ApiResponse<string>.Error("Usuario no encontrado"));

        user.Status = UserStatusEnum.Desactivado;
        await _db.SaveChangesAsync();
        return Ok(ApiResponse<string>.Ok("Usuario desactivado"));
    }

    [HttpDelete("{id}")]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> Delete(int id)
    {
        var user = await _db.Users
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Id == id);

        if (user == null) return NotFound(ApiResponse<string>.Error("Usuario no encontrado"));

        try
        {
            await using var tx = await _db.Database.BeginTransactionAsync();

            // Notificaciones usa FK restrict; se eliminan antes de borrar el usuario.
            await _db.Notificaciones
                .Where(n => n.UsuarioId == id)
                .ExecuteDeleteAsync();

            // Limpiar relaciones many-to-many para evitar restricciones en UserRoles.
            user.Roles.Clear();
            _db.Users.Remove(user);
            await _db.SaveChangesAsync();

            await tx.CommitAsync();
            return Ok(ApiResponse<string>.Ok("Usuario eliminado"));
        }
        catch (DbUpdateException)
        {
            return Conflict(ApiResponse<string>.Error(
                "No se pudo eliminar el usuario porque tiene información relacionada. Desactívalo en su lugar."));
        }
    }
}
