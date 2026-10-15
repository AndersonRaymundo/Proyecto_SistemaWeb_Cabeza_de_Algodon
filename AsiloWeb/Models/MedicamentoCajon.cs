using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AsiloWeb.Models
{
    // Medicamento de cajón (uso continuo/crónico) del residente. Un residente
    // puede tener varios, por eso cada uno es una fila ligada a su ficha base
    // (TBL_FICHAS_MEDICAS). Distinto de TBL_MEDICAMENTOS_RECETADOS, que son
    // los recetados en una consulta puntual y pasan por farmacia.
    [Table("TBL_MEDICAMENTOS_CAJON")]
    public class MedicamentoCajon
    {
        [Key]
        [Column("id_medicamento_cajon")]
        public int IdMedicamentoCajon { get; set; }

        [Column("id_ficha")]
        public int IdFicha { get; set; }

        [Required]
        [MaxLength(200)]
        [Column("nombre_medicamento")]
        public string NombreMedicamento { get; set; } = string.Empty;

        // Ej. "50 mg", "1 tableta"
        [MaxLength(100)]
        [Column("dosis")]
        public string? Dosis { get; set; }

        // Ej. "Cada 12 horas", "En ayunas"
        [MaxLength(100)]
        [Column("frecuencia")]
        public string? Frecuencia { get; set; }
    }
}
