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

        // Si ya hay sesion (por ejemplo, el Login abierto en otra pestaña), se va directo al Menu.
        // No se cierra la sesion aqui: todas las pestañas comparten la misma y se cerraria en todas.
        [HttpGet("/Auth/Login")]
        [AllowAnonymous]
        public IActionResult Login()
        {
            if (User.Identity?.IsAuthenticated == true)
                return Redirect("/Home/MENU");
            return View("~/Views/Auth/Login.cshtml");
        }

        // Enlace "Cerrar sesion": cierra la sesion en el servidor y vuelve al Login.
        // Funciona aunque falle el JavaScript del boton.
        [HttpGet("/Auth/Salir")]
        [AllowAnonymous]
        public async Task<IActionResult> Salir()
        {
            await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Redirect("/Auth/Login");
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
