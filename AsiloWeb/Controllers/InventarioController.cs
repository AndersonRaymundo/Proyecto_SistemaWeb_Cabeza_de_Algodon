using AsiloWeb.Data;
using AsiloWeb.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AsiloWeb.Controllers
{
    // Inventario de la farmacia: catalogo de medicamentos con sus existencias.
    // Al despachar un medicamento elegido de aqui, LaboratorioFarmaciaController descuenta las unidades.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "ADMINISTRADOR,FARMACIA")]
    public class InventarioController : ControllerBase
    {
        private readonly AppDbContext _context;

        public InventarioController(AppDbContext context)
        {
            _context = context;
        }

        public class InventarioRequest
        {
            public string Nombre { get; set; } = string.Empty;
            public string? Presentacion { get; set; }
            public decimal PrecioUnitario { get; set; }
            public int Existencias { get; set; }
            public int StockMinimo { get; set; }
            public DateTime? FechaVencimiento { get; set; }
        }

        public class EntradaRequest
        {
            public int Cantidad { get; set; }
        }

        // Vencido > Agotado > Bajo > Por vencer (30 dias) > Disponible
        private static string Estado(InventarioMedicamento i, DateTime hoy)
        {
            if (i.FechaVencimiento.HasValue && i.FechaVencimiento.Value.Date < hoy) return "Vencido";
            if (i.Existencias <= 0) return "Agotado";
            if (i.Existencias <= i.StockMinimo) return "Bajo";
            if (i.FechaVencimiento.HasValue && i.FechaVencimiento.Value.Date <= hoy.AddDays(30)) return "Por vencer";
            return "Disponible";
        }

        private static object Proyectar(InventarioMedicamento i, DateTime hoy) => new
        {
            i.IdInventario,
            i.Nombre,
            i.Presentacion,
            i.PrecioUnitario,
            i.Existencias,
            i.StockMinimo,
            i.FechaVencimiento,
            estado = Estado(i, hoy)
        };

        // Quita espacios de mas: "Losartán  50 mg" es lo mismo que "Losartán 50 mg"
        private static string NormalizarNombre(string nombre) =>
            System.Text.RegularExpressions.Regex.Replace(nombre.Trim(), @"\s+", " ");

        // Para comparar nombres sin distinguir mayusculas ni tildes: "Losartán" y "Losartan" son el mismo medicamento
        private const string ColacionSinTildes = "Latin1_General_CI_AI";

        private static string? Validar(InventarioRequest d)
        {
            if (string.IsNullOrWhiteSpace(d.Nombre)) return "El nombre del medicamento es obligatorio.";
            if (d.Nombre.Trim().Length > 150) return "El nombre es demasiado largo (máximo 150 caracteres).";
            if (d.Presentacion != null && d.Presentacion.Trim().Length > 100) return "La presentación es demasiado larga (máximo 100 caracteres).";
            if (d.PrecioUnitario < 0) return "El precio no puede ser negativo.";
            if (d.Existencias < 0) return "Las existencias no pueden ser negativas.";
            if (d.StockMinimo < 0) return "El mínimo no puede ser negativo.";
            return null;
        }

        [HttpGet]
        public async Task<IActionResult> Listar()
        {
            var hoy = DateTime.Today;
            var lista = await _context.Inventario.OrderBy(i => i.Nombre).ToListAsync();
            return Ok(lista.Select(i => Proyectar(i, hoy)));
        }

        [HttpPost]
        public async Task<IActionResult> Crear(InventarioRequest datos)
        {
            var error = Validar(datos);
            if (error != null) return BadRequest(new { message = error });

            var nombre = NormalizarNombre(datos.Nombre);
            if (await _context.Inventario.AnyAsync(i => EF.Functions.Collate(i.Nombre, ColacionSinTildes) == nombre))
                return Conflict(new { message = "Ese medicamento ya está en el inventario (no se distingue entre mayúsculas y tildes). Use \"Registrar entrada\" para sumar existencias." });

            var nuevo = new InventarioMedicamento
            {
                Nombre = nombre,
                Presentacion = string.IsNullOrWhiteSpace(datos.Presentacion) ? null : datos.Presentacion.Trim(),
                PrecioUnitario = datos.PrecioUnitario,
                Existencias = datos.Existencias,
                StockMinimo = datos.StockMinimo,
                FechaVencimiento = datos.FechaVencimiento
            };
            _context.Inventario.Add(nuevo);
            await _context.SaveChangesAsync();
            return StatusCode(201, Proyectar(nuevo, DateTime.Today));
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Actualizar(int id, InventarioRequest datos)
        {
            var producto = await _context.Inventario.FindAsync(id);
            if (producto == null) return NotFound(new { message = "Medicamento no encontrado." });

            var error = Validar(datos);
            if (error != null) return BadRequest(new { message = error });

            var nombre = NormalizarNombre(datos.Nombre);
            if (await _context.Inventario.AnyAsync(i => i.IdInventario != id && EF.Functions.Collate(i.Nombre, ColacionSinTildes) == nombre))
                return Conflict(new { message = "Ya existe otro medicamento con ese nombre (no se distingue entre mayúsculas y tildes)." });

            producto.Nombre = nombre;
            producto.Presentacion = string.IsNullOrWhiteSpace(datos.Presentacion) ? null : datos.Presentacion.Trim();
            producto.PrecioUnitario = datos.PrecioUnitario;
            producto.Existencias = datos.Existencias;
            producto.StockMinimo = datos.StockMinimo;
            producto.FechaVencimiento = datos.FechaVencimiento;
            await _context.SaveChangesAsync();
            return Ok(Proyectar(producto, DateTime.Today));
        }

        // Compra o donacion que ingresa a la farmacia: suma existencias
        [HttpPost("{id}/entrada")]
        public async Task<IActionResult> RegistrarEntrada(int id, EntradaRequest datos)
        {
            var producto = await _context.Inventario.FindAsync(id);
            if (producto == null) return NotFound(new { message = "Medicamento no encontrado." });
            if (datos.Cantidad <= 0)
                return BadRequest(new { message = "La cantidad de la entrada debe ser mayor que cero." });

            producto.Existencias += datos.Cantidad;
            await _context.SaveChangesAsync();
            return Ok(Proyectar(producto, DateTime.Today));
        }
    }
}
