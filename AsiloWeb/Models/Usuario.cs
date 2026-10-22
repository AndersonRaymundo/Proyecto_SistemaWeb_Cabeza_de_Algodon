using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AsiloWeb.Models
{

    //bloqueo tras 3 intentos fallidos.
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

        // desbloquea automáticamente (15 minutos de bloqueo).
        [Column("bloqueado_hasta")]
        public DateTime? BloqueadoHasta { get; set; }

        // "Olvide mi contraseña": codigo de 6 digitos enviado por correo. Se guarda cifrado (BCrypt),
        // con su hora de vencimiento y los intentos fallidos, y se borra al usarse o vencer.
        [Column("codigo_recuperacion_hash")]
        public string? CodigoRecuperacionHash { get; set; }

        [Column("codigo_recuperacion_expira")]
        public DateTime? CodigoRecuperacionExpira { get; set; }

        [Column("intentos_codigo")]
        public int IntentosCodigo { get; set; } = 0;

        // Solo para medicos: la especialidad con la que la Fundacion los asigna (lista en Catalogos.Especialidades)
        [Column("especialidad")]
        public string? Especialidad { get; set; }
    }
}
