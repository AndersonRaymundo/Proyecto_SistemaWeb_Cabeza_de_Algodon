using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using AsiloWeb.Data;
using AsiloWeb.Services;

namespace AsiloWeb.Controllers
{
    // RF-14 / CU-05: los 6 reportes pedidos en el analisis. Cada accion consulta
    // la base de datos (y el microservicio de Pacientes para los nombres),
    // arma el contenido y se lo manda al microservicio de PDF, que devuelve
    // el documento.
    [Authorize(Roles = "ADMINISTRADOR,DOCTOR")]
    public class ReportesController : Controller
    {
        private readonly AppDbContext _context;
        private readonly PdfService _pdf;
        private readonly PacientesService _pacientes;

        public ReportesController(AppDbContext context, PdfService pdf, PacientesService pacientes)
        {
            _context = context;
            _pdf = pdf;
            _pacientes = pacientes;
        }

        // ---------- utilidades ----------
        private static string Q(decimal v) => "Q" + v.ToString("N2", CultureInfo.InvariantCulture);
        private static string Fecha(DateTime d) => d.ToString("dd/MM/yyyy");
        private static string FechaHora(DateTime? d) => d.HasValue ? d.Value.ToString("dd/MM/yyyy HH:mm") : "-";
        private static string Vacio(string? t) => string.IsNullOrWhiteSpace(t) ? "-" : t!;

        private static string NombrePaciente(Dictionary<int, PacienteDto> pacientes, int id) =>
            pacientes.TryGetValue(id, out var p) ? p.NombreCompleto : $"Residente #{id}";

        private static List<string> FiltrosFecha(DateTime? desde, DateTime? hasta)
        {
            var filtros = new List<string>();
            if (desde.HasValue) filtros.Add($"Desde: {Fecha(desde.Value)}");
            if (hasta.HasValue) filtros.Add($"Hasta: {Fecha(hasta.Value)}");
            if (filtros.Count == 0) filtros.Add("Periodo: todo el historial");
            return filtros;
        }

        private async Task<IActionResult> Entregar(ReporteDto reporte, string archivo)
        {
            var bytes = await _pdf.GenerarReporteAsync(reporte);
            if (bytes == null)
                return StatusCode(502, "No se pudo generar el PDF. Verifique que pdf_service esté corriendo (puerto 8002).");
            return File(bytes, "application/pdf", archivo);
        }

        // ---------- 1. Costos de citas por paciente (consulta + examenes + medicamentos) ----------
        [HttpGet]
        public async Task<IActionResult> CostosCitas(int? idPaciente)
        {
            var pacientes = await _pacientes.ObtenerTodosAsync();

            var citas = await _context.CitasMedicas
                .Where(c => c.Estado == "Atendida" && (idPaciente == null || c.IdPaciente == idPaciente))
                .OrderBy(c => c.FechaCita)
                .ToListAsync();
            var ids = citas.Select(c => c.IdCita).ToList();

            var examenes = await _context.ExamenesLaboratorio
                .Where(e => e.IdCita != null && ids.Contains(e.IdCita.Value)).ToListAsync();
            var medicamentos = await _context.MedicamentosRecetados
                .Where(m => m.IdCita != null && ids.Contains(m.IdCita.Value)).ToListAsync();

            decimal tC = 0, tE = 0, tM = 0;
            var filas = new List<List<string>>();
            foreach (var c in citas)
            {
                var ex = examenes.Where(e => e.IdCita == c.IdCita).Sum(e => e.Costo);
                var me = medicamentos.Where(m => m.IdCita == c.IdCita).Sum(m => m.Costo);
                var total = c.CostoTotal + ex + me;
                tC += c.CostoTotal; tE += ex; tM += me;
                filas.Add(new List<string>
                {
                    Fecha(c.FechaCita ?? c.FechaSolicitud), NombrePaciente(pacientes, c.IdPaciente),
                    c.EspecialidadSolicitada, Q(c.CostoTotal), Q(ex), Q(me), Q(total), c.EstadoPago
                });
            }

            var filtros = new List<string>();
            filtros.Add(idPaciente.HasValue ? $"Paciente: {NombrePaciente(pacientes, idPaciente.Value)}" : "Pacientes: todos");

            return await Entregar(new ReporteDto
            {
                Titulo = "Costos de Citas por Paciente",
                Subtitulo = "Consulta, exámenes de laboratorio y medicamentos (precios con descuento de la fundación)",
                Filtros = filtros,
                Secciones = new List<ReporteSeccion>
                {
                    new ReporteSeccion
                    {
                        Encabezado = "Detalle por cita atendida",
                        Columnas = new List<string> { "Fecha", "Paciente", "Especialidad", "Consulta", "Exámenes", "Medicamentos", "Total", "Pago" },
                        Filas = filas,
                        Totales = new List<string> { "TOTAL", "", "", Q(tC), Q(tE), Q(tM), Q(tC + tE + tM), "" }
                    }
                }
            }, "costos_citas.pdf");
        }

