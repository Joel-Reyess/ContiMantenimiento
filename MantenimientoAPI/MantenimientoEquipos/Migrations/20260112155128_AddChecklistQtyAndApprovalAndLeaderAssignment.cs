using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MantenimientoEquipos.Migrations
{
    /// <inheritdoc />
    public partial class AddChecklistQtyAndApprovalAndLeaderAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Cantidad",
                table: "OrdenesTrabajoChecklistItems",
                type: "decimal(18,2)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ComentariosAprobacionLider",
                table: "OrdenesTrabajo",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ComentariosAprobacionSupervisor",
                table: "OrdenesTrabajo",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "EstadoAprobacionLider",
                table: "OrdenesTrabajo",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "EstadoAprobacionSupervisor",
                table: "OrdenesTrabajo",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "FirmaLider",
                table: "OrdenesTrabajo",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FirmaLiderFecha",
                table: "OrdenesTrabajo",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FirmaLiderNombre",
                table: "OrdenesTrabajo",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FirmaSupervisor",
                table: "OrdenesTrabajo",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "FirmaSupervisorFecha",
                table: "OrdenesTrabajo",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FirmaSupervisorNombre",
                table: "OrdenesTrabajo",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Cantidad",
                table: "ChecklistRespuestas",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateTable(
                name: "LiderTipoVehiculoAsignaciones",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UsuarioId = table.Column<int>(type: "int", nullable: false),
                    TipoVehiculo = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LiderTipoVehiculoAsignaciones", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LiderTipoVehiculoAsignaciones_Users_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_LiderTipoVehiculoAsignaciones_UsuarioId",
                table: "LiderTipoVehiculoAsignaciones",
                column: "UsuarioId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LiderTipoVehiculoAsignaciones");

            migrationBuilder.DropColumn(
                name: "Cantidad",
                table: "OrdenesTrabajoChecklistItems");

            migrationBuilder.DropColumn(
                name: "ComentariosAprobacionLider",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "ComentariosAprobacionSupervisor",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "EstadoAprobacionLider",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "EstadoAprobacionSupervisor",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "FirmaLider",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "FirmaLiderFecha",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "FirmaLiderNombre",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "FirmaSupervisor",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "FirmaSupervisorFecha",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "FirmaSupervisorNombre",
                table: "OrdenesTrabajo");

            migrationBuilder.DropColumn(
                name: "Cantidad",
                table: "ChecklistRespuestas");
        }
    }
}
