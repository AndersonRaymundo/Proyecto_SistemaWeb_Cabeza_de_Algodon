using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BackendAsilo.Migrations
{
    /// <inheritdoc />
    public partial class BajaUsuarios : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "activo",
                table: "TBL_USUARIOS",
                type: "bit",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "activo",
                table: "TBL_USUARIOS");
        }
    }
}