        // ---------- 2. Ficha medica por paciente (motivo de reclusion y medicacion) ----------
        [HttpGet]
        public async Task<IActionResult> FichaMedica(int idPaciente)
        {
            if (idPaciente <= 0) return BadRequest("Seleccione un residente.");

            var paciente = await _pacientes.ObtenerAsync(idPaciente);
            var ficha = await _context.FichasMedicas
                .Include(f => f.Patologias)
                .Include(f => f.MedicamentosCajon)
                .Where(f => f.IdPaciente == idPaciente).OrderBy(f => f.IdFicha).FirstOrDefaultAsync();
            var medicamentosCajon = ficha == null ? "" : string.Join(", ", ficha.MedicamentosCajon.Select(m =>
                string.Join(" ", new[] { m.NombreMedicamento, m.Dosis, m.Frecuencia }.Where(x => !string.IsNullOrWhiteSpace(x)))));
            var citas = await _context.CitasMedicas
                .Where(c => c.IdPaciente == idPaciente).OrderByDescending(c => c.FechaSolicitud).ToListAsync();
            var medicamentos = await _context.MedicamentosRecetados
                .Where(m => m.IdPaciente == idPaciente).OrderByDescending(m => m.FechaDespacho).ToListAsync();

            // RF-06: el historial de consultas indica el medico tratante
            var idsDoctores = citas.Where(c => c.IdDoctor != null).Select(c => c.IdDoctor!.Value).Distinct().ToList();
            var medicos = await _context.Usuarios
                .Where(u => idsDoctores.Contains(u.IdUsuario))
                .ToDictionaryAsync(u => u.IdUsuario, u => u.NombreCompleto);

            var secciones = new List<ReporteSeccion>
            {
                new ReporteSeccion
                {
                    Encabezado = "Datos del residente",
                    Columnas = new List<string> { "Campo", "Valor" },
                    Filas = new List<List<string>>
                    {
                        new List<string> { "No. de expediente", Vacio(paciente?.NoExpediente) },
                        new List<string> { "Nombre completo", Vacio(paciente?.NombreCompleto) },
                        new List<string> { "Motivo de reclusión / patología", Vacio(paciente?.Patologia) },
                        new List<string> { "Tutor responsable", Vacio(paciente?.NombreTutor) },
                        new List<string> { "Teléfono del tutor", Vacio(paciente?.TelefonoTutor) },
                        new List<string> { "Correo del tutor", Vacio(paciente?.CorreoTutor) }
                    }
                },
                new ReporteSeccion
                {
                    Encabezado = "Ficha médica base",
                    Columnas = new List<string> { "Campo", "Valor" },
                    Filas = new List<List<string>>
                    {
                        new List<string> { "Diagnóstico base", Vacio(ficha?.DiagnosticoBase) },
                        new List<string> { "Medicamentos de cajón (continuos)", Vacio(medicamentosCajon) }
                    }
                },
                new ReporteSeccion
                {
                    Encabezado = "Historial de consultas",
                    Columnas = new List<string> { "Fecha", "Especialidad y médico", "Motivo", "Diagnóstico", "Estado" },
                    Filas = citas.Select(c => new List<string>
                    {
                        Fecha(c.FechaCita ?? c.FechaSolicitud),
                        c.EspecialidadSolicitada + " - " + (c.IdDoctor != null && medicos.ContainsKey(c.IdDoctor.Value) ? medicos[c.IdDoctor.Value] : "sin médico"),
                        c.Motivo, Vacio(c.DiagnosticoConsulta), c.Estado
                    }).ToList()
                },
                new ReporteSeccion
                {
                    Encabezado = "Medicación recetada",
                    Columnas = new List<string> { "Fecha", "Medicamento", "Cantidad", "Tiempo de aplicación", "Despachado" },
                    Filas = medicamentos.Select(m => new List<string>
                    {
                        Fecha(m.FechaDespacho), m.NombreMedicamento, Vacio(m.Cantidad),
                        Vacio(m.TiempoAplicacion), m.Despachado ? "Sí" : "Pendiente"
                    }).ToList()
                }
            };

            return await Entregar(new ReporteDto
            {
                Titulo = "Ficha Médica del Residente",
                Subtitulo = "Análisis médico, motivo de reclusión y medicación",
                Filtros = new List<string> { $"Paciente: {Vacio(paciente?.NombreCompleto)}" },
                Secciones = secciones
            }, "ficha_medica.pdf");
        }

