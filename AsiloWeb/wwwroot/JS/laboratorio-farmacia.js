// Laboratorio y Farmacia - Asilo Cabeza de Algodon
// Pacientes sigue siendo microservicio (8000). Examenes y medicamentos viven
// en el backend .NET (LaboratorioFarmaciaController).
// RF-08 laboratorio registra resultados | RF-09 farmacia despacha | RF-10 cobro automatico

const PACIENTES_API_URL = "/api/Pacientes";
const LF_API_URL = "/api/LaboratorioFarmacia";
const DESCUENTO_API_URL = "/api/Config/descuento";

let mapaResidentes = {};
let porcentajeDescuento = 0;

const fecha = f => (f ? new Date(f).toLocaleString("es-GT") : "-");
const nombreDe = id => (mapaResidentes[id] || {}).nombreCompleto || `Residente #${id}`;
const verLab = () => ["ADMINISTRADOR", "DOCTOR", "LABORATORIO"].includes(rol());
const verFarmacia = () => ["ADMINISTRADOR", "DOCTOR", "FARMACIA"].includes(rol());

async function iniciar() {
    // Cada rol ve solo su modulo (RNF-02)
    if (!verLab()) document.getElementById("tab-btn-lab").style.display = "none";
    if (!verFarmacia()) document.getElementById("tab-btn-farmacia").style.display = "none";
    if (!verLab()) activarPestana("seccion-farmacia");
    if (!(verLab() && verFarmacia())) document.querySelector(".pestanas").style.display = "none";

    await Promise.all([cargarResidentes(), cargarDescuento()]);
    if (verLab()) { cargarExamenes(); document.getElementById("form-examen-directo").addEventListener("submit", registrarExamenDirecto); }
    if (verFarmacia()) { cargarMedicamentos(); document.getElementById("form-medicamento-directo").addEventListener("submit", registrarMedicamentoDirecto); }

    previsualizar("precio-examen", "final-examen");
    previsualizar("precio-medicamento", "final-medicamento");
}
if (window.ROL_ACTUAL) iniciar();
else document.addEventListener("sesion-lista", iniciar, { once: true });

async function cargarDescuento() {
    try {
        const r = await fetch(DESCUENTO_API_URL);
        if (r.ok) porcentajeDescuento = (await r.json()).porcentaje || 0;
    } catch (e) { /* sin descuento visible */ }
    if (porcentajeDescuento > 0) {
        document.getElementById("nota-descuento").innerHTML =
            `Se ingresa el <b>precio de lista</b>; el sistema aplica el descuento de la fundación (${porcentajeDescuento}%) y lo carga a la cuenta del familiar.`;
    }
}

function previsualizar(idInput, idTexto) {
    const input = document.getElementById(idInput);
    if (!input) return;
    input.addEventListener("input", () => {
        const lista = parseFloat(input.value) || 0;
        document.getElementById(idTexto).textContent =
            lista > 0 ? `Se cobrará ${quetzales(lista * (1 - porcentajeDescuento / 100))} al familiar.` : "";
    });
}

async function cargarResidentes() {
    const selects = ["select-residente-examen", "select-residente-medicamento"].map(id => document.getElementById(id));
    try {
        const respuesta = await fetch(PACIENTES_API_URL);
        if (!respuesta.ok) throw new Error("Error al cargar residentes");
        const residentes = await respuesta.json();
        residentes.forEach(r => { mapaResidentes[r.idResidente] = r; });

        selects.forEach(select => {
            select.innerHTML = '<option value="">-- Seleccionar Residente --</option>' +
                residentes.map(r => `<option value="${r.idResidente}">${esc(r.noExpediente)} - ${esc(r.nombreCompleto)}</option>`).join("");
        });
    } catch (err) {
        console.error("Error al cargar residentes:", err);
        selects.forEach(s => { s.innerHTML = '<option value="">-- No se pudo conectar con pacientes_service --</option>'; });
    }
}

