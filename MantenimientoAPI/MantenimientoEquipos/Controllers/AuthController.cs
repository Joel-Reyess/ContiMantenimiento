using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Utils;
using MantenimientoEquipos.Middlewares;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly MantenimientoDbContext _db;
    private readonly IConfiguration _config;

    public AuthController(MantenimientoDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var username = request.Username.Trim();
        var password = request.Password;

        var user = await _db.Users
            .Include(u => u.Roles)
            .Include(u => u.Area)
            .FirstOrDefaultAsync(u => u.Username == username);

        if (user == null)
            return Unauthorized(ApiResponse<string>.Error("Usuario o contraseña incorrectos"));

        var isPasswordValid = PasswordHasher.VerifyPassword(password, user.PasswordSalt, user.PasswordHash);
        if (!isPasswordValid && !string.Equals(password, password.Trim(), StringComparison.Ordinal))
        {
            // Tolerar espacios accidentales al copiar/pegar contraseñas temporales.
            isPasswordValid = PasswordHasher.VerifyPassword(password.Trim(), user.PasswordSalt, user.PasswordHash);
        }

        if (!isPasswordValid)
            return Unauthorized(ApiResponse<string>.Error("Usuario o contraseña incorrectos"));

        if (user.Status != Models.Enums.UserStatusEnum.Activo)
            return Unauthorized(ApiResponse<string>.Error("Usuario inactivo o suspendido"));

        // Actualizar último inicio de sesión
        user.UltimoInicioSesion = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        // Generar token JWT
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim("NombreCompleto", user.NombreCompleto)
        };
        claims.AddRange(user.Roles.Select(r => new Claim(ClaimTypes.Role, r.Nombre)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiration = DateTime.UtcNow.AddHours(int.Parse(_config["Jwt:ExpirationHours"] ?? "8"));

        var token = new JwtSecurityToken(
            claims: claims,
            expires: expiration,
            signingCredentials: creds
        );

        var response = new LoginResponse
        {
            Token = new JwtSecurityTokenHandler().WriteToken(token),
            Expiration = expiration,
            Usuario = new UserInfoDto
            {
                Id = user.Id,
                NombreCompleto = user.NombreCompleto,
                Username = user.Username,
                Email = user.Email,
                NumeroEmpleado = user.NumeroEmpleado,
                AreaId = user.AreaId,
                AreaNombre = user.Area?.Nombre,
                Roles = user.Roles.Select(r => r.Nombre).ToList(),
                UltimoInicioSesion = user.UltimoInicioSesion
            }
        };

        return Ok(ApiResponse<LoginResponse>.Ok(response));
    }

    [HttpPost("refresh-token")]
    [Authorize]
    public async Task<IActionResult> RefreshToken()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null)
            return Unauthorized(ApiResponse<string>.Error("Token invÃ¡lido"));

        var userId = int.Parse(userIdClaim.Value);
        var user = await _db.Users
            .Include(u => u.Roles)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return Unauthorized(ApiResponse<string>.Error("Usuario no encontrado"));

        // Generar nuevo token
        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim("NombreCompleto", user.NombreCompleto)
        };
        claims.AddRange(user.Roles.Select(r => new Claim(ClaimTypes.Role, r.Nombre)));

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var expiration = DateTime.UtcNow.AddHours(int.Parse(_config["Jwt:ExpirationHours"] ?? "8"));

        var token = new JwtSecurityToken(
            claims: claims,
            expires: expiration,
            signingCredentials: creds
        );

        return Ok(ApiResponse<object>.Ok(new
        {
            Token = new JwtSecurityTokenHandler().WriteToken(token),
            Expiration = expiration
        }));
    }

    [HttpPost("logout")]
    [Authorize]
    public IActionResult Logout()
    {
        // Generar token de logout
        var claims = new List<Claim> { new Claim("logout", "true") };
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            claims: claims,
            expires: DateTime.UtcNow.AddYears(10),
            signingCredentials: creds
        );

        return Ok(ApiResponse<object>.Ok(new
        {
            Token = new JwtSecurityTokenHandler().WriteToken(token),
            Message = "SesiÃ³n cerrada correctamente"
        }));
    }

    [HttpPost("register")]
    [Authorize]
    [RolesAllowed("SuperUsuario", "Administrador")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request)
    {
        if (await _db.Users.AnyAsync(u => u.Username == request.Username))
            return BadRequest(ApiResponse<string>.Error("El nombre de usuario ya estÃ¡ en uso"));

        var roles = await _db.Roles.Where(r => request.RoleIds.Contains(r.Id)).ToListAsync();
        if (roles.Count != request.RoleIds.Count)
            return BadRequest(ApiResponse<string>.Error("Uno o mÃ¡s roles no existen"));

        var salt = PasswordHasher.GenerateSalt();
        var hash = PasswordHasher.HashPassword(request.Password, salt);

        var user = new User
        {
            NombreCompleto = request.NombreCompleto,
            Username = request.Username,
            Email = request.Email,
            PasswordHash = hash,
            PasswordSalt = salt,
            NumeroEmpleado = request.NumeroEmpleado,
            Telefono = request.Telefono,
            AreaId = request.AreaId,
            Roles = roles,
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok("Usuario creado exitosamente"));
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null)
            return Unauthorized(ApiResponse<string>.Error("No autenticado"));

        var userId = int.Parse(userIdClaim.Value);
        var user = await _db.Users.FindAsync(userId);

        if (user == null)
            return NotFound(ApiResponse<string>.Error("Usuario no encontrado"));

        if (!PasswordHasher.VerifyPassword(request.PasswordActual, user.PasswordSalt, user.PasswordHash))
            return BadRequest(ApiResponse<string>.Error("La contraseÃ±a actual es incorrecta"));

        if (request.NuevaPassword != request.ConfirmarPassword)
            return BadRequest(ApiResponse<string>.Error("Las contraseÃ±as no coinciden"));

        user.PasswordSalt = PasswordHasher.GenerateSalt();
        user.PasswordHash = PasswordHasher.HashPassword(request.NuevaPassword, user.PasswordSalt);
        user.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();

        return Ok(ApiResponse<string>.Ok("ContraseÃ±a actualizada correctamente"));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> GetCurrentUser()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null)
            return Unauthorized(ApiResponse<string>.Error("No autenticado"));

        var userId = int.Parse(userIdClaim.Value);
        var user = await _db.Users
            .Include(u => u.Roles)
            .Include(u => u.Area)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            return NotFound(ApiResponse<string>.Error("Usuario no encontrado"));

        var userInfo = new UserInfoDto
        {
            Id = user.Id,
            NombreCompleto = user.NombreCompleto,
            Username = user.Username,
            Email = user.Email,
            NumeroEmpleado = user.NumeroEmpleado,
            AreaId = user.AreaId,
            AreaNombre = user.Area?.Nombre,
            Roles = user.Roles.Select(r => r.Nombre).ToList(),
            UltimoInicioSesion = user.UltimoInicioSesion
        };

        return Ok(ApiResponse<UserInfoDto>.Ok(userInfo));
    }
}
