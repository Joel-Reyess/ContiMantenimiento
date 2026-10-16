namespace MantenimientoEquipos.DTOs;

/// <summary>Un registro de la bitácora (LogAcciones): quién hizo qué y cuándo</summary>
public class BitacoraDto
{
    public int Id { get; set; }
    /// <summary>En UTC (con "Z"), para que el navegador la muestre en hora local</summary>
    public DateTime Fecha { get; set; }
    public string? Usuario { get; set; }
    public required string Accion { get; set; }
    public required string Entidad { get; set; }
    public int? EntidadId { get; set; }
    public string? Descripcion { get; set; }
}
