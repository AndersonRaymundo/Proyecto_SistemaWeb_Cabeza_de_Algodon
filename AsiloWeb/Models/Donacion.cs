using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AsiloWeb.Models
{
    // Corresponde a TBL_DONACIONES del ERD. Cubre RF-13 y el caso de uso
    // CU-04 (donación institucional sin paciente asociado).
    [Table("TBL_DONACIONES")]
    public class Donacion
    {
        [Key]
        [Column("id_donacion")]
        public int IdDonacion { get; set; }

        [Column("donante")]
        public string Donante { get; set; } = string.Empty;

        [Column("monto")]
        public decimal Monto { get; set; }

        // Internacional | Nacional | Gobierno | Particular
        [Column("tipo_donacion")]
        public string TipoDonacion { get; set; } = string.Empty;

        [Column("fecha_donacion")]
        public DateTime FechaDonacion { get; set; } = DateTime.Now;
    }
}
