using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using AsiloWeb.Services;

namespace AsiloWeb.Controllers
{
    // Datos de configuracion que necesitan las pantallas (por ejemplo, para
    // mostrar el precio final con el descuento de la fundacion, RF-10).
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ConfigController : ControllerBase
    {
        private readonly FacturacionService _facturacion;

        public ConfigController(FacturacionService facturacion)
        {
            _facturacion = facturacion;
        }

        [HttpGet("descuento")]
        public IActionResult Descuento()
        {
            return Ok(new { porcentaje = _facturacion.PorcentajeDescuento });
        }
    }
}