        // ---------- 3. Cobros por paciente por rango de fechas (con detalle medico) ----------
        [HttpGet]
        public async Task<IActionResult> CobrosPaciente(int? idPaciente, DateTime? desde, DateTime? hasta)
        {
            var pacientes = await _pacientes.ObtenerTodosAsync();
            var d = desde?.Date;
            var h = hasta?.Date.AddDays(1);

            var cobros = await _context.PagosFundacion
                .Where(p => (idPaciente == null || p.IdPaciente == idPaciente)
                         && (d == null || p.FechaPago >= d)
                         && (h == null || p.FechaPago < h))
                .OrderBy(p => p.FechaPago)
                .ToListAsync();

            var filas = cobros.Select(p => new List<string>
            {
                Fecha(p.FechaPago), NombrePaciente(pacientes, p.IdPaciente), p.ConceptoPago, Q(p.Monto), p.Estado
            }).ToList();

            var pagado = cobros.Where(p => p.Estado == "Pagado").Sum(p => p.Monto);
            var pendiente = cobros.Where(p => p.Estado != "Pagado").Sum(p => p.Monto);

            var filtros = FiltrosFecha(desde, hasta);
            filtros.Insert(0, idPaciente.HasValue ? $"Paciente: {NombrePaciente(pacientes, idPaciente.Value)}" : "Pacientes: todos");

            return await Entregar(new ReporteDto
            {
                Titulo = "Cobros por Paciente",
                Subtitulo = "Cargos a la cuenta del familiar, con el detalle médico de cada uno",
                Filtros = filtros,
                Secciones = new List<ReporteSeccion>
                {
                    new ReporteSeccion
                    {
                        Encabezado = "Detalle de cobros",
                        Columnas = new List<string> { "Fecha", "Paciente", "Concepto / detalle médico", "Monto", "Estado" },
                        Filas = filas,
                        Totales = new List<string> { "TOTAL", "", $"Pagado {Q(pagado)}  |  Pendiente {Q(pendiente)}", Q(pagado + pendiente), "" }
                    }
                }
            }, "cobros_paciente.pdf");
        }

