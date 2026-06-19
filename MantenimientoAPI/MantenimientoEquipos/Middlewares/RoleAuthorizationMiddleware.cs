using System.Security.Claims;
using MantenimientoEquipos.Models;

namespace MantenimientoEquipos.Middlewares;

/// <summary>
/// Middleware para validar autorización basada en roles
/// </summary>
public class RoleAuthorizationMiddleware
{
    private readonly RequestDelegate _next;

    public RoleAuthorizationMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var endpoint = context.GetEndpoint();
        if (endpoint != null)
        {
            var rolesAllowed = endpoint.Metadata.GetMetadata<RolesAllowedAttribute>();
            if (rolesAllowed != null)
            {
                if (!context.User.Identity?.IsAuthenticated ?? true)
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(
                        new ApiResponse<string>(false, null, "No autenticado. Inicie sesión para continuar."));
                    return;
                }

                var userRoles = context.User.Claims
                    .Where(c => c.Type == ClaimTypes.Role)
                    .Select(c => c.Value)
                    .ToList();

                var hasRequiredRole = rolesAllowed.Roles.Any(r => userRoles.Contains(r));
                if (!hasRequiredRole)
                {
                    context.Response.StatusCode = StatusCodes.Status403Forbidden;
                    await context.Response.WriteAsJsonAsync(
                        new ApiResponse<string>(false, null, "No tiene permisos para realizar esta acción."));
                    return;
                }
            }
        }

        await _next(context);
    }
}
