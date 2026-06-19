using MantenimientoEquipos.Models.Enums;

namespace MantenimientoEquipos.DTOs;

public class NotificacionDto
{
    public int Id { get; set; }
    public TipoNotificacionEnum Tipo { get; set; }
    public string? TipoNombre { get; set; }
    public required string Titulo { get; set; }
    public required string Mensaje { get; set; }
    public string? UrlDestino { get; set; }
    public int? ReferenciaId { get; set; }
    public string? TipoReferencia { get; set; }
    public bool Leida { get; set; }
    public DateTime? FechaLectura { get; set; }
    public DateTime FechaCreacion { get; set; }
}

public class NotificacionesResumenDto
{
    public int TotalNoLeidas { get; set; }
    public List<NotificacionDto> NotificacionesRecientes { get; set; } = new();
}

public class MarcarLeidaRequest
{
    public List<int> NotificacionIds { get; set; } = new();
}
