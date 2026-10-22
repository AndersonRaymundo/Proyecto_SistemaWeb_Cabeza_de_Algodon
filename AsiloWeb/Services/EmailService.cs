using Microsoft.Extensions.DependencyInjection;
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
        private readonly IServiceScopeFactory _scopes;
        public EmailService(HttpClient httpClient, IServiceScopeFactory scopes)
        {
            _httpClient = httpClient;
            _scopes = scopes;
        }

        public async Task<bool> EnviarNotificacionAsync(string destinatario, string asunto, string cuerpo)
        {
            if (string.IsNullOrWhiteSpace(destinatario))
                return false;

            var enviado = await EnviarSinRegistroAsync(destinatario, asunto, cuerpo);
            await RegistrarAsync(destinatario, asunto, enviado);
            return enviado;
        }

        // Deja constancia en la bitacora; si falla, no interrumpe nada.
        private async Task RegistrarAsync(string destinatario, string asunto, bool enviado)
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AsiloWeb.Data.AppDbContext>();
                db.BitacoraCorreos.Add(new AsiloWeb.Models.BitacoraCorreo
                {
                    Fecha = DateTime.Now,
                    Destinatario = destinatario.Trim(),
                    Asunto = asunto,
                    Enviado = enviado
                });
                await db.SaveChangesAsync();
            }
            catch
            {
                // la bitacora nunca debe impedir un envio
            }
        }

        private async Task<bool> EnviarSinRegistroAsync(string destinatario, string asunto, string cuerpo)
        {
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
