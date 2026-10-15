using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AsiloWeb.Data;
using AsiloWeb.Models;
using AsiloWeb.Services;

namespace AsiloWeb.Controllers
{
    // RF-08 (laboratorio registra resultados), RF-09 (farmacia controla el
    // despacho) y RF-10 (el costo se carga solo a la cuenta del familiar).
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "ADMINISTRADOR,DOCTOR,FARMACIA,LABORATORIO")]
    public class LaboratorioFarmaciaController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly FacturacionService _facturacion;
        private readonly ExpedienteService _expediente;

        public LaboratorioFarmaciaController(AppDbContext context, FacturacionService facturacion, ExpedienteService expediente)
        {
            _context = context;
            _facturacion = facturacion;
            _expediente = expediente;
        }

        private int IdUsuarioActual =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;

        // =====================  LABORATORIO  =====================

        public class ExamenRequest
        {
            public int IdPaciente { get; set; }
            public string TipoExamen { get; set; } = string.Empty;
            public string? Resultados { get; set; }
            public decimal PrecioLista { get; set; }
        }

        // Examen directo (paciente que llega al laboratorio sin visita previa)
        [HttpPost("examenes")]
        [Authorize(Roles = "ADMINISTRADOR,DOCTOR,LABORATORIO")]
        public async Task<IActionResult> CrearExamen(ExamenRequest datos)
        {
            var ficha = await _expediente.ObtenerOCrearFichaAsync(datos.IdPaciente, IdUsuarioActual);
            var examen = new ExamenLaboratorio
            {
                IdFicha = ficha.IdFicha,
                IdPaciente = datos.IdPaciente,
                TipoExamen = datos.TipoExamen,
                Resultados = datos.Resultados,
                Costo = _facturacion.AplicarDescuento(datos.PrecioLista)
            };
            _context.ExamenesLaboratorio.Add(examen);
            await _context.SaveChangesAsync();

            await _facturacion.CargarAFamiliaAsync(datos.IdPaciente, $"Examen: {datos.TipoExamen}", datos.PrecioLista, null);
            return Ok(examen);
        }

        // soloPendientes=true -> examenes solicitados en una visita que aun no tienen resultado
        [HttpGet("examenes")]
        [Authorize(Roles = "ADMINISTRADOR,DOCTOR,LABORATORIO")]
        public async Task<IActionResult> ListarExamenes([FromQuery] bool soloPendientes = false)
        {
            var query = _context.ExamenesLaboratorio.AsQueryable();
            if (soloPendientes)
                query = query.Where(e => e.Resultados == null || e.Resultados == "");

            var examenes = await query.OrderByDescending(e => e.FechaRegistro).ToListAsync();

            // RF-08: el laboratorio ve el contexto de la visita (motivo, diagnostico y medico)
            var idsCitas = examenes.Where(e => e.IdCita != null).Select(e => e.IdCita!.Value).Distinct().ToList();
            var citas = await _context.CitasMedicas.Where(c => idsCitas.Contains(c.IdCita)).ToListAsync();
            var idsDoctores = citas.Where(c => c.IdDoctor != null).Select(c => c.IdDoctor!.Value).Distinct().ToList();
            var medicos = await _context.Usuarios
                .Where(u => idsDoctores.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto);

            var resultado = examenes.Select(e =>
            {
                var cita = e.IdCita != null ? citas.FirstOrDefault(c => c.IdCita == e.IdCita) : null;
                return new
                {
                    e.IdExamen, e.IdFicha, e.IdPaciente, e.IdCita, e.TipoExamen, e.Resultados, e.FechaRegistro, e.Costo,
                    Motivo = cita?.Motivo,
                    Diagnostico = cita?.DiagnosticoConsulta,
                    Medico = cita != null && cita.IdDoctor != null && medicos.ContainsKey(cita.IdDoctor.Value) ? medicos[cita.IdDoctor.Value] : null
                };
            }).ToList();

            return Ok(resultado);
        }

        public class ResultadoRequest
        {
            public string Resultados { get; set; } = string.Empty;
            public decimal PrecioLista { get; set; }
        }

        // RF-08: el laboratorio registra el resultado; si el examen aun no tenia
        // costo, se aplica el descuento y se carga al familiar (RF-10).
        [HttpPut("examenes/{id}/resultado")]
        [Authorize(Roles = "ADMINISTRADOR,DOCTOR,LABORATORIO")]
        public async Task<IActionResult> RegistrarResultado(int id, ResultadoRequest datos)
        {
            var examen = await _context.ExamenesLaboratorio.FindAsync(id);
            if (examen == null) return NotFound();

            examen.Resultados = datos.Resultados;
            examen.FechaRegistro = DateTime.Now;

            var cobrar = examen.Costo == 0 && datos.PrecioLista > 0;
            if (cobrar) examen.Costo = _facturacion.AplicarDescuento(datos.PrecioLista);
            await _context.SaveChangesAsync();

            if (cobrar)
                await _facturacion.CargarAFamiliaAsync(examen.IdPaciente, $"Examen: {examen.TipoExamen}", datos.PrecioLista, examen.IdCita);

            return Ok(examen);
        }

        // =====================  FARMACIA  =====================

        public class MedicamentoRequest
        {
            public int IdPaciente { get; set; }
            public string NombreMedicamento { get; set; } = string.Empty;
            public string? Cantidad { get; set; }
            public string? TiempoAplicacion { get; set; }
            public decimal PrecioLista { get; set; }
        }

        // Despacho directo (sin receta previa en una visita)
        [HttpPost("medicamentos")]
        [Authorize(Roles = "ADMINISTRADOR,DOCTOR,FARMACIA")]
        public async Task<IActionResult> CrearMedicamento(MedicamentoRequest datos)
        {
            var medicamento = new MedicamentoRecetado
            {
                IdPaciente = datos.IdPaciente,
                NombreMedicamento = datos.NombreMedicamento,
                Cantidad = datos.Cantidad,
                TiempoAplicacion = datos.TiempoAplicacion,
                Costo = _facturacion.AplicarDescuento(datos.PrecioLista),
                Despachado = true,
                FechaDespacho = DateTime.Now
            };
            _context.MedicamentosRecetados.Add(medicamento);
            await _context.SaveChangesAsync();

            await _facturacion.CargarAFamiliaAsync(datos.IdPaciente, $"Medicamento: {datos.NombreMedicamento}", datos.PrecioLista, null);
            return Ok(medicamento);
        }

        // soloPendientes=true -> recetados en una visita que farmacia aun no despacha
        [HttpGet("medicamentos")]
        [Authorize(Roles = "ADMINISTRADOR,DOCTOR,FARMACIA")]
        public async Task<IActionResult> ListarMedicamentos([FromQuery] bool soloPendientes = false)
        {
            var query = _context.MedicamentosRecetados.AsQueryable();
            if (soloPendientes)
                query = query.Where(m => !m.Despachado);

            var medicamentos = await query.OrderByDescending(m => m.FechaDespacho).ToListAsync();
            return Ok(medicamentos);
        }

        public class DespacharRequest
        {
            public decimal PrecioLista { get; set; }
            public string? Cantidad { get; set; }
        }

        // RF-09: farmacia despacha el medicamento recetado y asocia su costo a la visita
        [HttpPut("medicamentos/{id}/despachar")]
        [Authorize(Roles = "ADMINISTRADOR,DOCTOR,FARMACIA")]
        public async Task<IActionResult> Despachar(int id, DespacharRequest datos)
        {
            var medicamento = await _context.MedicamentosRecetados.FindAsync(id);
            if (medicamento == null) return NotFound();
            if (medicamento.Despachado)
                return BadRequest(new { message = "Este medicamento ya fue despachado." });

            medicamento.Despachado = true;
            medicamento.FechaDespacho = DateTime.Now;
            medicamento.Costo = _facturacion.AplicarDescuento(datos.PrecioLista);
            if (!string.IsNullOrWhiteSpace(datos.Cantidad)) medicamento.Cantidad = datos.Cantidad;
            await _context.SaveChangesAsync();

            await _facturacion.CargarAFamiliaAsync(
                medicamento.IdPaciente, $"Medicamento: {medicamento.NombreMedicamento}", datos.PrecioLista, medicamento.IdCita);

            return Ok(medicamento);
        }
    }
}
