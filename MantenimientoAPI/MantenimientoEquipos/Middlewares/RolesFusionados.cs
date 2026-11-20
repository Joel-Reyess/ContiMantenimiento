using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;

namespace MantenimientoEquipos.Middlewares;

/// <summary>
/// USR-03 (Reporte 7): el rol Supervisor (Gerente de Mantenimiento) se fusionó con el Administrador del Sistema y el
/// SuperUsuario se eliminó. En la base todos quedan como Administrador (script 23); aquí el Administrador recibe
/// también los permisos que antes eran del Supervisor y del SuperUsuario, y una sesión iniciada antes del cambio con
/// esos roles sigue funcionando como Administrador. Así los permisos ([RolesAllowed], User.IsInRole, UsuarioFlujo)
/// quedan como la unión de los tres sin tocar cada pantalla.
/// </summary>
public class RolesFusionados : IClaimsTransformation
{
    private static readonly string[] Fusionados = { "Administrador", "Supervisor", "SuperUsuario" };

    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity is not ClaimsIdentity identidad || !identidad.IsAuthenticated) return Task.FromResult(principal);
        var roles = identidad.FindAll(ClaimTypes.Role).Select(c => c.Value).ToList();
        if (!roles.Any(r => Fusionados.Contains(r))) return Task.FromResult(principal);
        foreach (var r in Fusionados.Where(r => !roles.Contains(r)))
            identidad.AddClaim(new Claim(ClaimTypes.Role, r));
        return Task.FromResult(principal);
    }
}
