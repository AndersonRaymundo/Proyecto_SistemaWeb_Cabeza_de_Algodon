using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BackendAsilo.Migrations
{
    /// <summary>
    /// Las patologias del residente pasan a ser una lista: una fila por
    /// patologia en TBL_PATOLOGIAS, ligada a la ficha base.
    /// </summary>
    public partial class PatologiasLista : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TBL_PATOLOGIAS",
                columns: table => new
                {
                    id_patologia = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    id_ficha = table.Column<int>(type: "int", nullable: false),
                    nombre = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    observaciones = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_PATOLOGIAS", x => x.id_patologia);
                    table.ForeignKey(
                        name: "FK_TBL_PATOLOGIAS_TBL_FICHAS_MEDICAS_id_ficha",
                        column: x => x.id_ficha,
                        principalTable: "TBL_FICHAS_MEDICAS",
                        principalColumn: "id_ficha",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TBL_PATOLOGIAS_id_ficha",
                table: "TBL_PATOLOGIAS",
                column: "id_ficha");

            // Pasar el diagnostico base que ya existia (texto) a filas,
            // separando por comas o punto y coma. La columna diagnostico_base
            // se conserva como resumen en texto.
            migrationBuilder.Sql(@"
                INSERT INTO TBL_PATOLOGIAS (id_ficha, nombre)
                SELECT f.id_ficha, LEFT(LTRIM(RTRIM(p.value)), 200)
                FROM TBL_FICHAS_MEDICAS f
                CROSS APPLY STRING_SPLIT(REPLACE(f.diagnostico_base, ';', ','), ',') p
                WHERE LTRIM(RTRIM(p.value)) <> '';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TBL_PATOLOGIAS");
        }
    }
}
