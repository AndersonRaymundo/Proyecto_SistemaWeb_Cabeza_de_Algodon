using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AsiloWeb.Data;
using AsiloWeb.Models;

namespace AsiloWeb.Controllers
{
    // RF-01 (ficha base: psicopatologia y medicamentos de cajon) y
    // RF-06 (consulta del historial clinico completo).
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "ADMINISTRADOR,DOCTOR,ENFERMERO")]
    public class HistorialController : ControllerBase
    {
        private readonly AppDbContext _context;

        public HistorialController(AppDbContext context)
        {
            _context = context;
        }

        private int IdUsuarioActual =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

        public class PatologiaItem
        {
            public string? Nombre { get; set; }
            public string? Observaciones { get; set; }
        }

        public class MedicamentoCajonItem
        {
            public string? NombreMedicamento { get; set; }
            public string? Dosis { get; set; }
            public string? Frecuencia { get; set; }
        }

        public class FichaMedicaRequest
        {
            public int IdPaciente { get; set; }
            public int IdDoctor { get; set; }
            public string DiagnosticoBase { get; set; } = string.Empty;
            public List<PatologiaItem>? Patologias { get; set; }
            public List<MedicamentoCajonItem>? MedicamentosCajon { get; set; }
        }

        // RF-01: un residente puede tener varias patologias y varios medicamentos de cajon.
        // Si el cliente envia una lista, reemplaza la anterior. DiagnosticoBase guarda el
        // resumen en texto de las patologias (para listados y reportes).
        private void AplicarListas(FichaMedica ficha, FichaMedicaRequest datos)
        {
            if (datos.Patologias != null)
            {
                _context.RemoveRange(ficha.Patologias);
                ficha.Patologias = datos.Patologias
                    .Where(p => !string.IsNullOrWhiteSpace(p.Nombre))
                    .Select(p => new Patologia
                    {
                        Nombre = p.Nombre!.Trim(),
                        Observaciones = string.IsNullOrWhiteSpace(p.Observaciones) ? null : p.Observaciones.Trim()
                    }).ToList();
                ficha.DiagnosticoBase = string.Join(", ", ficha.Patologias.Select(p => p.Nombre));
            }
            else if (!string.IsNullOrWhiteSpace(datos.DiagnosticoBase))
            {
                ficha.DiagnosticoBase = datos.DiagnosticoBase;
            }

            if (datos.MedicamentosCajon != null)
            {
                _context.RemoveRange(ficha.MedicamentosCajon);
                ficha.MedicamentosCajon = datos.MedicamentosCajon
                    .Where(m => !string.IsNullOrWhiteSpace(m.NombreMedicamento))
                    .Select(m => new MedicamentoCajon
                    {
                        NombreMedicamento = m.NombreMedicamento!.Trim(),
                        Dosis = string.IsNullOrWhiteSpace(m.Dosis) ? null : m.Dosis.Trim(),
                        Frecuencia = string.IsNullOrWhiteSpace(m.Frecuencia) ? null : m.Frecuencia.Trim()
                    }).ToList();
            }
        }

        // Crea la ficha base del residente o actualiza la que ya tiene (RF-01).
        // Se llama desde la pantalla de Pacientes al guardar.
        [HttpPost("ficha-base")]
        public async Task<IActionResult> GuardarFichaBase(FichaMedicaRequest datos)
        {
            var ficha = await _context.FichasMedicas
                .Include(f => f.Patologias)
                .Include(f => f.MedicamentosCajon)
                .Where(f => f.IdPaciente == datos.IdPaciente)
                .OrderBy(f => f.IdFicha)
                .FirstOrDefaultAsync();

            if (ficha == null)
            {
                ficha = new FichaMedica
                {
                    IdPaciente = datos.IdPaciente,
                    IdDoctor = datos.IdDoctor > 0 ? datos.IdDoctor : IdUsuarioActual
                };
                _context.FichasMedicas.Add(ficha);
            }

            AplicarListas(ficha, datos);
            await _context.SaveChangesAsync();
            return Ok(ficha);
        }

        [HttpGet("residente/{idPaciente}")]
        public async Task<IActionResult> HistorialPorResidente(int idPaciente)
        {
            var fichas = await _context.FichasMedicas
                .Include(f => f.Patologias)
                .Include(f => f.MedicamentosCajon)
                .Where(f => f.IdPaciente == idPaciente)
                .OrderByDescending(f => f.FechaCreacion)
                .ToListAsync();
            return Ok(fichas);
        }

        // RF-06: ficha base + consultas + examenes + medicamentos del residente
        [HttpGet("expediente/{idPaciente}")]
        [Authorize(Roles = "ADMINISTRADOR,DOCTOR")]
        public async Task<IActionResult> Expediente(int idPaciente)
        {
            var ficha = await _context.FichasMedicas
                .Include(f => f.Patologias)
                .Include(f => f.MedicamentosCajon)
                .Where(f => f.IdPaciente == idPaciente)
                .OrderBy(f => f.IdFicha)
                .FirstOrDefaultAsync();

            var citas = await _context.CitasMedicas
                .Where(c => c.IdPaciente == idPaciente)
                .OrderByDescending(c => c.FechaSolicitud)
                .ToListAsync();

            var examenes = await _context.ExamenesLaboratorio
                .Where(e => e.IdPaciente == idPaciente)
                .OrderByDescending(e => e.FechaRegistro)
                .ToListAsync();

            var medicamentos = await _context.MedicamentosRecetados
                .Where(m => m.IdPaciente == idPaciente)
                .OrderByDescending(m => m.FechaDespacho)
                .ToListAsync();

            // RF-06: cada consulta muestra el medico tratante
            var idsDoctores = citas.Where(c => c.IdDoctor != null).Select(c => c.IdDoctor!.Value).Distinct().ToList();
            var medicos = await _context.Usuarios
                .Where(u => idsDoctores.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto);

            var citasConMedico = citas.Select(c => new
            {
                c.IdCita, c.IdPaciente, c.IdDoctor, c.EspecialidadSolicitada, c.Motivo, c.EnfermeroAsignado,
                c.FechaSolicitud, c.FechaCita, c.Estado, c.DiagnosticoConsulta, c.Observaciones, c.CostoTotal, c.EstadoPago,
                MedicoNombre = c.IdDoctor != null && medicos.ContainsKey(c.IdDoctor.Value) ? medicos[c.IdDoctor.Value] : null
            }).ToList();

            return Ok(new { ficha, citas = citasConMedico, examenes, medicamentos });
        }
    }
}
