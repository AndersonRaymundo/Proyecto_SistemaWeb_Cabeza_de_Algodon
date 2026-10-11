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

        public class FichaMedicaRequest
        {
            public int IdPaciente { get; set; }
            public int IdDoctor { get; set; }
            public string DiagnosticoBase { get; set; } = string.Empty;
            public string? MedicamentosContinuos { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> CrearFicha(FichaMedicaRequest datos)
        {
            var ficha = new FichaMedica
            {
                IdPaciente = datos.IdPaciente,
                IdDoctor = datos.IdDoctor,
                DiagnosticoBase = datos.DiagnosticoBase,
                MedicamentosContinuos = datos.MedicamentosContinuos
            };

            _context.FichasMedicas.Add(ficha);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(ObtenerPorId), new { id = ficha.IdFicha }, ficha);
        }

        // Crea la ficha base del residente o actualiza la que ya tiene (RF-01).
        // Se llama desde la pantalla de Pacientes al guardar.
        [HttpPost("ficha-base")]
        public async Task<IActionResult> GuardarFichaBase(FichaMedicaRequest datos)
        {
            var ficha = await _context.FichasMedicas
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

            ficha.DiagnosticoBase = datos.DiagnosticoBase ?? "";
            ficha.MedicamentosContinuos = datos.MedicamentosContinuos;
            await _context.SaveChangesAsync();
            return Ok(ficha);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerPorId(int id)
        {
            var ficha = await _context.FichasMedicas.FindAsync(id);
            if (ficha == null) return NotFound();
            return Ok(ficha);
        }

        [HttpGet("residente/{idPaciente}")]
        public async Task<IActionResult> HistorialPorResidente(int idPaciente)
        {
            var fichas = await _context.FichasMedicas
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

            return Ok(new { ficha, citas, examenes, medicamentos });
        }
    }
}
