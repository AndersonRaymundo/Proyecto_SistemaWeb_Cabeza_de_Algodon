// Pantalla de Configuracion (solo lectura): muestra los parametros vigentes del sistema.
(function () {
    const descuento = document.getElementById("valor-descuento");
    const usuario = document.getElementById("valor-usuario");
    const rol = document.getElementById("valor-rol");

    usuario.textContent = localStorage.getItem("nombre_usuario") || "—";
    rol.textContent = localStorage.getItem("rol_usuario") || "—";

    fetch("/api/Config/descuento")
        .then(r => (r.ok ? r.json() : Promise.reject()))
        .then(d => { descuento.textContent = d.porcentaje + "%"; })
        .catch(() => { descuento.textContent = "No disponible"; });
})();

// ===========================================================================
// Usuarios del sistema (solo el administrador): lista, alta, correo, clave y desbloqueo
// ===========================================================================
const USUARIOS_API_URL = "/api/Auth/usuarios";
const NOMBRE_ROL = { ADMINISTRADOR: "Administrador", DOCTOR: "Doctor", ENFERMERO: "Enfermero", FARMACIA: "Farmacia", FUNDACION: "Fundación", LABORATORIO: "Laboratorio" };
let usuariosCache = [];

// Misma regla que el servidor: 8 caracteres o mas, con letras y numeros
const claveValida = clave => clave.length >= 8 && /[A-Za-z]/.test(clave) && /\d/.test(clave);

