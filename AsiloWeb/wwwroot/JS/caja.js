// Caja y Finanzas - Asilo Cabeza de Algodon
// Pacientes sigue siendo microservicio (8000). Caja vive en el backend .NET
// (CajaController). RF-12 (citas no canceladas), RF-13 (donaciones, cuotas y
// gastos) y RF-11 (deuda con la fundacion, calculada en el resumen).

const PACIENTES_API_URL = "http://localhost:8000/api/Residentes";
const CAJA_API_URL = "/api/Caja";

let mapaResidentes = {};

const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const quetzales = n => "Q" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fecha = f => (f ? new Date(f).toLocaleDateString("es-GT") : "-");
const nombreDe = id => (mapaResidentes[id] || {}).nombreCompleto || `Residente #${id}`;

async function mensajeError(respuesta) {
    try {
        const d = await respuesta.clone().json();
        return d.message || d.title || JSON.stringify(d);
    } catch (e) {
        return (await respuesta.text()) || `Error ${respuesta.status}`;
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("form-cobro").addEventListener("submit", registrarCobro);
    document.getElementById("form-donacion").addEventListener("submit", registrarDonacion);
    document.getElementById("form-gasto").addEventListener("submit", registrarGasto);
    document.getElementById("filtro-cobros").addEventListener("change", cargarCobros);

    await cargarResidentes();      // primero los nombres, para que las listas los muestren
    refrescarTodo();
});

function refrescarTodo() {
    cargarResumen();
    cargarCitasPendientes();
    cargarCobros();
    cargarDonaciones();
    cargarGastos();
}

async function cargarResidentes() {
    const select = document.getElementById("select-residente-caja");
    try {
        const respuesta = await fetch(PACIENTES_API_URL);
        if (!respuesta.ok) throw new Error("Error al cargar residentes");
        const residentes = await respuesta.json();
        residentes.forEach(r => { mapaResidentes[r.idResidente] = r; });
        select.innerHTML = '<option value="">-- Seleccionar Residente --</option>' +
            residentes.map(r => `<option value="${r.idResidente}">${esc(r.noExpediente)} - ${esc(r.nombreCompleto)}</option>`).join("");
    } catch (err) {
        console.error("Error al cargar residentes:", err);
        select.innerHTML = '<option value="">-- No se pudo conectar con pacientes_service --</option>';
    }
}

