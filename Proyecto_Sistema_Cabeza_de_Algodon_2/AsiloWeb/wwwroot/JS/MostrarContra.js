// Login - Asilo Cabeza de Algodon
// Conecta con login_service (FastAPI, puerto 8007)

const LOGIN_API_URL = "http://localhost:8007/login";

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

// Iniciar sesion contra el microservicio de login
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
            if (respuesta.status === 401) {
                alert("Usuario o contraseña incorrectos.");
            } else if (respuesta.status === 403) {
                alert("Este usuario está deshabilitado. Contacte al administrador.");
            } else {
                alert("No se pudo iniciar sesión. Intente de nuevo.");
            }
            return;
        }

        const datos = await respuesta.json();

        // Guardar sesion para que roles.js filtre el menu segun el rol
        localStorage.setItem("token", datos.token);
        localStorage.setItem("id_usuario", datos.idUsuario);
        localStorage.setItem("nombre_usuario", datos.nombreCompleto);
        localStorage.setItem("rol_usuario", datos.rol);

        mostrarModalBienvenida();
    } catch (error) {
        console.error("Error al conectar con el servicio de login:", error);
        alert("No se pudo conectar con el servidor. Verifique que el login_service esté corriendo.");
    }
}

function mostrarModalBienvenida() {
    const modal = document.getElementById("modalBienvenida");
    if (modal) modal.style.display = "flex";
}

function cerrarModal() {
    const modal = document.getElementById("modalBienvenida");
    if (modal) modal.style.display = "none";
    // Redirige al menu principal despues de aceptar el mensaje de bienvenida
    window.location.href = "MENU.html";
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
