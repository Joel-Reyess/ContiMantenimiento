namespace MantenimientoEquipos.DTOs;

public class SolicitudActividadAdicionalDto
{
    public int Id { get; set; }
    public int OrdenTrabajoId { get; set; }
    public string? OrdenTrabajoFolio { get; set; }
    public string Descripcion { get; set; } = string.Empty;
    public string? Justificacion { get; set; }
    public string Estado { get; set; } = "Pendiente";
    public int SolicitadoPorId { get; set; }
    public string? SolicitadoPorNombre { get; set; }
    public DateTime FechaSolicitud { get; set; }
    public int? AprobadoPorId { get; set; }
    public string? AprobadoPorNombre { get; set; }
    public DateTime? FechaRespuesta { get; set; }
    public string? ComentariosResolucion { get; set; }
    public string? FotoUrl { get; set; }
}

public class CreateSolicitudActividadAdicionalDto
{
    public int OrdenTrabajoId { get; set; }
    public string Descripcion { get; set; } = string.Empty;
    public string? Justificacion { get; set; }
    public string? FotoUrl { get; set; }
}

public class ResponderSolicitudActividadDto
{
    public bool Aprobado { get; set; }
    public string? Comentarios { get; set; }
}
