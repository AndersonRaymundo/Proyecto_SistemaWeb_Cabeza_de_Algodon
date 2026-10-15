// ===========================================================================
// Funciones comunes a todas las pantallas.
// Se carga antes que el script de cada pantalla (no se usa en el inicio de sesion).
// ===========================================================================

// Escapa un texto antes de mostrarlo como HTML.
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 1234.5  ->  "Q1,234.50"
const quetzales = n => "Q" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Rol de quien inicio sesion.
const rol = () => window.ROL_ACTUAL || localStorage.getItem("rol_usuario") || "";

// Texto del error que devolvio el servidor.
async function mensajeError(respuesta) {
    try {
        const datos = await respuesta.clone().json();
        return datos.message || datos.title || JSON.stringify(datos);
    } catch (e) {
        return (await respuesta.text()) || `Error ${respuesta.status}`;
    }
}

// Ventana de aviso: tipo "exito" o "error".
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
