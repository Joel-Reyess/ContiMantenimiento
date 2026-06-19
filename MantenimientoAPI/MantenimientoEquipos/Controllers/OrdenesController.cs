using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using MantenimientoEquipos.Models;
using MantenimientoEquipos.Models.Enums;
using MantenimientoEquipos.DTOs;
using MantenimientoEquipos.Services;
using MantenimientoEquipos.Middlewares;
using MantenimientoEquipos.Utils;
using System.Security.Claims;
using System.IO;

namespace MantenimientoEquipos.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdenesController : ControllerBase
{
    private readonly OrdenTrabajoService _ordenService;
    private readonly NotificacionService _notificacionService;
    private readonly IWebHostEnvironment _env;
    private readonly LiderTipoVehiculoAsignacionService _asignacionService;

    public OrdenesController(OrdenTrabajoService ordenService, NotificacionService notificacionService, IWebHostEnvironment env, LiderTipoVehiculoAsignacionService asignacionService)
    {
        _ordenService = ordenService;
        _notificacionService = notificacionService;
        _env = env;
        _asignacionService = asignacionService;
    }

    /// <summary>
    /// Obtiene la lista de órdenes de trabajo
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] EstadoOrdenTrabajoEnum? estado = null,
        [FromQuery] int? tecnicoId = null,
        [FromQuery] int? vehiculoId = null,
        [FromQuery] DateTime? desde = null,
        [FromQuery] DateTime? hasta = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        List<TipoVehiculoEnum>? tiposPermitidos = null;
        
        if (User.IsInRole("Lider") || User.IsInRole("Supervisor"))
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var asignaciones = await _asignacionService.GetByUsuarioIdAsync(userId);
            if (asignaciones.Any())
            {
                tiposPermitidos = asignaciones.Select(a => a.TipoVehiculo).ToList();
            }
        }

        var ordenes = await _ordenService.GetAllAsync(estado, tecnicoId, vehiculoId, desde, hasta, tiposPermitidos);

        // Paginación simple
        var total = ordenes.Count;
        var items = ordenes.Skip((page - 1) * pageSize).Take(pageSize).ToList();

        var response = new PaginatedResponse<OrdenTrabajoListDto>
        {
            Items = items,
            TotalItems = total,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(total / (double)pageSize)
        };

        return Ok(ApiResponse<PaginatedResponse<OrdenTrabajoListDto>>.Ok(response));
    }

    /// <summary>
    /// Obtiene una orden por su ID
    /// </summary>
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(int id)
    {
        var orden = await _ordenService.GetByIdAsync(id);
        if (orden == null)
            return NotFound(ApiResponse<string>.Error("Orden de trabajo no encontrada"));

        return Ok(ApiResponse<OrdenTrabajoDto>.Ok(orden));
    }

    /// <summary>
    /// Crea una nueva orden de trabajo
    /// </summary>
    [HttpPost]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico")]
    public async Task<IActionResult> Create([FromBody] OrdenTrabajoCreateRequest request, [FromQuery] bool force = false)
    {
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var orden = await _ordenService.CreateAsync(request, userId, force);

            // Notificar al técnico si fue asignado
            if (request.TecnicoAsignadoId.HasValue)
            {
                await _notificacionService.NotificarOrdenAsignadaAsync(
                    request.TecnicoAsignadoId.Value, orden.Folio, orden.Id);
            }
            else
            {
                var detalle = await _ordenService.GetByIdAsync(orden.Id);
                var vehiculoCodigo = detalle?.VehiculoCodigo;
                await _notificacionService.NotificarOrdenDisponibleATecnicosAsync(orden.Folio, orden.Id, vehiculoCodigo);
            }

            // Avisar a supervisores/admin de la nueva orden (incluye las creadas por lǸder)
            {
                var detalle = await _ordenService.GetByIdAsync(orden.Id);
                var vehiculoCodigo = detalle?.VehiculoCodigo;
                await _notificacionService.NotificarNuevaOrdenAsync(orden.Folio, orden.Id, vehiculoCodigo);
            }

            return CreatedAtAction(nameof(GetById), new { id = orden.Id },
                ApiResponse<object>.Ok(new { orden.Id, orden.Folio }, "Orden de trabajo creada exitosamente"));
        }
        catch (DuplicateActiveOrderException ex)
        {
            // Devolver un error específico para que el frontend pueda pedir confirmación
            return Conflict(ApiResponse<string>.Error(ex.Message, "DuplicateActiveOrder", new { ex.ExistingOrderFolio, ex.ExistingOrderId }));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    /// <summary>
    /// Asigna un técnico a una orden de trabajo
    /// </summary>
    [HttpPost("{id}/asignar")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico")]
    public async Task<IActionResult> AsignarTecnico(int id, [FromBody] AsignarTecnicoRequest request)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _ordenService.AsignarTecnicoAsync(id, request.TecnicoId, userId, request.FirmaAsignacionTexto);

        if (!result)
            return NotFound(ApiResponse<string>.Error("Orden de trabajo no encontrada"));

        // Obtener la orden para el folio
        var orden = await _ordenService.GetByIdAsync(id);
        await _notificacionService.NotificarOrdenAsignadaAsync(request.TecnicoId, orden!.Folio, id);

        return Ok(ApiResponse<string>.Ok("Técnico asignado correctamente"));
    }

    /// <summary>
    /// El técnico inicia el trabajo en una orden
    /// </summary>
    [HttpPost("{id}/iniciar")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico")]
    public async Task<IActionResult> IniciarTrabajo(int id, [FromBody] IniciarTrabajoRequest request)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _ordenService.IniciarTrabajoAsync(id, request.Diagnostico, userId);

        if (!result)
            return NotFound(ApiResponse<string>.Error("Orden de trabajo no encontrada"));

        return Ok(ApiResponse<string>.Ok("Trabajo iniciado correctamente"));
    }

    /// <summary>
    /// El técnico completa el trabajo en una orden
    /// </summary>
    [HttpPost("{id}/completar")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico")]
    public async Task<IActionResult> CompletarTrabajo(int id, [FromBody] CompletarTrabajoRequest request)
    {
        try
        {
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
            var result = await _ordenService.CompletarTrabajoAsync(id, request, userId);

            if (!result)
                return NotFound(ApiResponse<string>.Error("Orden de trabajo no encontrada"));

            var detalle = await _ordenService.GetByIdAsync(id);
            if (detalle != null)
            {
                await _notificacionService.NotificarOrdenListaParaEntregaAsync(detalle.Folio, detalle.Id, detalle.VehiculoCodigo);
            }

            return Ok(ApiResponse<string>.Ok("Trabajo completado correctamente"));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ApiResponse<string>.Error(ex.Message));
        }
    }

    /// <summary>
    /// El supervisor valida una orden completada
    /// </summary>
    [HttpPost("{id}/validar")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> ValidarOrden(int id, [FromBody] ValidarOrdenRequest request)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _ordenService.ValidarOrdenAsync(id, request.Aprobado, request.Observaciones, userId);

        if (!result)
            return NotFound(ApiResponse<string>.Error("Orden de trabajo no encontrada"));

        return Ok(ApiResponse<string>.Ok(request.Aprobado ? "Orden validada correctamente" : "Orden devuelta para corrección"));
    }

    /// <summary>
    /// Aprueba o rechaza una orden (Lider o Supervisor)
    /// </summary>
    [HttpPost("{id}/aprobar")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Lider")]
    public async Task<IActionResult> AprobarOrden(int id, [FromBody] AprobarOrdenRequest request)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var result = await _ordenService.AprobarOrdenAsync(id, request, userId);

        if (!result)
            return NotFound(ApiResponse<string>.Error("Orden de trabajo no encontrada"));

        return Ok(ApiResponse<string>.Ok(request.Aprobado ? "Orden aprobada correctamente" : "Orden rechazada"));
    }

    /// <summary>
    /// Obtiene órdenes del técnico actual
    /// </summary>
    [HttpGet("mis-ordenes")]
    public async Task<IActionResult> GetMisOrdenes([FromQuery] EstadoOrdenTrabajoEnum? estado = null)
    {
        var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        var ordenes = await _ordenService.GetAllAsync(estado, userId);

        // Para tecnicos, por defecto se muestran solo ordenes activas en "Mis Ordenes".
        // Si envian estado explicito por query, se respeta tal cual.
        if (!estado.HasValue)
        {
            ordenes = ordenes
                .Where(o => o.Estado != EstadoOrdenTrabajoEnum.Completada
                         && o.Estado != EstadoOrdenTrabajoEnum.Validada
                         && o.Estado != EstadoOrdenTrabajoEnum.Cancelada
                         && o.Estado != EstadoOrdenTrabajoEnum.Entregado)
                .ToList();
        }

        return Ok(ApiResponse<List<OrdenTrabajoListDto>>.Ok(ordenes));
    }

    /// <summary>
    /// Agrega evidencia fotografica a una orden (multipart/form-data con campo 'archivo')
    /// </summary>
    [HttpPost("{id}/evidencias")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor", "Tecnico")]
    public async Task<IActionResult> AgregarEvidencia(int id, IFormFile? archivo, [FromForm] string? descripcion, [FromForm] string? tipoEvidencia)
    {
        var orden = await _ordenService.GetByIdAsync(id);
        if (orden == null)
            return NotFound(ApiResponse<string>.Error("Orden de trabajo no encontrada"));

        if (archivo == null || archivo.Length == 0)
            return BadRequest(ApiResponse<string>.Error("Debe enviar un archivo de evidencia"));

        var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)!.Value);

        var webRoot = _env.WebRootPath ?? Path.Combine(_env.ContentRootPath, "wwwroot");
        var uploadsPath = Path.Combine(webRoot, "uploads", "evidencias");
        Directory.CreateDirectory(uploadsPath);

        var fileName = $"{Guid.NewGuid()}{Path.GetExtension(archivo.FileName)}";
        var filePath = Path.Combine(uploadsPath, fileName);

        using (var stream = System.IO.File.Create(filePath))
        {
            await archivo.CopyToAsync(stream);
        }

        var urlImagen = $"/uploads/evidencias/{fileName}";

        var evidencia = await _ordenService.AgregarEvidenciaAsync(id, urlImagen, archivo.FileName, descripcion, tipoEvidencia, userId);
        if (evidencia == null)
            return NotFound(ApiResponse<string>.Error("Orden de trabajo no encontrada"));

        return Ok(ApiResponse<object>.Ok(new { evidencia.Id, evidencia.UrlImagen }, "Evidencia agregada correctamente"));
    }

    /// <summary>
    /// Genera órdenes de mantenimiento preventivo para un tipo de vehículo
    /// </summary>
    [HttpPost("programar-preventivo/{tipoVehiculoId}")]
    [RolesAllowed("SuperUsuario", "Administrador", "Supervisor")]
    public async Task<IActionResult> ProgramarPreventivo(int tipoVehiculoId)
    {
        await Task.CompletedTask;
        return Ok(ApiResponse<object>.Ok(
            new { CantidadCreada = 0, TipoVehiculoId = tipoVehiculoId },
            "La programación preventiva es solo recordatorio. No se generan órdenes automáticamente."
        ));
    }
}
