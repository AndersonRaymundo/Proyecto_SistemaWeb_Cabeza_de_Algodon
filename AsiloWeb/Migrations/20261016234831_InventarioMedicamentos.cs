using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BackendAsilo.Migrations
{
    /// <inheritdoc />
    public partial class InventarioMedicamentos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "id_inventario",
                table: "TBL_MEDICAMENTOS_RECETADOS",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "unidades_despachadas",
                table: "TBL_MEDICAMENTOS_RECETADOS",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TBL_INVENTARIO_MEDICAMENTOS",
                columns: table => new
                {
                    id_inventario = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    nombre = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    presentacion = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    precio_unitario = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    existencias = table.Column<int>(type: "int", nullable: false),
                    stock_minimo = table.Column<int>(type: "int", nullable: false),
                    fecha_vencimiento = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_INVENTARIO_MEDICAMENTOS", x => x.id_inventario);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TBL_INVENTARIO_MEDICAMENTOS_nombre",
                table: "TBL_INVENTARIO_MEDICAMENTOS",
                column: "nombre",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TBL_INVENTARIO_MEDICAMENTOS");

            migrationBuilder.DropColumn(
                name: "id_inventario",
                table: "TBL_MEDICAMENTOS_RECETADOS");

            migrationBuilder.DropColumn(
                name: "unidades_despachadas",
                table: "TBL_MEDICAMENTOS_RECETADOS");
        }
    }
}
