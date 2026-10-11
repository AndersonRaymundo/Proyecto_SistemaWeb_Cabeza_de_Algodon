using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AsiloWeb.Controllers
{
    // Esta vista es solo la pantalla (HTML/CSS/JS). El CRUD real de
    // pacientes lo hace el microservicio pacientes_service (puerto 8000),
    // consumido directamente desde wwwroot/JS/pacientes.js.
    [Authorize(Roles = "ADMINISTRADOR,DOCTOR,ENFERMERO")]
    public class ResidentesController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
