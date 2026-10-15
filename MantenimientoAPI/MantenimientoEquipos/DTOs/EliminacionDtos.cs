using System.ComponentModel.DataAnnotations;

namespace MantenimientoEquipos.DTOs;

public class EliminarIdsRequest
{
    [Required]
    [MinLength(1, ErrorMessage = "Selecciona al menos un registro")]
    public List<int> Ids { get; set; } = new();
}

public class EliminacionResultadoDto
{
    public int Reportes { get; set; }
    public int Ordenes { get; set; }
    /// <summary>Folios eliminados, para mostrarlos en el mensaje de confirmación</summary>
    public List<string> Folios { get; set; } = new();
}
