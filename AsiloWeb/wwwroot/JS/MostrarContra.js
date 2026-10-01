// Login - Asilo Cabeza de Algodon
// Conecta con el backend .NET (AuthController), mismo origen.

const LOGIN_API_URL = "/api/Auth/login";

// Mostrar / ocultar contrasena
function togglePassword(idCampo, boton) {
    const campo = document.getElementById(idCampo);
    const icono = boton.querySelector("i");

    if (campo.type === "password") {
        campo.type = "text";
        icono.classList.remove("fa-eye-slash");
        icono.classList.add("fa-eye");
    } else {
        campo.type = "password";
        icono.classList.remove("fa-eye");
        icono.classList.add("fa-eye-slash");
    }
}

// Iniciar sesion contra AuthController
async function iniciarSesion() {
    const usuario = document.getElementById("usuario").value.trim();
    const contrasena = document.getElementById("contrasena").value;

    if (!usuario || !contrasena) {
        alert("Por favor ingrese su nombre de usuario y contraseña.");
        return;
    }

    try {
        const respuesta = await fetch(LOGIN_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nombreUsuario: usuario,
                contrasena: contrasena
            })
        });

        if (!respuesta.ok) {
            const datosError = await respuesta.json().catch(() => null);
            alert(datosError?.message || "Usuario o contraseña incorrectos.");
            return;
        }

        const datos = await respuesta.json();

        // Guardar sesion para que roles.js filtre el menu segun el rol
        localStorage.setItem("id_usuario", datos.idUsuario);
        localStorage.setItem("nombre_usuario", datos.nombreCompleto);
        localStorage.setItem("rol_usuario", datos.rol);

        mostrarModalBienvenida();
    } catch (error) {
        console.error("Error al conectar con el login:", error);
        alert("No se pudo conectar con el servidor.");
    }
}

function mostrarModalBienvenida() {
    const modal = document.getElementById("modalBienvenida");
    if (modal) modal.style.display = "flex";
}

function cerrarModal() {
    const modal = document.getElementById("modalBienvenida");
    if (modal) modal.style.display = "none";
    window.location.href = "/Home/MENU";
}

// Permitir iniciar sesion con la tecla Enter
document.addEventListener("DOMContentLoaded", function () {
    const campoContrasena = document.getElementById("contrasena");
    if (campoContrasena) {
        campoContrasena.addEventListener("keyup", function (evento) {
            if (evento.key === "Enter") {
                iniciarSesion();
            }
        });
    }
});
