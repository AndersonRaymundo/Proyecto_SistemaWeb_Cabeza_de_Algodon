using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AsiloWeb.Controllers
{
    // Paginas del sistema. Cada una exige sesion iniciada y el rol que le
    // corresponde (RNF-02): si no se cumple, el servidor redirige al Login
    // o al Menu, aunque alguien escriba la URL a mano.
    [Authorize]
    public class PaginasController : Controller
    {
        [HttpGet("/Home/MENU")]
        public IActionResult Menu() => View("~/Views/Home/MENU.cshtml");

        // Entrar al Login cierra cualquier sesion abierta en el servidor. Asi el enlace
        // "Cerrar sesion" (que apunta aqui) cierra la sesion aunque falle el JavaScript.
        [HttpGet("/Auth/Login")]
        [AllowAnonymous]
        public async Task<IActionResult> Login()
        {
            if (User.Identity?.IsAuthenticated == true)
                await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return View("~/Views/Auth/Login.cshtml");
        }

        [HttpGet("/Citas")]
        [Authorize(Roles = "ADMINISTRADOR,DOCTOR,ENFERMERO,FUNDACION")]
        public IActionResult SolicitudesCitas() => View("~/Views/Citas/Index.cshtml");

        [HttpGet("/Historial")]
        [Authorize(Roles = "ADMINISTRADOR,DOCTOR")]
        public IActionResult HistorialMedico() => View("~/Views/Historial/Index.cshtml");

        [HttpGet("/LaboratorioFarmacia")]
        [Authorize(Roles = "ADMINISTRADOR,DOCTOR,FARMACIA,LABORATORIO")]
        public IActionResult LaboratorioFarmacia() => View("~/Views/LaboratorioFarmacia/Index.cshtml");

        [HttpGet("/Reportes")]
        [Authorize(Roles = "ADMINISTRADOR,DOCTOR")]
        public IActionResult Reportes() => View("~/Views/Reportes/Index.cshtml");

        [HttpGet("/Caja")]
        [Authorize(Roles = "ADMINISTRADOR")]
        public IActionResult Caja() => View("~/Views/Caja/Index.cshtml");

        [HttpGet("/Paginas/Configuracion")]
        [Authorize(Roles = "ADMINISTRADOR")]
        public IActionResult Configuracion() => View("~/Views/Paginas/Index.cshtml");
    }
}
