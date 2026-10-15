using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AsiloWeb.Models
{
    // RF-11: el sistema acumulaba lo que el asilo le debe a la fundacion, pero no
    // habia donde registrar lo que se le paga. Cada pago a la fundacion (abono) se
    // guarda aqui y reduce el saldo pendiente. No se confunde con TBL_PAGOS_FUNDACION,
    // que guarda los cobros a los familiares.
    [Table("TBL_ABONOS_FUNDACION")]
    public class AbonoFundacion
    {
        [Key]
        [Column("id_abono")]
        public int IdAbono { get; set; }

        [Column("monto")]
        public decimal Monto { get; set; }

        [Column("fecha_pago")]
        public DateTime FechaPago { get; set; } = DateTime.Now;

        [Column("nota")]
        public string? Nota { get; set; }

        [Column("id_usuario")]
        public int? IdUsuario { get; set; }   // quien registro el pago
    }
}
