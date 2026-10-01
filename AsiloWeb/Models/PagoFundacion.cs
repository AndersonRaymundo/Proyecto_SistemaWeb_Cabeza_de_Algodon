using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AsiloWeb.Models
{
    // Corresponde a TBL_PAGOS_FUNDACION del ERD (FK a id_paciente): según el
    // propio diagrama, registra los pagos/cobros asociados a un paciente
    // (mensualidad, servicio médico), cubriendo RF-13. El "estado" se agrega
    // sobre el ERD original porque RF-12 exige poder distinguir qué cobros
    // aún no han sido cancelados por el familiar.
    //
    // La "deuda del asilo con la fundación" (RF-11) no tiene tabla propia en
    // el ERD entregado; en vez de inventar una tabla redundante, se calcula
    // como un total agregado (ver CajaController -> /resumen) sumando los
    // costos de citas, exámenes y medicamentos ya registrados.
    [Table("TBL_PAGOS_FUNDACION")]
    public class PagoFundacion
    {
        [Key]
        [Column("id_pago")]
        public int IdPago { get; set; }

        [Column("id_paciente")]
        public int IdPaciente { get; set; }

        [Column("concepto_pago")]
        public string ConceptoPago { get; set; } = string.Empty;

        [Column("monto")]
        public decimal Monto { get; set; }

        [Column("fecha_pago")]
        public DateTime FechaPago { get; set; } = DateTime.Now;

        // Pendiente | Pagado
        [Column("estado")]
        public string Estado { get; set; } = "Pendiente";
    }
}
