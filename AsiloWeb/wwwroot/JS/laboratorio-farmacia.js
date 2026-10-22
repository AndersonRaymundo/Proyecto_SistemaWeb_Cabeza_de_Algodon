// Laboratorio y Farmacia - Asilo Cabeza de Algodon
// Pacientes sigue siendo microservicio (8000). Examenes y medicamentos viven
// en el backend .NET (LaboratorioFarmaciaController).
// RF-08 laboratorio registra resultados | RF-09 farmacia despacha | RF-10 cobro automatico

const PACIENTES_API_URL = "/api/Pacientes";
const LF_API_URL = "/api/LaboratorioFarmacia";
const DESCUENTO_API_URL = "/api/Config/descuento";
const INVENTARIO_API_URL = "/api/Inventario";

let mapaResidentes = {};
let porcentajeDescuento = 0;

const fecha = f => (f ? new Date(f).toLocaleString("es-GT") : "-");
const nombreDe = id => (mapaResidentes[id] || {}).nombreCompleto || `Residente #${id}`;
const dadoDeBaja = id => (mapaResidentes[id] || {}).estado === false;
const AVISO_BAJA = '<p style="margin:10px 0 0; color:#b45309; font-weight:600;"><i class="fa-solid fa-user-slash"></i> Residente dado de baja: no se puede registrar el resultado ni despachar.</p>';
// Quien receta (doctor) no registra resultados ni despacha: cada tarea es de su rol
const verLab = () => ["ADMINISTRADOR", "LABORATORIO"].includes(rol());
const verFarmacia = () => ["ADMINISTRADOR", "FARMACIA"].includes(rol());

