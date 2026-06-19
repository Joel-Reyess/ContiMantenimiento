using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Microsoft.EntityFrameworkCore;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.Repositories;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Configuración global de Serilog
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .CreateLogger();
builder.Host.UseSerilog();

// Agregar controladores con configuración JSON
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// Swagger/OpenAPI
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "API Mantenimiento de Equipos - Continental", Version = "v1" });

    // Configurar autenticación JWT en Swagger
    c.AddSecurityDefinition("Bearer", new Microsoft.OpenApi.Models.OpenApiSecurityScheme
    {
        Description = "JWT Authorization header. Ejemplo: \"Bearer {token}\"",
        Name = "Authorization",
        In = Microsoft.OpenApi.Models.ParameterLocation.Header,
        Type = Microsoft.OpenApi.Models.SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new Microsoft.OpenApi.Models.OpenApiSecurityRequirement
    {
        {
            new Microsoft.OpenApi.Models.OpenApiSecurityScheme
            {
                Reference = new Microsoft.OpenApi.Models.OpenApiReference
                {
                    Type = Microsoft.OpenApi.Models.ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Configurar DbContext
builder.Services.AddDbContext<MantenimientoDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Registrar servicios
builder.Services.AddScoped<VehiculoService>();
builder.Services.AddScoped<ReporteFallaService>();
builder.Services.AddScoped<OrdenTrabajoService>();
builder.Services.AddScoped<NotificacionService>();
builder.Services.AddScoped<DashboardService>();
builder.Services.AddScoped<SolicitudRefaccionService>();
builder.Services.AddScoped<SolicitudActividadAdicionalService>();
builder.Services.AddScoped<ChecklistService>();
builder.Services.AddScoped<VehiculoDocumentoService>();
builder.Services.AddScoped<ITipoVehiculoRepository, TipoVehiculoRepository>();
builder.Services.AddScoped<ReporteFallaChecklistItemService>();
builder.Services.AddScoped<VehiculoPrefijoConfigService>();
builder.Services.AddScoped<LiderTipoVehiculoAsignacionService>();
builder.Services.AddScoped<OrdenTrabajoChecklistItemService>();
builder.Services.AddScoped<MantenimientoEquipos.Services.TecnicoKPIsService>();

// Configuración CORS para permitir peticiones desde el frontend
var allowedOrigins = new[] {
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",
    "http://slas052a:5174",
    "https://x5xc1dsr-5173.usw3.devtunnels.ms",
    // Agregar aquí otros orígenes permitidos en producción
};
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
    );
});

// JWT Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.UseSecurityTokenValidators = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = false,
        IssuerSigningKey = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "MantenimientoEquiposContiSLP2024SecretKey123!"))
    };
});

builder.Services.AddAuthorization();

var app = builder.Build();

// Seed inicial de datos
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<MantenimientoDbContext>();
    await SeedDataAsync(db);
}

// Configurar pipeline HTTP
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "API Mantenimiento v1");
        c.RoutePrefix = "swagger";
    });
}

// Habilitar CORS antes de autenticación
app.UseCors("FrontendPolicy" );

// Servir archivos estaticos (wwwroot/uploads)
app.UseStaticFiles(); // Para archivos en wwwroot por defecto

// Mapeo explícito para la carpeta de uploads con soporte para tipos desconocidos y depuración
var uploadsPath = Path.Combine(builder.Environment.ContentRootPath, "wwwroot", "uploads");
if (!Directory.Exists(uploadsPath))
{
    Directory.CreateDirectory(uploadsPath);
}

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads",
    ServeUnknownFileTypes = true
});

// Middleware para rechazar tokens de sesión cerrada
app.UseMiddleware<LogoutTokenMiddleware>();

// Autenticación y Autorización
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<RoleAuthorizationMiddleware>();

app.MapControllers();

app.Run();

