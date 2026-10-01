using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AsiloWeb.Data;
using AsiloWeb.Models;

namespace AsiloWeb.Controllers
{
    // Implementa CU-01 Iniciar Sesión: valida usuario/contraseña (hash
    // Bcrypt), y bloquea la cuenta 15 minutos tras 3 intentos fallidos.
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _context;
        private const int MaxIntentos = 3;
        private const int MinutosBloqueo = 15;

        public AuthController(AppDbContext context)
        {
            _context = context;
        }

        public class LoginRequest
        {
            public string NombreUsuario { get; set; } = string.Empty;
            public string Contrasena { get; set; } = string.Empty;
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginRequest datos)
        {
            var usuario = await _context.Usuarios
                .FirstOrDefaultAsync(u => u.NombreUsuario == datos.NombreUsuario);

            if (usuario == null)
                return Unauthorized(new { message = "Usuario o contraseña incorrectos." });

            // Si el bloqueo ya expiró, se libera automáticamente.
            if (usuario.CuentaBloqueada && usuario.BloqueadoHasta.HasValue && usuario.BloqueadoHasta < DateTime.Now)
            {
                usuario.CuentaBloqueada = false;
                usuario.IntentosFallidos = 0;
                usuario.BloqueadoHasta = null;
            }

            if (usuario.CuentaBloqueada)
            {
                var minutosRestantes = usuario.BloqueadoHasta.HasValue
                    ? Math.Max(0, (int)Math.Ceiling((usuario.BloqueadoHasta.Value - DateTime.Now).TotalMinutes))
                    : MinutosBloqueo;
                return StatusCode(403, new { message = $"Cuenta bloqueada. Intente de nuevo en {minutosRestantes} minuto(s)." });
            }

            bool claveValida = BCrypt.Net.BCrypt.Verify(datos.Contrasena, usuario.PasswordHash);

            if (!claveValida)
            {
                usuario.IntentosFallidos++;
                if (usuario.IntentosFallidos >= MaxIntentos)
                {
                    usuario.CuentaBloqueada = true;
                    usuario.BloqueadoHasta = DateTime.Now.AddMinutes(MinutosBloqueo);
                }
                await _context.SaveChangesAsync();
                return Unauthorized(new { message = "Usuario o contraseña incorrectos." });
            }

            // Login correcto: se reinician los intentos fallidos.
            usuario.IntentosFallidos = 0;
            await _context.SaveChangesAsync();

            return Ok(new
            {
                idUsuario = usuario.IdUsuario,
                nombreUsuario = usuario.NombreUsuario,
                nombreCompleto = usuario.NombreCompleto,
                rol = usuario.Rol
            });
        }

        // --- Gestión de usuarios (para una futura pantalla de Configuración) ---

        public class UsuarioCreateRequest
        {
            public string NombreUsuario { get; set; } = string.Empty;
            public string Contrasena { get; set; } = string.Empty;
            public string NombreCompleto { get; set; } = string.Empty;
            public string Rol { get; set; } = string.Empty;
            public string? Email { get; set; }
        }

        [HttpGet("usuarios")]
        public async Task<IActionResult> ListarUsuarios()
        {
            var usuarios = await _context.Usuarios
                .Select(u => new
                {
                    u.IdUsuario,
                    u.NombreUsuario,
                    u.NombreCompleto,
                    u.Rol,
                    u.Email,
                    u.CuentaBloqueada
                })
                .ToListAsync();
            return Ok(usuarios);
        }

        [HttpPost("usuarios")]
        public async Task<IActionResult> CrearUsuario(UsuarioCreateRequest datos)
        {
            if (await _context.Usuarios.AnyAsync(u => u.NombreUsuario == datos.NombreUsuario))
                return Conflict(new { message = "Ese nombre de usuario ya existe." });

            var nuevo = new Usuario
            {
                NombreUsuario = datos.NombreUsuario,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(datos.Contrasena),
                NombreCompleto = datos.NombreCompleto,
                Rol = datos.Rol,
                Email = datos.Email
            };

            _context.Usuarios.Add(nuevo);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(ListarUsuarios), new { id = nuevo.IdUsuario }, nuevo);
        }
    }
}
