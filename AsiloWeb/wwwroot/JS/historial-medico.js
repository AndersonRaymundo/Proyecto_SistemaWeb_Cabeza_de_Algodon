// Historial Medico - Asilo Cabeza de Algodon
// Pacientes sigue siendo microservicio (8000). El registro clinico ahora
// vive en el backend .NET (CitasController), mismo origen.

const PACIENTES_BUSQUEDA_URL = "http://localhost:8000/api/Residentes/busqueda/autocomplete";
const CITAS_API_URL = "/api/Citas";

let tomSelectInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    // Inicializar TomSelect con el nuevo endpoint de búsqueda
    inicializarTomSelect();

    const form = document.getElementById("form-ficha-medica");
    if (form) {
        form.addEventListener("submit", registrarFicha);
    }
});

function inicializarTomSelect() {
    const selectElem = document.getElementById("select-paciente-historial");
    if (!selectElem) return;

    tomSelectInstance = new TomSelect('#select-paciente-historial', {
        valueField: 'id',
        labelField: 'text',
        searchField: 'text',
        placeholder: "Escriba el nombre o expediente...",
        load: function (query, callback) {
            if (!query.length) return callback();

            fetch(`${PACIENTES_BUSQUEDA_URL}?q=${encodeURIComponent(query)}`)
                .then(response => response.json())
                .then(json => callback(json))
                .catch(() => callback());
        },
        onChange: function (idResidente) {
            if (idResidente) {
                cargarHistorial(idResidente);
            } else {
                document.getElementById("contenedor-historial").innerHTML = "";
            }
        }
    });
}
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

async function cargarHistorial(idResidente) {
    const contenedor = document.getElementById("contenedor-historial");
    contenedor.innerHTML = "<p>Cargando expediente...</p>";

    try {
        const respuesta = await fetch(`${CITAS_API_URL}/residente/${idResidente}`);
        if (!respuesta.ok) throw new Error("Error al cargar el historial");
        const citas = await respuesta.json();

        if (!Array.isArray(citas) || citas.length === 0) {
            contenedor.innerHTML = "<p style='color:#777;'>Este residente aún no tiene consultas registradas.</p>";
            return;
        }

        let html = "";
        citas.forEach(c => {
            const fecha = new Date(c.fechaSolicitud).toLocaleString("es-GT");
            html += `
                <div class="formulario-datos" style="margin-bottom: 12px;">
                    <p><strong>Fecha:</strong> ${fecha}</p>
                    <p><strong>Motivo:</strong> ${c.motivo}</p>
                    ${c.diagnosticoConsulta ? `<p><strong>Diagnóstico:</strong> ${c.diagnosticoConsulta}</p>` : ""}
                    ${c.observaciones ? `<p><strong>Observaciones:</strong> ${c.observaciones}</p>` : ""}
                    <p style="font-size:0.85rem;color:#777;">Estado: ${c.estado}</p>
                </div>
            `;
        });
        contenedor.innerHTML = html;
    } catch (err) {
        console.error("Error al cargar el historial:", err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo cargar el historial.</p>";
    }
}

async function registrarFicha(event) {
    event.preventDefault();
                                   
    const select = document.getElementById("select-paciente-historial");
   // Obtiene el valor seleccionado desde TomSelect
const idResidente = tomSelectInstance ? tomSelectInstance.getValue() : document.getElementById("select-paciente-historial").value;

    if (!idResidente) {
        mostrarModal("Falta información", "Seleccione primero un residente.", "error");
        return;
    }

    const idDoctorGuardado = parseInt(localStorage.getItem("id_usuario"), 10);

    const payload = {
        idPaciente: parseInt(idResidente, 10),
        idDoctor: Number.isNaN(idDoctorGuardado) ? null : idDoctorGuardado,
        motivo: document.getElementById("motivo").value,
        diagnosticoConsulta: document.getElementById("diagnostico").value,
        tratamiento: document.getElementById("tratamiento").value,
        observaciones: document.getElementById("observaciones").value || null,
    };

    try {
        const respuesta = await fetch(`${CITAS_API_URL}/registro-directo`, {
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
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
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
