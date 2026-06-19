using System.IdentityModel.Tokens.Jwt;
using MantenimientoEquipos.Models;

namespace MantenimientoEquipos.Middlewares;

/// <summary>
/// Middleware para rechazar tokens de sesión cerrada
/// </summary>
public class LogoutTokenMiddleware
{
    private readonly RequestDelegate _next;

    public LogoutTokenMiddleware(RequestDelegate next)
    {
        _next = next;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var authHeader = context.Request.Headers["Authorization"].FirstOrDefault();
        if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
        {
            var token = authHeader.Substring("Bearer ".Length).Trim();
            try
            {
                var handler = new JwtSecurityTokenHandler();
                var jwtToken = handler.ReadJwtToken(token);

                // Verificar si el token tiene el claim de logout
                var logoutClaim = jwtToken.Claims.FirstOrDefault(c => c.Type == "logout");
                if (logoutClaim != null && logoutClaim.Value == "true")
                {
                    context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                    await context.Response.WriteAsJsonAsync(
                        new ApiResponse<string>(false, null, "Sesión cerrada. Inicie sesión nuevamente."));
                    return;
                }
            }
            catch
            {
                // Si hay error al leer el token, continuar y dejar que el middleware de autenticación lo maneje
            }
        }

        await _next(context);
    }
}
