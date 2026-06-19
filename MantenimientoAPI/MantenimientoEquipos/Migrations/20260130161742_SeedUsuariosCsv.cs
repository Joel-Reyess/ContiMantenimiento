using System;
using Microsoft.EntityFrameworkCore.Migrations;
using MantenimientoEquipos.Utils;

#nullable disable

namespace MantenimientoEquipos.Migrations
{
    /// <inheritdoc />
    public partial class SeedUsuariosCsv : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OrdenCompraId",
                table: "RegistrosPago",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "OrdenesCompra",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Folio = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    ProveedorId = table.Column<int>(type: "int", nullable: false),
                    FechaRegistro = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Estado = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Total = table.Column<decimal>(type: "decimal(18,2)", nullable: false),
                    NumeroExterno = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrdenesCompra", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrdenesCompra_Users_ProveedorId",
                        column: x => x.ProveedorId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RegistrosPago_OrdenCompraId",
                table: "RegistrosPago",
                column: "OrdenCompraId");

            migrationBuilder.CreateIndex(
                name: "IX_OrdenesCompra_ProveedorId",
                table: "OrdenesCompra",
                column: "ProveedorId");

            migrationBuilder.AddForeignKey(
                name: "FK_RegistrosPago_OrdenesCompra_OrdenCompraId",
                table: "RegistrosPago",
                column: "OrdenCompraId",
                principalTable: "OrdenesCompra",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // Seeding Logic for CSV Users
            var salt = PasswordHasher.GenerateSalt();
            var hash = PasswordHasher.HashPassword("Continental123!", salt);

            var sql = $@"
                -- Ensure Roles Exist (Basic check, usually seeded in InitialCreate but ensuring names match CSV mapping)
                -- Tecnico, Supervisor, SuperUsuario should exist.

                -- Ensure Areas Exist
                IF NOT EXISTS (SELECT 1 FROM Areas WHERE Nombre = 'Taller de Reparaciones') INSERT INTO Areas (Nombre, Activa, CreatedAt) VALUES ('Taller de Reparaciones', 1, GETDATE());
                IF NOT EXISTS (SELECT 1 FROM Areas WHERE Nombre = 'Infraestructura Sustentable') INSERT INTO Areas (Nombre, Activa, CreatedAt) VALUES ('Infraestructura Sustentable', 1, GETDATE());
                IF NOT EXISTS (SELECT 1 FROM Areas WHERE Nombre = 'Manufactura') INSERT INTO Areas (Nombre, Activa, CreatedAt) VALUES ('Manufactura', 1, GETDATE());
                IF NOT EXISTS (SELECT 1 FROM Areas WHERE Nombre = 'Tubuladoras') INSERT INTO Areas (Nombre, Activa, CreatedAt) VALUES ('Tubuladoras', 1, GETDATE());
                IF NOT EXISTS (SELECT 1 FROM Areas WHERE Nombre = 'Construcción') INSERT INTO Areas (Nombre, Activa, CreatedAt) VALUES ('Construcción', 1, GETDATE());

                DECLARE @AreaId int;
                DECLARE @RolId int;
                DECLARE @UserId int;
                DECLARE @PasswordHash nvarchar(100) = '{hash}';
                DECLARE @PasswordSalt nvarchar(max) = '{salt}';

                -- 1. Alberto Ojeda (Tecnico)
                SELECT @AreaId = Id FROM Areas WHERE Nombre = 'Taller de Reparaciones';
                SELECT @RolId = Id FROM Roles WHERE Nombre = 'Tecnico'; 
                IF @RolId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'aojeda')
                BEGIN
                    INSERT INTO Users (NombreCompleto, Username, Email, Telefono, AreaId, PasswordHash, PasswordSalt, Status, CreatedAt)
                    VALUES ('Alberto Ojeda', 'aojeda', 'auxiliar01@grupopotver.com', '4448039248', @AreaId, @PasswordHash, @PasswordSalt, 1, GETDATE());
                    SET @UserId = SCOPE_IDENTITY();
                    INSERT INTO UserRoles (UserId, RolesId) VALUES (@UserId, @RolId);
                END

                -- 2. Ernesto Paredes (SuperUsuario)
                SELECT @AreaId = Id FROM Areas WHERE Nombre = 'Infraestructura Sustentable';
                SELECT @RolId = Id FROM Roles WHERE Nombre = 'SuperUsuario';
                IF @RolId IS NULL SELECT @RolId = Id FROM Roles WHERE Nombre = 'Administrador'; -- Fallback
                IF @RolId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'eparedes')
                BEGIN
                    INSERT INTO Users (NombreCompleto, Username, Email, Telefono, AreaId, PasswordHash, PasswordSalt, Status, CreatedAt)
                    VALUES ('Ernesto Paredes', 'eparedes', 'ernesto.paredes.gonzalez@conti.com.mx', '4448268903', @AreaId, @PasswordHash, @PasswordSalt, 1, GETDATE());
                    SET @UserId = SCOPE_IDENTITY();
                    INSERT INTO UserRoles (UserId, RolesId) VALUES (@UserId, @RolId);
                END

                -- 3. Marco Antonio Martinez (SuperUsuario)
                SELECT @AreaId = Id FROM Areas WHERE Nombre = 'Infraestructura Sustentable';
                IF @RolId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'mmartinez')
                BEGIN
                    INSERT INTO Users (NombreCompleto, Username, Email, Telefono, AreaId, PasswordHash, PasswordSalt, Status, CreatedAt)
                    VALUES ('Marco Antonio Martinez', 'mmartinez', 'marco.antonio.martinez.martinez-EXT@functionalaccount.com', NULL, @AreaId, @PasswordHash, @PasswordSalt, 1, GETDATE());
                    SET @UserId = SCOPE_IDENTITY();
                    INSERT INTO UserRoles (UserId, RolesId) VALUES (@UserId, @RolId);
                END

                -- 4. Arturo Gálvez (SuperUsuario)
                SELECT @AreaId = Id FROM Areas WHERE Nombre = 'Infraestructura Sustentable';
                IF @RolId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'agalvez')
                BEGIN
                    INSERT INTO Users (NombreCompleto, Username, Email, Telefono, AreaId, PasswordHash, PasswordSalt, Status, CreatedAt)
                    VALUES ('Arturo Gálvez', 'agalvez', 'Arturo.Galvez@conti.com.mx', '4448268902', @AreaId, @PasswordHash, @PasswordSalt, 1, GETDATE());
                    SET @UserId = SCOPE_IDENTITY();
                    INSERT INTO UserRoles (UserId, RolesId) VALUES (@UserId, @RolId);
                END

                -- 5. Ana Gabriela Sierra (Supervisor)
                SELECT @AreaId = Id FROM Areas WHERE Nombre = 'Manufactura';
                SELECT @RolId = Id FROM Roles WHERE Nombre = 'Supervisor';
                IF @RolId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'asierra')
                BEGIN
                    INSERT INTO Users (NombreCompleto, Username, Email, Telefono, AreaId, PasswordHash, PasswordSalt, Status, CreatedAt)
                    VALUES ('Ana Gabriela Sierra', 'asierra', 'ana.gabriela.sierra@conti.com.mx', '4461399905', @AreaId, @PasswordHash, @PasswordSalt, 1, GETDATE());
                    SET @UserId = SCOPE_IDENTITY();
                    INSERT INTO UserRoles (UserId, RolesId) VALUES (@UserId, @RolId);
                END

                -- 6. Hugo Borges (Supervisor)
                SELECT @AreaId = Id FROM Areas WHERE Nombre = 'Tubuladoras';
                SELECT @RolId = Id FROM Roles WHERE Nombre = 'Supervisor';
                IF @RolId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'hborges')
                BEGIN
                    INSERT INTO Users (NombreCompleto, Username, Email, Telefono, AreaId, PasswordHash, PasswordSalt, Status, CreatedAt)
                    VALUES ('Hugo Borges', 'hborges', 'Hugo.Borges@conti.com.mx', '4448268850', @AreaId, @PasswordHash, @PasswordSalt, 1, GETDATE());
                    SET @UserId = SCOPE_IDENTITY();
                    INSERT INTO UserRoles (UserId, RolesId) VALUES (@UserId, @RolId);
                END

                -- 7. Enrique Flores (Supervisor)
                SELECT @AreaId = Id FROM Areas WHERE Nombre = 'Construcción';
                SELECT @RolId = Id FROM Roles WHERE Nombre = 'Supervisor';
                IF @RolId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'eflores')
                BEGIN
                    INSERT INTO Users (NombreCompleto, Username, Email, Telefono, AreaId, PasswordHash, PasswordSalt, Status, CreatedAt)
                    VALUES ('Enrique Flores', 'eflores', 'Enrique.Flores@conti.com.mx', NULL, @AreaId, @PasswordHash, @PasswordSalt, 1, GETDATE());
                    SET @UserId = SCOPE_IDENTITY();
                    INSERT INTO UserRoles (UserId, RolesId) VALUES (@UserId, @RolId);
                END

                -- 8. Manuel Salinas (Supervisor)
                SELECT @AreaId = Id FROM Areas WHERE Nombre = 'Construcción';
                SELECT @RolId = Id FROM Roles WHERE Nombre = 'Supervisor';
                IF @RolId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM Users WHERE Username = 'msalinas')
                BEGIN
                    INSERT INTO Users (NombreCompleto, Username, Email, Telefono, AreaId, PasswordHash, PasswordSalt, Status, CreatedAt)
                    VALUES ('Manuel Salinas', 'msalinas', 'Manuel.Salinas@conti.com.mx', '4448268800', @AreaId, @PasswordHash, @PasswordSalt, 1, GETDATE());
                    SET @UserId = SCOPE_IDENTITY();
                    INSERT INTO UserRoles (UserId, RolesId) VALUES (@UserId, @RolId);
                END
            ";

            migrationBuilder.Sql(sql);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RegistrosPago_OrdenesCompra_OrdenCompraId",
                table: "RegistrosPago");

            migrationBuilder.DropTable(
                name: "OrdenesCompra");

            migrationBuilder.DropIndex(
                name: "IX_RegistrosPago_OrdenCompraId",
                table: "RegistrosPago");

            migrationBuilder.DropColumn(
                name: "OrdenCompraId",
                table: "RegistrosPago");
        }
    }
}
