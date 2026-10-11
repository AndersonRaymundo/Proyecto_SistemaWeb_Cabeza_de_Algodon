using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AsiloWeb.Data;
using AsiloWeb.Models;

namespace AsiloWeb.Controllers
{
    // RF-11 (deuda con fundación, calculada), RF-12 (control de mora),
    // RF-13 (donaciones, cuotas y gastos), CU-04.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "ADMINISTRADOR")]
    public class CajaController : ControllerBase
    {
        private readonly AppDbContext _context;

        public CajaController(AppDbContext context)
        {
            _context = context;
        }

        // ---- Donaciones ----

        public class DonacionRequest
        {
            public string Donante { get; set; } = string.Empty;
            public decimal Monto { get; set; }
            public string TipoDonacion { get; set; } = string.Empty;
        }

        [HttpPost("donaciones")]
        public async Task<IActionResult> CrearDonacion(DonacionRequest datos)
        {
            var donacion = new Donacion
            {
                Donante = datos.Donante,
                Monto = datos.Monto,
                TipoDonacion = datos.TipoDonacion
            };
            _context.Donaciones.Add(donacion);
            await _context.SaveChangesAsync();
            return Ok(donacion);
        }

        [HttpGet("donaciones")]
        public async Task<IActionResult> ListarDonaciones()
        {
            var donaciones = await _context.Donaciones
                .OrderByDescending(d => d.FechaDonacion)
                .ToListAsync();
            return Ok(donaciones);
        }

        // ---- Pagos / cobros a la cuenta del familiar ----

        public class PagoRequest
        {
            public int IdPaciente { get; set; }
            public string ConceptoPago { get; set; } = string.Empty;
            public decimal Monto { get; set; }
        }

        [HttpPost("pagos")]
        public async Task<IActionResult> CrearPago(PagoRequest datos)
        {
            var pago = new PagoFundacion
            {
                IdPaciente = datos.IdPaciente,
                ConceptoPago = datos.ConceptoPago,
                Monto = datos.Monto
            };
            _context.PagosFundacion.Add(pago);
            await _context.SaveChangesAsync();
            return Ok(pago);
        }

        [HttpGet("pagos")]
        public async Task<IActionResult> ListarPagos([FromQuery] string? estado)
        {
            var query = _context.PagosFundacion.AsQueryable();
            if (!string.IsNullOrEmpty(estado))
                query = query.Where(p => p.Estado == estado);

            var pagos = await query.OrderByDescending(p => p.FechaPago).ToListAsync();
            return Ok(pagos);
        }

        [HttpGet("pagos/residente/{idPaciente}")]
        public async Task<IActionResult> PagosPorResidente(int idPaciente)
        {
            var pagos = await _context.PagosFundacion
                .Where(p => p.IdPaciente == idPaciente)
                .OrderByDescending(p => p.FechaPago)
                .ToListAsync();
            return Ok(pagos);
        }

        public class EstadoPagoRequest
        {
            public string Estado { get; set; } = string.Empty; // Pendiente | Pagado
        }

        [HttpPut("pagos/{id}/estado")]
        public async Task<IActionResult> MarcarPago(int id, EstadoPagoRequest datos)
        {
            var pago = await _context.PagosFundacion.FindAsync(id);
            if (pago == null) return NotFound();
            pago.Estado = datos.Estado;
            await _context.SaveChangesAsync();

            // RF-12: si el cobro pertenece a una cita, su estado de pago se
            // recalcula (queda "Pagado" solo cuando ya no hay cobros pendientes).
            if (pago.IdCita.HasValue)
            {
                var cita = await _context.CitasMedicas.FindAsync(pago.IdCita.Value);
                if (cita != null)
                {
                    var quedanPendientes = await _context.PagosFundacion
                        .AnyAsync(p => p.IdCita == pago.IdCita && p.Estado == "Pendiente");
                    cita.EstadoPago = quedanPendientes ? "Pendiente" : "Pagado";
                    await _context.SaveChangesAsync();
                }
            }
            return Ok(pago);
        }

        // RF-12: citas atendidas que todavia no estan completamente canceladas
        [HttpGet("citas-pendientes-pago")]
        public async Task<IActionResult> CitasPendientesDePago()
        {
            var cobros = await _context.PagosFundacion
                .Where(p => p.IdCita != null && p.Estado == "Pendiente")
                .ToListAsync();

            var saldos = cobros
                .GroupBy(p => p.IdCita!.Value)
                .ToDictionary(g => g.Key, g => g.Sum(x => x.Monto));

            var ids = saldos.Keys.ToList();
            var citas = await _context.CitasMedicas
                .Where(c => ids.Contains(c.IdCita))
                .OrderBy(c => c.FechaCita)
                .ToListAsync();

            return Ok(citas.Select(c => new
            {
                c.IdCita,
                c.IdPaciente,
                c.EspecialidadSolicitada,
                c.FechaCita,
                c.Estado,
                saldoPendiente = saldos[c.IdCita]
            }));
        }

        // ---- Gastos operativos (RF-13) ----

        public class GastoRequest
        {
            public string Concepto { get; set; } = string.Empty;
            public decimal Monto { get; set; }
        }

        [HttpPost("gastos")]
        public async Task<IActionResult> CrearGasto(GastoRequest datos)
        {
            var gasto = new Gasto { Concepto = datos.Concepto, Monto = datos.Monto };
            _context.Gastos.Add(gasto);
            await _context.SaveChangesAsync();
            return Ok(gasto);
        }

        [HttpGet("gastos")]
        public async Task<IActionResult> ListarGastos()
        {
            var gastos = await _context.Gastos.OrderByDescending(g => g.Fecha).ToListAsync();
            return Ok(gastos);
        }

        // ---- Resumen financiero (incluye RF-11: deuda con la fundación, calculada) ----

        [HttpGet("resumen")]
        public async Task<IActionResult> Resumen()
        {
            var totalDonaciones = await _context.Donaciones.SumAsync(d => (decimal?)d.Monto) ?? 0;
            var totalPagosCancelados = await _context.PagosFundacion.Where(p => p.Estado == "Pagado").SumAsync(p => (decimal?)p.Monto) ?? 0;
            var totalPagosPendientes = await _context.PagosFundacion.Where(p => p.Estado == "Pendiente").SumAsync(p => (decimal?)p.Monto) ?? 0;
            var totalGastos = await _context.Gastos.SumAsync(g => (decimal?)g.Monto) ?? 0;

            // RF-11: lo que el asilo le debe a la fundación = suma de costos de
            // citas + exámenes + medicamentos ya registrados (no pagados por la fundación aparte).
            var totalCitas = await _context.CitasMedicas.SumAsync(c => (decimal?)c.CostoTotal) ?? 0;
            var totalExamenes = await _context.ExamenesLaboratorio.SumAsync(e => (decimal?)e.Costo) ?? 0;
            var totalMedicamentos = await _context.MedicamentosRecetados.SumAsync(m => (decimal?)m.Costo) ?? 0;
            var deudaConFundacion = totalCitas + totalExamenes + totalMedicamentos;

            return Ok(new
            {
                totalDonaciones,
                totalPagosCancelados,
                totalPagosPendientes,
                totalGastos,
                deudaConFundacion,
                balance = totalDonaciones + totalPagosCancelados - totalGastos
            });
        }
    }
}
