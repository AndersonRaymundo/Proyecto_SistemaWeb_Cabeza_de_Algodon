using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BackendAsilo.Migrations
{
    /// <inheritdoc />
    public partial class AbonosFundacion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TBL_MEDICAMENTOS_CAJON_TBL_FICHAS_MEDICAS_id_ficha",
                table: "TBL_MEDICAMENTOS_CAJON");

            migrationBuilder.DropForeignKey(
                name: "FK_TBL_PATOLOGIAS_TBL_FICHAS_MEDICAS_id_ficha",
                table: "TBL_PATOLOGIAS");

            migrationBuilder.DropIndex(
                name: "IX_TBL_PATOLOGIAS_id_ficha",
                table: "TBL_PATOLOGIAS");

            migrationBuilder.DropIndex(
                name: "IX_TBL_MEDICAMENTOS_CAJON_id_ficha",
                table: "TBL_MEDICAMENTOS_CAJON");

            migrationBuilder.AddColumn<int>(
                name: "FichaMedicaIdFicha",
                table: "TBL_PATOLOGIAS",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "FichaMedicaIdFicha",
                table: "TBL_MEDICAMENTOS_CAJON",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TBL_ABONOS_FUNDACION",
                columns: table => new
                {
                    id_abono = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    monto = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    fecha_pago = table.Column<DateTime>(type: "datetime2", nullable: false),
                    nota = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    id_usuario = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_ABONOS_FUNDACION", x => x.id_abono);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TBL_PATOLOGIAS_FichaMedicaIdFicha",
                table: "TBL_PATOLOGIAS",
                column: "FichaMedicaIdFicha");

            migrationBuilder.CreateIndex(
                name: "IX_TBL_MEDICAMENTOS_CAJON_FichaMedicaIdFicha",
                table: "TBL_MEDICAMENTOS_CAJON",
                column: "FichaMedicaIdFicha");

            migrationBuilder.AddForeignKey(
                name: "FK_TBL_MEDICAMENTOS_CAJON_TBL_FICHAS_MEDICAS_FichaMedicaIdFicha",
                table: "TBL_MEDICAMENTOS_CAJON",
                column: "FichaMedicaIdFicha",
                principalTable: "TBL_FICHAS_MEDICAS",
                principalColumn: "id_ficha");

            migrationBuilder.AddForeignKey(
                name: "FK_TBL_PATOLOGIAS_TBL_FICHAS_MEDICAS_FichaMedicaIdFicha",
                table: "TBL_PATOLOGIAS",
                column: "FichaMedicaIdFicha",
                principalTable: "TBL_FICHAS_MEDICAS",
                principalColumn: "id_ficha");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_TBL_MEDICAMENTOS_CAJON_TBL_FICHAS_MEDICAS_FichaMedicaIdFicha",
                table: "TBL_MEDICAMENTOS_CAJON");

            migrationBuilder.DropForeignKey(
                name: "FK_TBL_PATOLOGIAS_TBL_FICHAS_MEDICAS_FichaMedicaIdFicha",
                table: "TBL_PATOLOGIAS");

            migrationBuilder.DropTable(
                name: "TBL_ABONOS_FUNDACION");

            migrationBuilder.DropIndex(
                name: "IX_TBL_PATOLOGIAS_FichaMedicaIdFicha",
                table: "TBL_PATOLOGIAS");

            migrationBuilder.DropIndex(
                name: "IX_TBL_MEDICAMENTOS_CAJON_FichaMedicaIdFicha",
                table: "TBL_MEDICAMENTOS_CAJON");

            migrationBuilder.DropColumn(
                name: "FichaMedicaIdFicha",
                table: "TBL_PATOLOGIAS");

            migrationBuilder.DropColumn(
                name: "FichaMedicaIdFicha",
                table: "TBL_MEDICAMENTOS_CAJON");

            migrationBuilder.CreateIndex(
                name: "IX_TBL_PATOLOGIAS_id_ficha",
                table: "TBL_PATOLOGIAS",
                column: "id_ficha");

            migrationBuilder.CreateIndex(
                name: "IX_TBL_MEDICAMENTOS_CAJON_id_ficha",
                table: "TBL_MEDICAMENTOS_CAJON",
                column: "id_ficha");

            migrationBuilder.AddForeignKey(
                name: "FK_TBL_MEDICAMENTOS_CAJON_TBL_FICHAS_MEDICAS_id_ficha",
                table: "TBL_MEDICAMENTOS_CAJON",
                column: "id_ficha",
                principalTable: "TBL_FICHAS_MEDICAS",
                principalColumn: "id_ficha",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_TBL_PATOLOGIAS_TBL_FICHAS_MEDICAS_id_ficha",
                table: "TBL_PATOLOGIAS",
                column: "id_ficha",
                principalTable: "TBL_FICHAS_MEDICAS",
                principalColumn: "id_ficha",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
