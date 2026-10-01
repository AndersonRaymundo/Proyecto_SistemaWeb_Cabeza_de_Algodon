using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace AsiloWeb.Services
{
    public class PdfService
    {
        private readonly HttpClient _httpClient;
        private const string BaseUrl = "http://localhost:8002"; // Puerto del microservicio Python

        public PdfService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        // 1. Análisis Médicos por Paciente
        public async Task<byte[]> ObtenerAnalisisMedicoAsync(int pacienteId)
        {
            var response = await _httpClient.GetAsync($"{BaseUrl}/reporte/analisis-medico/{pacienteId}");
            return response.IsSuccessStatusCode ? await response.Content.ReadAsByteArrayAsync() : null;
        }

        // 2. Reporte de Cobros y Donaciones
        public async Task<byte[]> ObtenerReporteCobrosDonacionesAsync(int mes, int anio)
        {
            var response = await _httpClient.GetAsync($"{BaseUrl}/reporte/cobros-donaciones?mes={mes}&anio={anio}");
            return response.IsSuccessStatusCode ? await response.Content.ReadAsByteArrayAsync() : null;
        }

        // 3. Pagos Realizados a la Fundación
        public async Task<byte[]> ObtenerPagosFundacionAsync(int pacienteId)
        {
            var response = await _httpClient.GetAsync($"{BaseUrl}/reporte/pagos-fundacion/{pacienteId}");
            return response.IsSuccessStatusCode ? await response.Content.ReadAsByteArrayAsync() : null;
        }
    }
}