namespace MantenimientoEquipos.DTOs;

public class TecnicoKpiDto
{
    public int TecnicoId { get; set; }
    public string NombreCompleto { get; set; } = string.Empty;
    public int MantenimientosCompletados { get; set; }
    public int MetaMensual { get; set; }
    public double PorcentajeCumplimientoMeta { get; set; }
    public double PorcentajeMantenimientosATiempo { get; set; } // < 7 días
    public double TiempoPromedioResolucionDias { get; set; }
    public int OrdenesActivas { get; set; }
    public int OrdenesVencidas { get; set; } // > 7 días en proceso
    public List<OrdenTrabajoResumenKpiDto>? MantenimientosDetalle { get; set; }
}

public class OrdenTrabajoResumenKpiDto
{
    public int Id { get; set; }
    public string Folio { get; set; } = string.Empty;
    public string VehiculoCodigo { get; set; } = string.Empty;
    public string TipoMantenimiento { get; set; } = string.Empty;
    public DateTime FechaFinalizacion { get; set; }
    public double DiasTranscurridos { get; set; }
}

public class UpsertMetaTecnicoDto
{
    public int TecnicoId { get; set; }
    public int Mes { get; set; }
    public int Anio { get; set; }
    public int MetaMantenimientos { get; set; }
}
