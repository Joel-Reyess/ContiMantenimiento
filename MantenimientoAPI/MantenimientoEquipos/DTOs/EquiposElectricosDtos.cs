namespace MantenimientoEquipos.DTOs;

// ===== Flujo de mantenimiento para equipos eléctricos (EQE-01 a EQE-12) =====

/// <summary>Datos propios del flujo eléctrico en el seguimiento de una orden</summary>
public class ElectricoInfoDto
{
    public bool EsPreventivo { get; set; }
    /// <summary>Operativo o Fuera de servicio</summary>
    public required string EstadoEquipo { get; set; }
    /// <summary>Pendiente de ingreso, En reparación o En mantenimiento (solo fuera de servicio)</summary>
    public string? SubestadoEquipo { get; set; }
    public string? NumeroEconomico { get; set; }
    public decimal? Horometro { get; set; }
    public string? Empresa { get; set; }
    public string? Tecnico { get; set; }
    public string? Diagnostico { get; set; }
    public string? ResultadoPruebas { get; set; }
    public string? TrabajoRealizado { get; set; }
    public string? TipoRevision { get; set; }
    public bool? CodigoFallaEncontrado { get; set; }
    public string? CodigoFalla { get; set; }
    public bool? CodigoFallaResuelto { get; set; }
    public DateTime? FechaAprobacionEntrega { get; set; }
    public string? AproboEntrega { get; set; }
    public DateTime? FechaDocumentoEntrega { get; set; }
    public List<DocumentoEntregaDto> Documentos { get; set; } = new();
    public List<CategoriaResultadoDto> Checklist { get; set; } = new();
    public int Activas { get; set; }
    public int Capacidad { get; set; }
}

public class DocumentoEntregaDto
{
    public int Id { get; set; }
    public required string Url { get; set; }
    public required string NombreArchivo { get; set; }
    public string? TipoContenido { get; set; }
    public long Tamano { get; set; }
    public string? SubidoPor { get; set; }
    public DateTime Fecha { get; set; }
}

public class CategoriaResultadoDto
{
    public int Numero { get; set; }
    public required string Nombre { get; set; }
    public List<ActividadResultadoDto> Actividades { get; set; } = new();
}

public class ActividadResultadoDto
{
    public int Id { get; set; }
    public required string Numero { get; set; }
    public required string Descripcion { get; set; }
    /// <summary>Bueno, Malo o null</summary>
    public string? Resultado { get; set; }
    public string? Observacion { get; set; }
}

public class InspeccionPreviaRequest
{
    public string? Diagnostico { get; set; }
}

public class PruebasRequest
{
    public bool Aprobadas { get; set; }
    /// <summary>Calibración, parámetros u observaciones (obligatorio si no se aprueban)</summary>
    public string? Observaciones { get; set; }
}

public class ChecklistPreventivoRequest
{
    public List<ResultadoActividadRequest> Resultados { get; set; } = new();
    public string? TipoRevision { get; set; }
    public bool? CodigoFallaEncontrado { get; set; }
    public string? CodigoFalla { get; set; }
    public bool? CodigoFallaResuelto { get; set; }
    public string? Notas { get; set; }
}

public class ResultadoActividadRequest
{
    public int Id { get; set; }
    public string? Resultado { get; set; }
    public string? Observacion { get; set; }
}

public class IniciarPreventivoRequest
{
    public int VehiculoId { get; set; }
    public decimal? Horometro { get; set; }
}

public class AjustarPreventivoRequest
{
    public DateTime Fecha { get; set; }
}

public class CancelarElectricoRequest
{
    public string? Motivo { get; set; }
}

/// <summary>Equipo eléctrico en la lista (estado operativo y preventivo)</summary>
public class EquipoElectricoDto
{
    public int VehiculoId { get; set; }
    public required string Codigo { get; set; }
    public string? NumeroEconomico { get; set; }
    public int TipoId { get; set; }
    public string? Tipo { get; set; }
    public string? Area { get; set; }
    public string? Marca { get; set; }
    public string? Modelo { get; set; }
    public string? NumeroSerie { get; set; }
    public required string EstadoEquipo { get; set; }
    public string? SubestadoEquipo { get; set; }
    public int? OrdenId { get; set; }
    public string? OrdenFolio { get; set; }
    public string? OrdenTipo { get; set; }
    public DateTime? UltimoPreventivo { get; set; }
    public DateTime? ProximoPreventivo { get; set; }
    /// <summary>Programado, Pendiente, En proceso, Vencido</summary>
    public required string EstadoPreventivo { get; set; }
    public int? DiasParaVencer { get; set; }
    public decimal? Horometro { get; set; }
    public decimal? HorasDesdePreventivo { get; set; }
    public int? HorasPreventivo { get; set; }
    public int PeriodicidadDias { get; set; }
    public List<string> Acciones { get; set; } = new();
}

public class EquiposElectricosDto
{
    public string? Proveedor { get; set; }
    public int? ProveedorId { get; set; }
    public int Activas { get; set; }
    public int Capacidad { get; set; }
    public List<EquipoElectricoDto> Equipos { get; set; } = new();
}

/// <summary>Checklist preventivo de un tipo para configurarlo (Administrador)</summary>
public class ChecklistPreventivoTipoDto
{
    public int TipoVehiculoId { get; set; }
    public string? Tipo { get; set; }
    public List<CategoriaChecklistDto> Categorias { get; set; } = new();
}

public class CategoriaChecklistDto
{
    public int? Id { get; set; }
    public int Numero { get; set; }
    public string Nombre { get; set; } = "";
    public List<ActividadChecklistDto> Actividades { get; set; } = new();
}

public class ActividadChecklistDto
{
    public int? Id { get; set; }
    public string? Numero { get; set; }
    public string Descripcion { get; set; } = "";
}

/// <summary>Indicadores del Dashboard para equipos eléctricos (EQE-12)</summary>
public class IndicadoresElectricosDto
{
    public int TotalEquipos { get; set; }
    public int Operativos { get; set; }
    public int FueraDeServicio { get; set; }
    public List<FueraServicioTipoDto> FueraPorTipo { get; set; } = new();
    public double? HorasPromedioFueraServicio { get; set; }
    public int PreventivosAlDia { get; set; }
    public double CumplimientoPreventivos { get; set; }
    public int PreventivosVencidos { get; set; }
    public int PreventivosProximos { get; set; }
    public int Activas { get; set; }
    public int Capacidad { get; set; }
    public string? Proveedor { get; set; }
    public List<FallasEquipoDto> FallasRecurrentes { get; set; } = new();
}

public class FueraServicioTipoDto
{
    public required string Tipo { get; set; }
    public int Correctivo { get; set; }
    public int Preventivo { get; set; }
}

public class FallasEquipoDto
{
    public int VehiculoId { get; set; }
    public required string Equipo { get; set; }
    public string? Tipo { get; set; }
    public int Correctivos { get; set; }
}
