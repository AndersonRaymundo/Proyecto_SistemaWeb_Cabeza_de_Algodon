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
    [Authorize(Roles = "ADMINISTRADOR,FARMACIA,LABORATORIO")]
    public class LaboratorioFarmaciaController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly FacturacionService _facturacion;
        private readonly ExpedienteService _expediente;
        private readonly PacientesService _pacientes;

        public LaboratorioFarmaciaController(AppDbContext context, FacturacionService facturacion, ExpedienteService expediente, PacientesService pacientes)
        {
            _context = context;
            _facturacion = facturacion;
            _expediente = expediente;
            _pacientes = pacientes;
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
        [Authorize(Roles = "ADMINISTRADOR,LABORATORIO")]
        public async Task<IActionResult> CrearExamen(ExamenRequest datos)
        {
            if (await _pacientes.EstaDadoDeBajaAsync(datos.IdPaciente))
                return BadRequest(new { message = PacientesService.MensajeDadoDeBaja });

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
        [Authorize(Roles = "ADMINISTRADOR,LABORATORIO")]
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
        [Authorize(Roles = "ADMINISTRADOR,LABORATORIO")]
        public async Task<IActionResult> RegistrarResultado(int id, ResultadoRequest datos)
        {
            var examen = await _context.ExamenesLaboratorio.FindAsync(id);
            if (examen == null) return NotFound();
            if (await _pacientes.EstaDadoDeBajaAsync(examen.IdPaciente))
                return BadRequest(new { message = PacientesService.MensajeDadoDeBaja });

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
            // Inventario (opcional): producto del catalogo y unidades que se descuentan
            public int? IdInventario { get; set; }
            public int? Unidades { get; set; }
        }

        // Despacho directo (sin receta previa en una visita)
        [HttpPost("medicamentos")]
        [Authorize(Roles = "ADMINISTRADOR,FARMACIA")]
        public async Task<IActionResult> CrearMedicamento(MedicamentoRequest datos)
        {
            if (await _pacientes.EstaDadoDeBajaAsync(datos.IdPaciente))
                return BadRequest(new { message = PacientesService.MensajeDadoDeBaja });

            var (producto, errorInventario) = await ValidarInventarioAsync(datos.IdInventario, datos.Unidades, datos.Cantidad);
            if (errorInventario != null)
                return BadRequest(new { message = errorInventario });

            var medicamento = new MedicamentoRecetado
            {
                IdInventario = producto?.IdInventario,
                UnidadesDespachadas = producto != null ? datos.Unidades : null,
                IdPaciente = datos.IdPaciente,
                NombreMedicamento = datos.NombreMedicamento,
                Cantidad = datos.Cantidad,
                TiempoAplicacion = datos.TiempoAplicacion,
                Costo = _facturacion.AplicarDescuento(datos.PrecioLista),
                Despachado = true,
                FechaDespacho = DateTime.Now
            };
            if (producto != null) producto.Existencias -= datos.Unidades!.Value;
            _context.MedicamentosRecetados.Add(medicamento);
            await _context.SaveChangesAsync();

            await _facturacion.CargarAFamiliaAsync(datos.IdPaciente, $"Medicamento: {datos.NombreMedicamento}", datos.PrecioLista, null);
            return Ok(medicamento);
        }

        // soloPendientes=true -> recetados en una visita que farmacia aun no despacha
        [HttpGet("medicamentos")]
        [Authorize(Roles = "ADMINISTRADOR,FARMACIA")]
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
            // Inventario (opcional): producto del catalogo y unidades que se descuentan
            public int? IdInventario { get; set; }
            public int? Unidades { get; set; }
        }

        // RF-09: farmacia despacha el medicamento recetado y asocia su costo a la visita
        [HttpPut("medicamentos/{id}/despachar")]
        [Authorize(Roles = "ADMINISTRADOR,FARMACIA")]
        public async Task<IActionResult> Despachar(int id, DespacharRequest datos)
        {
            var medicamento = await _context.MedicamentosRecetados.FindAsync(id);
            if (medicamento == null) return NotFound();
            if (await _pacientes.EstaDadoDeBajaAsync(medicamento.IdPaciente))
                return BadRequest(new { message = PacientesService.MensajeDadoDeBaja });
            if (medicamento.Despachado)
                return BadRequest(new { message = "Este medicamento ya fue despachado." });

            var (producto, errorInventario) = await ValidarInventarioAsync(datos.IdInventario, datos.Unidades, datos.Cantidad);
            if (errorInventario != null)
                return BadRequest(new { message = errorInventario });
            if (producto != null)
            {
                producto.Existencias -= datos.Unidades!.Value;
                medicamento.IdInventario = producto.IdInventario;
                medicamento.UnidadesDespachadas = datos.Unidades;
            }

            medicamento.Despachado = true;
            medicamento.FechaDespacho = DateTime.Now;
            medicamento.Costo = _facturacion.AplicarDescuento(datos.PrecioLista);
            if (!string.IsNullOrWhiteSpace(datos.Cantidad)) medicamento.Cantidad = datos.Cantidad;
            await _context.SaveChangesAsync();

            await _facturacion.CargarAFamiliaAsync(
                medicamento.IdPaciente, $"Medicamento: {medicamento.NombreMedicamento}", datos.PrecioLista, medicamento.IdCita);

            return Ok(medicamento);
        }

        // Si el medicamento viene del inventario, comprueba que exista, no este vencido y alcance
        // para las unidades pedidas. Sin IdInventario no se controla existencias (producto fuera del catalogo).
        private async Task<(InventarioMedicamento? Producto, string? Error)> ValidarInventarioAsync(int? idInventario, int? unidades, string? cantidadTexto)
        {
            if (idInventario == null) return (null, null);

            var producto = await _context.Inventario.FindAsync(idInventario.Value);
            if (producto == null)
                return (null, "El medicamento elegido no está en el inventario.");

            var cantidad = unidades ?? 0;
            if (cantidad <= 0)
                return (null, "Indique cuántas unidades se despachan.");
            // "Cantidad" (texto de la receta, ej. "30 tabletas") y "Unidades" son la misma cantidad:
            // si el texto empieza con un numero, debe ser el mismo que se descuenta del inventario.
            var numero = System.Text.RegularExpressions.Regex.Match(cantidadTexto ?? "", @"^\s*(\d+)");
            if (numero.Success && !(int.TryParse(numero.Groups[1].Value, out var escrito) && escrito == cantidad))
                return (null, $"La cantidad escrita ({numero.Groups[1].Value}) no coincide con las unidades que se descuentan del inventario ({cantidad}). Corrija una de las dos.");

            if (producto.FechaVencimiento.HasValue && producto.FechaVencimiento.Value.Date < DateTime.Today)
                return (null, $"{producto.Nombre} está vencido y no se puede despachar.");
            if (producto.Existencias < cantidad)
                return (null, $"Existencias insuficientes de {producto.Nombre}: hay {producto.Existencias} y se piden {cantidad}.");

            return (producto, null);
        }
    }
}
