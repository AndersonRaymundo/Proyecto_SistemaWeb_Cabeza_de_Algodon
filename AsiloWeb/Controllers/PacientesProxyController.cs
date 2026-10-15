using System.Net.Http.Headers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AsiloWeb.Controllers
{
    // Puerta de entrada al microservicio de Pacientes (pacientes_service).
    //
    // El navegador ya NO llama directamente al microservicio: todas las
    // peticiones llegan aqui (misma direccion del sitio), exigen sesion
    // iniciada y se reenvian por la red interna. Asi el microservicio no
    // necesita estar expuesto en internet y sus datos quedan protegidos.
    //
    //   /api/Pacientes                      ->  pacientes_service /api/Residentes
    //   /api/Pacientes/5                    ->  pacientes_service /api/Residentes/5
    //   /api/Pacientes/busqueda/autocomplete?q=ana -> ... /api/Residentes/busqueda/autocomplete?q=ana
    [ApiController]
    [Route("api/Pacientes")]
    [Authorize]
    public class PacientesProxyController : ControllerBase
    {
        // Leer pacientes lo puede hacer cualquier usuario con sesion; crear,
        // editar o dar de baja (cambio de estado) solo quienes trabajan el modulo de Pacientes.
        private static readonly string[] RolesEscritura = { "ADMINISTRADOR", "DOCTOR", "ENFERMERO" };

        private readonly IHttpClientFactory _factory;

        public PacientesProxyController(IHttpClientFactory factory)
        {
            _factory = factory;
        }

        [AcceptVerbs("GET", "POST", "PUT")]
        [Route("{**ruta}")]
        public async Task<IActionResult> Reenviar(string? ruta)
        {
            if (!HttpMethods.IsGet(Request.Method) && !RolesEscritura.Any(User.IsInRole))
                return Forbid();

            var destino = "/api/Residentes" + (string.IsNullOrEmpty(ruta) ? "" : "/" + ruta) + Request.QueryString;
            using var peticion = new HttpRequestMessage(new HttpMethod(Request.Method), destino);

            if (!HttpMethods.IsGet(Request.Method))
            {
                using var memoria = new MemoryStream();
                await Request.Body.CopyToAsync(memoria);
                peticion.Content = new ByteArrayContent(memoria.ToArray());
                if (!string.IsNullOrEmpty(Request.ContentType))
                    peticion.Content.Headers.ContentType = MediaTypeHeaderValue.Parse(Request.ContentType);
            }

            try
            {
                var cliente = _factory.CreateClient("pacientes");
                using var respuesta = await cliente.SendAsync(peticion, HttpContext.RequestAborted);
                var contenido = await respuesta.Content.ReadAsStringAsync(HttpContext.RequestAborted);

                return new ContentResult
                {
                    StatusCode = (int)respuesta.StatusCode,
                    Content = contenido,
                    ContentType = respuesta.Content.Headers.ContentType?.ToString() ?? "application/json"
                };
            }
            catch (HttpRequestException)
            {
                return StatusCode(502, new { message = "El servicio de pacientes no responde. Verifique que pacientes_service esté corriendo." });
            }
            catch (TaskCanceledException)
            {
                return StatusCode(504, new { message = "El servicio de pacientes tardó demasiado en responder." });
            }
        }
    }
}
