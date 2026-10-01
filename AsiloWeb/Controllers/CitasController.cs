using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AsiloWeb.Data;
using AsiloWeb.Models;
using AsiloWeb.Services;

namespace AsiloWeb.Controllers
{
    // Cubre el ciclo RF-02 (solicitud), RF-03 (enfermero asignado), RF-04
    // (correo al familiar), RF-05 (agenda de la fundación) y RF-07 (visita).
    [ApiController]
    [Route("api/[controller]")]
    public class CitasController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly EmailService _emailService;

        public CitasController(AppDbContext context, EmailService emailService)
        {
            _context = context;
            _emailService = emailService;
        }

        public class SolicitudRequest
        {
            public int IdPaciente { get; set; }
            public string EspecialidadSolicitada { get; set; } = string.Empty;
            public string Motivo { get; set; } = string.Empty;
            public string? EnfermeroAsignado { get; set; }
            public string? CorreoFamiliar { get; set; } // se recibe del frontend (dato del paciente)
        }

        // RF-02 + RF-03 + RF-04: el médico general crea la solicitud y se
        // notifica al familiar por correo.
        [HttpPost]
        public async Task<IActionResult> CrearSolicitud(SolicitudRequest datos)
        {
            var cita = new CitaMedica
            {
                IdPaciente = datos.IdPaciente,
                EspecialidadSolicitada = datos.EspecialidadSolicitada,
                Motivo = datos.Motivo,
                EnfermeroAsignado = datos.EnfermeroAsignado
            };

            _context.CitasMedicas.Add(cita);
            await _context.SaveChangesAsync();

            if (!string.IsNullOrWhiteSpace(datos.CorreoFamiliar))
            {
                await _emailService.EnviarNotificacionAsync(
                    datos.CorreoFamiliar,
                    "Actualización del estado de su familiar - Asilo Cabeza de Algodón",
                    $"Se ha creado una solicitud médica para su familiar. Fue referido a la especialidad de {cita.EspecialidadSolicitada}. Le mantendremos informado sobre la fecha y médico asignado."
                );
            }

            return CreatedAtAction(nameof(ObtenerPorId), new { id = cita.IdCita }, cita);
        }

        [HttpGet]
        public async Task<IActionResult> Listar([FromQuery] string? estado)
        {
            var query = _context.CitasMedicas.AsQueryable();
            if (!string.IsNullOrEmpty(estado))
                query = query.Where(c => c.Estado == estado);

            var citas = await query.OrderByDescending(c => c.FechaSolicitud).ToListAsync();
            return Ok(citas);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerPorId(int id)
        {
            var cita = await _context.CitasMedicas.FindAsync(id);
            if (cita == null) return NotFound();
            return Ok(cita);
        }

        [HttpGet("residente/{idPaciente}")]
        public async Task<IActionResult> PorResidente(int idPaciente)
        {
            var citas = await _context.CitasMedicas
                .Where(c => c.IdPaciente == idPaciente)
                .OrderByDescending(c => c.FechaSolicitud)
                .ToListAsync();
            return Ok(citas);
        }

        public class AgendarRequest
        {
            public DateTime FechaCita { get; set; }
            public int IdDoctor { get; set; }
        }

        // RF-05: la fundación asigna horario y médico especialista.
        [HttpPut("{id}/agendar")]
        public async Task<IActionResult> Agendar(int id, AgendarRequest datos)
        {
            var cita = await _context.CitasMedicas.FindAsync(id);
            if (cita == null) return NotFound();

            cita.FechaCita = datos.FechaCita;
            cita.IdDoctor = datos.IdDoctor;
            cita.Estado = "Agendada";
            await _context.SaveChangesAsync();
            return Ok(cita);
        }

        public class VisitaRequest
        {
            public string DiagnosticoConsulta { get; set; } = string.Empty;
            public string? Observaciones { get; set; }
            public decimal CostoTotal { get; set; }
        }

        // RF-07: el médico especialista registra la visita (diagnóstico, costo).
        [HttpPut("{id}/completar")]
        public async Task<IActionResult> CompletarVisita(int id, VisitaRequest datos)
        {
            var cita = await _context.CitasMedicas.FindAsync(id);
            if (cita == null) return NotFound();

            cita.DiagnosticoConsulta = datos.DiagnosticoConsulta;
            cita.Observaciones = datos.Observaciones;
            cita.CostoTotal = datos.CostoTotal;
            cita.Estado = "Atendida";
            await _context.SaveChangesAsync();
            return Ok(cita);
        }

        public class EstadoPagoRequest
        {
            public string EstadoPago { get; set; } = string.Empty; // Pendiente | Pagado
        }

        // RF-10 / RF-12: marcar la cita como pagada por el familiar.
        [HttpPut("{id}/estado-pago")]
        public async Task<IActionResult> MarcarPago(int id, EstadoPagoRequest datos)
        {
            var cita = await _context.CitasMedicas.FindAsync(id);
            if (cita == null) return NotFound();

            cita.EstadoPago = datos.EstadoPago;
            await _context.SaveChangesAsync();
            return Ok(cita);
        }

        public class RegistroDirectoRequest
        {
            public int IdPaciente { get; set; }
            public int? IdDoctor { get; set; }
            public string Motivo { get; set; } = string.Empty;
            public string DiagnosticoConsulta { get; set; } = string.Empty;
            public string? Tratamiento { get; set; }
            public string? Observaciones { get; set; }
        }

        // Para la vista "Historial Médico": registra en un solo paso una
        // consulta ya atendida (motivo + diagnóstico + tratamiento +
        // observaciones), sin pasar por el flujo de solicitud/agenda.
        [HttpPost("registro-directo")]
        public async Task<IActionResult> RegistroDirecto(RegistroDirectoRequest datos)
        {
            var cita = new CitaMedica
            {
                IdPaciente = datos.IdPaciente,
                IdDoctor = datos.IdDoctor,
                EspecialidadSolicitada = "General",
                Motivo = datos.Motivo,
                DiagnosticoConsulta = datos.DiagnosticoConsulta,
                Observaciones = datos.Observaciones,
                Estado = "Atendida",
                FechaCita = DateTime.Now
            };
            _context.CitasMedicas.Add(cita);
            await _context.SaveChangesAsync();

            if (!string.IsNullOrWhiteSpace(datos.Tratamiento))
            {
                _context.MedicamentosRecetados.Add(new MedicamentoRecetado
                {
                    IdPaciente = datos.IdPaciente,
                    NombreMedicamento = datos.Tratamiento
                });
                await _context.SaveChangesAsync();
            }

            return Ok(cita);
        }
    }
}
