using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.Models;

/// <summary>
/// Usuario del sistema - Puede ser Supervisor, Técnico o Administrativo
/// </summary>
public class User
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(100)]
    public required string NombreCompleto { get; set; }

    [Required]
    [MaxLength(50)]
    public required string Username { get; set; }

    [MaxLength(100)]
    public string? Email { get; set; }

    [Required]
    [MaxLength(100)]
    public required string PasswordHash { get; set; }

    [Required]
    public required string PasswordSalt { get; set; }

    [Required]
    public required ICollection<Rol> Roles { get; set; }

    [Required]
    public UserStatusEnum Status { get; set; } = UserStatusEnum.Activo;

    [MaxLength(20)]
    public string? NumeroEmpleado { get; set; }

    [MaxLength(20)]
    public string? Telefono { get; set; }

    public int? AreaId { get; set; }
    public virtual Area? Area { get; set; }

    public TipoTecnicoEnum? TipoTecnico { get; set; }

    [MaxLength(100)]
    public string? EmpresaExterna { get; set; }

    public decimal? TarifaHora { get; set; }

    /// <summary>
    /// Empresa proveedora del técnico (PDF 06-nov, USR-02): define el tarifario de sus órdenes de pago.
    /// Sin empresa se usa el costo base de cada actividad.
    /// </summary>
    public int? EmpresaId { get; set; }
    public virtual Empresa? Empresa { get; set; }

    [MaxLength(200)]
    public string? Especialidades { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? CreatedBy { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public int? UpdatedBy { get; set; }
    public DateTime? UltimoInicioSesion { get; set; }

    [NotMapped]
    public string RolNombre => Roles?.FirstOrDefault()?.Nombre ?? string.Empty;

    // Navegación
    public virtual ICollection<OrdenTrabajo> OrdenesAsignadas { get; set; } = new HashSet<OrdenTrabajo>();
    public virtual ICollection<ReporteFalla> ReportesCreados { get; set; } = new HashSet<ReporteFalla>();

    public User()
    {
        Roles = new HashSet<Rol>();
    }
}
