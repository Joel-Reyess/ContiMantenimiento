using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MantenimientoEquipos.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "CategoriasFalla",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Descripcion = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Icono = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Activa = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CategoriasFalla", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ChecklistTemplates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Descripcion = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    TipoVehiculo = table.Column<int>(type: "int", nullable: true),
                    TipoMantenimiento = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    Activo = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChecklistTemplates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Configuraciones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Clave = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Valor = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Descripcion = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    TipoDato = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Configuraciones", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Descripcion = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Activo = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ChecklistItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ChecklistTemplateId = table.Column<int>(type: "int", nullable: false),
                    Orden = table.Column<int>(type: "int", nullable: false),
                    Pregunta = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    TipoRespuesta = table.Column<int>(type: "int", nullable: false),
                    Opciones = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Obligatorio = table.Column<bool>(type: "bit", nullable: false),
                    RequiereFoto = table.Column<bool>(type: "bit", nullable: false),
                    Activo = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChecklistItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChecklistItems_ChecklistTemplates_ChecklistTemplateId",
                        column: x => x.ChecklistTemplateId,
                        principalTable: "ChecklistTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Areas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Codigo = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Descripcion = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    SupervisorId = table.Column<int>(type: "int", nullable: true),
                    Activa = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Areas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NombreCompleto = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Username = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    PasswordHash = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    PasswordSalt = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    Status = table.Column<int>(type: "int", nullable: false),
                    NumeroEmpleado = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Telefono = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    AreaId = table.Column<int>(type: "int", nullable: true),
                    TipoTecnico = table.Column<int>(type: "int", nullable: true),
                    EmpresaExterna = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TarifaHora = table.Column<decimal>(type: "decimal(18,2)", nullable: true),
                    Especialidades = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true),
                    UltimoInicioSesion = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Users_Areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "Areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Vehiculos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Codigo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Tipo = table.Column<int>(type: "int", nullable: false),
                    Marca = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Modelo = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    NumeroSerie = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Anio = table.Column<int>(type: "int", nullable: true),
                    Estado = table.Column<int>(type: "int", nullable: false),
                    AreaId = table.Column<int>(type: "int", nullable: true),
                    FechaAdquisicion = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UltimoMantenimiento = table.Column<DateTime>(type: "datetime2", nullable: true),
                    ProximoMantenimiento = table.Column<DateTime>(type: "datetime2", nullable: true),
                    CapacidadCarga = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    HorasOperacion = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    Kilometraje = table.Column<decimal>(type: "decimal(12,2)", nullable: true),
                    ImagenUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Notas = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    Activo = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedBy = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Vehiculos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Vehiculos_Areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "Areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "LogAcciones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UsuarioId = table.Column<int>(type: "int", nullable: true),
                    NombreUsuario = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Accion = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Entidad = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    EntidadId = table.Column<int>(type: "int", nullable: true),
                    Descripcion = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    DatosAnteriores = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DatosNuevos = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    DireccionIp = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LogAcciones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LogAcciones_Users_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Notificaciones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Tipo = table.Column<int>(type: "int", nullable: false),
                    UsuarioId = table.Column<int>(type: "int", nullable: false),
                    Titulo = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Mensaje = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    UrlDestino = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    ReferenciaId = table.Column<int>(type: "int", nullable: true),
                    TipoReferencia = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Leida = table.Column<bool>(type: "bit", nullable: false),
                    FechaLectura = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FechaCreacion = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notificaciones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Notificaciones_Users_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "UserRoles",
                columns: table => new
                {
                    RolesId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserRoles", x => new { x.RolesId, x.UserId });
                    table.ForeignKey(
                        name: "FK_UserRoles_Roles_RolesId",
                        column: x => x.RolesId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_UserRoles_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ReportesFalla",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Folio = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    VehiculoId = table.Column<int>(type: "int", nullable: false),
                    CategoriaFallaId = table.Column<int>(type: "int", nullable: true),
                    ReportadoPorId = table.Column<int>(type: "int", nullable: false),
                    Prioridad = table.Column<int>(type: "int", nullable: false),
                    Descripcion = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Ubicacion = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    PuedeOperar = table.Column<bool>(type: "bit", nullable: false),
                    FechaReporte = table.Column<DateTime>(type: "datetime2", nullable: false),
                    TieneOrdenTrabajo = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ReportesFalla", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ReportesFalla_CategoriasFalla_CategoriaFallaId",
                        column: x => x.CategoriaFallaId,
                        principalTable: "CategoriasFalla",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReportesFalla_Users_ReportadoPorId",
                        column: x => x.ReportadoPorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ReportesFalla_Vehiculos_VehiculoId",
                        column: x => x.VehiculoId,
                        principalTable: "Vehiculos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "OrdenesTrabajo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Folio = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    ReporteFallaId = table.Column<int>(type: "int", nullable: true),
                    VehiculoId = table.Column<int>(type: "int", nullable: false),
                    TecnicoAsignadoId = table.Column<int>(type: "int", nullable: true),
                    CreadoPorId = table.Column<int>(type: "int", nullable: false),
                    Estado = table.Column<int>(type: "int", nullable: false),
                    Prioridad = table.Column<int>(type: "int", nullable: false),
                    TipoMantenimiento = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Descripcion = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    Diagnostico = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    TrabajoRealizado = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    FechaCreacion = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FechaAsignacion = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FechaInicio = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FechaFinalizacion = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FechaValidacion = table.Column<DateTime>(type: "datetime2", nullable: true),
                    HorasTrabajadas = table.Column<decimal>(type: "decimal(8,2)", nullable: true),
                    CostoTotal = table.Column<decimal>(type: "decimal(12,2)", nullable: true),
                    ValidadoPorId = table.Column<int>(type: "int", nullable: true),
                    Notas = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrdenesTrabajo", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrdenesTrabajo_ReportesFalla_ReporteFallaId",
                        column: x => x.ReporteFallaId,
                        principalTable: "ReportesFalla",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrdenesTrabajo_Users_CreadoPorId",
                        column: x => x.CreadoPorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrdenesTrabajo_Users_TecnicoAsignadoId",
                        column: x => x.TecnicoAsignadoId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrdenesTrabajo_Users_ValidadoPorId",
                        column: x => x.ValidadoPorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_OrdenesTrabajo_Vehiculos_VehiculoId",
                        column: x => x.VehiculoId,
                        principalTable: "Vehiculos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ChecklistRespuestas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrdenTrabajoId = table.Column<int>(type: "int", nullable: false),
                    ChecklistItemId = table.Column<int>(type: "int", nullable: false),
                    Valor = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    FotoUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Notas = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    FechaRespuesta = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RespondidoPorId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChecklistRespuestas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChecklistRespuestas_ChecklistItems_ChecklistItemId",
                        column: x => x.ChecklistItemId,
                        principalTable: "ChecklistItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChecklistRespuestas_OrdenesTrabajo_OrdenTrabajoId",
                        column: x => x.OrdenTrabajoId,
                        principalTable: "OrdenesTrabajo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChecklistRespuestas_Users_RespondidoPorId",
                        column: x => x.RespondidoPorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "EvidenciasFotograficas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ReporteFallaId = table.Column<int>(type: "int", nullable: true),
                    OrdenTrabajoId = table.Column<int>(type: "int", nullable: true),
                    UrlImagen = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    NombreArchivo = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    Descripcion = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    TipoEvidencia = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    FechaCaptura = table.Column<DateTime>(type: "datetime2", nullable: false),
                    SubidoPorId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EvidenciasFotograficas", x => x.Id);
                    table.ForeignKey(
                        name: "FK_EvidenciasFotograficas_OrdenesTrabajo_OrdenTrabajoId",
                        column: x => x.OrdenTrabajoId,
                        principalTable: "OrdenesTrabajo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EvidenciasFotograficas_ReportesFalla_ReporteFallaId",
                        column: x => x.ReporteFallaId,
                        principalTable: "ReportesFalla",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_EvidenciasFotograficas_Users_SubidoPorId",
                        column: x => x.SubidoPorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "HistorialMantenimiento",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VehiculoId = table.Column<int>(type: "int", nullable: false),
                    OrdenTrabajoId = table.Column<int>(type: "int", nullable: true),
                    TipoMantenimiento = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Descripcion = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    TecnicoNombre = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TecnicoId = table.Column<int>(type: "int", nullable: true),
                    FechaMantenimiento = table.Column<DateTime>(type: "datetime2", nullable: false),
                    HorasVehiculo = table.Column<decimal>(type: "decimal(10,2)", nullable: true),
                    KilometrajeVehiculo = table.Column<decimal>(type: "decimal(12,2)", nullable: true),
                    Costo = table.Column<decimal>(type: "decimal(12,2)", nullable: true),
                    Notas = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HistorialMantenimiento", x => x.Id);
                    table.ForeignKey(
                        name: "FK_HistorialMantenimiento_OrdenesTrabajo_OrdenTrabajoId",
                        column: x => x.OrdenTrabajoId,
                        principalTable: "OrdenesTrabajo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_HistorialMantenimiento_Users_TecnicoId",
                        column: x => x.TecnicoId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_HistorialMantenimiento_Vehiculos_VehiculoId",
                        column: x => x.VehiculoId,
                        principalTable: "Vehiculos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RegistrosPago",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrdenTrabajoId = table.Column<int>(type: "int", nullable: false),
                    TecnicoId = table.Column<int>(type: "int", nullable: false),
                    HorasTrabajadas = table.Column<decimal>(type: "decimal(8,2)", nullable: false),
                    TarifaHora = table.Column<decimal>(type: "decimal(10,2)", nullable: false),
                    CostoManoObra = table.Column<decimal>(type: "decimal(12,2)", nullable: false),
                    CostoRefacciones = table.Column<decimal>(type: "decimal(12,2)", nullable: false),
                    OtrosCostos = table.Column<decimal>(type: "decimal(12,2)", nullable: false),
                    MontoTotal = table.Column<decimal>(type: "decimal(12,2)", nullable: false),
                    Estado = table.Column<int>(type: "int", nullable: false),
                    NumeroFactura = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    FacturaUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    FechaRegistro = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FechaAprobacion = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FechaPago = table.Column<DateTime>(type: "datetime2", nullable: true),
                    AprobadoPorId = table.Column<int>(type: "int", nullable: true),
                    Notas = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RegistrosPago", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RegistrosPago_OrdenesTrabajo_OrdenTrabajoId",
                        column: x => x.OrdenTrabajoId,
                        principalTable: "OrdenesTrabajo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RegistrosPago_Users_AprobadoPorId",
                        column: x => x.AprobadoPorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_RegistrosPago_Users_TecnicoId",
                        column: x => x.TecnicoId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "SolicitudesRefaccion",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    OrdenTrabajoId = table.Column<int>(type: "int", nullable: false),
                    NombreRefaccion = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    NumeroParte = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Cantidad = table.Column<int>(type: "int", nullable: false),
                    Justificacion = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Estado = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    CostoEstimado = table.Column<decimal>(type: "decimal(12,2)", nullable: true),
                    CostoReal = table.Column<decimal>(type: "decimal(12,2)", nullable: true),
                    SolicitadoPorId = table.Column<int>(type: "int", nullable: false),
                    AprobadoPorId = table.Column<int>(type: "int", nullable: true),
                    FechaSolicitud = table.Column<DateTime>(type: "datetime2", nullable: false),
                    FechaAprobacion = table.Column<DateTime>(type: "datetime2", nullable: true),
                    FechaEntrega = table.Column<DateTime>(type: "datetime2", nullable: true),
                    MotivoRechazo = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SolicitudesRefaccion", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SolicitudesRefaccion_OrdenesTrabajo_OrdenTrabajoId",
                        column: x => x.OrdenTrabajoId,
                        principalTable: "OrdenesTrabajo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SolicitudesRefaccion_Users_AprobadoPorId",
                        column: x => x.AprobadoPorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_SolicitudesRefaccion_Users_SolicitadoPorId",
                        column: x => x.SolicitadoPorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Areas_Codigo",
                table: "Areas",
                column: "Codigo",
                unique: true,
                filter: "[Codigo] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Areas_SupervisorId",
                table: "Areas",
                column: "SupervisorId");

            migrationBuilder.CreateIndex(
                name: "IX_CategoriasFalla_Nombre",
                table: "CategoriasFalla",
                column: "Nombre",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistItems_ChecklistTemplateId",
                table: "ChecklistItems",
                column: "ChecklistTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistRespuestas_ChecklistItemId",
                table: "ChecklistRespuestas",
                column: "ChecklistItemId");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistRespuestas_OrdenTrabajoId",
                table: "ChecklistRespuestas",
                column: "OrdenTrabajoId");

            migrationBuilder.CreateIndex(
                name: "IX_ChecklistRespuestas_RespondidoPorId",
                table: "ChecklistRespuestas",
                column: "RespondidoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_Configuraciones_Clave",
                table: "Configuraciones",
                column: "Clave",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_EvidenciasFotograficas_OrdenTrabajoId",
                table: "EvidenciasFotograficas",
                column: "OrdenTrabajoId");

            migrationBuilder.CreateIndex(
                name: "IX_EvidenciasFotograficas_ReporteFallaId",
                table: "EvidenciasFotograficas",
                column: "ReporteFallaId");

            migrationBuilder.CreateIndex(
                name: "IX_EvidenciasFotograficas_SubidoPorId",
                table: "EvidenciasFotograficas",
                column: "SubidoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_HistorialMantenimiento_OrdenTrabajoId",
                table: "HistorialMantenimiento",
                column: "OrdenTrabajoId");

            migrationBuilder.CreateIndex(
                name: "IX_HistorialMantenimiento_TecnicoId",
                table: "HistorialMantenimiento",
                column: "TecnicoId");

            migrationBuilder.CreateIndex(
                name: "IX_HistorialMantenimiento_VehiculoId",
                table: "HistorialMantenimiento",
                column: "VehiculoId");

            migrationBuilder.CreateIndex(
                name: "IX_LogAcciones_Entidad_EntidadId",
                table: "LogAcciones",
                columns: new[] { "Entidad", "EntidadId" });

            migrationBuilder.CreateIndex(
                name: "IX_LogAcciones_Fecha",
                table: "LogAcciones",
                column: "Fecha");

            migrationBuilder.CreateIndex(
                name: "IX_LogAcciones_UsuarioId",
                table: "LogAcciones",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Notificaciones_UsuarioId_Leida",
                table: "Notificaciones",
                columns: new[] { "UsuarioId", "Leida" });

            migrationBuilder.CreateIndex(
                name: "IX_OrdenesTrabajo_CreadoPorId",
                table: "OrdenesTrabajo",
                column: "CreadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_OrdenesTrabajo_Folio",
                table: "OrdenesTrabajo",
                column: "Folio",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrdenesTrabajo_ReporteFallaId",
                table: "OrdenesTrabajo",
                column: "ReporteFallaId",
                unique: true,
                filter: "[ReporteFallaId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_OrdenesTrabajo_TecnicoAsignadoId",
                table: "OrdenesTrabajo",
                column: "TecnicoAsignadoId");

            migrationBuilder.CreateIndex(
                name: "IX_OrdenesTrabajo_ValidadoPorId",
                table: "OrdenesTrabajo",
                column: "ValidadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_OrdenesTrabajo_VehiculoId",
                table: "OrdenesTrabajo",
                column: "VehiculoId");

            migrationBuilder.CreateIndex(
                name: "IX_RegistrosPago_AprobadoPorId",
                table: "RegistrosPago",
                column: "AprobadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_RegistrosPago_OrdenTrabajoId",
                table: "RegistrosPago",
                column: "OrdenTrabajoId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RegistrosPago_TecnicoId",
                table: "RegistrosPago",
                column: "TecnicoId");

            migrationBuilder.CreateIndex(
                name: "IX_ReportesFalla_CategoriaFallaId",
                table: "ReportesFalla",
                column: "CategoriaFallaId");

            migrationBuilder.CreateIndex(
                name: "IX_ReportesFalla_Folio",
                table: "ReportesFalla",
                column: "Folio",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ReportesFalla_ReportadoPorId",
                table: "ReportesFalla",
                column: "ReportadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_ReportesFalla_VehiculoId",
                table: "ReportesFalla",
                column: "VehiculoId");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_Nombre",
                table: "Roles",
                column: "Nombre",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SolicitudesRefaccion_AprobadoPorId",
                table: "SolicitudesRefaccion",
                column: "AprobadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitudesRefaccion_OrdenTrabajoId",
                table: "SolicitudesRefaccion",
                column: "OrdenTrabajoId");

            migrationBuilder.CreateIndex(
                name: "IX_SolicitudesRefaccion_SolicitadoPorId",
                table: "SolicitudesRefaccion",
                column: "SolicitadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_UserRoles_UserId",
                table: "UserRoles",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_AreaId",
                table: "Users",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Vehiculos_AreaId",
                table: "Vehiculos",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_Vehiculos_Codigo",
                table: "Vehiculos",
                column: "Codigo",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Areas_Users_SupervisorId",
                table: "Areas",
                column: "SupervisorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Areas_Users_SupervisorId",
                table: "Areas");

            migrationBuilder.DropTable(
                name: "ChecklistRespuestas");

            migrationBuilder.DropTable(
                name: "Configuraciones");

            migrationBuilder.DropTable(
                name: "EvidenciasFotograficas");

            migrationBuilder.DropTable(
                name: "HistorialMantenimiento");

            migrationBuilder.DropTable(
                name: "LogAcciones");

            migrationBuilder.DropTable(
                name: "Notificaciones");

            migrationBuilder.DropTable(
                name: "RegistrosPago");

            migrationBuilder.DropTable(
                name: "SolicitudesRefaccion");

            migrationBuilder.DropTable(
                name: "UserRoles");

            migrationBuilder.DropTable(
                name: "ChecklistItems");

            migrationBuilder.DropTable(
                name: "OrdenesTrabajo");

            migrationBuilder.DropTable(
                name: "Roles");

            migrationBuilder.DropTable(
                name: "ChecklistTemplates");

            migrationBuilder.DropTable(
                name: "ReportesFalla");

            migrationBuilder.DropTable(
                name: "CategoriasFalla");

            migrationBuilder.DropTable(
                name: "Vehiculos");

            migrationBuilder.DropTable(
                name: "Users");

            migrationBuilder.DropTable(
                name: "Areas");
        }
    }
}