        // ---------- 4. Pagos a la fundacion (lo que el asilo debe por los servicios) ----------
        [HttpGet]
        public async Task<IActionResult> PagosFundacion(DateTime? desde, DateTime? hasta)
        {
            var pacientes = await _pacientes.ObtenerTodosAsync();
            var d = desde?.Date;
            var h = hasta?.Date.AddDays(1);

            var citas = await _context.CitasMedicas
                .Where(c => c.Estado == "Atendida" && c.CostoTotal > 0
                         && (d == null || c.FechaCita >= d) && (h == null || c.FechaCita < h))
                .OrderBy(c => c.FechaCita).ToListAsync();
            var examenes = await _context.ExamenesLaboratorio
                .Where(e => e.Costo > 0 && (d == null || e.FechaRegistro >= d) && (h == null || e.FechaRegistro < h))
                .OrderBy(e => e.FechaRegistro).ToListAsync();
            var medicamentos = await _context.MedicamentosRecetados
                .Where(m => m.Despachado && m.Costo > 0 && (d == null || m.FechaDespacho >= d) && (h == null || m.FechaDespacho < h))
                .OrderBy(m => m.FechaDespacho).ToListAsync();

            var abonos = await _context.AbonosFundacion
                .Where(a => (d == null || a.FechaPago >= d) && (h == null || a.FechaPago < h))
                .OrderBy(a => a.FechaPago).ToListAsync();
            var tAbonos = abonos.Sum(a => a.Monto);

            var tCitas = citas.Sum(c => c.CostoTotal);
            var tEx = examenes.Sum(e => e.Costo);
            var tMed = medicamentos.Sum(m => m.Costo);

            var cols = new List<string> { "Fecha", "Paciente", "Detalle", "Monto (con descuento)" };

            return await Entregar(new ReporteDto
            {
                Titulo = "Pagos a la Fundación",
                Subtitulo = "Servicios prestados por la fundación con su descuento, pagos realizados y saldo",
                Filtros = FiltrosFecha(desde, hasta),
                Secciones = new List<ReporteSeccion>
                {
                    new ReporteSeccion
                    {
                        Encabezado = "Consultas médicas", Columnas = cols,
                        Filas = citas.Select(c => new List<string> { Fecha(c.FechaCita ?? c.FechaSolicitud), NombrePaciente(pacientes, c.IdPaciente), c.EspecialidadSolicitada, Q(c.CostoTotal) }).ToList(),
                        Totales = new List<string> { "Subtotal", "", "", Q(tCitas) }
                    },
                    new ReporteSeccion
                    {
                        Encabezado = "Exámenes de laboratorio", Columnas = cols,
                        Filas = examenes.Select(e => new List<string> { Fecha(e.FechaRegistro), NombrePaciente(pacientes, e.IdPaciente), e.TipoExamen, Q(e.Costo) }).ToList(),
                        Totales = new List<string> { "Subtotal", "", "", Q(tEx) }
                    },
                    new ReporteSeccion
                    {
                        Encabezado = "Medicamentos", Columnas = cols,
                        Filas = medicamentos.Select(m => new List<string> { Fecha(m.FechaDespacho), NombrePaciente(pacientes, m.IdPaciente), m.NombreMedicamento, Q(m.Costo) }).ToList(),
                        Totales = new List<string> { "Subtotal", "", "", Q(tMed) }
                    },
                    new ReporteSeccion
                    {
                        Encabezado = "Pagos realizados a la fundación",
                        Columnas = new List<string> { "Fecha", "Nota", "Monto" },
                        Filas = abonos.Select(a => new List<string> { Fecha(a.FechaPago), Vacio(a.Nota), Q(a.Monto) }).ToList(),
                        Totales = new List<string> { "Subtotal", "", Q(tAbonos) }
                    },
                    new ReporteSeccion
                    {
                        Encabezado = "Cuenta con la fundación",
                        Columnas = new List<string> { "Concepto", "Monto" },
                        Filas = new List<List<string>>
                        {
                            new List<string> { "Total adeudado (consultas + exámenes + medicamentos)", Q(tCitas + tEx + tMed) },
                            new List<string> { "Total pagado a la fundación", Q(tAbonos) },
                            new List<string> { "Saldo pendiente", Q(tCitas + tEx + tMed - tAbonos) }
                        }
                    }
                }
            }, "pagos_fundacion.pdf");
        }

        // ---------- 5. Entradas de dinero (donaciones y cobros de cuotas) ----------
        [HttpGet]
        public async Task<IActionResult> Entradas(DateTime? desde, DateTime? hasta)
        {
            var pacientes = await _pacientes.ObtenerTodosAsync();
            var d = desde?.Date;
            var h = hasta?.Date.AddDays(1);

            var donaciones = await _context.Donaciones
                .Where(x => (d == null || x.FechaDonacion >= d) && (h == null || x.FechaDonacion < h))
                .OrderBy(x => x.FechaDonacion).ToListAsync();
            var cobros = await _context.PagosFundacion
                .Where(p => p.Estado == "Pagado" && (d == null || p.FechaPago >= d) && (h == null || p.FechaPago < h))
                .OrderBy(p => p.FechaPago).ToListAsync();

            var tDon = donaciones.Sum(x => x.Monto);
            var tCob = cobros.Sum(p => p.Monto);

            return await Entregar(new ReporteDto
            {
                Titulo = "Entradas de Dinero",
                Subtitulo = "Donaciones recibidas y cobros cancelados por los familiares",
                Filtros = FiltrosFecha(desde, hasta),
                Secciones = new List<ReporteSeccion>
                {
                    new ReporteSeccion
                    {
                        Encabezado = "Donaciones",
                        Columnas = new List<string> { "Fecha", "Donante", "Tipo", "Monto" },
                        Filas = donaciones.Select(x => new List<string> { Fecha(x.FechaDonacion), x.Donante, x.TipoDonacion, Q(x.Monto) }).ToList(),
                        Totales = new List<string> { "Subtotal", "", "", Q(tDon) }
                    },
                    new ReporteSeccion
                    {
                        Encabezado = "Cobros y cuotas cancelados",
                        Columnas = new List<string> { "Fecha", "Paciente", "Concepto", "Monto" },
                        Filas = cobros.Select(p => new List<string> { Fecha(p.FechaPago), NombrePaciente(pacientes, p.IdPaciente), p.ConceptoPago, Q(p.Monto) }).ToList(),
                        Totales = new List<string> { "Subtotal", "", "", Q(tCob) }
                    },
                    new ReporteSeccion
                    {
                        Encabezado = "Total de entradas",
                        Columnas = new List<string> { "Concepto", "Monto" },
                        Filas = new List<List<string>> { new List<string> { "Donaciones + cobros cancelados", Q(tDon + tCob) } }
                    }
                }
            }, "entradas.pdf");
        }

