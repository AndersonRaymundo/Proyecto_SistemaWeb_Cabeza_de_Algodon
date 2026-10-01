using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AsiloWeb.Models
{
    // Corresponde a TBL_EXAMENES_LAB del ERD. El ERD lo liga a id_ficha
    // (la ficha médica base del paciente), tal como está diseñado en el
    // diagrama entregado. Cubre RF-08 (laboratorio ve y registra resultados).
    [Table("TBL_EXAMENES_LAB")]
    public class ExamenLaboratorio
    {
        [Key]
        [Column("id_examen")]
        public int IdExamen { get; set; }

        [Column("id_ficha")]
        public int IdFicha { get; set; }

        // No está en el ERD; se agrega para no obligar al laboratorio a saber
        // el id_ficha de memoria (RF-08: "buscar al paciente del asilo").
        [Column("id_paciente")]
        public int IdPaciente { get; set; }

        [Column("tipo_examen")]
        public string TipoExamen { get; set; } = string.Empty;

        [Column("resultados")]
        public string? Resultados { get; set; }

        [Column("fecha_registro")]
        public DateTime FechaRegistro { get; set; } = DateTime.Now;

        // No está en el ERD, pero RF-10 exige cargar el costo del examen
        // (con descuento de fundación) a la cuenta del familiar.
        [Column("costo")]
        public decimal Costo { get; set; } = 0;
    }
}
