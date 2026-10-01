// Caja y Finanzas - Asilo Cabeza de Algodon
// Conecta con pacientes_service (8000) y caja_service (8006)

const PACIENTES_API_URL = "http://localhost:8000/api/Residentes";
const CAJA_API_URL = "http://localhost:8006";

document.addEventListener("DOMContentLoaded", () => {
    cargarSelectResidentes();
    cargarResumen();
    cargarCobros();

    const form = document.getElementById("form-cobro");
    if (form) form.addEventListener("submit", registrarCobro);
});

async function cargarSelectResidentes() {
    const select = document.getElementById("select-residente-caja");
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

async function registrarCobro(event) {
    event.preventDefault();

    const idResidente = document.getElementById("select-residente-caja").value;
    if (!idResidente) {
        mostrarModal("Falta información", "Seleccione un residente.", "error");
        return;
    }

    const payload = {
        id_residente: parseInt(idResidente, 10),
        tipo: document.getElementById("tipo-cobro").value,
        concepto: document.getElementById("concepto-cobro").value,
        monto: parseFloat(document.getElementById("monto-cobro").value) || 0,
        estado: "Pendiente",
    };

    try {
        const respuesta = await fetch(`${CAJA_API_URL}/cobros`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (respuesta.ok) {
            mostrarModal("¡Éxito!", "Transacción registrada correctamente.", "exito");
            document.getElementById("form-cobro").reset();
            cargarCobros();
            cargarResumen();
        } else {
            const errorTexto = await respuesta.text();
            mostrarModal("Error del servidor", errorTexto, "error");
        }
    } catch (err) {
        console.error("Error de red:", err);
        mostrarModal("Error de conexión", "No se pudo conectar con caja_service.", "error");
    }
}

async function cargarResumen() {
    const contenedor = document.getElementById("contenedor-resumen-caja");
    if (!contenedor) return;

    try {
        const respuesta = await fetch(`${CAJA_API_URL}/resumen`);
        if (!respuesta.ok) throw new Error("Error al cargar el resumen");
        const r = await respuesta.json();

        contenedor.innerHTML = `
            <div style="display:flex; gap:16px; flex-wrap:wrap;">
                <div class="formulario-datos" style="flex:1; min-width:150px; text-align:center;">
                    <p style="margin:0; color:#777;">Donaciones</p>
                    <p style="margin:0; font-size:1.4rem; font-weight:bold; color:#2e7d32;">Q${r.total_donaciones.toFixed(2)}</p>
                </div>
                <div class="formulario-datos" style="flex:1; min-width:150px; text-align:center;">
                    <p style="margin:0; color:#777;">Cobros Pagados</p>
                    <p style="margin:0; font-size:1.4rem; font-weight:bold; color:#2e7d32;">Q${r.total_cobros_pagados.toFixed(2)}</p>
                </div>
                <div class="formulario-datos" style="flex:1; min-width:150px; text-align:center;">
                    <p style="margin:0; color:#777;">Cobros Pendientes</p>
                    <p style="margin:0; font-size:1.4rem; font-weight:bold; color:#c62828;">Q${r.total_cobros_pendientes.toFixed(2)}</p>
                </div>
                <div class="formulario-datos" style="flex:1; min-width:150px; text-align:center;">
                    <p style="margin:0; color:#777;">Gastos</p>
                    <p style="margin:0; font-size:1.4rem; font-weight:bold; color:#c62828;">Q${r.total_gastos.toFixed(2)}</p>
                </div>
                <div class="formulario-datos" style="flex:1; min-width:150px; text-align:center;">
                    <p style="margin:0; color:#777;">Balance</p>
                    <p style="margin:0; font-size:1.4rem; font-weight:bold; color:#2c3e50;">Q${r.balance.toFixed(2)}</p>
                </div>
            </div>
        `;
    } catch (err) {
        console.error("Error al cargar el resumen:", err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo conectar con caja_service.</p>";
    }
}

async function cargarCobros() {
    const contenedor = document.getElementById("contenedor-cobros");
    if (!contenedor) return;

    try {
        const respuesta = await fetch(`${CAJA_API_URL}/cobros`);
        if (!respuesta.ok) throw new Error("Error al cargar cobros");
        const cobros = await respuesta.json();

        if (!Array.isArray(cobros) || cobros.length === 0) {
            contenedor.innerHTML = "<p style='color:#777;'>Aún no hay cobros registrados.</p>";
            return;
        }

        let html = "";
        cobros.forEach(c => {
            const fecha = new Date(c.fecha).toLocaleDateString("es-GT");
            const colorEstado = c.estado === "Pagado" ? "#1e7e34" : "#c5221f";
            const fondoEstado = c.estado === "Pagado" ? "#e6f4ea" : "#fce8e6";
            html += `
                <div class="formulario-datos" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <div>
                        <p style="margin:0;"><strong>${c.concepto}</strong> (${c.tipo}) - Q${Number(c.monto).toFixed(2)}</p>
                        <p style="margin:0; font-size:0.85rem; color:#777;">Residente #${c.id_residente} - ${fecha}</p>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="background:${fondoEstado}; color:${colorEstado}; padding:4px 10px; border-radius:12px; font-size:0.85rem; font-weight:bold;">${c.estado}</span>
                        ${c.estado === "Pendiente" ? `<button onclick="marcarPagado(${c.id_cobro})" class="btn-guardar" style="padding:6px 10px;"><i class="fa-solid fa-check"></i></button>` : ""}
                    </div>
                </div>
            `;
        });
        contenedor.innerHTML = html;
    } catch (err) {
        console.error("Error al cargar cobros:", err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo conectar con caja_service.</p>";
    }
}

async function marcarPagado(idCobro) {
    try {
        const respuesta = await fetch(`${CAJA_API_URL}/cobros/${idCobro}/estado`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: "Pagado" }),
        });

        if (respuesta.ok) {
            cargarCobros();
            cargarResumen();
        } else {
            mostrarModal("Error", "No se pudo actualizar el cobro.", "error");
        }
    } catch (err) {
        console.error("Error al marcar como pagado:", err);
        mostrarModal("Error de conexión", "No se pudo conectar con caja_service.", "error");
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
