using System.Net.Http.Json;

namespace AsiloWeb.Services
{
    // Estructura generica de un reporte. El backend .NET reune los datos
    // reales de la base de datos y el microservicio de PDF solo se encarga
    // de dibujar el documento (CU-05).
    public class ReporteSeccion
    {
        public string Encabezado { get; set; } = string.Empty;
        public List<string> Columnas { get; set; } = new();
        public List<List<string>> Filas { get; set; } = new();
        public List<string> Totales { get; set; } = new();
    }

    public class ReporteDto
    {
        public string Titulo { get; set; } = string.Empty;
        public string Subtitulo { get; set; } = string.Empty;
        public List<string> Filtros { get; set; } = new();
        public List<ReporteSeccion> Secciones { get; set; } = new();
    }

    public class PdfService
    {
        private readonly HttpClient _httpClient;
        public PdfService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<byte[]?> GenerarReporteAsync(ReporteDto reporte)
        {
            try
            {
                var response = await _httpClient.PostAsJsonAsync("/generate-report", reporte);
                if (!response.IsSuccessStatusCode) return null;
                return await response.Content.ReadAsByteArrayAsync();
            }
            catch
            {
                return null;
            }
        }
    }
}
