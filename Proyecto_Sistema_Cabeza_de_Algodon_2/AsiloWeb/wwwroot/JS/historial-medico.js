// Historial Medico - Asilo Cabeza de Algodon
// Conecta con pacientes_service (8000) y historial_medico_service (8003)

const PACIENTES_API_URL = "http://localhost:8000/api/Residentes";
const HISTORIAL_API_URL = "http://localhost:8003/visitas";

document.addEventListener("DOMContentLoaded", () => {
    cargarSelectResidentes();

    const selectPaciente = document.getElementById("select-paciente-historial");
    if (selectPaciente) {
        selectPaciente.addEventListener("change", () => {
            if (selectPaciente.value) {
                cargarHistorial(selectPaciente.value);
            } else {
                document.getElementById("contenedor-historial").innerHTML = "";
            }
        });
    }

    const form = document.getElementById("form-ficha-medica");
    if (form) {
        form.addEventListener("submit", registrarFicha);
    }
});

// Cargar residentes en el <select>
async function cargarSelectResidentes() {
    const select = document.getElementById("select-paciente-historial");
    if (!select) return;

    try {
        const respuesta = await fetch(PACIENTES_API_URL);
        if (!respuesta.ok) throw new Error("Error al cargar residentes");
        const residentes = await respuesta.json();

        select.innerHTML = '<option value="">-- Seleccionar Residente --</option>';
        residentes.forEach(r => {
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

// Cargar el historial (fichas/visitas) de un residente
async function cargarHistorial(idResidente) {
    const contenedor = document.getElementById("contenedor-historial");
    contenedor.innerHTML = "<p>Cargando expediente...</p>";

    try {
        const respuesta = await fetch(`${HISTORIAL_API_URL}/residente/${idResidente}`);
        if (!respuesta.ok) throw new Error("Error al cargar el historial");
        const visitas = await respuesta.json();

        if (!Array.isArray(visitas) || visitas.length === 0) {
            contenedor.innerHTML = "<p style='color:#777;'>Este residente aún no tiene fichas registradas.</p>";
            return;
        }

        let html = "";
        visitas.forEach(v => {
            const fecha = new Date(v.fecha_visita).toLocaleString("es-GT");
            html += `
                <div class="formulario-datos" style="margin-bottom: 12px;">
                    <p><strong>Fecha:</strong> ${fecha}</p>
                    <p><strong>Motivo:</strong> ${v.motivo_visita}</p>
                    <p><strong>Médico tratante:</strong> ${v.medico_tratante}</p>
                    <p><strong>Diagnóstico:</strong> ${v.diagnostico}</p>
                    ${v.medicamento_aplicado ? `<p><strong>Tratamiento:</strong> ${v.medicamento_aplicado}</p>` : ""}
                    ${v.observaciones ? `<p><strong>Observaciones:</strong> ${v.observaciones}</p>` : ""}
                </div>
            `;
        });
        contenedor.innerHTML = html;
    } catch (err) {
        console.error("Error al cargar el historial:", err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo conectar con historial_medico_service.</p>";
    }
}

// Registrar una nueva ficha clínica
async function registrarFicha(event) {
    event.preventDefault();

    const select = document.getElementById("select-paciente-historial");
    const idResidente = select.value;

    if (!idResidente) {
        mostrarModal("Falta información", "Seleccione primero un residente.", "error");
        return;
    }

    const payload = {
        id_residente: parseInt(idResidente, 10),
        motivo_visita: document.getElementById("motivo").value,
        medico_tratante: localStorage.getItem("nombre_usuario") || "Médico no identificado",
        diagnostico: document.getElementById("diagnostico").value,
        medicamento_aplicado: document.getElementById("tratamiento").value,
        observaciones: document.getElementById("observaciones").value || null,
    };

    try {
        const respuesta = await fetch(HISTORIAL_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (respuesta.ok) {
            mostrarModal("¡Éxito!", "Ficha clínica registrada correctamente.", "exito");
            document.getElementById("form-ficha-medica").reset();
            cargarHistorial(idResidente);
        } else {
            const errorTexto = await respuesta.text();
            mostrarModal("Error del servidor", errorTexto, "error");
        }
    } catch (err) {
        console.error("Error de red:", err);
        mostrarModal("Error de conexión", "No se pudo conectar con historial_medico_service.", "error");
    }
}

// Modal reutilizable (mismo estilo que pacientes.js)
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