async function iniciar() {
    hacerBuscable("select-residente-examen");
    hacerBuscable("select-residente-medicamento");
    // Cada rol ve solo su modulo (RNF-02)
    if (!verLab()) document.getElementById("tab-btn-lab").style.display = "none";
    if (!verFarmacia()) document.getElementById("tab-btn-farmacia").style.display = "none";
    if (!verFarmacia()) document.getElementById("tab-btn-inventario").style.display = "none";
    if (!verLab()) activarPestana("seccion-farmacia");
    // las pestañas solo se muestran si hay mas de una (laboratorio, farmacia, inventario)
    if ([verLab(), verFarmacia(), verFarmacia()].filter(Boolean).length <= 1) document.querySelector(".pestanas").style.display = "none";

    await Promise.all([cargarResidentes(), cargarDescuento()]);
    if (verLab()) { cargarExamenes(); document.getElementById("form-examen-directo").addEventListener("submit", registrarExamenDirecto); }
    if (verFarmacia()) {
        document.getElementById("form-medicamento-directo").addEventListener("submit", registrarMedicamentoDirecto);
        document.getElementById("form-inventario").addEventListener("submit", guardarInventario);
        document.getElementById("form-entrada").addEventListener("submit", guardarEntrada);
        document.getElementById("inv-medicamento-directo").addEventListener("change", elegirInventarioDirecto);
        // en el despacho directo tambien: Cantidad y Unidades se mantienen iguales cuando hay un producto elegido
        ["cantidad", "unidades"].forEach(desde => document.getElementById(desde === "cantidad" ? "cantidad-medicamento" : "unidades-medicamento").addEventListener("input", () => {
            if (!document.getElementById("inv-medicamento-directo").value) return;
            sincronizarCantidadUnidades(document.getElementById("cantidad-medicamento"), document.getElementById("unidades-medicamento"), desde);
        }));
        await cargarInventario();     // antes que los pendientes: cada despacho ofrece el catalogo
        cargarMedicamentos();
    }

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
                residentes.filter(r => r.estado !== false).map(r => `<option value="${r.idResidente}">${esc(r.noExpediente)} - ${esc(r.nombreCompleto)}</option>`).join("");
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
                ${dadoDeBaja(e.idPaciente) ? AVISO_BAJA : `
                <div class="fila-controles">
                    <div style="flex:2; min-width:220px;"><label>Resultado</label>
                        <input type="text" id="res-${e.idExamen}" placeholder="Reporte del laboratorio"></div>
                    <div style="width:150px;"><label>Precio de lista (Q)</label>
                        <input type="number" step="0.01" min="0" id="precio-ex-${e.idExamen}" placeholder="0.00"></div>
                    <button type="button" class="btn-guardar" style="margin-top:0;" onclick="registrarResultado(${e.idExamen})"><i class="fa-solid fa-check"></i> Registrar resultado</button>
                </div>`}
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
                ${dadoDeBaja(m.idPaciente) ? AVISO_BAJA : `
                <div class="fila-controles">
                    <div style="width:180px;"><label>Cantidad</label>
                        <input type="text" id="cant-${m.idMedicamento}" value="${esc(m.cantidad || "")}" oninput="sincronizarFila(${m.idMedicamento}, 'cantidad')"></div>
                    <div style="width:240px;"><label>Del inventario</label>
                        <select id="inv-${m.idMedicamento}" onchange="sincronizarFila(${m.idMedicamento}, 'cantidad')">${opcionesInventario(productoPara(m.nombreMedicamento))}</select></div>
                    <div style="width:100px;"><label>Unidades</label>
                        <input type="number" min="1" step="1" id="uni-${m.idMedicamento}" value="${productoPara(m.nombreMedicamento) ? unidadesDe(m.cantidad) : ""}" oninput="sincronizarFila(${m.idMedicamento}, 'unidades')"></div>
                    <div style="width:150px;"><label>Precio de lista (Q)</label>
                        <input type="number" step="0.01" min="0" id="precio-med-${m.idMedicamento}" placeholder="0.00" oninput="this.dataset.manual='1'"></div>
                    <button type="button" class="btn-guardar" style="margin-top:0;" onclick="despachar(${m.idMedicamento})"><i class="fa-solid fa-box-open"></i> Despachar</button>
                </div>`}
            </div>`).join("") : "<p style='color:#64748b; padding:8px 0;'>No hay medicamentos pendientes de despacho.</p>";

        // Si el producto ya viene preseleccionado, se muestra de una vez el precio sugerido
        pendientes.filter(m => !dadoDeBaja(m.idPaciente)).forEach(m => sugerirPrecio(m.idMedicamento));

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
    const idInventario = parseInt(document.getElementById(`inv-${idMedicamento}`).value, 10) || null;
    const unidades = parseInt(document.getElementById(`uni-${idMedicamento}`).value, 10) || null;
    try {
        const respuesta = await fetch(`${LF_API_URL}/medicamentos/${idMedicamento}/despachar`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ precioLista, cantidad: cantidad || null, idInventario, unidades }),
        });
        if (!respuesta.ok) { mostrarModal("Error", await mensajeError(respuesta), "error"); return; }
        mostrarModal("¡Medicamento despachado!", precioLista > 0 ? "El costo se cargó a la cuenta del familiar." : "Despacho registrado.", "exito");
        await cargarInventario();
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
        idInventario: parseInt(document.getElementById("inv-medicamento-directo").value, 10) || null,
        unidades: parseInt(document.getElementById("unidades-medicamento").value, 10) || null,
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
        await cargarInventario();
        cargarMedicamentos();
    } catch (err) {
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

// ===========================================================================
// Inventario de la farmacia: catalogo, existencias, entradas y descuento al despachar
// ===========================================================================
let inventarioCache = [];

// "30 tabletas" -> "30"
const unidadesDe = texto => { const m = String(texto || "").match(/^\s*(\d+)/); return m ? m[1] : ""; };

// Producto del catalogo que mejor coincide con el nombre recetado (ej. "Losartán 50 mg")
function productoPara(nombre) {
    const n = normalizarTexto(nombre);
    if (!n) return undefined;
    return inventarioCache.find(p => normalizarTexto(p.nombre) === n)
        || inventarioCache.find(p => { const c = normalizarTexto(p.nombre); return n.includes(c) || c.includes(n); });
}

function opcionesInventario(seleccionado) {
    return '<option value="">Sin control de inventario</option>' + inventarioCache.map(p =>
        `<option value="${p.idInventario}"${seleccionado && seleccionado.idInventario === p.idInventario ? " selected" : ""}>${esc(p.nombre)}${p.presentacion ? " · " + esc(p.presentacion) : ""} (hay ${p.existencias})</option>`).join("");
}

// "Cantidad" (texto de la receta, ej. "30 tabletas") y "Unidades" (lo que se descuenta del inventario)
// son la misma cantidad: al cambiar una, se actualiza el numero de la otra, para que no se desajusten.
function sincronizarCantidadUnidades(campoCantidad, campoUnidades, desde) {
    if (desde === "cantidad") {
        const m = campoCantidad.value.match(/^\s*(\d+)/);
        if (m) campoUnidades.value = m[1];
    } else {
        const n = campoUnidades.value.trim();
        if (!n) return;
        campoCantidad.value = /^\s*\d+/.test(campoCantidad.value)
            ? campoCantidad.value.replace(/^\s*\d+/, n)
            : `${n} ${campoCantidad.value}`.trim();
    }
}

// En una fila pendiente solo se sincroniza si se eligio un producto del inventario
function sincronizarFila(idMedicamento, desde) {
    if (document.getElementById(`inv-${idMedicamento}`).value) {
        sincronizarCantidadUnidades(document.getElementById(`cant-${idMedicamento}`), document.getElementById(`uni-${idMedicamento}`), desde);
    }
    sugerirPrecio(idMedicamento);
}

// Sugiere el precio (unidades x precio por unidad) mientras la persona no lo haya escrito a mano
function sugerirPrecio(idMedicamento) {
    const producto = inventarioCache.find(p => String(p.idInventario) === document.getElementById(`inv-${idMedicamento}`).value);
    const unidades = parseInt(document.getElementById(`uni-${idMedicamento}`).value, 10) || 0;
    const precio = document.getElementById(`precio-med-${idMedicamento}`);
    if (producto && unidades > 0 && !precio.dataset.manual) precio.value = (producto.precioUnitario * unidades).toFixed(2);
}

function elegirInventarioDirecto() {
    const producto = inventarioCache.find(p => String(p.idInventario) === document.getElementById("inv-medicamento-directo").value);
    if (!producto) return;
    const nombre = document.getElementById("nombre-medicamento");
    if (!nombre.value.trim()) nombre.value = producto.nombre;
    const cantidadTexto = document.getElementById("cantidad-medicamento");
    sincronizarCantidadUnidades(cantidadTexto, document.getElementById("unidades-medicamento"), /^\s*\d+/.test(cantidadTexto.value) ? "cantidad" : "unidades");
    const unidades = parseInt(document.getElementById("unidades-medicamento").value, 10) || 0;
    const precio = document.getElementById("precio-medicamento");
    if (unidades > 0 && !precio.value) { precio.value = (producto.precioUnitario * unidades).toFixed(2); precio.dispatchEvent(new Event("input")); }
}

const ESTILO_ESTADO_INVENTARIO = { Disponible: "badge-exito", Bajo: "badge-alerta", "Por vencer": "badge-alerta", Agotado: "badge-peligro", Vencido: "badge-peligro" };

async function cargarInventario() {
    const contenedor = document.getElementById("contenedor-inventario");
    try {
        const respuesta = await fetch(INVENTARIO_API_URL);
        if (!respuesta.ok) throw new Error("Error al cargar el inventario");
        inventarioCache = await respuesta.json();
        document.getElementById("contador-inventario").textContent = inventarioCache.filter(p => p.estado !== "Disponible").length;

        const directo = document.getElementById("inv-medicamento-directo");
        const elegido = directo.value;
        directo.innerHTML = opcionesInventario(null);
        directo.value = elegido;

        const vence = f => f ? new Date(f).toLocaleDateString("es-GT") : "-";
        contenedor.innerHTML = inventarioCache.length ? `
            <table class="tabla-datos">
                <thead><tr><th>Medicamento</th><th class="centrado">Existencias</th><th class="centrado">Mínimo</th><th>Precio por unidad</th><th>Vence</th><th>Estado</th><th class="centrado">Acciones</th></tr></thead>
                <tbody>${inventarioCache.map(p => `
                    <tr>
                        <td><strong>${esc(p.nombre)}</strong>${p.presentacion ? `<div style="color:#64748b; font-size:.82rem;">${esc(p.presentacion)}</div>` : ""}</td>
                        <td class="centrado">${p.existencias}</td>
                        <td class="centrado">${p.stockMinimo}</td>
                        <td>${quetzales(p.precioUnitario)}</td>
                        <td>${vence(p.fechaVencimiento)}</td>
                        <td><span class="badge ${ESTILO_ESTADO_INVENTARIO[p.estado] || "badge-info"}">${esc(p.estado)}</span></td>
                        <td class="centrado">
                            <button class="btn-icono verde" onclick="abrirEntrada(${p.idInventario})" title="Registrar entrada"><i class="fa-solid fa-plus"></i></button>
                            <button class="btn-icono celeste" onclick="editarInventario(${p.idInventario})" title="Editar"><i class="fa-solid fa-pen"></i></button>
                        </td>
                    </tr>`).join("")}</tbody>
            </table>` : "<p style='color:#64748b; padding:8px 0;'>Aún no hay medicamentos en el inventario. Agregue el primero con \"Nuevo medicamento\".</p>";
    } catch (err) {
        console.error(err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo cargar el inventario.</p>";
    }
}

function nuevoInventario() {
    document.getElementById("form-inventario").reset();
    document.getElementById("inv-id").value = "";
    document.getElementById("titulo-inventario").innerHTML = '<i class="fa-solid fa-boxes-stacked"></i> Nuevo medicamento';
    abrirPanel("panel-inventario");
}

function editarInventario(id) {
    const p = inventarioCache.find(x => x.idInventario === id);
    if (!p) return;
    document.getElementById("inv-id").value = id;
    document.getElementById("inv-nombre").value = p.nombre;
    document.getElementById("inv-presentacion").value = p.presentacion || "";
    document.getElementById("inv-precio").value = p.precioUnitario;
    document.getElementById("inv-existencias").value = p.existencias;
    document.getElementById("inv-minimo").value = p.stockMinimo;
    document.getElementById("inv-vence").value = p.fechaVencimiento ? String(p.fechaVencimiento).substring(0, 10) : "";
    document.getElementById("titulo-inventario").innerHTML = '<i class="fa-solid fa-pen"></i> Editar medicamento';
    abrirPanel("panel-inventario");
}

async function guardarInventario(event) {
    event.preventDefault();
    const id = document.getElementById("inv-id").value;
    const payload = {
        nombre: document.getElementById("inv-nombre").value.trim(),
        presentacion: document.getElementById("inv-presentacion").value.trim() || null,
        precioUnitario: parseFloat(document.getElementById("inv-precio").value) || 0,
        existencias: parseInt(document.getElementById("inv-existencias").value, 10) || 0,
        stockMinimo: parseInt(document.getElementById("inv-minimo").value, 10) || 0,
        fechaVencimiento: document.getElementById("inv-vence").value || null,
    };
    try {
        const respuesta = await fetch(id ? `${INVENTARIO_API_URL}/${id}` : INVENTARIO_API_URL, {
            method: id ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!respuesta.ok) { mostrarModal("No se pudo guardar", await mensajeError(respuesta), "error"); return; }
        mostrarModal("¡Listo!", id ? "Medicamento actualizado." : "Medicamento agregado al inventario.", "exito");
        cerrarPanel("panel-inventario");
        cargarInventario();
    } catch (err) {
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

function abrirEntrada(id) {
    const p = inventarioCache.find(x => x.idInventario === id);
    if (!p) return;
    document.getElementById("entrada-id").value = id;
    document.getElementById("entrada-nombre").innerHTML = `Medicamento: <strong>${esc(p.nombre)}</strong> (hay ${p.existencias})`;
    document.getElementById("entrada-cantidad").value = "";
    abrirPanel("panel-entrada");
}

async function guardarEntrada(event) {
    event.preventDefault();
    const id = document.getElementById("entrada-id").value;
    const cantidad = parseInt(document.getElementById("entrada-cantidad").value, 10) || 0;
    try {
        const respuesta = await fetch(`${INVENTARIO_API_URL}/${id}/entrada`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cantidad }),
        });
        if (!respuesta.ok) { mostrarModal("No se pudo registrar", await mensajeError(respuesta), "error"); return; }
        mostrarModal("¡Listo!", "Entrada registrada. Las existencias se actualizaron.", "exito");
        cerrarPanel("panel-entrada");
        cargarInventario();
    } catch (err) {
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}
