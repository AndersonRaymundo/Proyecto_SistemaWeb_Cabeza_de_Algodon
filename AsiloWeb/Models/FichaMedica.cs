using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AsiloWeb.Models
{
    // Corresponde a TBL_FICHAS_MEDICAS del ERD: la ficha base/crónica del
    // residente (diagnóstico base y medicamentos continuos), distinta de
    // cada cita puntual (TBL_CITAS_MEDICAS). CU-03 del análisis.
    [Table("TBL_FICHAS_MEDICAS")]
    public class FichaMedica
    {
        [Key]
        [Column("id_ficha")]
        public int IdFicha { get; set; }

        [Column("id_paciente")]
        public int IdPaciente { get; set; }

        [Column("id_doctor")]
        public int IdDoctor { get; set; }

        [Column("diagnostico_base")]
        public string DiagnosticoBase { get; set; } = string.Empty;

        [Column("medicamentos_continuos")]
        public string? MedicamentosContinuos { get; set; }

        [Column("fecha_creacion")]
        public DateTime FechaCreacion { get; set; } = DateTime.Now;
    }
}
