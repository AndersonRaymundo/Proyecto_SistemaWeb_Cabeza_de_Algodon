using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AsiloWeb.Models
{
    // Patología / condición del residente. Un residente puede tener varias,
    // por eso cada una es una fila ligada a su ficha base (TBL_FICHAS_MEDICAS).
    // "diagnostico_base" de la ficha y "patologia" de TBL_PACIENTES guardan
    // el resumen en texto (todas unidas por comas) para listados y reportes.
    [Table("TBL_PATOLOGIAS")]
    public class Patologia
    {
        [Key]
        [Column("id_patologia")]
        public int IdPatologia { get; set; }

        [Column("id_ficha")]
        public int IdFicha { get; set; }

        [Required]
        [MaxLength(200)]
        [Column("nombre")]
        public string Nombre { get; set; } = string.Empty;

        // Ej. "Controlada", "Diagnosticada en 2020"
        [MaxLength(200)]
        [Column("observaciones")]
        public string? Observaciones { get; set; }
    }
}
