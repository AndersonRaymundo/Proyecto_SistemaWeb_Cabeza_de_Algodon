// Laboratorio y Farmacia - Asilo Cabeza de Algodon
// Conecta con pacientes_service (8000), historial_medico_service (8003)
// y laboratorio_farmacia_service (8005)

const PACIENTES_API_URL = "http://localhost:8000/api/Residentes";
const VISITAS_API_URL = "http://localhost:8003/visitas";
const LABFARMACIA_API_URL = "http://localhost:8005";

let mapaResidentes = {}; // idResidente -> nombreCompleto
let mapaVisitas = {};    // idVisita -> idResidente

document.addEventListener("DOMContentLoaded", () => {
    cargarSelectVisitas();
    cargarRegistros();

    const form = document.getElementById("form-lab-farmacia");
    if (form) form.addEventListener("submit", registrarExamenYFarmacia);
});

async function cargarSelectVisitas() {
    const select = document.getElementById("select-visita-lab");
    if (!select) return;

    try {
        const [resResidentes, resVisitas] = await Promise.all([
            fetch(PACIENTES_API_URL),
            fetch(VISITAS_API_URL),
        ]);

        const residentes = resResidentes.ok ? await resResidentes.json() : [];
        residentes.forEach(r => { mapaResidentes[r.idResidente] = r.nombreCompleto; });

        const visitas = resVisitas.ok ? await resVisitas.json() : [];

        select.innerHTML = '<option value="">-- Seleccionar Consulta --</option>';
        visitas.forEach(v => {
            mapaVisitas[v.id_visita] = v.id_residente;
            const nombre = mapaResidentes[v.id_residente] || `Residente #${v.id_residente}`;
            const opcion = document.createElement("option");
            opcion.value = v.id_visita;
            opcion.textContent = `Consulta #${v.id_visita} - ${nombre} (${v.motivo_visita})`;
            select.appendChild(opcion);
        });
    } catch (err) {
        console.error("Error al cargar consultas:", err);
        select.innerHTML = '<option value="">-- No se pudo conectar con los microservicios --</option>';
    }
}

async function registrarExamenYFarmacia(event) {
    event.preventDefault();

    const idVisita = document.getElementById("select-visita-lab").value;
    if (!idVisita) {
        mostrarModal("Falta información", "Seleccione una consulta/visita médica.", "error");
        return;
    }

    const idResidente = mapaVisitas[idVisita];
    const nombreExamen = document.getElementById("nombre-examen").value;
    const medicamento = document.getElementById("medicamento").value;

    if (!nombreExamen && !medicamento) {
        mostrarModal("Falta información", "Ingrese al menos un examen o un medicamento.", "error");
        return;
    }

    const payload = {
        id_visita: parseInt(idVisita, 10),
        id_residente: idResidente,
        nombre_examen: nombreExamen || null,
        resultados: document.getElementById("resultados-examen").value || null,
        costo_examen: parseFloat(document.getElementById("costo-examen").value) || 0,
        medicamento: medicamento || null,
        dosis_instrucciones: document.getElementById("dosis-instrucciones").value || null,
        cantidad: document.getElementById("cantidad-medicamento").value || null,
        costo_medicamento: parseFloat(document.getElementById("costo-medicamento").value) || 0,
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
        mostrarModal("Error de conexión", "No se pudo conectar con laboratorio_farmacia_service.", "error");
    }
}

async function cargarRegistros() {
    const contenedor = document.getElementById("contenedor-lab-farmacia");
    if (!contenedor) return;

    try {
        const [resExamenes, resRecetas] = await Promise.all([
            fetch(`${LABFARMACIA_API_URL}/examenes`),
            fetch(`${LABFARMACIA_API_URL}/recetas`),
        ]);

        const examenes = resExamenes.ok ? await resExamenes.json() : [];
        const recetas = resRecetas.ok ? await resRecetas.json() : [];

        if (examenes.length === 0 && recetas.length === 0) {
            contenedor.innerHTML = "<p style='color:#777;'>Aún no hay exámenes ni recetas registrados.</p>";
            return;
        }

        let html = "<h3>Exámenes</h3>";
        html += examenes.length
            ? examenes.map(e => `
                <p>#${e.id_examen} - ${e.nombre_examen} - Q${Number(e.costo).toFixed(2)}
                   ${e.resultados ? ` - Resultado: ${e.resultados}` : " - Pendiente"}</p>
              `).join("")
            : "<p style='color:#777;'>Sin exámenes registrados.</p>";

        html += "<h3>Recetas / Farmacia</h3>";
        html += recetas.length
            ? recetas.map(r => `
                <p>#${r.id_receta} - ${r.medicamento} ${r.dosis_instrucciones ? `(${r.dosis_instrucciones})` : ""} - Q${Number(r.costo).toFixed(2)}</p>
              `).join("")
            : "<p style='color:#777;'>Sin recetas registradas.</p>";

        contenedor.innerHTML = html;
    } catch (err) {
        console.error("Error al cargar registros:", err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo conectar con laboratorio_farmacia_service.</p>";
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
