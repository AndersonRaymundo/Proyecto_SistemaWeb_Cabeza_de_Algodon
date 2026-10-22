using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AsiloWeb.Models
{
    // Registro de cada correo que el sistema intenta enviar (solicitudes, citas, comprobantes, codigos).
    // Sirve para saber si un correo salio o fallo, que de otra forma queda oculto.
    [Table("TBL_BITACORA_CORREOS")]
    public class BitacoraCorreo
    {
        [Key]
        [Column("id_bitacora")]
        public int IdBitacora { get; set; }

        [Column("fecha")]
        public DateTime Fecha { get; set; } = DateTime.Now;

        [StringLength(200)]
        [Column("destinatario")]
        public string Destinatario { get; set; } = string.Empty;

        [StringLength(250)]
        [Column("asunto")]
        public string Asunto { get; set; } = string.Empty;

        [Column("enviado")]
        public bool Enviado { get; set; }
    }
}
