// Laboratorio y Farmacia - Asilo Cabeza de Algodon
// Pacientes sigue siendo microservicio (8000). Examenes/medicamentos ahora
// viven en el backend .NET (LaboratorioFarmaciaController), mismo origen.

const PACIENTES_API_URL = "http://localhost:8000/api/Residentes";
const LABFARMACIA_API_URL = "/api/LaboratorioFarmacia";

document.addEventListener("DOMContentLoaded", () => {
    cargarSelectResidentes();
    cargarRegistros();

    const form = document.getElementById("form-lab-farmacia");
    if (form) form.addEventListener("submit", registrarExamenYFarmacia);
});

async function cargarSelectResidentes() {
    const select = document.getElementById("select-residente-lab");
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

async function registrarExamenYFarmacia(event) {
    event.preventDefault();

    const idResidente = document.getElementById("select-residente-lab").value;
    if (!idResidente) {
        mostrarModal("Falta información", "Seleccione un residente.", "error");
        return;
    }

    const nombreExamen = document.getElementById("nombre-examen").value;
    const medicamento = document.getElementById("medicamento").value;

    if (!nombreExamen && !medicamento) {
        mostrarModal("Falta información", "Ingrese al menos un examen o un medicamento.", "error");
        return;
    }

    const payload = {
        idPaciente: parseInt(idResidente, 10),
        tipoExamen: nombreExamen || null,
        resultados: document.getElementById("resultados-examen").value || null,
        costoExamen: parseFloat(document.getElementById("costo-examen").value) || 0,
        nombreMedicamento: medicamento || null,
        cantidad: document.getElementById("cantidad-medicamento").value || null,
        tiempoAplicacion: document.getElementById("dosis-instrucciones").value || null,
        costoMedicamento: parseFloat(document.getElementById("costo-medicamento").value) || 0,
    };

    try {
        const respuesta = await fetch(`${LABFARMACIA_API_URL}/registro-completo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (respuesta.ok) {
            mostrarModal("¡Éxito!", "Registro guardado correctamente.", "exito");
            document.getElementById("form-lab-farmacia").reset();
            cargarRegistros();
        } else {
            const errorTexto = await respuesta.text();
            mostrarModal("Error del servidor", errorTexto, "error");
        }
    } catch (err) {
        console.error("Error de red:", err);
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

async function cargarRegistros() {
    const contenedor = document.getElementById("contenedor-lab-farmacia");
    if (!contenedor) return;

    try {
        const [resExamenes, resMedicamentos] = await Promise.all([
            fetch(`${LABFARMACIA_API_URL}/examenes`),
            fetch(`${LABFARMACIA_API_URL}/medicamentos`),
        ]);

        const examenes = resExamenes.ok ? await resExamenes.json() : [];
        const medicamentos = resMedicamentos.ok ? await resMedicamentos.json() : [];

        if (examenes.length === 0 && medicamentos.length === 0) {
            contenedor.innerHTML = "<p style='color:#777;'>Aún no hay exámenes ni medicamentos registrados.</p>";
            return;
        }

        let html = "<h3>Exámenes</h3>";
        html += examenes.length
            ? examenes.map(e => `
                <p>#${e.idExamen} - ${e.tipoExamen} - Q${Number(e.costo).toFixed(2)}
                   ${e.resultados ? ` - Resultado: ${e.resultados}` : " - Pendiente"}</p>
              `).join("")
            : "<p style='color:#777;'>Sin exámenes registrados.</p>";

        html += "<h3>Medicamentos / Farmacia</h3>";
        html += medicamentos.length
            ? medicamentos.map(m => `
                <p>#${m.idMedicamento} - ${m.nombreMedicamento} ${m.tiempoAplicacion ? `(${m.tiempoAplicacion})` : ""} - Q${Number(m.costo).toFixed(2)}</p>
              `).join("")
            : "<p style='color:#777;'>Sin medicamentos registrados.</p>";

        contenedor.innerHTML = html;
    } catch (err) {
        console.error("Error al cargar registros:", err);
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
