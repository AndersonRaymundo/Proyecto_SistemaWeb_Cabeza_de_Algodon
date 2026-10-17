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
        return datos.message || (typeof datos.detail === "string" ? datos.detail : "") || datos.title || JSON.stringify(datos);
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

// Texto sin tildes ni mayusculas, para comparar al buscar.
const normalizarTexto = t => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// ===========================================================================
// Selector con busqueda. Convierte un <select> largo (por ejemplo, el de residentes)
// en un campo donde se escribe parte del nombre o del expediente y se elige de la lista.
// El <select> original se conserva (oculto) y sigue guardando el valor elegido.
// ===========================================================================
function hacerBuscable(selectOId) {
    const select = typeof selectOId === "string" ? document.getElementById(selectOId) : selectOId;
    if (!select || select.dataset.buscable) return;
    select.dataset.buscable = "1";

    const caja = document.createElement("div");
    caja.className = "buscador-select";
    const entrada = document.createElement("input");
    entrada.type = "text";
    entrada.autocomplete = "off";
    entrada.className = "buscador-select-input";
    const lista = document.createElement("div");
    lista.className = "buscador-select-lista";
    lista.hidden = true;

    select.parentNode.insertBefore(caja, select);
    caja.append(entrada, lista, select);
    select.tabIndex = -1;

    let resaltada = -1;
    const textoVacio = () => {
        const o = select.options[0];
        return o && o.value === "" && !o.textContent.trim().startsWith("--") ? o.textContent.trim() : "";
    };
    const etiquetaActual = () => { const o = select.selectedOptions[0]; return o && o.value ? o.textContent : ""; };
    const sincronizar = () => {
        entrada.value = etiquetaActual();
        entrada.placeholder = textoVacio() || "Escriba nombre o expediente...";
    };

    function elegir(valor) {
        select.value = valor;
        sincronizar();
        lista.hidden = true;
        select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    function marcar(indice) {
        const items = Array.from(lista.querySelectorAll(".buscador-select-opcion"));
        if (!items.length) return;
        resaltada = (indice + items.length) % items.length;
        items.forEach((el, i) => el.classList.toggle("resaltada", i === resaltada));
        items[resaltada].scrollIntoView({ block: "nearest" });
    }
    function pintar() {
        const buscado = entrada.value === etiquetaActual() ? "" : entrada.value;
        const palabras = normalizarTexto(buscado).split(/\s+/).filter(Boolean);
        const items = [];
        if (textoVacio() && !palabras.length) items.push({ valor: "", texto: textoVacio() });
        Array.from(select.options)
            .filter(o => o.value !== "" && palabras.every(p => normalizarTexto(o.textContent).includes(p)))
            .slice(0, 50)
            .forEach(o => items.push({ valor: o.value, texto: o.textContent }));
        lista.innerHTML = "";
        if (!items.length) {
            const vacio = document.createElement("div");
            vacio.className = "buscador-select-vacio";
            vacio.textContent = "Sin coincidencias";
            lista.appendChild(vacio);
        }
        items.forEach(it => {
            const el = document.createElement("div");
            el.className = "buscador-select-opcion";
            el.textContent = it.texto;
            el.dataset.valor = it.valor;
            el.addEventListener("mousedown", e => { e.preventDefault(); elegir(it.valor); });
            lista.appendChild(el);
        });
        resaltada = -1;
        lista.hidden = false;
    }

    entrada.addEventListener("focus", () => { sincronizar(); entrada.select(); pintar(); });
    entrada.addEventListener("input", pintar);
    entrada.addEventListener("blur", () => { lista.hidden = true; sincronizar(); });
    entrada.addEventListener("keydown", e => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (lista.hidden) pintar();
            marcar(resaltada + (e.key === "ArrowDown" ? 1 : -1));
        } else if (e.key === "Enter" && !lista.hidden) {
            e.preventDefault();
            const items = lista.querySelectorAll(".buscador-select-opcion");
            const el = items[resaltada >= 0 ? resaltada : 0];
            if (el) elegir(el.dataset.valor);
        } else if (e.key === "Escape") {
            lista.hidden = true;
            sincronizar();
        }
    });
    if (select.form) select.form.addEventListener("reset", () => setTimeout(sincronizar, 0));
    // si el script vuelve a llenar las opciones del <select>, se actualiza el texto mostrado
    new MutationObserver(sincronizar).observe(select, { childList: true });
    sincronizar();
}
