namespace MantenimientoEquipos.Middlewares;

/// <summary>
/// Atributo para especificar los roles permitidos en un endpoint
/// </summary>
[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RolesAllowedAttribute : Attribute
{
    public string[] Roles { get; }

    public RolesAllowedAttribute(params string[] roles)
    {
        Roles = roles;
    }
}
