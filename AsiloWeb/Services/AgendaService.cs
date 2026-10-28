using System.Globalization;

namespace AsiloWeb.Services
{
    // Horario de atencion de las citas. Se configura en appsettings.json, seccion "Agenda":
    //   HoraInicio / HoraFin           jornada (formato 24 horas, "08:00")
    //   AlmuerzoInicio / AlmuerzoFin   receso en el que no se agendan citas
    //   DuracionMinutos                duracion de cada cita (los espacios se calculan con ella)
    //   DiasLaborales                  dias de atencion: 0 = domingo ... 6 = sabado ("1,2,3,4,5,6" = lunes a sabado)
    public class AgendaService
    {
        private readonly TimeSpan _inicio;
        private readonly TimeSpan _fin;
        private readonly TimeSpan _almuerzoInicio;
        private readonly TimeSpan _almuerzoFin;
        private readonly int _duracion;
        private readonly HashSet<DayOfWeek> _dias;

        public AgendaService(IConfiguration config)
        {
            var s = config.GetSection("Agenda");
            _inicio = Hora(s["HoraInicio"], "08:00");
            _fin = Hora(s["HoraFin"], "17:00");
            _almuerzoInicio = Hora(s["AlmuerzoInicio"], "12:00");
            _almuerzoFin = Hora(s["AlmuerzoFin"], "13:00");
            _duracion = int.TryParse(s["DuracionMinutos"], out var d) && d > 0 ? d : 30;
            _dias = (s["DiasLaborales"] ?? "1,2,3,4,5,6")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(x => int.TryParse(x, out var n) ? n : -1)
                .Where(n => n >= 0 && n <= 6)
                .Select(n => (DayOfWeek)n)
                .ToHashSet();
        }

        private static TimeSpan Hora(string? texto, string porDefecto) =>
            TimeSpan.TryParseExact(texto ?? porDefecto, @"hh\:mm", CultureInfo.InvariantCulture, out var t)
                ? t
                : TimeSpan.ParseExact(porDefecto, @"hh\:mm", CultureInfo.InvariantCulture);

        // "8:00 a. m.", "1:30 p. m." (se arma a mano para no depender de la cultura del servidor)
        private static string Formato(TimeSpan t)
        {
            var h12 = t.Hours % 12 == 0 ? 12 : t.Hours % 12;
            return $"{h12}:{t.Minutes:00} {(t.Hours < 12 ? "a. m." : "p. m.")}";
        }

        public bool EsDiaLaborable(DateTime dia) => _dias.Contains(dia.DayOfWeek);

        // Hora de Guatemala
        public bool YaPaso(DateTime fechaHora) => fechaHora <= DateTime.Now;

        // Horas de inicio de cita de un dia: dentro de la jornada y sin tocar el almuerzo
        public List<TimeSpan> HorariosDelDia()
        {
            var lista = new List<TimeSpan>();
            var paso = TimeSpan.FromMinutes(_duracion);
            for (var t = _inicio; t + paso <= _fin; t += paso)
            {
                var chocaConAlmuerzo = t < _almuerzoFin && t + paso > _almuerzoInicio;
                if (!chocaConAlmuerzo) lista.Add(t);
            }
            return lista;
        }

        // null si la fecha y hora son validas para una cita; si no, el motivo
        public string? Validar(DateTime fechaHora)
        {
            // No se puede agendar en el pasado
            if (YaPaso(fechaHora))
                return "Esa fecha y hora ya pasaron. Elija un horario a partir de ahora.";

            if (!EsDiaLaborable(fechaHora))
                return "Ese día no hay atención de citas.";

            var hora = new TimeSpan(fechaHora.Hour, fechaHora.Minute, 0);
            if (fechaHora.Second != 0 || !HorariosDelDia().Contains(hora))
                return $"Esa hora no está disponible. Las citas se agendan de {Formato(_inicio)} a {Formato(_fin)}, " +
                       $"cada {_duracion} minutos, y no hay citas de {Formato(_almuerzoInicio)} a {Formato(_almuerzoFin)} (almuerzo).";

            return null;
        }
    }
}
