using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BackendAsilo.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "TBL_CITAS_MEDICAS",
                columns: table => new
                {
                    id_cita = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    id_paciente = table.Column<int>(type: "int", nullable: false),
                    id_doctor = table.Column<int>(type: "int", nullable: true),
                    especialidad_solicitada = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    motivo = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    enfermero_asignado = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    fecha_solicitud = table.Column<DateTime>(type: "datetime2", nullable: false),
                    fecha_cita = table.Column<DateTime>(type: "datetime2", nullable: true),
                    estado = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    diagnostico_consulta = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    observaciones = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    costo_total = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    estado_pago = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_CITAS_MEDICAS", x => x.id_cita);
                });

            migrationBuilder.CreateTable(
                name: "TBL_DONACIONES",
                columns: table => new
                {
                    id_donacion = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    donante = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    monto = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    tipo_donacion = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    fecha_donacion = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_DONACIONES", x => x.id_donacion);
                });

            migrationBuilder.CreateTable(
                name: "TBL_EXAMENES_LAB",
                columns: table => new
                {
                    id_examen = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    id_ficha = table.Column<int>(type: "int", nullable: false),
                    id_paciente = table.Column<int>(type: "int", nullable: false),
                    tipo_examen = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    resultados = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    fecha_registro = table.Column<DateTime>(type: "datetime2", nullable: false),
                    costo = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_EXAMENES_LAB", x => x.id_examen);
                });

            migrationBuilder.CreateTable(
                name: "TBL_FICHAS_MEDICAS",
                columns: table => new
                {
                    id_ficha = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    id_paciente = table.Column<int>(type: "int", nullable: false),
                    id_doctor = table.Column<int>(type: "int", nullable: false),
                    diagnostico_base = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    medicamentos_continuos = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    fecha_creacion = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_FICHAS_MEDICAS", x => x.id_ficha);
                });

            migrationBuilder.CreateTable(
                name: "TBL_GASTOS",
                columns: table => new
                {
                    id_gasto = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    concepto = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    monto = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    fecha = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_GASTOS", x => x.id_gasto);
                });

            migrationBuilder.CreateTable(
                name: "TBL_MEDICAMENTOS_RECETADOS",
                columns: table => new
                {
                    id_medicamento = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    id_cita = table.Column<int>(type: "int", nullable: true),
                    id_paciente = table.Column<int>(type: "int", nullable: false),
                    nombre_medicamento = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    cantidad = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    tiempo_aplicacion = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    costo = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    fecha_despacho = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_MEDICAMENTOS_RECETADOS", x => x.id_medicamento);
                });

            migrationBuilder.CreateTable(
                name: "TBL_PAGOS_FUNDACION",
                columns: table => new
                {
                    id_pago = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    id_paciente = table.Column<int>(type: "int", nullable: false),
                    concepto_pago = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    monto = table.Column<decimal>(type: "decimal(10,2)", precision: 10, scale: 2, nullable: false),
                    fecha_pago = table.Column<DateTime>(type: "datetime2", nullable: false),
                    estado = table.Column<string>(type: "nvarchar(max)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_PAGOS_FUNDACION", x => x.id_pago);
                });

            migrationBuilder.CreateTable(
                name: "TBL_USUARIOS",
                columns: table => new
                {
                    id_usuario = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    nombre_usuario = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    email = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    password_hash = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    rol = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    nombre_completo = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    intentos_fallidos = table.Column<int>(type: "int", nullable: false),
                    cuenta_bloqueada = table.Column<bool>(type: "bit", nullable: false),
                    bloqueado_hasta = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TBL_USUARIOS", x => x.id_usuario);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TBL_CITAS_MEDICAS");

            migrationBuilder.DropTable(
                name: "TBL_DONACIONES");

            migrationBuilder.DropTable(
                name: "TBL_EXAMENES_LAB");

            migrationBuilder.DropTable(
                name: "TBL_FICHAS_MEDICAS");

            migrationBuilder.DropTable(
                name: "TBL_GASTOS");

            migrationBuilder.DropTable(
                name: "TBL_MEDICAMENTOS_RECETADOS");

            migrationBuilder.DropTable(
                name: "TBL_PAGOS_FUNDACION");

            migrationBuilder.DropTable(
                name: "TBL_USUARIOS");
        }
    }
}