async function cargarUsuarios() {
    const contenedor = document.getElementById("contenedor-usuarios");
    try {
        const respuesta = await fetch(USUARIOS_API_URL);
        if (!respuesta.ok) throw new Error("Error al cargar usuarios");
        usuariosCache = await respuesta.json();

        contenedor.innerHTML = `
            <table class="tabla-datos">
                <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Correo</th><th>Cuenta</th><th class="centrado">Acciones</th></tr></thead>
                <tbody>${usuariosCache.map(u => `
                    <tr>
                        <td>${esc(u.nombreCompleto)}</td>
                        <td>${esc(u.nombreUsuario)}</td>
                        <td>${esc(NOMBRE_ROL[u.rol] || u.rol)}</td>
                        <td>${u.email ? esc(u.email) : '<em style="color:#b45309;">Sin correo</em>'}</td>
                        <td><span class="badge ${u.cuentaBloqueada ? "badge-peligro" : "badge-exito"}">${u.cuentaBloqueada ? "Bloqueada" : "Activa"}</span></td>
                        <td class="centrado">
                            <button class="btn-icono azul" onclick="abrirClaveUsuario(${u.idUsuario})" title="Cambiar contraseña"><i class="fa-solid fa-key"></i></button>
                            <button class="btn-icono celeste" onclick="abrirCorreoUsuario(${u.idUsuario})" title="Cambiar correo"><i class="fa-solid fa-envelope"></i></button>
                            ${u.cuentaBloqueada ? `<button class="btn-icono ambar" onclick="desbloquearUsuario(${u.idUsuario})" title="Desbloquear cuenta"><i class="fa-solid fa-lock-open"></i></button>` : ""}
                        </td>
                    </tr>`).join("")}</tbody>
            </table>`;
    } catch (err) {
        console.error(err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo cargar la lista de usuarios.</p>";
    }
}

// Envia al servidor y muestra el resultado; devuelve true si salio bien
async function enviarUsuario(url, metodo, cuerpo, mensajeExito) {
    try {
        const respuesta = await fetch(url, { method: metodo, headers: { "Content-Type": "application/json" }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
        if (!respuesta.ok) { mostrarModal("No se pudo guardar", await mensajeError(respuesta), "error"); return false; }
        mostrarModal("¡Listo!", mensajeExito, "exito");
        cargarUsuarios();
        return true;
    } catch (err) {
        console.error(err);
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
        return false;
    }
}

async function crearUsuario(event) {
    event.preventDefault();
    const clave = document.getElementById("usuario-clave").value;
    if (!claveValida(clave)) { mostrarModal("Contraseña débil", "La contraseña debe tener al menos 8 caracteres e incluir letras y números.", "error"); return; }
    if (clave !== document.getElementById("usuario-clave2").value) { mostrarModal("Contraseñas distintas", "Las dos contraseñas no coinciden.", "error"); return; }

    const ok = await enviarUsuario(USUARIOS_API_URL, "POST", {
        nombreCompleto: document.getElementById("usuario-nombre").value.trim(),
        nombreUsuario: document.getElementById("usuario-login").value.trim(),
        rol: document.getElementById("usuario-rol").value,
        email: document.getElementById("usuario-correo").value.trim() || null,
        contrasena: clave,
    }, "Usuario creado correctamente.");
    if (ok) { document.getElementById("form-usuario").reset(); cerrarPanel("panel-usuario"); }
}

function abrirClaveUsuario(id) {
    const u = usuariosCache.find(x => x.idUsuario === id);
    if (!u) return;
    document.getElementById("clave-usuario-id").value = id;
    document.getElementById("clave-usuario-nombre").innerHTML = `Usuario: <strong>${esc(u.nombreCompleto)}</strong> (${esc(u.nombreUsuario)})`;
    document.getElementById("form-clave-usuario").reset();
    abrirPanel("panel-clave-usuario");
}

async function guardarClaveUsuario(event) {
    event.preventDefault();
    const clave = document.getElementById("clave-nueva").value;
    if (!claveValida(clave)) { mostrarModal("Contraseña débil", "La contraseña debe tener al menos 8 caracteres e incluir letras y números.", "error"); return; }
    if (clave !== document.getElementById("clave-nueva2").value) { mostrarModal("Contraseñas distintas", "Las dos contraseñas no coinciden.", "error"); return; }
    const id = document.getElementById("clave-usuario-id").value;
    const ok = await enviarUsuario(`${USUARIOS_API_URL}/${id}/contrasena`, "PUT", { nuevaContrasena: clave }, "Contraseña actualizada. La cuenta quedó desbloqueada.");
    if (ok) cerrarPanel("panel-clave-usuario");
}

function abrirCorreoUsuario(id) {
    const u = usuariosCache.find(x => x.idUsuario === id);
    if (!u) return;
    document.getElementById("correo-usuario-id").value = id;
    document.getElementById("correo-usuario-nombre").innerHTML = `Usuario: <strong>${esc(u.nombreCompleto)}</strong> (${esc(u.nombreUsuario)})`;
    document.getElementById("correo-nuevo").value = u.email || "";
    abrirPanel("panel-correo-usuario");
}

async function guardarCorreoUsuario(event) {
    event.preventDefault();
    const id = document.getElementById("correo-usuario-id").value;
    const ok = await enviarUsuario(`${USUARIOS_API_URL}/${id}/correo`, "PUT", { email: document.getElementById("correo-nuevo").value.trim() }, "Correo actualizado.");
    if (ok) cerrarPanel("panel-correo-usuario");
}

async function desbloquearUsuario(id) {
    await enviarUsuario(`${USUARIOS_API_URL}/${id}/desbloquear`, "PUT", null, "La cuenta quedó desbloqueada.");
}

(function iniciarUsuarios() {
    const seccion = document.getElementById("seccion-usuarios");
    if (!seccion) return;
    const arrancar = () => {
        if (rol() !== "ADMINISTRADOR") { seccion.style.display = "none"; return; }
        document.getElementById("form-usuario").addEventListener("submit", crearUsuario);
        document.getElementById("form-clave-usuario").addEventListener("submit", guardarClaveUsuario);
        document.getElementById("form-correo-usuario").addEventListener("submit", guardarCorreoUsuario);
        cargarUsuarios();
    };
    if (window.ROL_ACTUAL) arrancar(); else document.addEventListener("sesion-lista", arrancar, { once: true });
})();
