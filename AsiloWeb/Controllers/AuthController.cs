using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AsiloWeb.Data;
using AsiloWeb.Models;
using AsiloWeb.Services;

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
        private readonly EmailService _email;
        private const int MaxIntentos = 3;
        private const int MinutosBloqueo = 15;

        public AuthController(AppDbContext context, EmailService email)
        {
            _context = context;
            _email = email;
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

            // La clave es correcta, pero una cuenta dada de baja no puede entrar
            if (!usuario.Activo)
                return StatusCode(403, new { message = "Su cuenta está desactivada. Comuníquese con el administrador." });

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

        // ------------------------------------------------------------------
        // Reglas compartidas: crear usuario, cambiar clave y recuperarla
        // ------------------------------------------------------------------

        // Minimo 8 caracteres, con letras y numeros.
        private static string? ValidarContrasena(string? clave)
        {
            if (string.IsNullOrEmpty(clave) || clave.Length < 8 || !clave.Any(char.IsLetter) || !clave.Any(char.IsDigit))
                return "La contraseña debe tener al menos 8 caracteres e incluir letras y números.";
            return null;
        }

        private static bool CorreoValido(string? correo)
        {
            if (string.IsNullOrWhiteSpace(correo)) return false;
            try { return new MailAddress(correo.Trim()).Address == correo.Trim(); }
            catch { return false; }
        }

        // ------------------------------------------------------------------
        // Gestion de usuarios (solo el administrador)
        // ------------------------------------------------------------------
        public class UsuarioCreateRequest
        {
            public string NombreUsuario { get; set; } = string.Empty;
            public string Contrasena { get; set; } = string.Empty;
            public string NombreCompleto { get; set; } = string.Empty;
            public string Rol { get; set; } = string.Empty;
            public string? Email { get; set; }
            public string? Especialidad { get; set; }
        }

        public class EspecialidadRequest
        {
            public string? Especialidad { get; set; }
        }

        public class DatosUsuarioRequest
        {
            public string NombreCompleto { get; set; } = string.Empty;
            public string Rol { get; set; } = string.Empty;
            public string? Especialidad { get; set; }
        }

        public class MiClaveRequest
        {
            public string Actual { get; set; } = string.Empty;
            public string Nueva { get; set; } = string.Empty;
        }

        public class ClaveRequest
        {
            public string NuevaContrasena { get; set; } = string.Empty;
        }

        public class CorreoRequest
        {
            public string? Email { get; set; }
        }

        [HttpGet("usuarios")]
        public async Task<IActionResult> ListarUsuarios()
        {
            // El correo y el estado de la cuenta solo los ve el administrador;
            // los demas roles reciben lo basico (la agenda necesita la lista de medicos).
            if (User.IsInRole("ADMINISTRADOR"))
            {
                var completos = await _context.Usuarios
                    .OrderBy(u => u.NombreCompleto)
                    .Select(u => new { u.IdUsuario, u.NombreUsuario, u.NombreCompleto, u.Rol, u.Especialidad, u.Email, u.CuentaBloqueada, u.Activo })
                    .ToListAsync();
                return Ok(completos);
            }

            var basicos = await _context.Usuarios
                .OrderBy(u => u.NombreCompleto)
                .Select(u => new { u.IdUsuario, u.NombreUsuario, u.NombreCompleto, u.Rol, u.Especialidad, u.Activo })
                .ToListAsync();
            return Ok(basicos);
        }

        [HttpPost("usuarios")]
        [Authorize(Roles = "ADMINISTRADOR")]
        public async Task<IActionResult> CrearUsuario(UsuarioCreateRequest datos)
        {
            var login = (datos.NombreUsuario ?? "").Trim();
            if (!System.Text.RegularExpressions.Regex.IsMatch(login, @"^[A-Za-z0-9._-]{3,30}$"))
                return BadRequest(new { message = "El usuario debe tener de 3 a 30 caracteres: letras, números, punto, guion o guion bajo." });
            if (string.IsNullOrWhiteSpace(datos.NombreCompleto))
                return BadRequest(new { message = "El nombre completo es obligatorio." });
            if (!RolesValidos.Contains(datos.Rol))
                return BadRequest(new { message = "Rol inválido." });
            if (datos.Rol == "DOCTOR" && !Catalogos.Especialidades.Contains(datos.Especialidad ?? ""))
                return BadRequest(new { message = "Elija la especialidad del médico." });
            var errorClave = ValidarContrasena(datos.Contrasena);
            if (errorClave != null)
                return BadRequest(new { message = errorClave });
            if (!string.IsNullOrWhiteSpace(datos.Email) && !CorreoValido(datos.Email))
                return BadRequest(new { message = "El correo no tiene un formato válido." });
            if (await _context.Usuarios.AnyAsync(u => u.NombreUsuario == login))
                return Conflict(new { message = "Ese nombre de usuario ya existe." });
            if (!string.IsNullOrWhiteSpace(datos.Email) && await _context.Usuarios.AnyAsync(u => u.Email == datos.Email.Trim()))
                return Conflict(new { message = "Ese correo ya está registrado en otro usuario." });

            var nuevo = new Usuario
            {
                NombreUsuario = login,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(datos.Contrasena),
                NombreCompleto = datos.NombreCompleto.Trim(),
                Rol = datos.Rol,
                Especialidad = datos.Rol == "DOCTOR" ? datos.Especialidad : null,
                Email = string.IsNullOrWhiteSpace(datos.Email) ? null : datos.Email.Trim()
            };

            _context.Usuarios.Add(nuevo);
            await _context.SaveChangesAsync();

            // No se devuelve el registro completo (incluye la clave cifrada)
            return StatusCode(201, new { nuevo.IdUsuario, nuevo.NombreUsuario, nuevo.NombreCompleto, nuevo.Rol, nuevo.Especialidad, nuevo.Email, nuevo.CuentaBloqueada });
        }

        // Quita el bloqueo de una cuenta sin esperar los 15 minutos
        [HttpPut("usuarios/{id}/desbloquear")]
        [Authorize(Roles = "ADMINISTRADOR")]
        public async Task<IActionResult> Desbloquear(int id)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound(new { message = "Usuario no encontrado." });

            usuario.CuentaBloqueada = false;
            usuario.IntentosFallidos = 0;
            usuario.BloqueadoHasta = null;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Cuenta desbloqueada." });
        }

        // El administrador asigna una contrasena nueva (por ejemplo, si no llega el correo de recuperacion)
        [HttpPut("usuarios/{id}/contrasena")]
        [Authorize(Roles = "ADMINISTRADOR")]
        public async Task<IActionResult> CambiarContrasena(int id, ClaveRequest datos)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound(new { message = "Usuario no encontrado." });

            var error = ValidarContrasena(datos.NuevaContrasena);
            if (error != null) return BadRequest(new { message = error });

            usuario.PasswordHash = BCrypt.Net.BCrypt.HashPassword(datos.NuevaContrasena);
            usuario.CuentaBloqueada = false;
            usuario.IntentosFallidos = 0;
            usuario.BloqueadoHasta = null;
            usuario.CodigoRecuperacionHash = null;
            usuario.CodigoRecuperacionExpira = null;
            usuario.IntentosCodigo = 0;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Contraseña actualizada." });
        }

        // Lista de especialidades para los formularios (cualquier usuario con sesion)
        [HttpGet("especialidades")]
        public IActionResult Especialidades() => Ok(Catalogos.Especialidades);

        private bool EsUsuarioActual(int id) =>
            int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var actual) && actual == id;

        // Antes de quitarle el acceso a alguien (baja o cambio de rol): no puede ser el ultimo administrador
        // y un medico no puede tener citas agendadas sin atender.
        private async Task<string?> ValidarQuitarAcceso(Usuario usuario)
        {
            if (usuario.Rol == "ADMINISTRADOR" &&
                !await _context.Usuarios.AnyAsync(u => u.IdUsuario != usuario.IdUsuario && u.Activo && u.Rol == "ADMINISTRADOR"))
                return "No se puede: es el último administrador activo del sistema.";

            if (usuario.Rol == "DOCTOR")
            {
                var agendadas = await _context.CitasMedicas.CountAsync(c => c.IdDoctor == usuario.IdUsuario && c.Estado == "Agendada");
                if (agendadas > 0)
                    return $"Este médico tiene {agendadas} cita(s) agendada(s). Reprográmelas o cancélelas antes.";
            }
            return null;
        }

        // Da de baja una cuenta: no puede entrar (ni con una sesion abierta) y su historial se conserva
        [HttpPut("usuarios/{id}/baja")]
        [Authorize(Roles = "ADMINISTRADOR")]
        public async Task<IActionResult> DarDeBaja(int id)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound(new { message = "Usuario no encontrado." });
            if (!usuario.Activo) return Ok(new { message = "La cuenta ya estaba dada de baja." });
            if (EsUsuarioActual(id)) return BadRequest(new { message = "No puede dar de baja su propia cuenta." });

            var error = await ValidarQuitarAcceso(usuario);
            if (error != null) return BadRequest(new { message = error });

            usuario.Activo = false;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Cuenta dada de baja." });
        }

        [HttpPut("usuarios/{id}/reactivar")]
        [Authorize(Roles = "ADMINISTRADOR")]
        public async Task<IActionResult> Reactivar(int id)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound(new { message = "Usuario no encontrado." });
            usuario.Activo = true;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Cuenta reactivada." });
        }

        // Corrige el nombre completo y el rol (el nombre de usuario no cambia nunca)
        [HttpPut("usuarios/{id}/datos")]
        [Authorize(Roles = "ADMINISTRADOR")]
        public async Task<IActionResult> CambiarDatos(int id, DatosUsuarioRequest datos)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound(new { message = "Usuario no encontrado." });

            var nombre = (datos.NombreCompleto ?? "").Trim();
            if (nombre.Length < 3) return BadRequest(new { message = "Escriba el nombre completo." });
            if (nombre.Length > 100) return BadRequest(new { message = "El nombre es demasiado largo (máximo 100 caracteres)." });
            if (!RolesValidos.Contains(datos.Rol)) return BadRequest(new { message = "Rol inválido." });

            var cambiaRol = datos.Rol != usuario.Rol;
            if (cambiaRol)
            {
                if (EsUsuarioActual(id)) return BadRequest(new { message = "No puede cambiar su propio rol." });
                var error = await ValidarQuitarAcceso(usuario);
                if (error != null) return BadRequest(new { message = error });
                if (datos.Rol == "DOCTOR" && !Catalogos.Especialidades.Contains(datos.Especialidad ?? ""))
                    return BadRequest(new { message = "Elija la especialidad del médico." });
            }

            usuario.NombreCompleto = nombre;
            if (cambiaRol)
            {
                usuario.Rol = datos.Rol;
                usuario.Especialidad = datos.Rol == "DOCTOR" ? datos.Especialidad : null;
            }
            await _context.SaveChangesAsync();
            return Ok(new { message = "Datos actualizados." });
        }

        // Asigna o corrige la especialidad de un medico (los que se crearon antes no la tenian)
        [HttpPut("usuarios/{id}/especialidad")]
        [Authorize(Roles = "ADMINISTRADOR")]
        public async Task<IActionResult> CambiarEspecialidad(int id, EspecialidadRequest datos)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound(new { message = "Usuario no encontrado." });
            if (usuario.Rol != "DOCTOR")
                return BadRequest(new { message = "Solo los médicos tienen especialidad." });
            if (!Catalogos.Especialidades.Contains(datos.Especialidad ?? ""))
                return BadRequest(new { message = "Elija una especialidad de la lista." });

            usuario.Especialidad = datos.Especialidad;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Especialidad actualizada." });
        }

        // Cada usuario cambia su propia contrasena, confirmando la actual
        [HttpPut("mi-contrasena")]
        public async Task<IActionResult> CambiarMiContrasena(MiClaveRequest datos)
        {
            if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
                return Unauthorized();
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return Unauthorized();

            if (!BCrypt.Net.BCrypt.Verify(datos.Actual ?? "", usuario.PasswordHash))
                return BadRequest(new { message = "La contraseña actual no es correcta." });
            var error = ValidarContrasena(datos.Nueva);
            if (error != null) return BadRequest(new { message = error });
            if (datos.Nueva == datos.Actual)
                return BadRequest(new { message = "La contraseña nueva debe ser distinta de la actual." });

            usuario.PasswordHash = BCrypt.Net.BCrypt.HashPassword(datos.Nueva);
            usuario.CodigoRecuperacionHash = null;
            usuario.CodigoRecuperacionExpira = null;
            usuario.IntentosCodigo = 0;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Contraseña actualizada." });
        }

        // El correo es el que recibe el codigo de recuperacion
        [HttpPut("usuarios/{id}/correo")]
        [Authorize(Roles = "ADMINISTRADOR")]
        public async Task<IActionResult> CambiarCorreo(int id, CorreoRequest datos)
        {
            var usuario = await _context.Usuarios.FindAsync(id);
            if (usuario == null) return NotFound(new { message = "Usuario no encontrado." });
            if (!CorreoValido(datos.Email))
                return BadRequest(new { message = "El correo no tiene un formato válido." });

            var correo = datos.Email!.Trim();
            if (await _context.Usuarios.AnyAsync(u => u.IdUsuario != id && u.Email == correo))
                return Conflict(new { message = "Ese correo ya está registrado en otro usuario." });

            usuario.Email = correo;
            await _context.SaveChangesAsync();
            return Ok(new { message = "Correo actualizado." });
        }

        // ------------------------------------------------------------------
        // Olvide mi contrasena: codigo de 6 digitos por correo (diseno del Login)
        // ------------------------------------------------------------------
        private const int MinutosCodigo = 5;
        private const int SegundosEntreEnvios = 60;
        private const int MaxIntentosCodigo = 5;

        public class RecuperarSolicitudRequest
        {
            public string NombreUsuario { get; set; } = string.Empty;
        }

        public class RecuperarRestablecerRequest
        {
            public string NombreUsuario { get; set; } = string.Empty;
            public string Codigo { get; set; } = string.Empty;
            public string NuevaContrasena { get; set; } = string.Empty;
        }

        // Acepta el nombre de usuario o el correo registrado. Por correo solo se resuelve si pertenece
        // a una sola cuenta (si dos comparten correo, no se sabe a cual restablecer).
        // En la peticion el campo se llama NombreUsuario, pero trae cualquiera de los dos.
        private async Task<Usuario?> BuscarPorUsuarioOCorreo(string? identificador)
        {
            var texto = (identificador ?? "").Trim();
            if (texto.Length == 0) return null;

            if (texto.Contains('@'))
            {
                var coinciden = await _context.Usuarios.Where(u => u.Activo && u.Email == texto).Take(2).ToListAsync();
                return coinciden.Count == 1 ? coinciden[0] : null;
            }
            return await _context.Usuarios.FirstOrDefaultAsync(u => u.Activo && u.NombreUsuario == texto);
        }

        private static void AnularCodigo(Usuario usuario)
        {
            usuario.CodigoRecuperacionHash = null;
            usuario.CodigoRecuperacionExpira = null;
            usuario.IntentosCodigo = 0;
        }

        [HttpPost("recuperar/solicitar")]
        [AllowAnonymous]
        public async Task<IActionResult> SolicitarCodigo(RecuperarSolicitudRequest datos)
        {
            var usuario = await BuscarPorUsuarioOCorreo(datos.NombreUsuario);

            // La respuesta es la misma exista o no el usuario, para no revelar quien tiene cuenta.
            var respuesta = new
            {
                message = "Si el usuario existe y tiene un correo registrado, se envió un código de 6 dígitos.",
                minutos = MinutosCodigo,
                segundosParaReenviar = SegundosEntreEnvios
            };

            if (usuario == null || !CorreoValido(usuario.Email)) return Ok(respuesta);

            // No se reenvia antes de 60 segundos (evita llenar la bandeja del usuario de correos)
            if (usuario.CodigoRecuperacionExpira.HasValue &&
                usuario.CodigoRecuperacionExpira.Value.AddMinutes(-MinutosCodigo).AddSeconds(SegundosEntreEnvios) > DateTime.Now)
                return Ok(respuesta);

            var codigo = RandomNumberGenerator.GetInt32(0, 1000000).ToString("D6");
            usuario.CodigoRecuperacionHash = BCrypt.Net.BCrypt.HashPassword(codigo);
            usuario.CodigoRecuperacionExpira = DateTime.Now.AddMinutes(MinutosCodigo);
            usuario.IntentosCodigo = 0;
            await _context.SaveChangesAsync();

            var cuerpo =
                "<div style=\"font-family: Arial, sans-serif;\">" +
                "<h2>Asilo Cabeza de Algod&oacute;n</h2>" +
                $"<p>Hola <b>{System.Net.WebUtility.HtmlEncode(usuario.NombreCompleto)}</b>,</p>" +
                "<p>Su c&oacute;digo para restablecer la contrase&ntilde;a es:</p>" +
                $"<p style=\"font-size:28px; letter-spacing:6px;\"><b>{codigo}</b></p>" +
                $"<p>Vence en {MinutosCodigo} minutos. Si usted no lo solicit&oacute;, ignore este mensaje.</p></div>";

            var enviado = await _email.EnviarNotificacionAsync(
                usuario.Email!.Trim(), "Código de recuperación de contraseña - Asilo Cabeza de Algodón", cuerpo);

            // Si el correo no salio, el codigo no sirve de nada: se anula
            if (!enviado)
            {
                AnularCodigo(usuario);
                await _context.SaveChangesAsync();
            }
            return Ok(respuesta);
        }

        [HttpPost("recuperar/restablecer")]
        [AllowAnonymous]
        public async Task<IActionResult> RestablecerConCodigo(RecuperarRestablecerRequest datos)
        {
            const string invalido = "El código no es válido o ya venció. Solicite uno nuevo.";

            var errorClave = ValidarContrasena(datos.NuevaContrasena);
            if (errorClave != null) return BadRequest(new { message = errorClave });

            var usuario = await BuscarPorUsuarioOCorreo(datos.NombreUsuario);

            if (usuario == null || usuario.CodigoRecuperacionHash == null ||
                usuario.CodigoRecuperacionExpira == null || usuario.CodigoRecuperacionExpira < DateTime.Now)
                return BadRequest(new { message = invalido });

            if (!BCrypt.Net.BCrypt.Verify((datos.Codigo ?? "").Trim(), usuario.CodigoRecuperacionHash))
            {
                usuario.IntentosCodigo++;
                var quedan = MaxIntentosCodigo - usuario.IntentosCodigo;
                if (quedan <= 0) AnularCodigo(usuario);
                await _context.SaveChangesAsync();
                return BadRequest(new
                {
                    message = quedan > 0
                        ? $"Código incorrecto. Le quedan {quedan} intento(s)."
                        : "Demasiados intentos. Solicite un código nuevo."
                });
            }

            usuario.PasswordHash = BCrypt.Net.BCrypt.HashPassword(datos.NuevaContrasena);
            usuario.CuentaBloqueada = false;
            usuario.IntentosFallidos = 0;
            usuario.BloqueadoHasta = null;
            AnularCodigo(usuario);
            await _context.SaveChangesAsync();
            return Ok(new { message = "Contraseña actualizada. Ya puede iniciar sesión." });
        }
    }
}
