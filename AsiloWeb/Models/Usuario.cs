using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AsiloWeb.Models
{
    // Corresponde a TBL_USUARIOS del ERD (Fase de Análisis).
    // Cubre CU-01 (Iniciar Sesión) incluyendo el bloqueo tras 3 intentos fallidos.
    [Table("TBL_USUARIOS")]
    public class Usuario
    {
        [Key]
        [Column("id_usuario")]
        public int IdUsuario { get; set; }

        [Column("nombre_usuario")]
        public string NombreUsuario { get; set; } = string.Empty;

        [Column("email")]
        public string? Email { get; set; }

        [Column("password_hash")]
        public string PasswordHash { get; set; } = string.Empty;

        [Column("rol")]
        public string Rol { get; set; } = string.Empty; // ADMINISTRADOR | DOCTOR | ENFERMERO | FARMACIA

        [Column("nombre_completo")]
        public string NombreCompleto { get; set; } = string.Empty;

        [Column("intentos_fallidos")]
        public int IntentosFallidos { get; set; } = 0;

        [Column("cuenta_bloqueada")]
        public bool CuentaBloqueada { get; set; } = false;

        // No está en el ERD original, pero es necesario para saber CUÁNDO se
        // desbloquea automáticamente (CU-01 pide 15 minutos de bloqueo).
        [Column("bloqueado_hasta")]
        public DateTime? BloqueadoHasta { get; set; }
    }
}
