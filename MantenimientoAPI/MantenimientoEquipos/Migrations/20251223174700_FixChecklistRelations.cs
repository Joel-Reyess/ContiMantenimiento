using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MantenimientoEquipos.Migrations
{
    /// <inheritdoc />
    public partial class FixChecklistRelations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[OrdenesTrabajoChecklistItems]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[OrdenesTrabajoChecklistItems](
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [OrdenTrabajoId] INT NOT NULL,
        [ChecklistItemId] INT NOT NULL,
        [FechaAsignacion] datetime2 NOT NULL,
        [FechaCompletado] datetime2 NULL,
        [Estado] nvarchar(20) NOT NULL,
        [Notas] nvarchar(500) NULL
    );
    CREATE INDEX [IX_OrdenesTrabajoChecklistItems_ChecklistItemId] ON [dbo].[OrdenesTrabajoChecklistItems]([ChecklistItemId]);
    CREATE INDEX [IX_OrdenesTrabajoChecklistItems_OrdenTrabajoId] ON [dbo].[OrdenesTrabajoChecklistItems]([OrdenTrabajoId]);
    ALTER TABLE [dbo].[OrdenesTrabajoChecklistItems] ADD CONSTRAINT [FK_OrdenesTrabajoChecklistItems_OrdenesTrabajo_OrdenTrabajoId] FOREIGN KEY ([OrdenTrabajoId]) REFERENCES [dbo].[OrdenesTrabajo]([Id]) ON DELETE CASCADE;
    ALTER TABLE [dbo].[OrdenesTrabajoChecklistItems] ADD CONSTRAINT [FK_OrdenesTrabajoChecklistItems_ChecklistItems_ChecklistItemId] FOREIGN KEY ([ChecklistItemId]) REFERENCES [dbo].[ChecklistItems]([Id]) ON DELETE NO ACTION;
END;

IF OBJECT_ID(N'[dbo].[ReportesFallaChecklistItems]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[ReportesFallaChecklistItems](
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [ReporteFallaId] INT NOT NULL,
        [ChecklistItemId] INT NOT NULL,
        [FechaAsignacion] datetime2 NOT NULL,
        [Estado] nvarchar(20) NOT NULL,
        [Notas] nvarchar(500) NULL
    );
    CREATE INDEX [IX_ReportesFallaChecklistItems_ChecklistItemId] ON [dbo].[ReportesFallaChecklistItems]([ChecklistItemId]);
    CREATE INDEX [IX_ReportesFallaChecklistItems_ReporteFallaId] ON [dbo].[ReportesFallaChecklistItems]([ReporteFallaId]);
    ALTER TABLE [dbo].[ReportesFallaChecklistItems] ADD CONSTRAINT [FK_ReportesFallaChecklistItems_ReportesFalla_ReporteFallaId] FOREIGN KEY ([ReporteFallaId]) REFERENCES [dbo].[ReportesFalla]([Id]) ON DELETE CASCADE;
    ALTER TABLE [dbo].[ReportesFallaChecklistItems] ADD CONSTRAINT [FK_ReportesFallaChecklistItems_ChecklistItems_ChecklistItemId] FOREIGN KEY ([ChecklistItemId]) REFERENCES [dbo].[ChecklistItems]([Id]) ON DELETE NO ACTION;
END;

IF OBJECT_ID(N'[dbo].[VehiculoPrefijoConfigs]', 'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[VehiculoPrefijoConfigs](
        [Id] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        [PrefijoCodigo] nvarchar(20) NOT NULL,
        [TipoVehiculoId] INT NOT NULL,
        [Descripcion] nvarchar(100) NULL,
        [Activo] bit NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        [CreatedBy] INT NULL,
        [UpdatedAt] datetime2 NULL,
        [UpdatedBy] INT NULL
    );
    CREATE INDEX [IX_VehiculoPrefijoConfigs_TipoVehiculoId] ON [dbo].[VehiculoPrefijoConfigs]([TipoVehiculoId]);
    ALTER TABLE [dbo].[VehiculoPrefijoConfigs] ADD CONSTRAINT [FK_VehiculoPrefijoConfigs_TiposVehiculo_TipoVehiculoId] FOREIGN KEY ([TipoVehiculoId]) REFERENCES [dbo].[TiposVehiculo]([Id]) ON DELETE CASCADE;
END;

IF COL_LENGTH('ChecklistRespuestas','ChecklistItemId1') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ChecklistRespuestas_ChecklistItems_ChecklistItemId1')
        ALTER TABLE [ChecklistRespuestas] DROP CONSTRAINT [FK_ChecklistRespuestas_ChecklistItems_ChecklistItemId1];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ChecklistRespuestas_ChecklistItemId1')
        DROP INDEX [IX_ChecklistRespuestas_ChecklistItemId1] ON [ChecklistRespuestas];
    ALTER TABLE [ChecklistRespuestas] DROP COLUMN [ChecklistItemId1];
END;

IF COL_LENGTH('OrdenesTrabajoChecklistItems','ChecklistItemId1') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_OrdenesTrabajoChecklistItems_ChecklistItems_ChecklistItemId1')
        ALTER TABLE [OrdenesTrabajoChecklistItems] DROP CONSTRAINT [FK_OrdenesTrabajoChecklistItems_ChecklistItems_ChecklistItemId1];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrdenesTrabajoChecklistItems_ChecklistItemId1')
        DROP INDEX [IX_OrdenesTrabajoChecklistItems_ChecklistItemId1] ON [OrdenesTrabajoChecklistItems];
    ALTER TABLE [OrdenesTrabajoChecklistItems] DROP COLUMN [ChecklistItemId1];
END;

IF COL_LENGTH('OrdenesTrabajoChecklistItems','ChecklistTemplateId') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_OrdenesTrabajoChecklistItems_ChecklistTemplates_ChecklistTemplateId')
        ALTER TABLE [OrdenesTrabajoChecklistItems] DROP CONSTRAINT [FK_OrdenesTrabajoChecklistItems_ChecklistTemplates_ChecklistTemplateId];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_OrdenesTrabajoChecklistItems_ChecklistTemplateId')
        DROP INDEX [IX_OrdenesTrabajoChecklistItems_ChecklistTemplateId] ON [OrdenesTrabajoChecklistItems];
    ALTER TABLE [OrdenesTrabajoChecklistItems] DROP COLUMN [ChecklistTemplateId];
END;

IF COL_LENGTH('VehiculoChecklistAsignaciones','ChecklistTemplateId1') IS NOT NULL
BEGIN
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_VehiculoChecklistAsignaciones_ChecklistTemplates_ChecklistTemplateId1')
        ALTER TABLE [VehiculoChecklistAsignaciones] DROP CONSTRAINT [FK_VehiculoChecklistAsignaciones_ChecklistTemplates_ChecklistTemplateId1];
    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_VehiculoChecklistAsignaciones_ChecklistTemplateId1')
        DROP INDEX [IX_VehiculoChecklistAsignaciones_ChecklistTemplateId1] ON [VehiculoChecklistAsignaciones];
    ALTER TABLE [VehiculoChecklistAsignaciones] DROP COLUMN [ChecklistTemplateId1];
END;
");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
IF OBJECT_ID(N'[dbo].[ReportesFallaChecklistItems]', 'U') IS NOT NULL
    DROP TABLE [dbo].[ReportesFallaChecklistItems];

IF OBJECT_ID(N'[dbo].[OrdenesTrabajoChecklistItems]', 'U') IS NOT NULL
    DROP TABLE [dbo].[OrdenesTrabajoChecklistItems];

IF OBJECT_ID(N'[dbo].[VehiculoPrefijoConfigs]', 'U') IS NOT NULL
    DROP TABLE [dbo].[VehiculoPrefijoConfigs];

IF COL_LENGTH('VehiculoChecklistAsignaciones','ChecklistTemplateId1') IS NULL
BEGIN
    ALTER TABLE [VehiculoChecklistAsignaciones] ADD [ChecklistTemplateId1] INT NULL;
    CREATE INDEX [IX_VehiculoChecklistAsignaciones_ChecklistTemplateId1] ON [VehiculoChecklistAsignaciones]([ChecklistTemplateId1]);
    ALTER TABLE [VehiculoChecklistAsignaciones] ADD CONSTRAINT [FK_VehiculoChecklistAsignaciones_ChecklistTemplates_ChecklistTemplateId1] FOREIGN KEY ([ChecklistTemplateId1]) REFERENCES [ChecklistTemplates]([Id]);
END;

IF COL_LENGTH('OrdenesTrabajoChecklistItems','ChecklistItemId1') IS NULL AND OBJECT_ID(N'[dbo].[OrdenesTrabajoChecklistItems]', 'U') IS NOT NULL
BEGIN
    ALTER TABLE [OrdenesTrabajoChecklistItems] ADD [ChecklistItemId1] INT NULL;
    CREATE INDEX [IX_OrdenesTrabajoChecklistItems_ChecklistItemId1] ON [OrdenesTrabajoChecklistItems]([ChecklistItemId1]);
    ALTER TABLE [OrdenesTrabajoChecklistItems] ADD CONSTRAINT [FK_OrdenesTrabajoChecklistItems_ChecklistItems_ChecklistItemId1] FOREIGN KEY ([ChecklistItemId1]) REFERENCES [ChecklistItems]([Id]);
END;

IF COL_LENGTH('OrdenesTrabajoChecklistItems','ChecklistTemplateId') IS NULL AND OBJECT_ID(N'[dbo].[OrdenesTrabajoChecklistItems]', 'U') IS NOT NULL
BEGIN
    ALTER TABLE [OrdenesTrabajoChecklistItems] ADD [ChecklistTemplateId] INT NULL;
    CREATE INDEX [IX_OrdenesTrabajoChecklistItems_ChecklistTemplateId] ON [OrdenesTrabajoChecklistItems]([ChecklistTemplateId]);
    ALTER TABLE [OrdenesTrabajoChecklistItems] ADD CONSTRAINT [FK_OrdenesTrabajoChecklistItems_ChecklistTemplates_ChecklistTemplateId] FOREIGN KEY ([ChecklistTemplateId]) REFERENCES [ChecklistTemplates]([Id]);
END;

IF COL_LENGTH('ChecklistRespuestas','ChecklistItemId1') IS NULL
BEGIN
    ALTER TABLE [ChecklistRespuestas] ADD [ChecklistItemId1] INT NULL;
    CREATE INDEX [IX_ChecklistRespuestas_ChecklistItemId1] ON [ChecklistRespuestas]([ChecklistItemId1]);
    ALTER TABLE [ChecklistRespuestas] ADD CONSTRAINT [FK_ChecklistRespuestas_ChecklistItems_ChecklistItemId1] FOREIGN KEY ([ChecklistItemId1]) REFERENCES [ChecklistItems]([Id]);
END;
");
        }
    }
}
