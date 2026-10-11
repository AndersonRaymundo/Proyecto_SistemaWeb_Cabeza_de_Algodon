using Microsoft.EntityFrameworkCore;
using AsiloWeb.Data;
using AsiloWeb.Models;

namespace AsiloWeb.Services
{
    // Busca la ficha medica base de un residente (TBL_FICHAS_MEDICAS) y, si
    // todavia no tiene, la crea vacia. Asi examenes y visitas siempre quedan
    // ligados a una ficha, como pide el ERD.
    public class ExpedienteService
    {
        private readonly AppDbContext _context;

        public ExpedienteService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<FichaMedica> ObtenerOCrearFichaAsync(int idPaciente, int idDoctor)
        {
            var ficha = await _context.FichasMedicas
                .Where(f => f.IdPaciente == idPaciente)
                .OrderBy(f => f.IdFicha)
                .FirstOrDefaultAsync();

            if (ficha == null)
            {
                ficha = new FichaMedica
                {
                    IdPaciente = idPaciente,
                    IdDoctor = idDoctor,
                    DiagnosticoBase = ""
                };
                _context.FichasMedicas.Add(ficha);
                await _context.SaveChangesAsync();
            }
            return ficha;
        }
    }
}
