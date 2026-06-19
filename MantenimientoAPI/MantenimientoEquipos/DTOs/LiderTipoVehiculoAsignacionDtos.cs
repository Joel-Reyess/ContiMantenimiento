using System.ComponentModel.DataAnnotations;
using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.DTOs;

public class LiderTipoVehiculoAsignacionDto
{
    public int Id { get; set; }
    public int UsuarioId { get; set; }
    public string UsuarioNombre { get; set; } = string.Empty;
    public TipoVehiculoEnum TipoVehiculo { get; set; }
    public string TipoVehiculoNombre { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class CreateLiderTipoVehiculoAsignacionRequest
{
    [Required]
    public int UsuarioId { get; set; }

    [Required]
    public TipoVehiculoEnum TipoVehiculo { get; set; }
}
