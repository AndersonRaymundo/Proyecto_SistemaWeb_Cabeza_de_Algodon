using Microsoft.AspNetCore.Mvc;
using AsiloWeb.Services;
using System.Threading.Tasks;

namespace AsiloWeb.Controllers
{
    public class ReportesController : Controller
    {
        private readonly PdfService _pdfService;

        // Inyección de dependencias de PdfService
        public ReportesController(PdfService pdfService)
        {
            _pdfService = pdfService;
        }

        // 1. Endpoint para Análisis Médicos por Paciente
        [HttpGet]
        public async Task<IActionResult> DescargarAnalisisMedico(int id)
        {
            byte[] pdfBytes = await _pdfService.ObtenerAnalisisMedicoAsync(id);
            if (pdfBytes == null) 
                return NotFound("No se pudo generar el análisis médico.");
            
            return File(pdfBytes, "application/pdf", $"Analisis_Medico_Paciente_{id}.pdf");
        }

        // 2. Endpoint para Reporte de Cobros y Donaciones
        [HttpGet]
        public async Task<IActionResult> DescargarCobrosDonaciones(int mes, int anio)
        {
            byte[] pdfBytes = await _pdfService.ObtenerReporteCobrosDonacionesAsync(mes, anio);
            if (pdfBytes == null) 
                return NotFound("No se pudo generar el reporte financiero.");

            return File(pdfBytes, "application/pdf", $"Reporte_Financiero_{mes}_{anio}.pdf");
        }

        // 3. Endpoint para Pagos Realizados a la Fundación
        [HttpGet]
        public async Task<IActionResult> DescargarPagosFundacion(int id)
        {
            byte[] pdfBytes = await _pdfService.ObtenerPagosFundacionAsync(id);
            if (pdfBytes == null) 
                return NotFound("No se encontraron registros de pagos.");

            return File(pdfBytes, "application/pdf", $"Pagos_Fundacion_Paciente_{id}.pdf");
        }
    }
}