// ============================ LABORATORIO ============================
async function cargarExamenes() {
    const pend = document.getElementById("contenedor-examenes-pendientes");
    const hechos = document.getElementById("contenedor-examenes");
    try {
        const respuesta = await fetch(`${LF_API_URL}/examenes`);
        if (!respuesta.ok) throw new Error("Error al cargar exámenes");
        const examenes = await respuesta.json();

        const pendientes = examenes.filter(e => !e.resultados);
        const conResultado = examenes.filter(e => e.resultados);
        document.getElementById("contador-examenes").textContent = pendientes.length;

        pend.innerHTML = pendientes.length ? pendientes.map(e => `
            <div class="item-pendiente">
                <p><strong>${esc(nombreDe(e.idPaciente))}</strong> - ${esc(e.tipoExamen)}
                    <span style="color:#64748b; font-size:.82rem;">(solicitado ${fecha(e.fechaRegistro)})</span></p>
                ${(e.motivo || e.diagnostico || e.medico) ? `<p class="contexto-visita" style="color:#475569; font-size:.84rem; margin:2px 0 8px;">Visita${e.medico ? " de " + esc(e.medico) : ""}${e.motivo ? " · Motivo: " + esc(e.motivo) : ""}${e.diagnostico ? " · Diagnóstico: " + esc(e.diagnostico) : ""}</p>` : ""}
                <div class="fila-controles">
                    <div style="flex:2; min-width:220px;"><label>Resultado</label>
                        <input type="text" id="res-${e.idExamen}" placeholder="Reporte del laboratorio"></div>
                    <div style="width:150px;"><label>Precio de lista (Q)</label>
                        <input type="number" step="0.01" min="0" id="precio-ex-${e.idExamen}" placeholder="0.00"></div>
                    <button type="button" class="btn-guardar" style="margin-top:0;" onclick="registrarResultado(${e.idExamen})"><i class="fa-solid fa-check"></i> Registrar resultado</button>
                </div>
            </div>`).join("") : "<p style='color:#64748b; padding:8px 0;'>No hay exámenes pendientes.</p>";

        hechos.innerHTML = conResultado.length ? conResultado.map(e => `
            <div class="item-hecho">
                <span>${fecha(e.fechaRegistro)} - <strong>${esc(nombreDe(e.idPaciente))}</strong> - ${esc(e.tipoExamen)}: ${esc(e.resultados)}</span>
                <strong style="color:#15803d; white-space:nowrap;">${quetzales(e.costo)}</strong>
            </div>`).join("") : "<p style='color:#64748b; padding:8px 0;'>Aún no hay exámenes con resultado.</p>";
    } catch (err) {
        console.error(err);
        pend.innerHTML = "<p style='color:#c62828;'>No se pudo conectar con el servidor.</p>";
    }
}

