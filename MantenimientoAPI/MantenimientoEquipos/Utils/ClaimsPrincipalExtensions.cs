using System.Security.Claims;
using MantenimientoEquipos.Services;

namespace MantenimientoEquipos.Utils;

public static class ClaimsPrincipalExtensions
{
    public static int? UsuarioId(this ClaimsPrincipal user) =>
        int.TryParse(user.FindFirst(ClaimTypes.NameIdentifier)?.Value, out var id) ? id : null;

    /// <summary>Nombre para la bitácora: el completo si viene en el token, si no el usuario</summary>
    public static string? NombreUsuario(this ClaimsPrincipal user) =>
        user.FindFirst("NombreCompleto")?.Value ?? user.FindFirst(ClaimTypes.Name)?.Value;

    private static readonly string[] RolesConMasAlcance = { "SuperUsuario", "Administrador", "Supervisor", "Tecnico", "Lider" };

    /// <summary>
    /// Operador sin otro rol: solo consulta sus propios reportes (definición de roles, 23-oct-2026)
    /// </summary>
    /// <summary>Quién hace una acción del flujo de 7 etapas</summary>
    public static UsuarioFlujo UsuarioFlujo(this ClaimsPrincipal user) =>
        new(user.UsuarioId() ?? 0, user.NombreUsuario() ?? "Usuario", user.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList());

    public static bool EsSoloOperador(this ClaimsPrincipal user) =>
        user.IsInRole("Operador") && !RolesConMasAlcance.Any(user.IsInRole);
}
