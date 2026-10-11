// Solicitudes y Citas - Asilo Cabeza de Algodon
// Pacientes sigue siendo microservicio (8000). Las citas viven en el backend
// .NET (CitasController). Cubre RF-02/03/04 (solicitud + correo), RF-05 (agenda
// de la Fundacion), RF-07 (visita medica) y RF-12 (estado de pago por cita).

const PACIENTES_API_URL = "http://localhost:8000/api/Residentes";
const CITAS_API_URL = "/api/Citas";
const USUARIOS_API_URL = "/api/Auth/usuarios";
const DESCUENTO_API_URL = "/api/Config/descuento";

let mapaResidentes = {};      // idResidente -> { nombreCompleto, correoTutor }
let medicos = [];             // usuarios con rol DOCTOR
let porcentajeDescuento = 0;  // descuento de la fundacion (RF-10)

const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const rol = () => window.ROL_ACTUAL || localStorage.getItem("rol_usuario") || "";
const quetzales = n => "Q" + Number(n || 0).toFixed(2);

async function mensajeError(respuesta) {
    try {
        const datos = await respuesta.clone().json();
        return datos.message || datos.title || JSON.stringify(datos);
    } catch (e) {
        return (await respuesta.text()) || `Error ${respuesta.status}`;
    }
}

// La pagina arranca cuando roles.js confirma la sesion (para conocer el rol)
function iniciar() {
    cargarSelectResidentes();
    cargarMedicos();
    cargarDescuento();
    cargarSolicitudes();

    const form = document.getElementById("form-solicitud");
    if (form) form.addEventListener("submit", registrarSolicitud);
    const filtro = document.getElementById("filtro-estado");
    if (filtro) filtro.addEventListener("change", cargarSolicitudes);
}
if (window.ROL_ACTUAL) iniciar();
else document.addEventListener("sesion-lista", iniciar, { once: true });

async function cargarSelectResidentes() {
    const select = document.getElementById("select-residente-solicitud");
    if (!select) return;
    try {
        const respuesta = await fetch(PACIENTES_API_URL);
        if (!respuesta.ok) throw new Error("Error al cargar residentes");
        const residentes = await respuesta.json();

        select.innerHTML = '<option value="">-- Seleccionar Residente --</option>';
        residentes.forEach(r => {
            mapaResidentes[r.idResidente] = { nombreCompleto: r.nombreCompleto, correoTutor: r.correoTutor };
            const opcion = document.createElement("option");
            opcion.value = r.idResidente;
            opcion.textContent = `${r.noExpediente} - ${r.nombreCompleto}`;
            select.appendChild(opcion);
        });
        cargarSolicitudes(); // para mostrar nombres ya resueltos
    } catch (err) {
        console.error("Error al cargar residentes:", err);
        select.innerHTML = '<option value="">-- No se pudo conectar con pacientes_service --</option>';
    }
}

async function cargarMedicos() {
    try {
        const respuesta = await fetch(USUARIOS_API_URL);
        if (!respuesta.ok) return;
        const usuarios = await respuesta.json();
        medicos = usuarios.filter(u => u.rol === "DOCTOR");
        cargarSolicitudes();
    } catch (err) {
        console.error("Error al cargar médicos:", err);
    }
}

async function cargarDescuento() {
    try {
        const respuesta = await fetch(DESCUENTO_API_URL);
        if (respuesta.ok) porcentajeDescuento = (await respuesta.json()).porcentaje || 0;
    } catch (err) { /* sin descuento visible */ }
}

