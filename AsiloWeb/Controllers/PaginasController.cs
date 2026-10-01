using Microsoft.AspNetCore.Mvc;

namespace AsiloWeb.Controllers
{
    public class PaginasController : Controller
    {
        [HttpGet("/Home/MENU")]
        public IActionResult Menu() => View("~/Views/Home/MENU.cshtml");

        [HttpGet("/Auth/Login")]
        public IActionResult Login() => View("~/Views/Auth/Login.cshtml");

        [HttpGet("/Citas")]
        public IActionResult SolicitudesCitas() => View("~/Views/Citas/Index.cshtml");

        [HttpGet("/Historial")]
        public IActionResult HistorialMedico() => View("~/Views/Historial/Index.cshtml");

        [HttpGet("/LaboratorioFarmacia")]
        public IActionResult LaboratorioFarmacia() => View("~/Views/LaboratorioFarmacia/Index.cshtml");

        [HttpGet("/Reportes")]
        public IActionResult Reportes() => View("~/Views/Reportes/Index.cshtml");

        [HttpGet("/Caja")]
        public IActionResult Caja() => View("~/Views/Caja/Index.cshtml");

        [HttpGet("/Paginas/Configuracion")]
        public IActionResult Configuracion() => View("~/Views/Paginas/Index.cshtml");
    }
}