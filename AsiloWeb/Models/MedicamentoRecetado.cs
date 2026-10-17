using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AsiloWeb.Models
{
    // No aparece en el ERD entregado, pero RF-07 y RF-09 lo piden
    // explícitamente ("medicamento aplicado, cantidad y tiempo de
    // aplicación", "controlar su despacho en farmacia, asociando el costo a
    // la visita médica"). Se liga a la CITA (la consulta puntual que generó
    // la receta), a diferencia de "medicamentos_continuos" en
    // TBL_FICHAS_MEDICAS, que son los de cajón/crónicos.
    [Table("TBL_MEDICAMENTOS_RECETADOS")]
    public class MedicamentoRecetado
    {
        [Key]
        [Column("id_medicamento")]
        public int IdMedicamento { get; set; }

        // Se vuelve opcional: si el despacho no viene de una cita puntual ya
        // registrada, se guarda solo el paciente (más simple para farmacia).
        [Column("id_cita")]
        public int? IdCita { get; set; }

        [Column("id_paciente")]
        public int IdPaciente { get; set; }

        [Column("nombre_medicamento")]
        public string NombreMedicamento { get; set; } = string.Empty;

        [Column("cantidad")]
        public string? Cantidad { get; set; }

        [Column("tiempo_aplicacion")]
        public string? TiempoAplicacion { get; set; }

        [Column("costo")]
        public decimal Costo { get; set; } = 0;

        [Column("fecha_despacho")]
        public DateTime FechaDespacho { get; set; } = DateTime.Now;

        // RF-09: el medico lo receta (Despachado = false) y farmacia lo
        // despacha despues (Despachado = true) asignando el costo.
        [Column("despachado")]
        public bool Despachado { get; set; } = false;

        // Inventario: de que producto del catalogo se descontaron unidades al despachar (opcional)
        [Column("id_inventario")]
        public int? IdInventario { get; set; }

        [Column("unidades_despachadas")]
        public int? UnidadesDespachadas { get; set; }
    }
}