// ---------------------------------------------------------------- RF-02/03/04
async function registrarSolicitud(event) {
    event.preventDefault();

    const idResidente = document.getElementById("select-residente-solicitud").value;
    if (!idResidente) {
        mostrarModal("Falta información", "Seleccione un residente.", "error");
        return;
    }
    const info = mapaResidentes[idResidente] || {};

    const payload = {
        idPaciente: parseInt(idResidente, 10),
        especialidadSolicitada: document.getElementById("especialidad-solicitada").value,
        motivo: document.getElementById("motivo-remision").value,
        enfermeroAsignado: document.getElementById("enfermero-asignado").value || null,
        correoFamiliar: info.correoTutor || null,
    };

    try {
        const respuesta = await fetch(CITAS_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!respuesta.ok) {
            mostrarModal("Error del servidor", await mensajeError(respuesta), "error");
            return;
        }
        const aviso = info.correoTutor ? " Se envió un correo al familiar." : " El residente no tiene correo de tutor registrado.";
        mostrarModal("¡Éxito!", "Solicitud enviada a la Fundación." + aviso, "exito");
        document.getElementById("form-solicitud").reset();
        cerrarPaneles();
        cargarSolicitudes();
    } catch (err) {
        console.error("Error de red:", err);
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

// ---------------------------------------------------------------- listado
const COLORES_ESTADO = {
    Pendiente: ["#fce8e6", "#c5221f"],
    Agendada: ["#fff3cd", "#8a6d00"],
    Atendida: ["#e6f4ea", "#1e7e34"],
    Cancelada: ["#eee", "#666"],
};
const COLORES_PAGO = {
    Pendiente: ["#fce8e6", "#c5221f"],
    Pagado: ["#e6f4ea", "#1e7e34"],
    "Sin cargos": ["#eee", "#666"],
};

function etiqueta(texto, [fondo, color]) {
    return `<span style="background:${fondo}; color:${color}; padding:2px 10px; border-radius:12px; font-size:0.8rem; font-weight:bold; margin-left:8px;">${esc(texto)}</span>`;
}

async function cargarSolicitudes() {
    const contenedor = document.getElementById("contenedor-solicitudes");
    if (!contenedor) return;

    const filtro = (document.getElementById("filtro-estado") || {}).value || "";
    try {
        const respuesta = await fetch(CITAS_API_URL + (filtro ? `?estado=${encodeURIComponent(filtro)}` : ""));
        if (!respuesta.ok) throw new Error("Error al cargar solicitudes");
        const citas = await respuesta.json();

        if (!Array.isArray(citas) || citas.length === 0) {
            contenedor.innerHTML = "<p style='color:#777;'>No hay solicitudes para mostrar.</p>";
            return;
        }

        const puedeAgendar = ["ADMINISTRADOR", "FUNDACION"].includes(rol());
        const puedeAtender = ["ADMINISTRADOR", "DOCTOR"].includes(rol());

        contenedor.innerHTML = citas.map(c => {
            const nombre = (mapaResidentes[c.idPaciente] || {}).nombreCompleto || `Residente #${c.idPaciente}`;
            const medico = medicos.find(m => m.idUsuario === c.idDoctor);
            const fechaCita = c.fechaCita ? new Date(c.fechaCita).toLocaleString("es-GT") : "Sin agendar";

            let acciones = "";
            if (c.estado === "Pendiente" && puedeAgendar) {
                const opciones = medicos.map(m => `<option value="${m.idUsuario}">${esc(m.nombreCompleto)}</option>`).join("");
                acciones = `
                    <div class="fila-controles">
                        <div><label>Médico especialista</label>
                            <select id="agenda-medico-${c.idCita}"><option value="">-- Seleccionar --</option>${opciones}</select></div>
                        <div><label>Fecha y hora</label>
                            <input type="datetime-local" id="agenda-fecha-${c.idCita}"></div>
                        <button type="button" class="btn-guardar" onclick="agendarCita(${c.idCita})"><i class="fa-solid fa-calendar-plus"></i> Agendar cita</button>
                    </div>`;
            } else if (c.estado === "Agendada" && puedeAtender) {
                acciones = `<div style="margin-top:10px;"><button type="button" class="btn-guardar" onclick="abrirVisita(${c.idCita})"><i class="fa-solid fa-user-doctor"></i> Registrar visita médica</button></div>`;
            }

            let detalleVisita = "";
            if (c.estado === "Atendida") {
                detalleVisita = `
                    <p style="margin:2px 0;"><strong>Diagnóstico:</strong> ${esc(c.diagnosticoConsulta)}</p>
                    ${c.observaciones ? `<p style="margin:2px 0;"><strong>Observaciones:</strong> ${esc(c.observaciones)}</p>` : ""}
                    <p style="margin:2px 0;"><strong>Consulta:</strong> ${quetzales(c.costoTotal)}
                        ${etiqueta("Pago: " + c.estadoPago, COLORES_PAGO[c.estadoPago] || ["#eee", "#666"])}</p>`;
            }

            return `
                <div class="formulario-datos" style="margin-bottom: 10px;">
                    <p><strong>${esc(nombre)}</strong> - ${esc(c.especialidadSolicitada)}
                        ${etiqueta(c.estado, COLORES_ESTADO[c.estado] || ["#eee", "#666"])}</p>
                    <p style="margin:2px 0; color:#555;">${esc(c.motivo)}</p>
                    <p style="margin:2px 0; font-size:0.85rem; color:#777;">
                        Cita: ${esc(fechaCita)}${medico ? ` - Médico: ${esc(medico.nombreCompleto)}` : ""}
                        ${c.enfermeroAsignado ? ` - Acompaña: ${esc(c.enfermeroAsignado)}` : ""}
                    </p>
                    ${detalleVisita}
                    ${acciones}
                </div>`;
        }).join("");
    } catch (err) {
        console.error("Error al cargar solicitudes:", err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo conectar con el servidor.</p>";
    }
}

// ---------------------------------------------------------------- RF-05 agenda
async function agendarCita(idCita) {
    const idDoctor = document.getElementById(`agenda-medico-${idCita}`).value;
    const fecha = document.getElementById(`agenda-fecha-${idCita}`).value;
    if (!idDoctor || !fecha) {
        mostrarModal("Falta información", "Seleccione el médico especialista y la fecha y hora de la cita.", "error");
        return;
    }
    try {
        const respuesta = await fetch(`${CITAS_API_URL}/${idCita}/agendar`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fechaCita: fecha, idDoctor: parseInt(idDoctor, 10) }),
        });
        if (!respuesta.ok) {
            mostrarModal("No se pudo agendar", await mensajeError(respuesta), "error");
            return;
        }
        mostrarModal("¡Cita agendada!", "Se asignó el médico y el horario. El familiar recibió un aviso por correo.", "exito");
        cargarSolicitudes();
    } catch (err) {
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

// ---------------------------------------------------------------- RF-07 visita
function abrirVisita(idCita) {
    cerrarVisita();
    const nota = porcentajeDescuento > 0
        ? `Ingrese el <b>precio de lista</b>; el sistema aplica el descuento de la fundación (${porcentajeDescuento}%) y lo carga a la cuenta del familiar.`
        : "Ingrese el precio de la consulta; se carga a la cuenta del familiar.";

    document.body.insertAdjacentHTML("beforeend", `
        <div id="modalVisita" class="panel-fondo abierto" data-efimero>
            <div class="panel ancho" role="dialog" aria-modal="true">
                <div class="panel-cabecera">
                    <h2><i class="fa-solid fa-user-doctor"></i> Registrar visita médica</h2>
                    <button type="button" class="panel-cerrar" data-cerrar aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="panel-cuerpo">
                    <p>${nota}</p>
                    <form id="form-visita">
                        <div class="grupo-campo"><label>Diagnóstico:</label>
                            <textarea id="visita-diagnostico" rows="3" required></textarea></div>
                        <div class="fila-2">
                            <div class="grupo-campo"><label>Observaciones médicas:</label>
                                <input type="text" id="visita-observaciones"></div>
                            <div class="grupo-campo"><label>Precio de la consulta (Q):</label>
                                <input type="number" step="0.01" min="0" id="visita-precio" placeholder="0.00">
                                <small id="visita-final" style="color:#1e7e34;"></small></div>
                        </div>
                        <div class="fila-2">
                            <div class="grupo-campo"><label>Examen de laboratorio a solicitar (opcional):</label>
                                <input type="text" id="visita-examen" placeholder="Ej. Perfil lipídico"></div>
                            <div class="grupo-campo"><label>Medicamento a recetar (opcional):</label>
                                <input type="text" id="visita-medicamento" placeholder="Ej. Losartán 50mg"></div>
                        </div>
                        <div class="fila-2">
                            <div class="grupo-campo"><label>Cantidad:</label>
                                <input type="text" id="visita-cantidad" placeholder="Ej. 30 tabletas"></div>
                            <div class="grupo-campo"><label>Tiempo de aplicación:</label>
                                <input type="text" id="visita-tiempo" placeholder="Ej. 1 cada 12 h por 30 días"></div>
                        </div>
                        <div class="panel-pie">
                            <button type="button" class="btn-guardar btn-secundario" data-cerrar>Cancelar</button>
                            <button type="submit" class="btn-guardar"><i class="fa-solid fa-floppy-disk"></i> Guardar visita</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`);
    document.body.classList.add("panel-abierto");

    document.getElementById("visita-precio").addEventListener("input", e => {
        const lista = parseFloat(e.target.value) || 0;
        document.getElementById("visita-final").textContent =
            lista > 0 ? `Se cobrará ${quetzales(lista * (1 - porcentajeDescuento / 100))} al familiar.` : "";
    });
    document.getElementById("form-visita").addEventListener("submit", ev => guardarVisita(ev, idCita));
}

function cerrarVisita() {
    if (document.getElementById("modalVisita")) cerrarPanel("modalVisita");
}

async function guardarVisita(event, idCita) {
    event.preventDefault();
    const valor = id => document.getElementById(id).value.trim();
    const payload = {
        diagnosticoConsulta: valor("visita-diagnostico"),
        observaciones: valor("visita-observaciones") || null,
        precioLista: parseFloat(valor("visita-precio")) || 0,
        examenSolicitado: valor("visita-examen") || null,
        medicamento: valor("visita-medicamento") || null,
        cantidad: valor("visita-cantidad") || null,
        tiempoAplicacion: valor("visita-tiempo") || null,
    };
    try {
        const respuesta = await fetch(`${CITAS_API_URL}/${idCita}/completar`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!respuesta.ok) {
            mostrarModal("No se pudo registrar la visita", await mensajeError(respuesta), "error");
            return;
        }
        cerrarVisita();
        mostrarModal("¡Visita registrada!", "Los exámenes pasan a Laboratorio, el medicamento a Farmacia y la consulta se cargó a la cuenta del familiar.", "exito");
        cargarSolicitudes();
    } catch (err) {
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

// ---------------------------------------------------------------- modal general
function mostrarModal(titulo, mensaje, tipo) {
    let modalExistente = document.getElementById("customModal");
    if (modalExistente) modalExistente.remove();

    const colorIcono = tipo === "exito" ? "#2e7d32" : "#c62828";
    const icono = tipo === "exito" ? "fa-circle-check" : "fa-circle-xmark";

    const modalHTML = `
        <div id="customModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;">
            <div style="background: white; border-radius: 12px; padding: 25px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <i class="fa-solid ${icono}" style="font-size: 3rem; color: ${colorIcono}; margin-bottom: 15px;"></i>
                <h3 style="margin: 0 0 10px 0; color: #333;">${titulo}</h3>
                <p style="color: #666; margin-bottom: 20px; font-size: 0.95rem;">${esc(mensaje)}</p>
                <button onclick="cerrarModal()" style="background: ${colorIcono}; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                    Aceptar
                </button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML("beforeend", modalHTML);
}

function cerrarModal() {
    const modal = document.getElementById("customModal");
    if (modal) modal.remove();
}
