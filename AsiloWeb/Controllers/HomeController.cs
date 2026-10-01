using Microsoft.AspNetCore.Mvc;

namespace AsiloWeb.Controllers
{
    public class HomeController : Controller
    {
        // Ruta raíz (http://localhost:5168/) -> Carga el Login
        public IActionResult Index()
        {
            return View("~/Views/Auth/LOGIN.cshtml");
        }
    }
}