async function registrarResultado(idExamen) {
    const resultados = document.getElementById(`res-${idExamen}`).value.trim();
    const precioLista = parseFloat(document.getElementById(`precio-ex-${idExamen}`).value) || 0;
    if (!resultados) {
        mostrarModal("Falta información", "Escriba el resultado del examen.", "error");
        return;
    }
    try {
        const respuesta = await fetch(`${LF_API_URL}/examenes/${idExamen}/resultado`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resultados, precioLista }),
        });
        if (!respuesta.ok) { mostrarModal("Error", await mensajeError(respuesta), "error"); return; }
        mostrarModal("¡Resultado registrado!", precioLista > 0 ? "El costo se cargó a la cuenta del familiar." : "Resultado guardado en el expediente.", "exito");
        cargarExamenes();
    } catch (err) {
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

async function registrarExamenDirecto(event) {
    event.preventDefault();
    const payload = {
        idPaciente: parseInt(document.getElementById("select-residente-examen").value, 10),
        tipoExamen: document.getElementById("nombre-examen").value.trim(),
        resultados: document.getElementById("resultados-examen").value.trim() || null,
        precioLista: parseFloat(document.getElementById("precio-examen").value) || 0,
    };
    if (!payload.idPaciente) { mostrarModal("Falta información", "Seleccione un residente.", "error"); return; }
    try {
        const respuesta = await fetch(`${LF_API_URL}/examenes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!respuesta.ok) { mostrarModal("Error", await mensajeError(respuesta), "error"); return; }
        mostrarModal("¡Éxito!", "Examen registrado y cargado a la cuenta del familiar.", "exito");
        document.getElementById("form-examen-directo").reset();
        document.getElementById("final-examen").textContent = "";
        cerrarPaneles();
        cargarExamenes();
    } catch (err) {
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

// ============================ FARMACIA ============================
async function cargarMedicamentos() {
    const pend = document.getElementById("contenedor-medicamentos-pendientes");
    const hechos = document.getElementById("contenedor-medicamentos");
    try {
        const respuesta = await fetch(`${LF_API_URL}/medicamentos`);
        if (!respuesta.ok) throw new Error("Error al cargar medicamentos");
        const medicamentos = await respuesta.json();

        const pendientes = medicamentos.filter(m => !m.despachado);
        const despachados = medicamentos.filter(m => m.despachado);
        document.getElementById("contador-medicamentos").textContent = pendientes.length;

        pend.innerHTML = pendientes.length ? pendientes.map(m => `
            <div class="item-pendiente">
                <p><strong>${esc(nombreDe(m.idPaciente))}</strong> - ${esc(m.nombreMedicamento)}
                    ${m.tiempoAplicacion ? `<span style="color:#64748b; font-size:.82rem;">(${esc(m.tiempoAplicacion)})</span>` : ""}</p>
                <div class="fila-controles">
                    <div style="width:180px;"><label>Cantidad</label>
                        <input type="text" id="cant-${m.idMedicamento}" value="${esc(m.cantidad || "")}"></div>
                    <div style="width:150px;"><label>Precio de lista (Q)</label>
                        <input type="number" step="0.01" min="0" id="precio-med-${m.idMedicamento}" placeholder="0.00"></div>
                    <button type="button" class="btn-guardar" style="margin-top:0;" onclick="despachar(${m.idMedicamento})"><i class="fa-solid fa-box-open"></i> Despachar</button>
                </div>
            </div>`).join("") : "<p style='color:#64748b; padding:8px 0;'>No hay medicamentos pendientes de despacho.</p>";

        hechos.innerHTML = despachados.length ? despachados.map(m => `
            <div class="item-hecho">
                <span>${fecha(m.fechaDespacho)} - <strong>${esc(nombreDe(m.idPaciente))}</strong> - ${esc(m.nombreMedicamento)}${m.cantidad ? ` - ${esc(m.cantidad)}` : ""}</span>
                <strong style="color:#15803d; white-space:nowrap;">${quetzales(m.costo)}</strong>
            </div>`).join("") : "<p style='color:#64748b; padding:8px 0;'>Aún no hay despachos.</p>";
    } catch (err) {
        console.error(err);
        pend.innerHTML = "<p style='color:#c62828;'>No se pudo conectar con el servidor.</p>";
    }
}

async function despachar(idMedicamento) {
    const precioLista = parseFloat(document.getElementById(`precio-med-${idMedicamento}`).value) || 0;
    const cantidad = document.getElementById(`cant-${idMedicamento}`).value.trim();
    try {
        const respuesta = await fetch(`${LF_API_URL}/medicamentos/${idMedicamento}/despachar`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ precioLista, cantidad: cantidad || null }),
        });
        if (!respuesta.ok) { mostrarModal("Error", await mensajeError(respuesta), "error"); return; }
        mostrarModal("¡Medicamento despachado!", precioLista > 0 ? "El costo se cargó a la cuenta del familiar." : "Despacho registrado.", "exito");
        cargarMedicamentos();
    } catch (err) {
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

async function registrarMedicamentoDirecto(event) {
    event.preventDefault();
    const payload = {
        idPaciente: parseInt(document.getElementById("select-residente-medicamento").value, 10),
        nombreMedicamento: document.getElementById("nombre-medicamento").value.trim(),
        cantidad: document.getElementById("cantidad-medicamento").value.trim() || null,
        tiempoAplicacion: document.getElementById("tiempo-medicamento").value.trim() || null,
        precioLista: parseFloat(document.getElementById("precio-medicamento").value) || 0,
    };
    if (!payload.idPaciente) { mostrarModal("Falta información", "Seleccione un residente.", "error"); return; }
    try {
        const respuesta = await fetch(`${LF_API_URL}/medicamentos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!respuesta.ok) { mostrarModal("Error", await mensajeError(respuesta), "error"); return; }
        mostrarModal("¡Éxito!", "Despacho registrado y cargado a la cuenta del familiar.", "exito");
        document.getElementById("form-medicamento-directo").reset();
        document.getElementById("final-medicamento").textContent = "";
        cerrarPaneles();
        cargarMedicamentos();
    } catch (err) {
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

