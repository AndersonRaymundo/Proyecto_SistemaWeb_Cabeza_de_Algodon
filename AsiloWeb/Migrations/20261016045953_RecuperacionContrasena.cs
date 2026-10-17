using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BackendAsilo.Migrations
{
    /// <inheritdoc />
    public partial class RecuperacionContrasena : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "codigo_recuperacion_expira",
                table: "TBL_USUARIOS",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "codigo_recuperacion_hash",
                table: "TBL_USUARIOS",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "intentos_codigo",
                table: "TBL_USUARIOS",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "codigo_recuperacion_expira",
                table: "TBL_USUARIOS");

            migrationBuilder.DropColumn(
                name: "codigo_recuperacion_hash",
                table: "TBL_USUARIOS");

            migrationBuilder.DropColumn(
                name: "intentos_codigo",
                table: "TBL_USUARIOS");
        }
    }
}
