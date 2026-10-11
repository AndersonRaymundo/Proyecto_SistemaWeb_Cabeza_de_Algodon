using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
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
    [Authorize]
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
        [AllowAnonymous]
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

            // Sesion en el servidor (cookie): es lo que protege las paginas y la API (RNF-02)
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, usuario.IdUsuario.ToString()),
                new Claim(ClaimTypes.Name, usuario.NombreUsuario),
                new Claim("NombreCompleto", usuario.NombreCompleto),
                new Claim(ClaimTypes.Role, usuario.Rol)
            };
            var identidad = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await HttpContext.SignInAsync(
                CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(identidad),
                new AuthenticationProperties { IsPersistent = false });

            return Ok(new
            {
                idUsuario = usuario.IdUsuario,
                nombreUsuario = usuario.NombreUsuario,
                nombreCompleto = usuario.NombreCompleto,
                rol = usuario.Rol
            });
        }

        // --- Gestión de usuarios (para una futura pantalla de Configuración) ---

        // Devuelve quien tiene la sesion abierta segun el servidor (no segun el navegador)
        [HttpGet("sesion")]
        public IActionResult Sesion()
        {
            return Ok(new
            {
                idUsuario = int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0,
                nombreUsuario = User.Identity?.Name,
                nombreCompleto = User.FindFirstValue("NombreCompleto"),
                rol = User.FindFirstValue(ClaimTypes.Role)
            });
        }

        [HttpPost("logout")]
        [AllowAnonymous]
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Ok(new { message = "Sesión cerrada." });
        }

        private static readonly string[] RolesValidos =
            { "ADMINISTRADOR", "DOCTOR", "ENFERMERO", "FARMACIA", "FUNDACION", "LABORATORIO" };

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
        [Authorize(Roles = "ADMINISTRADOR")]
        public async Task<IActionResult> CrearUsuario(UsuarioCreateRequest datos)
        {
            if (!RolesValidos.Contains(datos.Rol))
                return BadRequest(new { message = "Rol inválido." });

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
