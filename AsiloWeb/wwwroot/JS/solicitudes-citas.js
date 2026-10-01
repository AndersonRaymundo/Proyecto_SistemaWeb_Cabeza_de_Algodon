// Solicitudes y Citas - Asilo Cabeza de Algodon
// Pacientes sigue siendo microservicio (8000). Las citas ahora viven en el
// backend .NET (CitasController), mismo origen.

const PACIENTES_API_URL = "http://localhost:8000/api/Residentes";
const CITAS_API_URL = "/api/Citas";
const USUARIOS_API_URL = "/api/Auth/usuarios";

let mapaResidentesSolicitud = {}; // idResidente -> { nombreCompleto, correoTutor }

document.addEventListener("DOMContentLoaded", () => {
    cargarSelectResidentes();
    cargarSelectMedicos();
    cargarSolicitudes();

    const form = document.getElementById("form-solicitud");
    if (form) form.addEventListener("submit", registrarSolicitud);
});

async function cargarSelectResidentes() {
    const select = document.getElementById("select-residente-solicitud");
    if (!select) return;

    try {
        const respuesta = await fetch(PACIENTES_API_URL);
        if (!respuesta.ok) throw new Error("Error al cargar residentes");
        const residentes = await respuesta.json();

        select.innerHTML = '<option value="">-- Seleccionar Residente --</option>';
        residentes.forEach(r => {
            mapaResidentesSolicitud[r.idResidente] = {
                nombreCompleto: r.nombreCompleto,
                correoTutor: r.correoTutor,
            };
            const opcion = document.createElement("option");
            opcion.value = r.idResidente;
            opcion.textContent = `${r.noExpediente} - ${r.nombreCompleto}`;
            select.appendChild(opcion);
        });
    } catch (err) {
        console.error("Error al cargar residentes:", err);
        select.innerHTML = '<option value="">-- No se pudo conectar con pacientes_service --</option>';
    }
}

async function cargarSelectMedicos() {
    const select = document.getElementById("medico-asignado-solicitud");
    if (!select) return;

    try {
        const respuesta = await fetch(USUARIOS_API_URL);
        if (!respuesta.ok) throw new Error("Error al cargar usuarios");
        const usuarios = await respuesta.json();

        const medicos = usuarios.filter(u => u.rol === "DOCTOR");
        select.innerHTML = '<option value="">-- Sin asignar todavía --</option>';
        medicos.forEach(m => {
            const opcion = document.createElement("option");
            opcion.value = m.idUsuario;
            opcion.textContent = m.nombreCompleto;
            select.appendChild(opcion);
        });
    } catch (err) {
        console.error("Error al cargar médicos:", err);
    }
}

async function registrarSolicitud(event) {
    event.preventDefault();

    const idResidente = document.getElementById("select-residente-solicitud").value;
    if (!idResidente) {
        mostrarModal("Falta información", "Seleccione un residente.", "error");
        return;
    }

    const infoResidente = mapaResidentesSolicitud[idResidente] || {};

    const payload = {
        idPaciente: parseInt(idResidente, 10),
        especialidadSolicitada: document.getElementById("especialidad-solicitada").value,
        motivo: document.getElementById("motivo-remision").value,
        enfermeroAsignado: document.getElementById("enfermero-asignado").value || null,
        correoFamiliar: infoResidente.correoTutor || null,
    };

    try {
        const respuesta = await fetch(CITAS_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!respuesta.ok) {
            const errorTexto = await respuesta.text();
            mostrarModal("Error del servidor", errorTexto, "error");
            return;
        }

        const citaCreada = await respuesta.json();

        // Si ya se indicó fecha/hora y médico, se agenda de una vez.
        const fechaHora = document.getElementById("fecha-hora-cita").value;
        const idDoctor = document.getElementById("medico-asignado-solicitud").value;
        if (fechaHora && idDoctor) {
            await fetch(`${CITAS_API_URL}/${citaCreada.idCita}/agendar`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fechaCita: fechaHora, idDoctor: parseInt(idDoctor, 10) }),
            });
        }

        mostrarModal("¡Éxito!", "Solicitud registrada correctamente.", "exito");
        document.getElementById("form-solicitud").reset();
        cargarSolicitudes();
    } catch (err) {
        console.error("Error de red:", err);
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

async function cargarSolicitudes() {
    const contenedor = document.getElementById("contenedor-solicitudes");
    if (!contenedor) return;

    try {
        const respuesta = await fetch(CITAS_API_URL);
        if (!respuesta.ok) throw new Error("Error al cargar solicitudes");
        const solicitudes = await respuesta.json();

        if (!Array.isArray(solicitudes) || solicitudes.length === 0) {
            contenedor.innerHTML = "<p style='color:#777;'>Aún no hay solicitudes registradas.</p>";
            return;
        }

        const coloresEstado = {
            Pendiente: ["#fce8e6", "#c5221f"],
            Agendada: ["#fff3cd", "#8a6d00"],
            Atendida: ["#e6f4ea", "#1e7e34"],
            Cancelada: ["#eee", "#666"],
        };

        let html = "";
        solicitudes.forEach(s => {
            const [fondo, color] = coloresEstado[s.estado] || ["#eee", "#666"];
            const nombreResidente = (mapaResidentesSolicitud[s.idPaciente] || {}).nombreCompleto || `Residente #${s.idPaciente}`;
            const fechaCita = s.fechaCita ? new Date(s.fechaCita).toLocaleString("es-GT") : "Sin agendar";
            html += `
                <div class="formulario-datos" style="margin-bottom: 10px;">
                    <p><strong>${nombreResidente}</strong> - ${s.especialidadSolicitada}
                        <span style="background:${fondo}; color:${color}; padding:2px 10px; border-radius:12px; font-size:0.8rem; font-weight:bold; margin-left:8px;">${s.estado}</span>
                    </p>
                    <p style="margin:2px 0; color:#555;">${s.motivo}</p>
                    <p style="margin:2px 0; font-size:0.85rem; color:#777;">
                        Cita: ${fechaCita}
                        ${s.enfermeroAsignado ? ` - Enfermero: ${s.enfermeroAsignado}` : ""}
                    </p>
                </div>
            `;
        });
        contenedor.innerHTML = html;
    } catch (err) {
        console.error("Error al cargar solicitudes:", err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo conectar con el servidor.</p>";
    }
}

function mostrarModal(titulo, mensaje, tipo) {
    let modalExistente = document.getElementById("customModal");
    if (modalExistente) modalExistente.remove();

    const colorIcono = tipo === "exito" ? "#2e7d32" : "#c62828";
    const icono = tipo === "exito" ? "fa-circle-check" : "fa-circle-xmark";

    const modalHTML = `
        <div id="customModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;">
            <div style="background: white; border-radius: 12px; padding: 25px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <i class="fa-solid ${icono}" style="font-size: 3rem; color: ${colorIcono}; margin-bottom: 15px;"></i>
                <h3 style="margin: 0 0 10px 0; color: #333;">${titulo}</h3>
                <p style="color: #666; margin-bottom: 20px; font-size: 0.95rem;">${mensaje}</p>
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
