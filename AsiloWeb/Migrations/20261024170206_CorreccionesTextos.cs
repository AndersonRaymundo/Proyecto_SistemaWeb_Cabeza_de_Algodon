using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BackendAsilo.Migrations
{
    // Correccion de tildes en los usuarios de prueba y en los cobros, y especialidad del doctor
    public partial class CorreccionesTextos : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE TBL_USUARIOS SET nombre_completo = N'Licda. Sofía López'
                WHERE nombre_completo = N'Licda. Sofia Lopez';

                UPDATE TBL_USUARIOS SET nombre_completo = N'Personal de la Fundación'
                WHERE nombre_completo = N'Personal de la Fundacion';

                UPDATE TBL_USUARIOS SET especialidad = N'Medicina general'
                WHERE nombre_usuario = N'doctor' AND rol = N'DOCTOR' AND (especialidad IS NULL OR especialidad = N'');

                UPDATE TBL_PAGOS_FUNDACION
                SET concepto_pago = REPLACE(REPLACE(concepto_pago,
                        N'(lista Q', N'(precio de lista Q'),
                        N', desc. fundacion ', N', descuento de la fundación ')
                WHERE concepto_pago LIKE N'%desc. fundacion%';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // No se revierte
        }
    }
}
