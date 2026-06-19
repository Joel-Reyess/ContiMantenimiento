namespace MantenimientoEquipos.DTOs;

public class ReportImageFaultDto
{
    public int Id { get; set; }
    public int ReporteFallaId { get; set; }
    public int ImageFaultId { get; set; }
    public string? ImageFaultName { get; set; }
    public int? VehicleImagePointId { get; set; }
    public decimal? XPct { get; set; }
    public decimal? YPct { get; set; }
}

public class ReportImageFaultCreateDto
{
    public int ImageFaultId { get; set; }
    public int? VehicleImagePointId { get; set; }
}
