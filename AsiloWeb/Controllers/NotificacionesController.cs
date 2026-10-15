using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AsiloWeb.Services;

namespace AsiloWeb.Controllers
{
    // Envio manual de correos al tutor desde la pantalla de Pacientes.
    // Antes el navegador llamaba directo al microservicio de correo; ahora
    // pasa por aqui (con sesion y rol) y el backend se lo pasa al servicio.
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "ADMINISTRADOR,DOCTOR,ENFERMERO")]
    public class NotificacionesController : ControllerBase
    {
        private readonly EmailService _email;

        public NotificacionesController(EmailService email)
        {
            _email = email;
        }

        public class CorreoRequest
        {
            public string Recipient { get; set; } = string.Empty;
            public string Subject { get; set; } = string.Empty;
            public string Body { get; set; } = string.Empty;
        }

        [HttpPost("correo")]
        public async Task<IActionResult> EnviarCorreo(CorreoRequest datos)
        {
            if (string.IsNullOrWhiteSpace(datos.Recipient) || string.IsNullOrWhiteSpace(datos.Subject))
                return BadRequest(new { message = "Faltan el destinatario o el asunto." });

            var enviado = await _email.EnviarNotificacionAsync(datos.Recipient, datos.Subject, datos.Body);
            return enviado
                ? Ok(new { message = "Correo enviado." })
                : StatusCode(502, new { message = "El servicio de correo no pudo enviar el mensaje." });
        }
    }
}
