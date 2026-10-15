using System.Security.Claims;

namespace MantenimientoEquipos.Utils;

public static class ClaimsPrincipalExtensions
{
    public static int? UsuarioId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

    /// <summary>Nombre para la bitácora: el completo si viene en el token, si no el usuario</summary>
    public static string? NombreUsuario(this ClaimsPrincipal user) =>
        user.FindFirst("NombreCompleto")?.Value ?? user.FindFirst(ClaimTypes.Name)?.Value;
}
