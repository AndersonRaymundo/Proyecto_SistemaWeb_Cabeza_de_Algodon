using Microsoft.AspNetCore.Mvc;

namespace AsiloWeb.Controllers
{
    public class HomeController : Controller
    {
        // Ruta raíz (http://localhost:5168/) -> Carga el Menú
        public IActionResult Index()
        {
            return View("MENU");
        }
    }
}