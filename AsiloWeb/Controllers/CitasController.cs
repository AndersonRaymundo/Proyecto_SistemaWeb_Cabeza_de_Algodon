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
        private readonly AgendaService _agenda;

        public CitasController(AppDbContext context, EmailService emailService,
            PacientesService pacientes, FacturacionService facturacion, ExpedienteService expediente, AgendaService agenda)
        {
            _agenda = agenda;
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
            if (await _pacientes.EstaDadoDeBajaAsync(datos.IdPaciente))
                return BadRequest(new { message = PacientesService.MensajeDadoDeBaja });

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

            return StatusCode(StatusCodes.Status201Created, cita);
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

        // ------------------------------------------------------------------
        // RF-05: la Fundacion asigna horario y medico especialista
        // ------------------------------------------------------------------
        public class AgendarRequest
        {
            public DateTime FechaCita { get; set; }
            public int IdDoctor { get; set; }
        }

        public class CancelarRequest
        {
            public string? Motivo { get; set; }
        }

        // Cancela una cita agendada que todavia no se atendio. El horario queda libre y se avisa al familiar.
        // (Para cambiar la fecha o el medico no hace falta cancelar: se vuelve a agendar la misma solicitud.)
        [HttpPut("{id}/cancelar")]
        [Authorize(Roles = "ADMINISTRADOR,FUNDACION")]
        public async Task<IActionResult> Cancelar(int id, CancelarRequest datos)
        {
            var cita = await _context.CitasMedicas.FindAsync(id);
            if (cita == null) return NotFound();
            if (cita.Estado != "Agendada")
                return BadRequest(new { message = "Solo se pueden cancelar citas agendadas que todavía no fueron atendidas." });

            var motivo = (datos.Motivo ?? "").Trim();
            if (motivo.Length < 3)
                return BadRequest(new { message = "Escriba el motivo de la cancelación." });

            cita.Estado = "Cancelada";
            cita.Observaciones = $"Cancelada: {motivo}";
            await _context.SaveChangesAsync();

            var paciente = await _pacientes.ObtenerAsync(cita.IdPaciente);
            if (paciente != null && !string.IsNullOrWhiteSpace(paciente.CorreoTutor))
            {
                var cuerpo =
                    "<div style=\"font-family: Arial, sans-serif;\"><h2>Asilo Cabeza de Algod&oacute;n</h2>" +
                    $"<p>Estimado(a) <b>{H(paciente.NombreTutor)}</b>,</p>" +
                    $"<p>La cita de <b>{H(paciente.NombreCompleto)}</b> ({H(cita.EspecialidadSolicitada)}) fue <b>cancelada</b>.</p>" +
                    $"<p><b>Motivo:</b> {H(motivo)}</p>" +
                    "<p>La Fundaci&oacute;n le informar&aacute; la nueva fecha cuando se reagende.</p></div>";
                await _emailService.EnviarNotificacionAsync(paciente.CorreoTutor, "Cita médica cancelada - Asilo Cabeza de Algodón", cuerpo);
            }
            return Ok(cita);
        }

        // Horarios de un medico en un dia: el cliente muestra solo estos espacios para elegir.
        // idCita (opcional) es la solicitud que se esta agendando: no choca consigo misma y, si el
        // residente ya tiene otra cita a esa hora, ese espacio se marca como ocupado.
        [HttpGet("disponibilidad")]
        [Authorize(Roles = "ADMINISTRADOR,FUNDACION")]
        public async Task<IActionResult> Disponibilidad(int idDoctor, DateTime fecha, int? idCita)
        {
            var dia = fecha.Date;
            if (!_agenda.EsDiaLaborable(dia))
                return Ok(new { laborable = false, mensaje = "Ese día no hay atención de citas.", horarios = new object[0] });

            var siguiente = dia.AddDays(1);
            var ocupadas = await _context.CitasMedicas
                .Where(c => c.Estado != "Cancelada" && c.FechaCita != null && c.FechaCita >= dia && c.FechaCita < siguiente && (idCita == null || c.IdCita != idCita))
                .Select(c => new { c.IdDoctor, c.IdPaciente, c.FechaCita })
                .ToListAsync();

            int? idPaciente = null;
            if (idCita != null)
                idPaciente = await _context.CitasMedicas.Where(c => c.IdCita == idCita).Select(c => (int?)c.IdPaciente).FirstOrDefaultAsync();

            var horarios = _agenda.HorariosDelDia().Select(h =>
            {
                var inicio = dia + h;
                var medico = ocupadas.Any(c => c.IdDoctor == idDoctor && c.FechaCita == inicio);
                var residente = idPaciente != null && ocupadas.Any(c => c.IdPaciente == idPaciente && c.FechaCita == inicio);
                return new { hora = $"{h.Hours:00}:{h.Minutes:00}", estado = medico ? "medico" : (residente ? "residente" : "libre") };
            }).ToList();

            return Ok(new { laborable = true, horarios });
        }

        [HttpPut("{id}/agendar")]
        [Authorize(Roles = "ADMINISTRADOR,FUNDACION")]
        public async Task<IActionResult> Agendar(int id, AgendarRequest datos)
        {
            var cita = await _context.CitasMedicas.FindAsync(id);
            if (cita == null) return NotFound();
            if (cita.Estado == "Atendida")
                return BadRequest(new { message = "Esta cita ya fue atendida." });
            if (cita.Estado == "Cancelada")
                return BadRequest(new { message = "Esta cita fue cancelada." });
            if (await _pacientes.EstaDadoDeBajaAsync(cita.IdPaciente))
                return BadRequest(new { message = PacientesService.MensajeDadoDeBaja });

            // Solo se agenda dentro del horario de atencion (jornada, dias laborables y sin el almuerzo)
            var errorHorario = _agenda.Validar(datos.FechaCita);
            if (errorHorario != null)
                return BadRequest(new { message = errorHorario });

            // La agenda no admite choques: un medico no puede tener dos citas a la misma fecha y hora,
            // ni un residente estar en dos citas a la vez (la cita que se esta moviendo no cuenta).
            var medicoOcupado = await _context.CitasMedicas.AnyAsync(c =>
                c.IdCita != id && c.Estado != "Cancelada" && c.IdDoctor == datos.IdDoctor && c.FechaCita == datos.FechaCita);
            if (medicoOcupado)
                return BadRequest(new { message = "Ese médico ya tiene una cita en esa fecha y hora. Elija otro horario u otro médico." });

            var residenteOcupado = await _context.CitasMedicas.AnyAsync(c =>
                c.IdCita != id && c.Estado != "Cancelada" && c.IdPaciente == cita.IdPaciente && c.FechaCita == datos.FechaCita);
            if (residenteOcupado)
                return BadRequest(new { message = "Este residente ya tiene otra cita en esa fecha y hora." });

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
        public class MedicamentoVisita
        {
            public string Nombre { get; set; } = string.Empty;
            public string? Cantidad { get; set; }
            public string? TiempoAplicacion { get; set; }
        }

        public class VisitaRequest
        {
            public string DiagnosticoConsulta { get; set; } = string.Empty;
            public string? Observaciones { get; set; }
            public decimal PrecioLista { get; set; }          // precio de la consulta antes del descuento
            public string? ExamenSolicitado { get; set; }      // se manda al laboratorio
            public string? Medicamento { get; set; }           // se manda a farmacia
            public string? Cantidad { get; set; }
            public string? TiempoAplicacion { get; set; }
            public List<string>? Examenes { get; set; }                  // varios examenes (van al laboratorio)
            public List<MedicamentoVisita>? Medicamentos { get; set; }   // varios medicamentos (van a farmacia)
        }

        // Registra examenes/medicamentos de la visita y el cobro de la consulta (RF-07, RF-10)
        private async Task RegistrarDetalleVisitaAsync(CitaMedica cita, VisitaRequest datos)
        {
            cita.EstadoPago = "Sin cargos";
            cita.CostoTotal = _facturacion.AplicarDescuento(datos.PrecioLista);

            // RF-07: la visita admite varios examenes y varios medicamentos
            // (tambien se aceptan los campos simples de la version anterior)
            var examenes = (datos.Examenes ?? new List<string>()).ToList();
            if (!string.IsNullOrWhiteSpace(datos.ExamenSolicitado)) examenes.Add(datos.ExamenSolicitado!);
            examenes = examenes.Where(e => !string.IsNullOrWhiteSpace(e)).Select(e => e.Trim()).Distinct().ToList();

            var medicamentos = (datos.Medicamentos ?? new List<MedicamentoVisita>()).ToList();
            if (!string.IsNullOrWhiteSpace(datos.Medicamento))
                medicamentos.Add(new MedicamentoVisita { Nombre = datos.Medicamento!, Cantidad = datos.Cantidad, TiempoAplicacion = datos.TiempoAplicacion });
            medicamentos = medicamentos.Where(m => !string.IsNullOrWhiteSpace(m.Nombre)).ToList();

            if (examenes.Count > 0)
            {
                var ficha = await _expediente.ObtenerOCrearFichaAsync(cita.IdPaciente, cita.IdDoctor ?? IdUsuarioActual);
                foreach (var examen in examenes)
                {
                    _context.ExamenesLaboratorio.Add(new ExamenLaboratorio
                    {
                        IdFicha = ficha.IdFicha,
                        IdPaciente = cita.IdPaciente,
                        IdCita = cita.IdCita,
                        TipoExamen = examen
                    });
                }
            }

            foreach (var m in medicamentos)
            {
                _context.MedicamentosRecetados.Add(new MedicamentoRecetado
                {
                    IdCita = cita.IdCita,
                    IdPaciente = cita.IdPaciente,
                    NombreMedicamento = m.Nombre.Trim(),
                    Cantidad = m.Cantidad,
                    TiempoAplicacion = m.TiempoAplicacion,
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
            if (cita.Estado == "Cancelada")
                return BadRequest(new { message = "Esta cita fue cancelada." });
            if (await _pacientes.EstaDadoDeBajaAsync(cita.IdPaciente))
                return BadRequest(new { message = PacientesService.MensajeDadoDeBaja });

            // RF-07: la visita la registra el medico asignado (el administrador puede hacerlo siempre)
            if (User.IsInRole("DOCTOR") && cita.IdDoctor.HasValue && cita.IdDoctor.Value != IdUsuarioActual)
                return StatusCode(403, new { message = "Esta cita fue asignada a otro médico." });

            cita.DiagnosticoConsulta = datos.DiagnosticoConsulta;
            cita.Observaciones = datos.Observaciones;
            cita.Estado = "Atendida";
            if (cita.IdDoctor == null) cita.IdDoctor = IdUsuarioActual;

            await RegistrarDetalleVisitaAsync(cita, datos);
            return Ok(cita);
        }

        // Estado de pago manual de una cita (lo normal es que cambie solo desde Caja)
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
            public List<string>? Examenes { get; set; }
            public List<MedicamentoVisita>? Medicamentos { get; set; }
        }

        [HttpPost("registro-directo")]
        [Authorize(Roles = "ADMINISTRADOR,DOCTOR")]
        public async Task<IActionResult> RegistroDirecto(RegistroDirectoRequest datos)
        {
            if (await _pacientes.EstaDadoDeBajaAsync(datos.IdPaciente))
                return BadRequest(new { message = PacientesService.MensajeDadoDeBaja });

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
                TiempoAplicacion = datos.TiempoAplicacion,
                Examenes = datos.Examenes,
                Medicamentos = datos.Medicamentos
            });

            return Ok(cita);
        }
    }
}
