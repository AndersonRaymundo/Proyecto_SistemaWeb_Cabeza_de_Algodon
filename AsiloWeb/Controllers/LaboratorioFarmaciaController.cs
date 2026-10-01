using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AsiloWeb.Data;
using AsiloWeb.Models;

namespace AsiloWeb.Controllers
{
    // RF-08 (laboratorio) y RF-09 (farmacia/despacho).
    [ApiController]
    [Route("api/[controller]")]
    public class LaboratorioFarmaciaController : ControllerBase
    {
        private readonly AppDbContext _context;

        public LaboratorioFarmaciaController(AppDbContext context)
        {
            _context = context;
        }

        // Busca la ficha medica base del paciente; si no existe todavia, crea
        // una vacia automaticamente (RF-08 no exige que el laboratorio sepa
        // el id_ficha de memoria, solo el paciente).
        private async Task<FichaMedica> ObtenerOCrearFichaAsync(int idPaciente)
        {
            var ficha = await _context.FichasMedicas.FirstOrDefaultAsync(f => f.IdPaciente == idPaciente);
            if (ficha == null)
            {
                ficha = new FichaMedica { IdPaciente = idPaciente, DiagnosticoBase = "" };
                _context.FichasMedicas.Add(ficha);
                await _context.SaveChangesAsync();
            }
            return ficha;
        }

        // ---- Examenes de laboratorio ----

        public class ExamenRequest
        {
            public int IdPaciente { get; set; }
            public string TipoExamen { get; set; } = string.Empty;
            public string? Resultados { get; set; }
            public decimal Costo { get; set; }
        }

        [HttpPost("examenes")]
        public async Task<IActionResult> CrearExamen(ExamenRequest datos)
        {
            var ficha = await ObtenerOCrearFichaAsync(datos.IdPaciente);
            var examen = new ExamenLaboratorio
            {
                IdFicha = ficha.IdFicha,
                IdPaciente = datos.IdPaciente,
                TipoExamen = datos.TipoExamen,
                Resultados = datos.Resultados,
                Costo = datos.Costo
            };
            _context.ExamenesLaboratorio.Add(examen);
            await _context.SaveChangesAsync();
            return Ok(examen);
        }

        [HttpGet("examenes")]
        public async Task<IActionResult> ListarExamenes()
        {
            var examenes = await _context.ExamenesLaboratorio
                .OrderByDescending(e => e.FechaRegistro)
                .ToListAsync();
            return Ok(examenes);
        }

        [HttpGet("examenes/residente/{idPaciente}")]
        public async Task<IActionResult> ExamenesPorResidente(int idPaciente)
        {
            var examenes = await _context.ExamenesLaboratorio
                .Where(e => e.IdPaciente == idPaciente)
                .ToListAsync();
            return Ok(examenes);
        }

        public class ResultadoRequest
        {
            public string Resultados { get; set; } = string.Empty;
        }

        [HttpPut("examenes/{id}/resultado")]
        public async Task<IActionResult> RegistrarResultado(int id, ResultadoRequest datos)
        {
            var examen = await _context.ExamenesLaboratorio.FindAsync(id);
            if (examen == null) return NotFound();
            examen.Resultados = datos.Resultados;
            await _context.SaveChangesAsync();
            return Ok(examen);
        }

        // ---- Medicamentos recetados / despacho de farmacia ----

        public class MedicamentoRequest
        {
            public int IdPaciente { get; set; }
            public string NombreMedicamento { get; set; } = string.Empty;
            public string? Cantidad { get; set; }
            public string? TiempoAplicacion { get; set; }
            public decimal Costo { get; set; }
        }

        [HttpPost("medicamentos")]
        public async Task<IActionResult> CrearMedicamento(MedicamentoRequest datos)
        {
            var medicamento = new MedicamentoRecetado
            {
                IdPaciente = datos.IdPaciente,
                NombreMedicamento = datos.NombreMedicamento,
                Cantidad = datos.Cantidad,
                TiempoAplicacion = datos.TiempoAplicacion,
                Costo = datos.Costo
            };
            _context.MedicamentosRecetados.Add(medicamento);
            await _context.SaveChangesAsync();
            return Ok(medicamento);
        }

        [HttpGet("medicamentos")]
        public async Task<IActionResult> ListarMedicamentos()
        {
            var medicamentos = await _context.MedicamentosRecetados
                .OrderByDescending(m => m.FechaDespacho)
                .ToListAsync();
            return Ok(medicamentos);
        }

        [HttpGet("medicamentos/residente/{idPaciente}")]
        public async Task<IActionResult> MedicamentosPorResidente(int idPaciente)
        {
            var medicamentos = await _context.MedicamentosRecetados
                .Where(m => m.IdPaciente == idPaciente)
                .ToListAsync();
            return Ok(medicamentos);
        }

        // Endpoint combinado: coincide con el formulario unico del frontend
        // (registra examen y/o medicamento en una sola llamada, eligiendo
        // solo al residente).
        public class RegistroCompletoRequest
        {
            public int IdPaciente { get; set; }
            public string? TipoExamen { get; set; }
            public string? Resultados { get; set; }
            public decimal CostoExamen { get; set; }
            public string? NombreMedicamento { get; set; }
            public string? Cantidad { get; set; }
            public string? TiempoAplicacion { get; set; }
            public decimal CostoMedicamento { get; set; }
        }

        [HttpPost("registro-completo")]
        public async Task<IActionResult> RegistroCompleto(RegistroCompletoRequest datos)
        {
            ExamenLaboratorio? examen = null;
            MedicamentoRecetado? medicamento = null;

            if (!string.IsNullOrWhiteSpace(datos.TipoExamen))
            {
                var ficha = await ObtenerOCrearFichaAsync(datos.IdPaciente);
                examen = new ExamenLaboratorio
                {
                    IdFicha = ficha.IdFicha,
                    IdPaciente = datos.IdPaciente,
                    TipoExamen = datos.TipoExamen,
                    Resultados = datos.Resultados,
                    Costo = datos.CostoExamen
                };
                _context.ExamenesLaboratorio.Add(examen);
            }

            if (!string.IsNullOrWhiteSpace(datos.NombreMedicamento))
            {
                medicamento = new MedicamentoRecetado
                {
                    IdPaciente = datos.IdPaciente,
                    NombreMedicamento = datos.NombreMedicamento,
                    Cantidad = datos.Cantidad,
                    TiempoAplicacion = datos.TiempoAplicacion,
                    Costo = datos.CostoMedicamento
                };
                _context.MedicamentosRecetados.Add(medicamento);
            }

            if (examen == null && medicamento == null)
                return BadRequest(new { message = "Debe incluir al menos un examen o un medicamento." });

            await _context.SaveChangesAsync();
            return Ok(new { examen, medicamento });
        }
    }
}
