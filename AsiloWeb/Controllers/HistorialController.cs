using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AsiloWeb.Data;
using AsiloWeb.Models;

namespace AsiloWeb.Controllers
{
    // CU-03: Registrar Ficha Médica y Diagnóstico.
    [ApiController]
    [Route("api/[controller]")]
    public class HistorialController : ControllerBase
    {
        private readonly AppDbContext _context;

        public HistorialController(AppDbContext context)
        {
            _context = context;
        }

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

        [HttpGet("{id}")]
        public async Task<IActionResult> ObtenerPorId(int id)
        {
            var ficha = await _context.FichasMedicas.FindAsync(id);
            if (ficha == null) return NotFound();
            return Ok(ficha);
        }

        // Historial completo de un residente, para la vista "Historial Médico".
        [HttpGet("residente/{idPaciente}")]
        public async Task<IActionResult> HistorialPorResidente(int idPaciente)
        {
            var fichas = await _context.FichasMedicas
                .Where(f => f.IdPaciente == idPaciente)
                .OrderByDescending(f => f.FechaCreacion)
                .ToListAsync();
            return Ok(fichas);
        }
    }
}
