using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AsiloWeb.Models
{
    // Corresponde a TBL_CITAS_MEDICAS del ERD. Une en una sola tabla el ciclo
    // completo que describen RF-02, RF-03, RF-05 y RF-07: el médico general
    // crea la solicitud, la fundación la agenda (asigna doctor y fecha), y al
    // atenderla se completa como visita médica con diagnóstico.
    //
    // Columnas agregadas sobre el ERD original, justificadas por los
    // requerimientos funcionales del propio análisis:
    //  - especialidad_solicitada, enfermero_asignado -> RF-02 / RF-03
    //  - observaciones -> RF-07 ("observaciones médicas")
    //  - costo_total, estado_pago -> RF-10 / RF-12 (cobro y control de mora)
    [Table("TBL_CITAS_MEDICAS")]
    public class CitaMedica
    {
        [Key]
        [Column("id_cita")]
        public int IdCita { get; set; }

        [Column("id_paciente")]
        public int IdPaciente { get; set; }

        // Médico especialista asignado por la fundación (nulo mientras está Pendiente)
        [Column("id_doctor")]
        public int? IdDoctor { get; set; }

        [Column("especialidad_solicitada")]
        public string EspecialidadSolicitada { get; set; } = string.Empty;

        [Column("motivo")]
        public string Motivo { get; set; } = string.Empty;

        [Column("enfermero_asignado")]
        public string? EnfermeroAsignado { get; set; }

        [Column("fecha_solicitud")]
        public DateTime FechaSolicitud { get; set; } = DateTime.Now;

        [Column("fecha_cita")]
        public DateTime? FechaCita { get; set; }

        // Pendiente -> Agendada -> Atendida (o Cancelada)
        [Column("estado")]
        public string Estado { get; set; } = "Pendiente";

        [Column("diagnostico_consulta")]
        public string? DiagnosticoConsulta { get; set; }

        [Column("observaciones")]
        public string? Observaciones { get; set; }

        [Column("costo_total")]
        public decimal CostoTotal { get; set; } = 0;

        // Pendiente | Pagado
        [Column("estado_pago")]
        public string EstadoPago { get; set; } = "Pendiente";
    }
}
