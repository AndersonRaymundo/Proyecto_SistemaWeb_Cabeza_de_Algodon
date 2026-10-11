using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AsiloWeb.Data;
using AsiloWeb.Models;
using AsiloWeb.Services;

namespace AsiloWeb.Controllers
{
    // Ciclo completo de la cita medica:
    //  RF-02 solicitud, RF-03 enfermero acompanante, RF-04 correo al familiar,
    //  RF-05 agenda de la fundacion, RF-07 visita medica, RF-10 cobro automatico.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "ADMINISTRADOR,DOCTOR,ENFERMERO,FUNDACION")]
    public class CitasController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly EmailService _emailService;
        private readonly PacientesService _pacientes;
        private readonly FacturacionService _facturacion;
        private readonly ExpedienteService _expediente;

        public CitasController(AppDbContext context, EmailService emailService,
            PacientesService pacientes, FacturacionService facturacion, ExpedienteService expediente)
        {
            _context = context;
            _emailService = emailService;
            _pacientes = pacientes;
            _facturacion = facturacion;
            _expediente = expediente;
        }

        private int IdUsuarioActual =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

        private static string H(string? texto) => WebUtility.HtmlEncode(texto ?? "");

        // ------------------------------------------------------------------
        // RF-02 / RF-03 / RF-04: crear la solicitud y avisar al familiar
        // ------------------------------------------------------------------
        public class SolicitudRequest
        {
            public int IdPaciente { get; set; }
            public string EspecialidadSolicitada { get; set; } = string.Empty;
            public string Motivo { get; set; } = string.Empty;
            public string? EnfermeroAsignado { get; set; }
            public string? CorreoFamiliar { get; set; } // respaldo si el microservicio no responde
        }

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

            // RF-04: correo con el estado del paciente y la especialidad a la que fue referido
            var paciente = await _pacientes.ObtenerAsync(cita.IdPaciente);
            var correo = !string.IsNullOrWhiteSpace(paciente?.CorreoTutor) ? paciente!.CorreoTutor : datos.CorreoFamiliar;

