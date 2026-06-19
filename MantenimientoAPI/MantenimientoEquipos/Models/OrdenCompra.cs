using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace MantenimientoEquipos.Models;

public class OrdenCompra
{
    [Key]
    public int Id { get; set; }

    [Required]
    [MaxLength(50)]
    public string Folio { get; set; } = string.Empty;

    public int ProveedorId { get; set; }
    [ForeignKey("ProveedorId")]
    public virtual User Proveedor { get; set; } = null!;

    public DateTime FechaRegistro { get; set; } = DateTime.UtcNow;

    [MaxLength(20)]
    public string Estado { get; set; } = "Activa"; // Activa, Completada, Cancelada

    [Column(TypeName = "decimal(18,2)")]
    public decimal Total { get; set; }

    [MaxLength(50)]
    public string? NumeroExterno { get; set; }

    public virtual ICollection<RegistroPago> Pagos { get; set; } = new List<RegistroPago>();

    public OrdenCompra()
    {
        // Constructor vacio necesario para Entity Framework
    }

    // Constructor para usar en el servicio
    public OrdenCompra(string folio, int proveedorId, decimal total, string estado = "Activa", string? numeroExterno = null)
    {
        Folio = folio;
        ProveedorId = proveedorId;
        Total = total;
        Estado = estado;
        NumeroExterno = numeroExterno;
        FechaRegistro = DateTime.UtcNow;
    }
}
