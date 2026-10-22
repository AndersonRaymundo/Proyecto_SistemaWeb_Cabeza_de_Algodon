using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BackendAsilo.Migrations
{
    /// <inheritdoc />
    public partial class MejorasFinales : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "especialidad",
                table: "TBL_USUARIOS",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TBL_BITACORA_CORREOS",
                columns: table => new
                {
                    id_bitacora = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    fecha = table.Column<DateTime>(type: "datetime2", nullable: false),
                    destinatario = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    asunto = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: false),
                    enviado = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_BITACORA_CORREOS", x => x.id_bitacora);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TBL_BITACORA_CORREOS");

            migrationBuilder.DropColumn(
                name: "especialidad",
                table: "TBL_USUARIOS");
        }
    }
}
