using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.DTOs;

public class LoginRequest
{
    [Required(ErrorMessage = "El nombre de usuario es requerido")]
    public required string Username { get; set; }

    [Required(ErrorMessage = "La contraseña es requerida")]
    public required string Password { get; set; }
}

public class LoginResponse
{
    public required string Token { get; set; }
    public DateTime Expiration { get; set; }
    public UserInfoDto Usuario { get; set; } = null!;
}

public class RegisterRequest
{
    [Required(ErrorMessage = "El nombre completo es requerido")]
    [MaxLength(100)]
    public required string NombreCompleto { get; set; }

    [Required(ErrorMessage = "El nombre de usuario es requerido")]
    [MaxLength(50)]
    public required string Username { get; set; }

    [Required(ErrorMessage = "La contraseña es requerida")]
    [MinLength(6, ErrorMessage = "La contrasena debe tener al menos 6 caracteres")]
    public required string Password { get; set; }

    [MaxLength(100)]
    public string? Email { get; set; }

    [MaxLength(20)]
    public string? NumeroEmpleado { get; set; }

    [MaxLength(20)]
    public string? Telefono { get; set; }

    public int? AreaId { get; set; }

    public List<int> RoleIds { get; set; } = new();
}

public class ChangePasswordRequest
{
    [Required]
    public required string PasswordActual { get; set; }

    [Required]
    [MinLength(6)]
    public required string NuevaPassword { get; set; }

    [Required]
    public required string ConfirmarPassword { get; set; }
}

public class UserInfoDto
{
    public int Id { get; set; }
    public required string NombreCompleto { get; set; }
    public required string Username { get; set; }
    public string? Email { get; set; }
    public string? NumeroEmpleado { get; set; }
    public int? AreaId { get; set; }
    public string? AreaNombre { get; set; }
    public List<string> Roles { get; set; } = new();
    public DateTime? UltimoInicioSesion { get; set; }
}

public class UserUpdateRequest
{
    [Required]
    public required string NombreCompleto { get; set; }
    public string? Email { get; set; }
    public string? Telefono { get; set; }
    public int? AreaId { get; set; }
    public int RolId { get; set; }

    [MinLength(6, ErrorMessage = "La contrasena debe tener al menos 6 caracteres")]
    public string? Password { get; set; }
}

