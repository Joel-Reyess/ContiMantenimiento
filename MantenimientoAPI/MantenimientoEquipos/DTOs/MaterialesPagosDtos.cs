namespace MantenimientoEquipos.DTOs;

// ===== Materiales usados en la orden (PDF 29-oct, 5.1) =====

public class MaterialOrdenDto
{
    public int Id { get; set; }
    public int ConsumibleId { get; set; }
    public string Codigo { get; set; } = string.Empty;
    public string Nombre { get; set; } = string.Empty;
    public string? Categoria { get; set; }
    /// <summary>Refacción (categoría con "refac") o consumible</summary>
    public bool EsRefaccion { get; set; }
    public string Unidad { get; set; } = string.Empty;
    public decimal Cantidad { get; set; }
    public decimal CostoUnitario { get; set; }
    public decimal Subtotal { get; set; }
    /// <summary>Ya se descontó del inventario: no se puede editar</summary>
    public bool Descontado { get; set; }
    public DateTime? FechaDescuento { get; set; }
    public decimal StockActual { get; set; }
}

public class MaterialesOrdenDto
{
    public int OrdenId { get; set; }
    public string OrdenFolio { get; set; } = string.Empty;
    /// <summary>El usuario puede capturar materiales ahora (técnico de la orden en TALLER)</summary>
    public bool Editable { get; set; }
    /// <summary>Por qué no se puede editar (orden validada, aún no aceptada, etc.)</summary>
    public string? Bloqueo { get; set; }
    public bool AplicaGarantia { get; set; }
    public List<MaterialOrdenDto> Items { get; set; } = new();
    public decimal TotalRefacciones { get; set; }
    public decimal TotalConsumibles { get; set; }
    public decimal Total { get; set; }
}

public class MaterialRequest
{
    public int ConsumibleId { get; set; }
    public decimal Cantidad { get; set; }
}

public class GuardarMaterialesRequest
{
    /// <summary>Materiales aún no descontados; reemplaza la lista pendiente de la orden</summary>
    public List<MaterialRequest> Items { get; set; } = new();
}

// ===== Orden de pago automática (PDF 29-oct, 6.1) =====

public class ActividadPagoDto
{
    public string Descripcion { get; set; } = string.Empty;
    public decimal Cantidad { get; set; }
    public decimal CostoUnitario { get; set; }
    public decimal Subtotal { get; set; }
}

public class DetalleOrdenPagoDto
{
    public int Id { get; set; }
    public string Folio { get; set; } = string.Empty;
    public string Estado { get; set; } = string.Empty;
    public int EstadoId { get; set; }
    public int OrdenTrabajoId { get; set; }
    public string OrdenTrabajoFolio { get; set; } = string.Empty;
    public string? ReporteFolio { get; set; }
    public string VehiculoCodigo { get; set; } = string.Empty;
    public string? TipoVehiculo { get; set; }
    public string? Area { get; set; }
    public int TecnicoId { get; set; }
    public string? Tecnico { get; set; }
    public DateTime FechaCreacionOrden { get; set; }
    public DateTime? FechaFinalizacionOrden { get; set; }
    public DateTime FechaRegistro { get; set; }
    public DateTime? FechaPago { get; set; }
    public bool AplicaGarantia { get; set; }
    public List<ActividadPagoDto> Actividades { get; set; } = new();
    public List<MaterialOrdenDto> Materiales { get; set; } = new();
    public decimal CostoActividades { get; set; }
    public decimal CostoMateriales { get; set; }
    public decimal Total { get; set; }
    public string? Notas { get; set; }
}

public class ResultadoGenerarPagosDto
{
    public int Generadas { get; set; }
    public List<string> Folios { get; set; } = new();
}
