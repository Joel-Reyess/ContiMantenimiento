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

    // Sin caracteres que se confunden al dictarlos o copiarlos (0/O, 1/l/I)
    private const string CaracteresTemporales = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    /// <summary>
    /// Contraseña temporal aleatoria ("Temp-xxxxxxxxxx") para restablecer o dar de alta usuarios
    /// </summary>
    public static string GenerarTemporal(int longitud = 10)
    {
        var chars = new char[longitud];
        for (var i = 0; i < longitud; i++)
            chars[i] = CaracteresTemporales[RandomNumberGenerator.GetInt32(CaracteresTemporales.Length)];
        return $"Temp-{new string(chars)}";
    }
}
