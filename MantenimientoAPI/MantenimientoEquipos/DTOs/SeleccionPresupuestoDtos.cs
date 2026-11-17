namespace MantenimientoEquipos.DTOs;

// ===== Selección automática de empresa proveedora y presupuesto de empresas (Reporte 6) =====

/// <summary>Parámetros que controla el Gerente de Mantenimiento</summary>
public class ConfigSeleccionDto
{
    /// <summary>Una empresa con saldo menor a este monto no recibe órdenes nuevas</summary>
    public decimal SaldoMinimo { get; set; }
    /// <summary>Aviso preventivo cuando el saldo baja a este porcentaje del presupuesto asignado</summary>
    public int UmbralPreventivo { get; set; }
    /// <summary>Órdenes activas (aceptadas y aún no disponibles) que puede tener cada empresa a la vez</summary>
    public int CapacidadMaxima { get; set; }
}

/// <summary>Situación de una empresa para la asignación automática</summary>
public class EmpresaSeleccionDto
{
    public int Id { get; set; }
    public required string Nombre { get; set; }
    public string? Identificador { get; set; }
    public bool Activa { get; set; }
    public bool TienePresupuesto { get; set; }
    public decimal Asignado { get; set; }
    public decimal Utilizado { get; set; }
    public decimal Saldo { get; set; }
    /// <summary>Disponible, Preventivo (saldo bajo el umbral), Agotado, Sin presupuesto</summary>
    public required string EstadoFinanciero { get; set; }
    public int Activas { get; set; }
    public int Capacidad { get; set; }
    /// <summary>verde (0-6 de 10), amarillo (7-9), rojo (10)</summary>
    public required string SemaforoCapacidad { get; set; }
    public bool Elegible { get; set; }
    /// <summary>Por qué no recibe órdenes ahora (null si es elegible)</summary>
    public string? Motivo { get; set; }
    /// <summary>Disponible, Inactiva, Sin presupuesto, Capacidad máxima, Sin técnicos</summary>
    public required string Disponibilidad { get; set; }
    public List<TecnicoSeleccionDto> Tecnicos { get; set; } = new();
}

public class TecnicoSeleccionDto
{
    public int Id { get; set; }
    public required string Nombre { get; set; }
    /// <summary>Órdenes asignadas a este técnico que aún no se liberan</summary>
    public int Ordenes { get; set; }
}

/// <summary>Vista previa de la etapa SELECCIÓN de una orden (solo Administrador y Gerente)</summary>
public class SeleccionOrdenDto
{
    public int OrdenId { get; set; }
    public required string OrdenFolio { get; set; }
    public string? VehiculoCodigo { get; set; }
    /// <summary>pendiente (aún no llega a la zona), asignada, sinDisponibilidad, aceptada</summary>
    public required string Estado { get; set; }
    public EmpresaSeleccionDto? Empresa { get; set; }
    public int? TecnicoId { get; set; }
    public string? Tecnico { get; set; }
    public DateTime? FechaSeleccion { get; set; }
    public DateTime? FechaSinProveedor { get; set; }
    /// <summary>Actividades de la orden con la tarifa de la empresa asignada</summary>
    public List<ActividadPagoDto> CostosAplicables { get; set; } = new();
    public decimal CostoEstimado { get; set; }
    public bool PuedeReasignar { get; set; }
    /// <summary>Todas las empresas con su elegibilidad, para reasignar</summary>
    public List<EmpresaSeleccionDto> Empresas { get; set; } = new();
    public List<HistorialFlujoDto> Historial { get; set; } = new();
}

public class ReasignarProveedorRequest
{
    public int EmpresaId { get; set; }
    public int? TecnicoId { get; set; }
    public string? Motivo { get; set; }
}

/// <summary>Resumen del módulo Presupuesto de Empresas</summary>
public class PresupuestoEmpresasDto
{
    public ConfigSeleccionDto Config { get; set; } = new();
    public List<EmpresaSeleccionDto> Empresas { get; set; } = new();
    public List<OrdenSinProveedorDto> SinProveedor { get; set; } = new();
}

public class OrdenSinProveedorDto
{
    public int OrdenId { get; set; }
    public required string OrdenFolio { get; set; }
    public string? VehiculoCodigo { get; set; }
    public DateTime? Desde { get; set; }
}

public class MovimientoPresupuestoDto
{
    public int Id { get; set; }
    public int EmpresaId { get; set; }
    public string? Empresa { get; set; }
    public required string Tipo { get; set; }
    public decimal Monto { get; set; }
    public decimal SaldoResultante { get; set; }
    public string? FolioPago { get; set; }
    public int? OrdenTrabajoId { get; set; }
    public string? FolioOrden { get; set; }
    public string? VehiculoCodigo { get; set; }
    public string? Motivo { get; set; }
    public string? Usuario { get; set; }
    public DateTime Fecha { get; set; }
}

public class MovimientoPresupuestoRequest
{
    public int EmpresaId { get; set; }
    /// <summary>Asignacion (suma al presupuesto) o Ajuste (positivo o negativo)</summary>
    public string? Tipo { get; set; }
    public decimal Monto { get; set; }
    public string? Motivo { get; set; }
}

/// <summary>Indicadores por empresa proveedora para el Dashboard (DSH-03)</summary>
public class IndicadoresProveedoresDto
{
    public int OrdenesSinProveedor { get; set; }
    public int CapacidadMaxima { get; set; }
    public List<IndicadorEmpresaDto> Empresas { get; set; } = new();
}

public class IndicadorEmpresaDto
{
    public int EmpresaId { get; set; }
    public required string Empresa { get; set; }
    public required string Disponibilidad { get; set; }
    public string? Motivo { get; set; }
    public int OrdenesAtendidas { get; set; }
    public int ReparacionesConcluidas { get; set; }
    public int ReparacionesPendientes { get; set; }
    public int Activas { get; set; }
    public int Capacidad { get; set; }
    public required string SemaforoCapacidad { get; set; }
    public bool TienePresupuesto { get; set; }
    public decimal Asignado { get; set; }
    public decimal Utilizado { get; set; }
    public decimal Saldo { get; set; }
    public required string EstadoFinanciero { get; set; }
    public decimal CostoPromedio { get; set; }
    public List<GastoTipoVehiculoDto> GastoPorTipo { get; set; } = new();
}

public class GastoTipoVehiculoDto
{
    public required string Tipo { get; set; }
    public int Reparaciones { get; set; }
    public decimal Total { get; set; }
}
