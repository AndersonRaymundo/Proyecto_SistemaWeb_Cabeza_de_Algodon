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

// ---------------------------------------------------------------------------
// Olvide mi contrasena: el sistema envia un codigo de 6 digitos al correo registrado
// ---------------------------------------------------------------------------
const RECUPERAR_SOLICITAR_URL = "/api/Auth/recuperar/solicitar";
const RECUPERAR_RESTABLECER_URL = "/api/Auth/recuperar/restablecer";
let cuentaRegresiva = null;

const porId = id => document.getElementById(id);

function mensajeRecuperacion(texto, tipo) {
    const caja = porId("rec-mensaje");
    caja.textContent = texto || "";
    caja.className = tipo === "ok" ? "rec-ok" : "rec-error";
}

function detenerCuentaRegresiva() {
    if (cuentaRegresiva) { clearInterval(cuentaRegresiva); cuentaRegresiva = null; }
}

function abrirRecuperacion() {
    detenerCuentaRegresiva();
    porId("rec-paso1").style.display = "block";
    porId("rec-paso2").style.display = "none";
    porId("rec-usuario").value = porId("usuario").value.trim();
    ["rec-codigo", "rec-clave", "rec-clave2"].forEach(id => { porId(id).value = ""; });
    mensajeRecuperacion("");
    porId("modalRecuperar").style.display = "flex";
    porId("rec-usuario").focus();
}

function cerrarRecuperacion() {
    detenerCuentaRegresiva();
    porId("modalRecuperar").style.display = "none";
}

// Cuenta regresiva del codigo (mm:ss) y del tiempo que falta para poder pedir otro
function iniciarCuentaRegresiva(segundosCodigo, segundosReenvio) {
    detenerCuentaRegresiva();
    let restante = segundosCodigo;
    let hastaReenvio = segundosReenvio;
    const pintar = () => {
        const mm = String(Math.floor(restante / 60)).padStart(2, "0");
        const ss = String(restante % 60).padStart(2, "0");
        porId("rec-tiempo").textContent = `${mm}:${ss}`;
        const boton = porId("rec-reenviar");
        boton.disabled = hastaReenvio > 0;
        boton.textContent = hastaReenvio > 0 ? `Reenviar código (${hastaReenvio} s)` : "Reenviar código";
        if (restante <= 0) {
            detenerCuentaRegresiva();
            mensajeRecuperacion("El código venció. Pida uno nuevo.", "error");
        }
    };
    pintar();
    cuentaRegresiva = setInterval(() => {
        restante--;
        if (hastaReenvio > 0) hastaReenvio--;
        pintar();
    }, 1000);
}

async function solicitarCodigo() {
    const usuario = porId("rec-usuario").value.trim();
    if (!usuario) { mensajeRecuperacion("Escriba su usuario o su correo.", "error"); return; }

    try {
        const respuesta = await fetch(RECUPERAR_SOLICITAR_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombreUsuario: usuario })
        });
        if (!respuesta.ok) throw new Error("No se pudo solicitar el código");
        const datos = await respuesta.json();

        porId("rec-paso1").style.display = "none";
        porId("rec-paso2").style.display = "block";
        mensajeRecuperacion(`${datos.message} Si no le llega, pida al administrador que restablezca su contraseña.`, "ok");
        iniciarCuentaRegresiva((datos.minutos || 5) * 60, datos.segundosParaReenviar || 60);
        porId("rec-codigo").focus();
    } catch (error) {
        console.error(error);
        mensajeRecuperacion("No se pudo conectar con el servidor.", "error");
    }
}

async function restablecerClave() {
    const usuario = porId("rec-usuario").value.trim();
    const codigo = porId("rec-codigo").value.trim();
    const clave = porId("rec-clave").value;
    const clave2 = porId("rec-clave2").value;

    if (!/^\d{6}$/.test(codigo)) { mensajeRecuperacion("El código tiene 6 dígitos.", "error"); return; }
    if (clave.length < 8 || !/[A-Za-z]/.test(clave) || !/\d/.test(clave)) {
        mensajeRecuperacion("La contraseña debe tener al menos 8 caracteres e incluir letras y números.", "error"); return;
    }
    if (clave !== clave2) { mensajeRecuperacion("Las contraseñas no coinciden.", "error"); return; }

    try {
        const respuesta = await fetch(RECUPERAR_RESTABLECER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nombreUsuario: usuario, codigo, nuevaContrasena: clave })
        });
        const datos = await respuesta.json().catch(() => null);
        if (!respuesta.ok) { mensajeRecuperacion(datos?.message || "No se pudo cambiar la contraseña.", "error"); return; }

        cerrarRecuperacion();
        porId("usuario").value = usuario;
        porId("contrasena").value = "";
        const aviso = porId("aviso-login");
        aviso.textContent = datos?.message || "Contraseña actualizada. Ya puede iniciar sesión.";
        aviso.style.display = "block";
        porId("contrasena").focus();
    } catch (error) {
        console.error(error);
        mensajeRecuperacion("No se pudo conectar con el servidor.", "error");
    }
}
