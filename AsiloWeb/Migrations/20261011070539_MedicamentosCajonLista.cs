using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BackendAsilo.Migrations
{
    /// <summary>
    /// Los medicamentos de cajon pasan de ser un texto en TBL_FICHAS_MEDICAS
    /// ("medicamentos_continuos") a una lista: una fila por medicamento en
    /// TBL_MEDICAMENTOS_CAJON. Los textos que ya existian se separan por
    /// comas o punto y coma y cada parte se guarda como un medicamento.
    /// </summary>
    public partial class MedicamentosCajonLista : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TBL_MEDICAMENTOS_CAJON",
                columns: table => new
                {
                    id_medicamento_cajon = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    id_ficha = table.Column<int>(type: "int", nullable: false),
                    nombre_medicamento = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    dosis = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    frecuencia = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_MEDICAMENTOS_CAJON", x => x.id_medicamento_cajon);
                    table.ForeignKey(
                        name: "FK_TBL_MEDICAMENTOS_CAJON_TBL_FICHAS_MEDICAS_id_ficha",
                        column: x => x.id_ficha,
                        principalTable: "TBL_FICHAS_MEDICAS",
                        principalColumn: "id_ficha",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_TBL_MEDICAMENTOS_CAJON_id_ficha",
                table: "TBL_MEDICAMENTOS_CAJON",
                column: "id_ficha");

            // Pasar los textos existentes a filas antes de borrar la columna.
            migrationBuilder.Sql(@"
                INSERT INTO TBL_MEDICAMENTOS_CAJON (id_ficha, nombre_medicamento)
                SELECT f.id_ficha, LEFT(LTRIM(RTRIM(p.value)), 200)
                FROM TBL_FICHAS_MEDICAS f
                CROSS APPLY STRING_SPLIT(REPLACE(f.medicamentos_continuos, ';', ','), ',') p
                WHERE f.medicamentos_continuos IS NOT NULL
                  AND LTRIM(RTRIM(p.value)) <> '';");

            migrationBuilder.DropColumn(
                name: "medicamentos_continuos",
                table: "TBL_FICHAS_MEDICAS");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "medicamentos_continuos",
                table: "TBL_FICHAS_MEDICAS",
                type: "nvarchar(max)",
                nullable: true);

            // Volver a juntar la lista en un solo texto separado por comas.
            migrationBuilder.Sql(@"
                UPDATE f SET medicamentos_continuos = m.texto
                FROM TBL_FICHAS_MEDICAS f
                JOIN (
                    SELECT id_ficha,
                           STRING_AGG(CAST(CONCAT_WS(' ', nombre_medicamento, dosis, frecuencia) AS nvarchar(max)), ', ') AS texto
                    FROM TBL_MEDICAMENTOS_CAJON
                    GROUP BY id_ficha
                ) m ON m.id_ficha = f.id_ficha;");

            migrationBuilder.DropTable(
                name: "TBL_MEDICAMENTOS_CAJON");
        }
    }
}
