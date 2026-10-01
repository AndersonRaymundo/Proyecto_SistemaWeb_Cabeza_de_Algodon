// Solicitudes y Citas - Asilo Cabeza de Algodon
// Conecta con pacientes_service (8000) y solicitudes_citas_service (8004)

const PACIENTES_API_URL = "http://localhost:8000/api/Residentes";
const SOLICITUDES_API_URL = "http://localhost:8004/solicitudes";

let mapaResidentesSolicitud = {}; // idResidente -> { nombreCompleto, correoTutor }

document.addEventListener("DOMContentLoaded", () => {
    cargarSelectResidentes();
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

async function registrarSolicitud(event) {
    event.preventDefault();

    const idResidente = document.getElementById("select-residente-solicitud").value;
    if (!idResidente) {
        mostrarModal("Falta información", "Seleccione un residente.", "error");
        return;
    }

    const fechaHora = document.getElementById("fecha-hora-cita").value; // formato datetime-local
    const medicoAsignado = document.getElementById("medico-asignado-solicitud").value;
    const infoResidente = mapaResidentesSolicitud[idResidente] || {};

    const payload = {
        id_residente: parseInt(idResidente, 10),
        especialidad_solicitada: document.getElementById("especialidad-solicitada").value,
        motivo_remision: document.getElementById("motivo-remision").value,
        enfermero_asignado: document.getElementById("enfermero-asignado").value || null,
        medico_general: localStorage.getItem("nombre_usuario") || null,
        correo_familiar: infoResidente.correoTutor || null,
        fecha_hora_cita: fechaHora || null,
        medico_asignado: medicoAsignado || null,
    };

    try {
        const respuesta = await fetch(SOLICITUDES_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (respuesta.ok) {
            mostrarModal("¡Éxito!", "Solicitud registrada correctamente.", "exito");
            document.getElementById("form-solicitud").reset();
            cargarSolicitudes();
        } else {
            const errorTexto = await respuesta.text();
            mostrarModal("Error del servidor", errorTexto, "error");
        }
    } catch (err) {
        console.error("Error de red:", err);
        mostrarModal("Error de conexión", "No se pudo conectar con solicitudes_citas_service.", "error");
    }
}

async function cargarSolicitudes() {
    const contenedor = document.getElementById("contenedor-solicitudes");
    if (!contenedor) return;

    try {
        const respuesta = await fetch(SOLICITUDES_API_URL);
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
            const nombreResidente = (mapaResidentesSolicitud[s.id_residente] || {}).nombreCompleto || `Residente #${s.id_residente}`;
            const fechaCita = s.fecha_hora_cita ? new Date(s.fecha_hora_cita).toLocaleString("es-GT") : "Sin agendar";
            html += `
                <div class="formulario-datos" style="margin-bottom: 10px;">
                    <p><strong>${nombreResidente}</strong> - ${s.especialidad_solicitada}
                        <span style="background:${fondo}; color:${color}; padding:2px 10px; border-radius:12px; font-size:0.8rem; font-weight:bold; margin-left:8px;">${s.estado}</span>
                    </p>
                    <p style="margin:2px 0; color:#555;">${s.motivo_remision}</p>
                    <p style="margin:2px 0; font-size:0.85rem; color:#777;">
                        Cita: ${fechaCita}${s.medico_asignado ? ` - Médico: ${s.medico_asignado}` : ""}
                        ${s.enfermero_asignado ? ` - Enfermero: ${s.enfermero_asignado}` : ""}
                    </p>
                </div>
            `;
        });
        contenedor.innerHTML = html;
    } catch (err) {
        console.error("Error al cargar solicitudes:", err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo conectar con solicitudes_citas_service.</p>";
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
