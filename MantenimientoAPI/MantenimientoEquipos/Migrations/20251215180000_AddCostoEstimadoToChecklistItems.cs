using Microsoft.EntityFrameworkCore.Migrations;

namespace MantenimientoEquipos.Migrations
{
    /// <summary>
    /// Agrega la columna CostoEstimado a ChecklistItems (faltaba en el esquema inicial).
    /// </summary>
    public partial class AddCostoEstimadoToChecklistItems : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "CostoEstimado",
                table: "ChecklistItems",
                type: "decimal(18,2)",
                nullable: false,
                defaultValue: 0m);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CostoEstimado",
                table: "ChecklistItems");
        }
    }
}
