using Microsoft.EntityFrameworkCore;
using AsiloWeb.Models;

namespace AsiloWeb.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        public DbSet<Usuario> Usuarios { get; set; }
        public DbSet<FichaMedica> FichasMedicas { get; set; }
        public DbSet<CitaMedica> CitasMedicas { get; set; }
        public DbSet<ExamenLaboratorio> ExamenesLaboratorio { get; set; }
        public DbSet<MedicamentoRecetado> MedicamentosRecetados { get; set; }
        public DbSet<Donacion> Donaciones { get; set; }
        public DbSet<PagoFundacion> PagosFundacion { get; set; }
        public DbSet<Gasto> Gastos { get; set; }
        public DbSet<AbonoFundacion> AbonosFundacion { get; set; }
        public DbSet<InventarioMedicamento> Inventario { get; set; }
        public DbSet<BitacoraCorreo> BitacoraCorreos { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // Precision de columnas decimales (dinero): 10 digitos, 2 decimales.
            modelBuilder.Entity<CitaMedica>().Property(c => c.CostoTotal).HasPrecision(10, 2);
            modelBuilder.Entity<ExamenLaboratorio>().Property(e => e.Costo).HasPrecision(10, 2);
            modelBuilder.Entity<MedicamentoRecetado>().Property(m => m.Costo).HasPrecision(10, 2);
            modelBuilder.Entity<Donacion>().Property(d => d.Monto).HasPrecision(10, 2);
            modelBuilder.Entity<PagoFundacion>().Property(p => p.Monto).HasPrecision(10, 2);
            modelBuilder.Entity<Gasto>().Property(g => g.Monto).HasPrecision(10, 2);
            modelBuilder.Entity<AbonoFundacion>().Property(a => a.Monto).HasPrecision(10, 2);
            modelBuilder.Entity<InventarioMedicamento>().Property(i => i.PrecioUnitario).HasPrecision(10, 2);
        }
    }
}
