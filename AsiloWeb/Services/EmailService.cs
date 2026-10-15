using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace AsiloWeb.Services
{
    // Conecta con el microservicio de correo (Python; direccion en "Servicios:Correo") para
    // cumplir RF-04: notificar automáticamente al familiar cuando se crea
    // una solicitud médica.
    public class EmailService
    {
        private readonly HttpClient _httpClient;
        public EmailService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<bool> EnviarNotificacionAsync(string destinatario, string asunto, string cuerpo)
        {
            if (string.IsNullOrWhiteSpace(destinatario))
                return false;

            try
            {
                var payload = new { recipient = destinatario, subject = asunto, body = cuerpo };
                var response = await _httpClient.PostAsJsonAsync("/send-email", payload);
                return response.IsSuccessStatusCode;
            }
            catch
            {
                // No debe interrumpir el flujo principal si el microservicio de correo falla.
                return false;
            }
        }
    }
}
