using System.Security.Cryptography;
using System.Text;

namespace MantenimientoEquipos.Utils;

/// <summary>
/// Utilidad para hash y verificación de contraseñas
/// </summary>
public static class PasswordHasher
{
    /// <summary>
    /// Genera el hash de una contraseña usando SHA256 y salt
    /// </summary>
    public static string HashPassword(string password, string salt)
    {
        using var sha256 = SHA256.Create();
        var saltedPassword = $"{password}{salt}";
        var bytes = Encoding.UTF8.GetBytes(saltedPassword);
        var hash = sha256.ComputeHash(bytes);
        return Convert.ToBase64String(hash);
    }

    /// <summary>
    /// Verifica si una contraseña coincide con el hash almacenado
    /// </summary>
    public static bool VerifyPassword(string password, string salt, string storedHash)
    {
        var computedHash = HashPassword(password, salt);
        return computedHash == storedHash;
    }

    /// <summary>
    /// Genera un salt aleatorio
    /// </summary>
    public static string GenerateSalt()
    {
        return Guid.NewGuid().ToString();
    }
}
