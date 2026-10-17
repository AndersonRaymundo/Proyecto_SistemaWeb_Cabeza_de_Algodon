using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BackendAsilo.Migrations
{
    /// <inheritdoc />
    public partial class FechaPagoCobros : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "cancelado_por",
                table: "TBL_PAGOS_FUNDACION",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "fecha_cancelado",
                table: "TBL_PAGOS_FUNDACION",
                type: "datetime2",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "cancelado_por",
                table: "TBL_PAGOS_FUNDACION");

            migrationBuilder.DropColumn(
                name: "fecha_cancelado",
                table: "TBL_PAGOS_FUNDACION");
        }
    }
}
