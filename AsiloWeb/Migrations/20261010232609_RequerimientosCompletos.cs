using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BackendAsilo.Migrations
{
    /// <inheritdoc />
    public partial class RequerimientosCompletos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "id_cita",
                table: "TBL_PAGOS_FUNDACION",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "despachado",
                table: "TBL_MEDICAMENTOS_RECETADOS",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "id_cita",
                table: "TBL_EXAMENES_LAB",
                type: "int",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "id_cita",
                table: "TBL_PAGOS_FUNDACION");

            migrationBuilder.DropColumn(
                name: "despachado",
                table: "TBL_MEDICAMENTOS_RECETADOS");

            migrationBuilder.DropColumn(
                name: "id_cita",
                table: "TBL_EXAMENES_LAB");
        }
    }
}
