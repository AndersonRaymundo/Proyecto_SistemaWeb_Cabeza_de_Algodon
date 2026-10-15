using System.Net.Http.Json;

namespace AsiloWeb.Services
{
    // Datos del residente tal como los devuelve el microservicio de Pacientes.
    public class PacienteDto
    {
        public int IdResidente { get; set; }
        public string NoExpediente { get; set; } = string.Empty;
        public string NombreCompleto { get; set; } = string.Empty;
        public string? Patologia { get; set; }
        public string? NombreTutor { get; set; }
        public string? TelefonoTutor { get; set; }
        public string? CorreoTutor { get; set; }
    }

    // Conector del backend .NET con pacientes_service. Se usa
    // para armar correos (RF-04) y reportes (RF-14) con el nombre real del
    // residente, ya que sus datos viven en el microservicio.
    public class PacientesService
    {
        private readonly HttpClient _http;
        private const string Ruta = "/api/Residentes"; // la direccion base sale de "Servicios:Pacientes"

        public PacientesService(HttpClient http)
        {
            _http = http;
        }

        public async Task<PacienteDto?> ObtenerAsync(int idPaciente)
        {
            try
            {
                return await _http.GetFromJsonAsync<PacienteDto>($"{Ruta}/{idPaciente}");
            }
            catch
            {
                return null;
            }
        }

        public async Task<Dictionary<int, PacienteDto>> ObtenerTodosAsync()
        {
            try
            {
                var lista = await _http.GetFromJsonAsync<List<PacienteDto>>(Ruta);
                return (lista ?? new List<PacienteDto>()).ToDictionary(p => p.IdResidente);
            }
            catch
            {
                return new Dictionary<int, PacienteDto>();
            }
        }
    }
}
