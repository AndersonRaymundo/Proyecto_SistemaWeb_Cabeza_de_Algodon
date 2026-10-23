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
                <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Especialidad</th><th>Correo</th><th>Cuenta</th><th class="centrado">Acciones</th></tr></thead>
                <tbody>${usuariosCache.map(u => `
                    <tr${u.activo === false ? ' style="opacity:.6;"' : ""}>
                        <td>${esc(u.nombreCompleto)}</td>
                        <td>${esc(u.nombreUsuario)}</td>
                        <td>${esc(NOMBRE_ROL[u.rol] || u.rol)}</td>
                        <td>${u.rol === "DOCTOR" ? (u.especialidad ? esc(u.especialidad) : '<em style="color:#b45309;">Sin especialidad</em>') : "-"}</td>
                        <td>${u.email ? esc(u.email) : '<em style="color:#b45309;">Sin correo</em>'}</td>
                        <td><span class="badge ${u.activo === false ? "badge-peligro" : (u.cuentaBloqueada ? "badge-alerta" : "badge-exito")}">${u.activo === false ? "Dada de baja" : (u.cuentaBloqueada ? "Bloqueada" : "Activa")}</span></td>
                        <td class="centrado">
                            <button class="btn-icono celeste" onclick="abrirDatosUsuario(${u.idUsuario})" title="Editar nombre y rol"><i class="fa-solid fa-pen-to-square"></i></button>
                            ${u.rol === "DOCTOR" ? `<button class="btn-icono verde" onclick="abrirEspecialidadUsuario(${u.idUsuario})" title="Cambiar especialidad"><i class="fa-solid fa-stethoscope"></i></button>` : ""}
                            <button class="btn-icono azul" onclick="abrirClaveUsuario(${u.idUsuario})" title="Cambiar contraseña"><i class="fa-solid fa-key"></i></button>
                            <button class="btn-icono celeste" onclick="abrirCorreoUsuario(${u.idUsuario})" title="Cambiar correo"><i class="fa-solid fa-envelope"></i></button>
                            ${u.cuentaBloqueada ? `<button class="btn-icono ambar" onclick="desbloquearUsuario(${u.idUsuario})" title="Desbloquear cuenta"><i class="fa-solid fa-lock-open"></i></button>` : ""}
                            ${u.activo === false
                                ? `<button class="btn-icono verde" onclick="reactivarUsuario(${u.idUsuario})" title="Reactivar cuenta"><i class="fa-solid fa-user-check"></i></button>`
                                : (u.idUsuario === Number(localStorage.getItem("id_usuario")) ? "" : `<button class="btn-icono ambar" onclick="darDeBajaUsuario(${u.idUsuario})" title="Dar de baja"><i class="fa-solid fa-user-slash"></i></button>`)}
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
    if (document.getElementById("usuario-rol").value === "DOCTOR" && !document.getElementById("usuario-especialidad").value) {
        mostrarModal("Falta la especialidad", "Elija la especialidad del médico.", "error"); return;
    }

    const ok = await enviarUsuario(USUARIOS_API_URL, "POST", {
        nombreCompleto: document.getElementById("usuario-nombre").value.trim(),
        nombreUsuario: document.getElementById("usuario-login").value.trim(),
        rol: document.getElementById("usuario-rol").value,
        especialidad: document.getElementById("usuario-rol").value === "DOCTOR" ? document.getElementById("usuario-especialidad").value : null,
        email: document.getElementById("usuario-correo").value.trim() || null,
        contrasena: clave,
    }, "Usuario creado correctamente.");
    if (ok) { document.getElementById("form-usuario").reset(); alCambiarRol(); cerrarPanel("panel-usuario"); }
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
    const bitacora = document.getElementById("seccion-bitacora");
    const arrancar = () => {
        if (rol() !== "ADMINISTRADOR") {
            // quien no es administrador solo ve los parametros
            seccion.style.display = "none";
            if (bitacora) bitacora.style.display = "none";
            document.querySelectorAll('[data-pestana="pestana-usuarios"], [data-pestana="pestana-correos"]').forEach(b => { b.style.display = "none"; });
            const parametros = document.querySelector('[data-pestana="pestana-parametros"]');
            if (parametros) parametros.click();
            return;
        }
        document.getElementById("form-usuario").addEventListener("submit", crearUsuario);
        document.getElementById("form-clave-usuario").addEventListener("submit", guardarClaveUsuario);
        document.getElementById("form-correo-usuario").addEventListener("submit", guardarCorreoUsuario);
        document.getElementById("form-especialidad-usuario").addEventListener("submit", guardarEspecialidadUsuario);
        document.getElementById("form-datos-usuario").addEventListener("submit", guardarDatosUsuario);
        document.getElementById("datos-usuario-rol").addEventListener("change", alCambiarRolEdicion);
        document.getElementById("usuario-rol").addEventListener("change", alCambiarRol);
        cargarEspecialidades();
        cargarUsuarios();
        cargarBitacora();
    };
    if (window.ROL_ACTUAL) arrancar(); else document.addEventListener("sesion-lista", arrancar, { once: true });
})();

// ---------------------------------------------------------------------------
// Especialidad de los medicos (la Fundacion los asigna segun la especialidad que pide la solicitud)
// ---------------------------------------------------------------------------
let especialidades = ["Medicina general", "Geriatría", "Cardiología", "Neurología", "Endocrinología", "Reumatología",
    "Traumatología", "Neumología", "Oftalmología", "Psiquiatría", "Urología", "Gastroenterología"];   // si el servidor no responde

async function cargarEspecialidades() {
    try {
        const respuesta = await fetch("/api/Auth/especialidades");
        if (respuesta.ok) { const lista = await respuesta.json(); if (Array.isArray(lista) && lista.length) especialidades = lista; }
    } catch (err) { /* se usa la lista de respaldo */ }
    const opciones = '<option value="">-- Seleccionar --</option>' + especialidades.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join("");
    document.getElementById("usuario-especialidad").innerHTML = opciones;
    document.getElementById("especialidad-nueva").innerHTML = opciones;
    document.getElementById("datos-usuario-especialidad").innerHTML = opciones;
}

// La especialidad solo se pide cuando el rol elegido es Doctor
function alCambiarRol() {
    document.getElementById("grupo-especialidad").style.display = document.getElementById("usuario-rol").value === "DOCTOR" ? "block" : "none";
}

function abrirEspecialidadUsuario(id) {
    const u = usuariosCache.find(x => x.idUsuario === id);
    if (!u) return;
    document.getElementById("especialidad-usuario-id").value = id;
    document.getElementById("especialidad-usuario-nombre").innerHTML = `Médico: <strong>${esc(u.nombreCompleto)}</strong> (${esc(u.nombreUsuario)})`;
    document.getElementById("especialidad-nueva").value = u.especialidad || "";
    abrirPanel("panel-especialidad-usuario");
}

async function guardarEspecialidadUsuario(event) {
    event.preventDefault();
    const id = document.getElementById("especialidad-usuario-id").value;
    const ok = await enviarUsuario(`${USUARIOS_API_URL}/${id}/especialidad`, "PUT", { especialidad: document.getElementById("especialidad-nueva").value }, "Especialidad actualizada.");
    if (ok) cerrarPanel("panel-especialidad-usuario");
}

// ---------------------------------------------------------------------------
// Bitacora de correos: si un correo falla, aqui se ve (antes quedaba oculto)
// ---------------------------------------------------------------------------
async function cargarBitacora() {
    const contenedor = document.getElementById("contenedor-bitacora");
    if (!contenedor) return;
    try {
        const respuesta = await fetch("/api/Bitacora/correos?top=50");
        if (!respuesta.ok) throw new Error("Error al cargar la bitacora");
        const correos = await respuesta.json();
        contenedor.innerHTML = correos.length ? `
            <table class="tabla-datos">
                <thead><tr><th>Fecha</th><th>Destinatario</th><th>Asunto</th><th>Resultado</th></tr></thead>
                <tbody>${correos.map(c => `
                    <tr>
                        <td>${new Date(c.fecha).toLocaleString("es-GT")}</td>
                        <td>${esc(c.destinatario)}</td>
                        <td>${esc(c.asunto)}</td>
                        <td><span class="badge ${c.enviado ? "badge-exito" : "badge-peligro"}">${c.enviado ? "Enviado" : "No se envió"}</span></td>
                    </tr>`).join("")}</tbody>
            </table>` : "<p style='color:#64748b; padding:8px 0;'>Aún no se ha enviado ningún correo.</p>";
    } catch (err) {
        console.error(err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo cargar la bitácora de correos.</p>";
    }
}

// ---------------------------------------------------------------------------
// Editar nombre y rol, dar de baja y reactivar (la cuenta nunca se borra: se conserva su historial)
// ---------------------------------------------------------------------------
function alCambiarRolEdicion() {
    document.getElementById("datos-grupo-especialidad").style.display = document.getElementById("datos-usuario-rol").value === "DOCTOR" ? "block" : "none";
}

function abrirDatosUsuario(id) {
    const u = usuariosCache.find(x => x.idUsuario === id);
    if (!u) return;
    document.getElementById("datos-usuario-id").value = id;
    document.getElementById("datos-usuario-login").innerHTML = `Usuario: <strong>${esc(u.nombreUsuario)}</strong>`;
    document.getElementById("datos-usuario-nombre").value = u.nombreCompleto;
    document.getElementById("datos-usuario-rol").value = u.rol;
    document.getElementById("datos-usuario-especialidad").value = u.especialidad || "";
    alCambiarRolEdicion();
    abrirPanel("panel-datos-usuario");
}

async function guardarDatosUsuario(event) {
    event.preventDefault();
    const id = document.getElementById("datos-usuario-id").value;
    const rol = document.getElementById("datos-usuario-rol").value;
    const especialidad = document.getElementById("datos-usuario-especialidad").value;
    const actual = usuariosCache.find(x => x.idUsuario === Number(id));
    // Al pasar a Doctor hace falta la especialidad; un medico que sigue siendo medico conserva la suya
    if (rol === "DOCTOR" && !especialidad) { mostrarModal("Falta la especialidad", "Elija la especialidad del médico.", "error"); return; }
    const ok = await enviarUsuario(`${USUARIOS_API_URL}/${id}/datos`, "PUT", {
        nombreCompleto: document.getElementById("datos-usuario-nombre").value.trim(),
        rol,
        especialidad: rol === "DOCTOR" ? especialidad : null,
    }, actual && actual.rol !== rol ? "Datos actualizados. La persona deberá volver a iniciar sesión." : "Datos actualizados.");
    if (ok) cerrarPanel("panel-datos-usuario");
}

async function darDeBajaUsuario(id) {
    const u = usuariosCache.find(x => x.idUsuario === id);
    if (!u) return;
    const acepta = await confirmar({
        titulo: "Dar de baja a un usuario",
        mensaje: `¿Dar de baja a ${u.nombreCompleto}? No podrá iniciar sesión, pero su historial se conserva y se puede reactivar.`,
        textoAceptar: "Dar de baja",
        peligro: true,
    });
    if (!acepta) return;
    await enviarUsuario(`${USUARIOS_API_URL}/${id}/baja`, "PUT", null, "La cuenta fue dada de baja.");
}

async function reactivarUsuario(id) {
    await enviarUsuario(`${USUARIOS_API_URL}/${id}/reactivar`, "PUT", null, "La cuenta fue reactivada.");
}