        // ---------- 6. Examenes medicos realizados por paciente ----------
        [HttpGet]
        public async Task<IActionResult> Examenes(int? idPaciente)
        {
            var pacientes = await _pacientes.ObtenerTodosAsync();

            var examenes = await _context.ExamenesLaboratorio
                .Where(e => idPaciente == null || e.IdPaciente == idPaciente)
                .OrderBy(e => e.FechaRegistro).ToListAsync();

            var filtros = new List<string>
            {
                idPaciente.HasValue ? $"Paciente: {NombrePaciente(pacientes, idPaciente.Value)}" : "Pacientes: todos"
            };

            return await Entregar(new ReporteDto
            {
                Titulo = "Exámenes Médicos Realizados por Paciente",
                Subtitulo = "Exámenes de laboratorio solicitados y sus resultados",
                Filtros = filtros,
                Secciones = new List<ReporteSeccion>
                {
                    new ReporteSeccion
                    {
                        Encabezado = "Exámenes de laboratorio",
                        Columnas = new List<string> { "Fecha", "Paciente", "Examen", "Resultado", "Costo" },
                        Filas = examenes.Select(e => new List<string> { Fecha(e.FechaRegistro), NombrePaciente(pacientes, e.IdPaciente), e.TipoExamen, string.IsNullOrWhiteSpace(e.Resultados) ? "Pendiente" : e.Resultados!, Q(e.Costo) }).ToList()
                    }
                }
            }, "examenes_por_paciente.pdf");
        }

        // ---------- 7. Medicamentos aplicados por paciente ----------
        [HttpGet]
        public async Task<IActionResult> Medicamentos(int? idPaciente)
        {
            var pacientes = await _pacientes.ObtenerTodosAsync();

            var medicamentos = await _context.MedicamentosRecetados
                .Where(m => idPaciente == null || m.IdPaciente == idPaciente)
                .OrderBy(m => m.FechaDespacho).ToListAsync();

            var filtros = new List<string>
            {
                idPaciente.HasValue ? $"Paciente: {NombrePaciente(pacientes, idPaciente.Value)}" : "Pacientes: todos"
            };

            return await Entregar(new ReporteDto
            {
                Titulo = "Medicamentos Aplicados por Paciente",
                Subtitulo = "Medicamentos recetados y su despacho",
                Filtros = filtros,
                Secciones = new List<ReporteSeccion>
                {
                    new ReporteSeccion
                    {
                        Encabezado = "Medicamentos aplicados",
                        Columnas = new List<string> { "Fecha", "Paciente", "Medicamento", "Cantidad", "Tiempo", "Despachado", "Costo" },
                        Filas = medicamentos.Select(m => new List<string> { Fecha(m.FechaDespacho), NombrePaciente(pacientes, m.IdPaciente), m.NombreMedicamento, Vacio(m.Cantidad), Vacio(m.TiempoAplicacion), m.Despachado ? "Sí" : "Pendiente", Q(m.Costo) }).ToList()
                    }
                }
            }, "medicamentos_por_paciente.pdf");
        }
    }
}
