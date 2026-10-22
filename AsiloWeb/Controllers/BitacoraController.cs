using AsiloWeb.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AsiloWeb.Controllers
{
    // Consulta de la bitacora de correos (solo el administrador).
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "ADMINISTRADOR")]
    public class BitacoraController : ControllerBase
    {
        private readonly AppDbContext _context;

        public BitacoraController(AppDbContext context)
        {
            _context = context;
        }

        // Los correos mas recientes primero (por defecto 100, maximo 500)
        [HttpGet("correos")]
        public async Task<IActionResult> Correos(int top = 100)
        {
            top = Math.Clamp(top, 1, 500);
            var lista = await _context.BitacoraCorreos
                .OrderByDescending(b => b.Fecha)
                .Take(top)
                .Select(b => new { b.IdBitacora, b.Fecha, b.Destinatario, b.Asunto, b.Enviado })
                .ToListAsync();
            return Ok(lista);
        }
    }
}
