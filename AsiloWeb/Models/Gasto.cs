using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AsiloWeb.Models
{
    // RF-13 pide registrar "los gastos operativos del asilo (agua, luz,
    // etc.)" pero el ERD entregado no incluye una tabla para esto. Se agrega
    // aquí, siguiendo el mismo estilo de nombres del resto del esquema.
    [Table("TBL_GASTOS")]
    public class Gasto
    {
        [Key]
        [Column("id_gasto")]
        public int IdGasto { get; set; }

        [Column("concepto")]
        public string Concepto { get; set; } = string.Empty;

        [Column("monto")]
        public decimal Monto { get; set; }

        [Column("fecha")]
        public DateTime Fecha { get; set; } = DateTime.Now;
    }
}
