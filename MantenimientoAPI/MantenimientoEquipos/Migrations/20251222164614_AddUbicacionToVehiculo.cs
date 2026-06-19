using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MantenimientoEquipos.Migrations
{
    /// <inheritdoc />
    public partial class AddUbicacionToVehiculo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // migrationBuilder.DropForeignKey(
            //    name: "FK_OrdenesTrabajo_Users_FirmadoPorId",
            //    table: "OrdenesTrabajo");
            migrationBuilder.Sql("IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_OrdenesTrabajo_Users_FirmadoPorId' AND parent_object_id = OBJECT_ID('OrdenesTrabajo')) ALTER TABLE [OrdenesTrabajo] DROP CONSTRAINT [FK_OrdenesTrabajo_Users_FirmadoPorId];");

            migrationBuilder.AddColumn<string>(
                name: "DocumentacionDibujos",
                table: "Vehiculos",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "DocumentacionEspecificaciones",
                table: "Vehiculos",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ListaMateriales",
                table: "Vehiculos",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "RegistroModificaciones",
                table: "Vehiculos",
                type: "nvarchar(2000)",
                maxLength: 2000,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "Ubicacion",
                table: "Vehiculos",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "TipoMantenimiento",
                table: "ReportesFalla",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "ChecklistRecepcionJson",
                table: "OrdenesTrabajo",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "HerramientasUsadas",
                table: "OrdenesTrabajo",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "HorasHerramienta",
                table: "OrdenesTrabajo",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TiempoEsperaHoras",
                table: "OrdenesTrabajo",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TiempoReparacionHoras",
                table: "OrdenesTrabajo",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "TiempoTransicionHoras",
                table: "OrdenesTrabajo",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Consumibles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Codigo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Nombre = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    Categoria = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Unidad = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    StockActual = table.Column<decimal>(type: "decimal(12,2)", nullable: false),
                    StockMinimo = table.Column<decimal>(type: "decimal(12,2)", nullable: false),
                    StockMaximo = table.Column<decimal>(type: "decimal(12,2)", nullable: true),
                    CostoUnitario = table.Column<decimal>(type: "decimal(12,2)", nullable: false, defaultValue: 0m),
                    AlertaActiva = table.Column<bool>(type: "bit", nullable: false),
                    Activo = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Consumibles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "TiposVehiculo",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nombre = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Descripcion = table.Column<string>(type: "nvarchar(300)", maxLength: 300, nullable: true),
                    Activo = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TiposVehiculo", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "VehiculoChecklistAsignaciones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VehiculoId = table.Column<int>(type: "int", nullable: false),
                    ChecklistTemplateId = table.Column<int>(type: "int", nullable: false),
                    FechaAsignacion = table.Column<DateTime>(type: "datetime2", nullable: false),
                    AsignadoPorId = table.Column<int>(type: "int", nullable: true),
                    Activo = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VehiculoChecklistAsignaciones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VehiculoChecklistAsignaciones_ChecklistTemplates_ChecklistTemplateId",
                        column: x => x.ChecklistTemplateId,
                        principalTable: "ChecklistTemplates",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_VehiculoChecklistAsignaciones_Users_AsignadoPorId",
                        column: x => x.AsignadoPorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_VehiculoChecklistAsignaciones_Vehiculos_VehiculoId",
                        column: x => x.VehiculoId,
                        principalTable: "Vehiculos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "VehiculoDocumentos",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    VehiculoId = table.Column<int>(type: "int", nullable: false),
                    Nombre = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Tipo = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Descripcion = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    UrlArchivo = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VehiculoDocumentos", x => x.Id);
                    table.ForeignKey(
                        name: "FK_VehiculoDocumentos_Vehiculos_VehiculoId",
                        column: x => x.VehiculoId,
                        principalTable: "Vehiculos",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ConsumosConsumibles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    ConsumibleId = table.Column<int>(type: "int", nullable: false),
                    OrdenTrabajoId = table.Column<int>(type: "int", nullable: true),
                    ReporteId = table.Column<int>(type: "int", nullable: true),
                    UsuarioId = table.Column<int>(type: "int", nullable: true),
                    TipoMovimiento = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Cantidad = table.Column<decimal>(type: "decimal(12,2)", nullable: false),
                    Comentario = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    EsConsumoInusual = table.Column<bool>(type: "bit", nullable: true),
                    Fecha = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ConsumosConsumibles", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ConsumosConsumibles_Consumibles_ConsumibleId",
                        column: x => x.ConsumibleId,
                        principalTable: "Consumibles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ConsumosConsumibles_OrdenesTrabajo_OrdenTrabajoId",
                        column: x => x.OrdenTrabajoId,
                        principalTable: "OrdenesTrabajo",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ConsumosConsumibles_ReportesFalla_ReporteId",
                        column: x => x.ReporteId,
                        principalTable: "ReportesFalla",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ConsumosConsumibles_Users_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Consumibles_Codigo",
                table: "Consumibles",
                column: "Codigo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ConsumosConsumibles_ConsumibleId",
                table: "ConsumosConsumibles",
                column: "ConsumibleId");

            migrationBuilder.CreateIndex(
                name: "IX_ConsumosConsumibles_OrdenTrabajoId",
                table: "ConsumosConsumibles",
                column: "OrdenTrabajoId");

            migrationBuilder.CreateIndex(
                name: "IX_ConsumosConsumibles_ReporteId",
                table: "ConsumosConsumibles",
                column: "ReporteId");

            migrationBuilder.CreateIndex(
                name: "IX_ConsumosConsumibles_UsuarioId",
                table: "ConsumosConsumibles",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_VehiculoChecklistAsignaciones_AsignadoPorId",
                table: "VehiculoChecklistAsignaciones",
                column: "AsignadoPorId");

            migrationBuilder.CreateIndex(
                name: "IX_VehiculoChecklistAsignaciones_ChecklistTemplateId",
                table: "VehiculoChecklistAsignaciones",
                column: "ChecklistTemplateId");

            migrationBuilder.CreateIndex(
                name: "IX_VehiculoChecklistAsignaciones_VehiculoId",
                table: "VehiculoChecklistAsignaciones",
                column: "VehiculoId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_VehiculoDocumentos_VehiculoId",
                table: "VehiculoDocumentos",
                column: "VehiculoId");

            migrationBuilder.AddForeignKey(
                name: "FK_OrdenesTrabajo_Users_FirmadoPorId",
                table: "OrdenesTrabajo",
                column: "FirmadoPorId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrdenesTrabajo_Users_FirmadoPorId",
                table: "OrdenesTrabajo");

            migrationBuilder.DropTable(
                name: "ConsumosConsumibles");

            migrationBuilder.DropTable(
                name: "TiposVehiculo");

            migrationBuilder.DropTable(
                name: "VehiculoChecklistAsignaciones");

            migrationBuilder.DropTable(
                name: "VehiculoDocumentos");

            migrationBuilder.DropTable(
                name: "Consumibles");

            migrationBuilder.DropColumn(
                name: "DocumentacionDibujos",
                table: "Vehiculos");

            migrationBuilder.DropColumn(
                name: "DocumentacionEspecificaciones",
                table: "Vehiculos");

            migrationBuilder.DropColumn(
                name: "ListaMateriales",
                table: "Vehiculos");

            migrationBuilder.DropColumn(
                name: "RegistroModificaciones",
                table: "Vehiculos");

            migrationBuilder.DropColumn(
                name: "Ubicacion",
                table: "Vehiculos");

            migrationBuilder.DropColumn(
                name: "TipoMantenimiento",
                table: "ReportesFalla");

            migrationBuilder.DropColumn(
                name: "ChecklistRecepcionJson",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "HerramientasUsadas",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "HorasHerramienta",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "TiempoEsperaHoras",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "TiempoReparacionHoras",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "TiempoTransicionHoras",
                table: "OrdenesTrabajo");

            migrationBuilder.AddForeignKey(
                name: "FK_OrdenesTrabajo_Users_FirmadoPorId",
                table: "OrdenesTrabajo",
                column: "FirmadoPorId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