            if (!string.IsNullOrWhiteSpace(correo))
            {
                var cuerpo =
                    "<div style=\"font-family: Arial, sans-serif;\">" +
                    "<h2>Asilo Cabeza de Algod&oacute;n</h2>" +
                    $"<p>Estimado(a) <b>{H(paciente?.NombreTutor ?? "Tutor/Encargado")}</b>,</p>" +
                    $"<p>Le informamos que para el residente <b>{H(paciente?.NombreCompleto ?? "su familiar")}</b> se cre&oacute; una solicitud de evaluaci&oacute;n m&eacute;dica.</p>" +
                    "<ul>" +
                    $"<li><b>Estado / condici&oacute;n del paciente:</b> {H(string.IsNullOrWhiteSpace(paciente?.Patologia) ? "En observación" : paciente!.Patologia)}</li>" +
                    $"<li><b>Especialidad a la que fue referido:</b> {H(cita.EspecialidadSolicitada)}</li>" +
                    $"<li><b>Motivo de la remisi&oacute;n:</b> {H(cita.Motivo)}</li>" +
                    "</ul>" +
                    "<p>Le informaremos cuando la Fundaci&oacute;n asigne el m&eacute;dico y la fecha de la cita.</p>" +
                    "</div>";

                await _emailService.EnviarNotificacionAsync(
                    correo!,
                    "Actualización del estado de su familiar - Asilo Cabeza de Algodón",
                    cuerpo);
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

        // ------------------------------------------------------------------
        // RF-05: la Fundacion asigna horario y medico especialista
        // ------------------------------------------------------------------
        public class AgendarRequest
        {
            public DateTime FechaCita { get; set; }
            public int IdDoctor { get; set; }
        }

        [HttpPut("{id}/agendar")]
        [Authorize(Roles = "ADMINISTRADOR,FUNDACION")]
        public async Task<IActionResult> Agendar(int id, AgendarRequest datos)
        {
            var cita = await _context.CitasMedicas.FindAsync(id);
            if (cita == null) return NotFound();
            if (cita.Estado == "Atendida")
                return BadRequest(new { message = "Esta cita ya fue atendida." });

            cita.FechaCita = datos.FechaCita;
            cita.IdDoctor = datos.IdDoctor;
            cita.Estado = "Agendada";
            await _context.SaveChangesAsync();

            // Aviso al familiar con la fecha y el medico asignado
            var paciente = await _pacientes.ObtenerAsync(cita.IdPaciente);
            var doctor = await _context.Usuarios.FindAsync(datos.IdDoctor);
            if (!string.IsNullOrWhiteSpace(paciente?.CorreoTutor))
            {
                var cuerpo =
                    "<div style=\"font-family: Arial, sans-serif;\">" +
                    "<h2>Asilo Cabeza de Algod&oacute;n</h2>" +
                    $"<p>Estimado(a) <b>{H(paciente!.NombreTutor)}</b>,</p>" +
                    $"<p>La cita de <b>{H(paciente.NombreCompleto)}</b> ({H(cita.EspecialidadSolicitada)}) fue agendada:</p>" +
                    "<ul>" +
                    $"<li><b>Fecha y hora:</b> {cita.FechaCita:dd/MM/yyyy HH:mm}</li>" +
                    $"<li><b>M&eacute;dico asignado:</b> {H(doctor?.NombreCompleto ?? "Por confirmar")}</li>" +
                    "</ul></div>";
                await _emailService.EnviarNotificacionAsync(
                    paciente.CorreoTutor!,
                    "Cita médica agendada - Asilo Cabeza de Algodón",
                    cuerpo);
            }

            return Ok(cita);
        }

        // ------------------------------------------------------------------
        // RF-07: el medico convierte la solicitud en visita medica
        // ------------------------------------------------------------------
        public class VisitaRequest
        {
            public string DiagnosticoConsulta { get; set; } = string.Empty;
            public string? Observaciones { get; set; }
            public decimal PrecioLista { get; set; }          // precio de la consulta antes del descuento
            public string? ExamenSolicitado { get; set; }      // se manda al laboratorio
            public string? Medicamento { get; set; }           // se manda a farmacia
            public string? Cantidad { get; set; }
            public string? TiempoAplicacion { get; set; }
        }

        // Registra examenes/medicamentos de la visita y el cobro de la consulta (RF-07, RF-10)
        private async Task RegistrarDetalleVisitaAsync(CitaMedica cita, VisitaRequest datos)
        {
            cita.EstadoPago = "Sin cargos";
            cita.CostoTotal = _facturacion.AplicarDescuento(datos.PrecioLista);

            if (!string.IsNullOrWhiteSpace(datos.ExamenSolicitado))
            {
                var ficha = await _expediente.ObtenerOCrearFichaAsync(cita.IdPaciente, cita.IdDoctor ?? IdUsuarioActual);
                _context.ExamenesLaboratorio.Add(new ExamenLaboratorio
                {
                    IdFicha = ficha.IdFicha,
                    IdPaciente = cita.IdPaciente,
                    IdCita = cita.IdCita,
                    TipoExamen = datos.ExamenSolicitado!.Trim()
                });
            }

            if (!string.IsNullOrWhiteSpace(datos.Medicamento))
            {
                _context.MedicamentosRecetados.Add(new MedicamentoRecetado
                {
                    IdCita = cita.IdCita,
                    IdPaciente = cita.IdPaciente,
                    NombreMedicamento = datos.Medicamento!.Trim(),
                    Cantidad = datos.Cantidad,
                    TiempoAplicacion = datos.TiempoAplicacion,
                    Despachado = false
                });
            }

            await _context.SaveChangesAsync();

            // RF-10: cargo automatico de la consulta a la cuenta del familiar
            await _facturacion.CargarAFamiliaAsync(
                cita.IdPaciente, $"Consulta de {cita.EspecialidadSolicitada}", datos.PrecioLista, cita.IdCita);
        }

        [HttpPut("{id}/completar")]
        [Authorize(Roles = "ADMINISTRADOR,DOCTOR")]
        public async Task<IActionResult> CompletarVisita(int id, VisitaRequest datos)
        {
            var cita = await _context.CitasMedicas.FindAsync(id);
            if (cita == null) return NotFound();
            if (cita.Estado == "Atendida")
                return BadRequest(new { message = "Esta cita ya fue atendida." });

            cita.DiagnosticoConsulta = datos.DiagnosticoConsulta;
            cita.Observaciones = datos.Observaciones;
            cita.Estado = "Atendida";
            if (cita.IdDoctor == null) cita.IdDoctor = IdUsuarioActual;

            await RegistrarDetalleVisitaAsync(cita, datos);
            return Ok(cita);
        }

        // Estado de pago manual de una cita (lo normal es que cambie solo desde Caja)
        public class EstadoPagoRequest
        {
            public string EstadoPago { get; set; } = string.Empty; // Pendiente | Pagado
        }

        [HttpPut("{id}/estado-pago")]
        [Authorize(Roles = "ADMINISTRADOR")]
        public async Task<IActionResult> MarcarPago(int id, EstadoPagoRequest datos)
        {
            var cita = await _context.CitasMedicas.FindAsync(id);
            if (cita == null) return NotFound();

            cita.EstadoPago = datos.EstadoPago;
            await _context.SaveChangesAsync();
            return Ok(cita);
        }

        // ------------------------------------------------------------------
        // Pantalla "Historial Medico": consulta ya atendida, sin solicitud previa
        // ------------------------------------------------------------------
        public class RegistroDirectoRequest
        {
            public int IdPaciente { get; set; }
            public int? IdDoctor { get; set; }
            public string Motivo { get; set; } = string.Empty;
            public string DiagnosticoConsulta { get; set; } = string.Empty;
            public string? Tratamiento { get; set; }          // medicamento recetado
            public string? Cantidad { get; set; }
            public string? TiempoAplicacion { get; set; }
            public string? ExamenSolicitado { get; set; }
            public string? Observaciones { get; set; }
            public decimal PrecioLista { get; set; }
        }

        [HttpPost("registro-directo")]
        [Authorize(Roles = "ADMINISTRADOR,DOCTOR")]
        public async Task<IActionResult> RegistroDirecto(RegistroDirectoRequest datos)
        {
            var cita = new CitaMedica
            {
                IdPaciente = datos.IdPaciente,
                IdDoctor = datos.IdDoctor ?? IdUsuarioActual,
                EspecialidadSolicitada = "General",
                Motivo = datos.Motivo,
                DiagnosticoConsulta = datos.DiagnosticoConsulta,
                Observaciones = datos.Observaciones,
                Estado = "Atendida",
                FechaCita = DateTime.Now
            };
            _context.CitasMedicas.Add(cita);
            await _context.SaveChangesAsync();

            await RegistrarDetalleVisitaAsync(cita, new VisitaRequest
            {
                DiagnosticoConsulta = datos.DiagnosticoConsulta,
                Observaciones = datos.Observaciones,
                PrecioLista = datos.PrecioLista,
                ExamenSolicitado = datos.ExamenSolicitado,
                Medicamento = datos.Tratamiento,
                Cantidad = datos.Cantidad,
                TiempoAplicacion = datos.TiempoAplicacion
            });

            return Ok(cita);
        }
    }
}