// ------------------------------------------------------------ resumen
async function cargarResumen() {
    const contenedor = document.getElementById("contenedor-resumen-caja");
    try {
        const respuesta = await fetch(`${CAJA_API_URL}/resumen`);
        if (!respuesta.ok) throw new Error("Error al cargar el resumen");
        const r = await respuesta.json();

        const tarjeta = (titulo, valor, color) => `
            <div class="kpi ${color}">
                <span>${titulo}</span>
                <strong>${quetzales(valor)}</strong>
            </div>`;

        contenedor.innerHTML = `<div class="kpi-grid">
            ${tarjeta("Donaciones", r.totalDonaciones, "verde")}
            ${tarjeta("Cobros cancelados", r.totalPagosCancelados, "verde")}
            ${tarjeta("Cobros pendientes", r.totalPagosPendientes, "rojo")}
            ${tarjeta("Gastos", r.totalGastos, "rojo")}
            ${tarjeta("Deuda con la Fundación", r.deudaConFundacion, "ambar")}
            ${tarjeta("Balance", r.balance, "azul")}
        </div>`;
    } catch (err) {
        console.error(err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo cargar el resumen.</p>";
    }
}

// ------------------------------------------------------------ RF-12 citas por cobrar
async function cargarCitasPendientes() {
    const contenedor = document.getElementById("contenedor-citas-pendientes");
    try {
        const respuesta = await fetch(`${CAJA_API_URL}/citas-pendientes-pago`);
        if (!respuesta.ok) throw new Error("Error al cargar citas pendientes");
        const citas = await respuesta.json();

        if (!citas.length) {
            contenedor.innerHTML = "<p style='color:#2e7d32;'>No hay citas con saldo pendiente. Todo está al día.</p>";
            return;
        }
        const total = citas.reduce((s, c) => s + c.saldoPendiente, 0);
        contenedor.innerHTML = citas.map(c => `
            <div class="fila-movimiento">
                <div><strong>${esc(nombreDe(c.idPaciente))}</strong> - ${esc(c.especialidadSolicitada)}
                    <span style="color:#777; font-size:0.85rem;">(cita ${fecha(c.fechaCita)})</span></div>
                <div class="monto rojo">${quetzales(c.saldoPendiente)}</div>
            </div>`).join("") +
            `<p style="text-align:right; margin-top:8px;"><strong>Total por cobrar en citas: ${quetzales(total)}</strong></p>`;
    } catch (err) {
        console.error(err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo cargar el control de citas.</p>";
    }
}

// ------------------------------------------------------------ cobros
async function registrarCobro(event) {
    event.preventDefault();
    const idResidente = document.getElementById("select-residente-caja").value;
    if (!idResidente) { mostrarModal("Falta información", "Seleccione un residente.", "error"); return; }

    const tipo = document.getElementById("tipo-cobro").value;
    const detalle = document.getElementById("concepto-cobro").value.trim();

    await enviar(`${CAJA_API_URL}/pagos`, {
        idPaciente: parseInt(idResidente, 10),
        conceptoPago: detalle ? `${tipo} - ${detalle}` : tipo,
        monto: parseFloat(document.getElementById("monto-cobro").value) || 0,
    }, "Cobro registrado correctamente.", "form-cobro");
}

async function cargarCobros() {
    const contenedor = document.getElementById("contenedor-cobros");
    const filtro = document.getElementById("filtro-cobros").value;
    try {
        const respuesta = await fetch(`${CAJA_API_URL}/pagos` + (filtro ? `?estado=${filtro}` : ""));
        if (!respuesta.ok) throw new Error("Error al cargar cobros");
        const pagos = await respuesta.json();

        if (!pagos.length) { contenedor.innerHTML = "<p style='color:#777;'>No hay cobros para mostrar.</p>"; return; }

        contenedor.innerHTML = pagos.map(p => {
            const pagado = p.estado === "Pagado";
            return `
            <div class="formulario-datos" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <div>
                    <p style="margin:0;"><strong>${esc(p.conceptoPago)}</strong> - ${quetzales(p.monto)}</p>
                    <p style="margin:0; font-size:0.85rem; color:#777;">${esc(nombreDe(p.idPaciente))} - ${fecha(p.fechaPago)}</p>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="background:${pagado ? "#e6f4ea" : "#fce8e6"}; color:${pagado ? "#1e7e34" : "#c5221f"}; padding:4px 10px; border-radius:12px; font-size:0.85rem; font-weight:bold;">${pagado ? "Cancelado" : "Pendiente"}</span>
                    ${pagado ? "" : `<button onclick="marcarPagado(${p.idPago})" class="btn-guardar" style="padding:6px 10px;" title="Marcar como cancelado"><i class="fa-solid fa-check"></i></button>`}
                </div>
            </div>`;
        }).join("");
    } catch (err) {
        console.error(err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudieron cargar los cobros.</p>";
    }
}

async function marcarPagado(idPago) {
    try {
        const respuesta = await fetch(`${CAJA_API_URL}/pagos/${idPago}/estado`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: "Pagado" }),
        });
        if (respuesta.ok) refrescarTodo();
        else mostrarModal("Error", await mensajeError(respuesta), "error");
    } catch (err) {
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

// ------------------------------------------------------------ donaciones (RF-13)
async function registrarDonacion(event) {
    event.preventDefault();
    await enviar(`${CAJA_API_URL}/donaciones`, {
        donante: document.getElementById("donante").value.trim(),
        tipoDonacion: document.getElementById("tipo-donacion").value,
        monto: parseFloat(document.getElementById("monto-donacion").value) || 0,
    }, "Donación registrada correctamente.", "form-donacion");
}

async function cargarDonaciones() {
    const contenedor = document.getElementById("contenedor-donaciones");
    try {
        const respuesta = await fetch(`${CAJA_API_URL}/donaciones`);
        if (!respuesta.ok) throw new Error("Error al cargar donaciones");
        const donaciones = await respuesta.json();
        contenedor.innerHTML = donaciones.length ? donaciones.map(d => `
            <div class="fila-movimiento">
                <div><strong>${esc(d.donante)}</strong> <span style="color:#777; font-size:0.85rem;">(${esc(d.tipoDonacion)} - ${fecha(d.fechaDonacion)})</span></div>
                <div class="monto verde">${quetzales(d.monto)}</div>
            </div>`).join("") : "<p style='color:#777;'>Aún no hay donaciones registradas.</p>";
    } catch (err) {
        console.error(err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudieron cargar las donaciones.</p>";
    }
}

// ------------------------------------------------------------ gastos (RF-13)
async function registrarGasto(event) {
    event.preventDefault();
    await enviar(`${CAJA_API_URL}/gastos`, {
        concepto: document.getElementById("concepto-gasto").value.trim(),
        monto: parseFloat(document.getElementById("monto-gasto").value) || 0,
    }, "Gasto registrado correctamente.", "form-gasto");
}

async function cargarGastos() {
    const contenedor = document.getElementById("contenedor-gastos");
    try {
        const respuesta = await fetch(`${CAJA_API_URL}/gastos`);
        if (!respuesta.ok) throw new Error("Error al cargar gastos");
        const gastos = await respuesta.json();
        contenedor.innerHTML = gastos.length ? gastos.map(g => `
            <div class="fila-movimiento">
                <div><strong>${esc(g.concepto)}</strong> <span style="color:#777; font-size:0.85rem;">(${fecha(g.fecha)})</span></div>
                <div class="monto rojo">${quetzales(g.monto)}</div>
            </div>`).join("") : "<p style='color:#777;'>Aún no hay gastos registrados.</p>";
    } catch (err) {
        console.error(err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudieron cargar los gastos.</p>";
    }
}

// ------------------------------------------------------------ comunes
async function enviar(url, payload, mensajeExito, idFormulario) {
    try {
        const respuesta = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!respuesta.ok) { mostrarModal("Error del servidor", await mensajeError(respuesta), "error"); return; }
        mostrarModal("¡Éxito!", mensajeExito, "exito");
        document.getElementById(idFormulario).reset();
        cerrarPaneles();
        refrescarTodo();
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