// Método para inicializar datos semilla
static async Task SeedDataAsync(MantenimientoDbContext db)
{
    // Crear roles si no existen
    if (!db.Roles.Any())
    {
        var roles = new[]
        {
            new Rol { Nombre = "SuperUsuario", Descripcion = "Acceso total al sistema" },
            new Rol { Nombre = "Administrador", Descripcion = "Administrador del sistema" },
            new Rol { Nombre = "Supervisor", Descripcion = "Supervisor de área" },
            new Rol { Nombre = "Tecnico", Descripcion = "Técnico de mantenimiento" },
            new Rol { Nombre = "Operador", Descripcion = "Operador de vehículos" },
            new Rol { Nombre = "Lider", Descripcion = "Líder de producción - Reporte rápido de fallas" }
        };
        db.Roles.AddRange(roles);
        await db.SaveChangesAsync();
    }

    // Crear usuarios si no existen
    if (!db.Users.Any())
    {
        var adminRole = db.Roles.First(r => r.Nombre == "SuperUsuario");
        var operadorRole = db.Roles.First(r => r.Nombre == "Operador");
        var tecnicoRole = db.Roles.First(r => r.Nombre == "Tecnico");

        // Admin
        var salt1 = MantenimientoEquipos.Utils.PasswordHasher.GenerateSalt();
        var hash1 = MantenimientoEquipos.Utils.PasswordHasher.HashPassword("Admin123!", salt1);
        var admin = new User
        {
            NombreCompleto = "Administrador del Sistema",
            Username = "admin",
            Email = "admin@continental.com",
            PasswordHash = hash1,
            PasswordSalt = salt1,
            NumeroEmpleado = "00000001",
            CreatedAt = DateTime.UtcNow,
            Roles = new List<Rol> { adminRole }
        };

        // Proveedor Externo (Técnico)
        var salt2 = MantenimientoEquipos.Utils.PasswordHasher.GenerateSalt();
        var hash2 = MantenimientoEquipos.Utils.PasswordHasher.HashPassword("Proveedor123!", salt2);
        var proveedor = new User
        {
            NombreCompleto = "Proveedor Externo MX",
            Username = "proveedor",
            Email = "proveedor@proveedorexterno.com",
            PasswordHash = hash2,
            PasswordSalt = salt2,
            NumeroEmpleado = "EXT00001",
            CreatedAt = DateTime.UtcNow,
            Roles = new List<Rol> { tecnicoRole }
        };

        // Cliente Interno (Operador)
        var salt3 = MantenimientoEquipos.Utils.PasswordHasher.GenerateSalt();
        var hash3 = MantenimientoEquipos.Utils.PasswordHasher.HashPassword("Cliente123!", salt3);
        var cliente = new User
        {
            NombreCompleto = "Juan Pérez García",
            Username = "cliente",
            Email = "juan.perez@continental.com",
            PasswordHash = hash3,
            PasswordSalt = salt3,
            NumeroEmpleado = "32000100",
            CreatedAt = DateTime.UtcNow,
            Roles = new List<Rol> { operadorRole }
        };

        db.Users.AddRange(admin, proveedor, cliente);
        await db.SaveChangesAsync();
    }

    // Crear áreas si no existen
    if (!db.Areas.Any())
    {
        var areas = new[]
        {
            new Area { Nombre = "Producción", Descripcion = "Área de producción", Activa = true },
            new Area { Nombre = "Almacén", Descripcion = "Área de almacén y logística", Activa = true },
            new Area { Nombre = "Mantenimiento", Descripcion = "Área de mantenimiento", Activa = true }
        };
        db.Areas.AddRange(areas);
        await db.SaveChangesAsync();
    }

    // Crear categorías de fallas si no existen
    if (!db.CategoriasFalla.Any())
    {
        var categorias = new[]
        {
            new CategoriaFalla { Nombre = "Motor", Descripcion = "Problemas relacionados con el motor", Activa = true },
            new CategoriaFalla { Nombre = "Transmisión", Descripcion = "Problemas de transmisión", Activa = true },
            new CategoriaFalla { Nombre = "Sistema Eléctrico", Descripcion = "Fallas eléctricas", Activa = true },
            new CategoriaFalla { Nombre = "Frenos", Descripcion = "Sistema de frenos", Activa = true },
            new CategoriaFalla { Nombre = "Llantas/Ruedas", Descripcion = "Llantas y ruedas", Activa = true },
            new CategoriaFalla { Nombre = "Dirección", Descripcion = "Sistema de dirección", Activa = true },
            new CategoriaFalla { Nombre = "Estructura/Carrocería", Descripcion = "Daños estructurales", Activa = true },
            new CategoriaFalla { Nombre = "Sistema Hidráulico", Descripcion = "Componentes hidráulicos", Activa = true },
            new CategoriaFalla { Nombre = "Otro", Descripcion = "Otras fallas no categorizadas", Activa = true }
        };
        db.CategoriasFalla.AddRange(categorias);
        await db.SaveChangesAsync();
    }

}
