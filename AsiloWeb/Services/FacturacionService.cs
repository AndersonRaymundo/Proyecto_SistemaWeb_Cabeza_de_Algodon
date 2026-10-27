using System.Globalization;
using AsiloWeb.Data;
using AsiloWeb.Models;

namespace AsiloWeb.Services
{
    // RF-10: calcula el descuento especial de la fundacion y carga
    // automaticamente los costos (consultas, examenes, medicamentos) a la
    // cuenta del familiar (TBL_PAGOS_FUNDACION, estado Pendiente).
    public class FacturacionService
    {
        private readonly AppDbContext _context;
        private readonly IConfiguration _config;

        public FacturacionService(AppDbContext context, IConfiguration config)
        {
            _context = context;
            _config = config;
        }

        // Se puede cambiar en appsettings.json -> "Fundacion": { "DescuentoPorcentaje": 20 }
        public decimal PorcentajeDescuento =>
            _config.GetValue<decimal?>("Fundacion:DescuentoPorcentaje") ?? 20m;

        public decimal AplicarDescuento(decimal precioLista)
        {
            if (precioLista <= 0) return 0;
            return Math.Round(precioLista * (1 - PorcentajeDescuento / 100m), 2);
        }

        public string DetalleDescuento(decimal precioLista)
        {
            return string.Format(CultureInfo.InvariantCulture,
                "precio de lista Q{0:F2}, descuento de la fundación {1:0.##}%", precioLista, PorcentajeDescuento);
        }

        // Agrega el cargo a la cuenta del familiar (no hace nada si el monto es 0).
        public async Task CargarAFamiliaAsync(int idPaciente, string concepto, decimal precioLista, int? idCita)
        {
            var montoFinal = AplicarDescuento(precioLista);
            if (montoFinal <= 0) return;

            _context.PagosFundacion.Add(new PagoFundacion
            {
                IdPaciente = idPaciente,
                ConceptoPago = $"{concepto} ({DetalleDescuento(precioLista)})",
                Monto = montoFinal,
                IdCita = idCita
            });

            // RF-12: si el cargo viene de una cita, esa cita queda con pago pendiente.
            if (idCita.HasValue)
            {
                var cita = await _context.CitasMedicas.FindAsync(idCita.Value);
                if (cita != null) cita.EstadoPago = "Pendiente";
            }
            await _context.SaveChangesAsync();
        }
    }
}
