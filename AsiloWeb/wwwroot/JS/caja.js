// Caja y Finanzas - Asilo Cabeza de Algodon
// Pacientes sigue siendo microservicio (8000). Caja vive en el backend .NET
// (CajaController). RF-12 (citas no canceladas), RF-13 (donaciones, cuotas y
// gastos) y RF-11 (deuda con la fundacion, calculada en el resumen).

const PACIENTES_API_URL = "/api/Pacientes";
const CAJA_API_URL = "/api/Caja";

let mapaResidentes = {};

const fecha = f => (f ? new Date(f).toLocaleDateString("es-GT") : "-");
const nombreDe = id => (mapaResidentes[id] || {}).nombreCompleto || `Residente #${id}`;

document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("form-cobro").addEventListener("submit", registrarCobro);
    document.getElementById("form-donacion").addEventListener("submit", registrarDonacion);
    document.getElementById("form-gasto").addEventListener("submit", registrarGasto);
    document.getElementById("form-abono").addEventListener("submit", registrarAbono);
    document.getElementById("filtro-cobros").addEventListener("change", cargarCobros);
    document.getElementById("buscador-cobros").addEventListener("input", pintarCobros);
    hacerBuscable("select-residente-caja");

    await cargarResidentes();      // primero los nombres, para que las listas los muestren
    refrescarTodo();
});

function refrescarTodo() {
    cargarResumen();
    cargarCitasPendientes();
    cargarCobros();
    cargarDonaciones();
    cargarGastos();
    cargarCuentaFundacion();
}

async function cargarResidentes() {
    const select = document.getElementById("select-residente-caja");
    try {
        const respuesta = await fetch(PACIENTES_API_URL);
        if (!respuesta.ok) throw new Error("Error al cargar residentes");
        const residentes = await respuesta.json();
        residentes.forEach(r => { mapaResidentes[r.idResidente] = r; });
        select.innerHTML = '<option value="">-- Seleccionar Residente --</option>' +
            residentes.filter(r => r.estado !== false).map(r => `<option value="${r.idResidente}">${esc(r.noExpediente)} - ${esc(r.nombreCompleto)}</option>`).join("");
        if (pagosCache.length) pintarCobros();   // ya se conocen los nombres
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
            ${tarjeta("Saldo con la Fundación", r.saldoFundacion ?? r.deudaConFundacion, "ambar")}
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
        conceptoPago: !detalle ? tipo : (normalizarTexto(detalle).startsWith(normalizarTexto(tipo)) ? detalle : `${tipo} - ${detalle}`),
        monto: parseFloat(document.getElementById("monto-cobro").value) || 0,
    }, "Cobro registrado correctamente.", "form-cobro");
}

let pagosCache = [];
const CATEGORIAS_COBRO = ["Mensualidades", "Consultas", "Exámenes", "Medicamentos", "Otros cargos"];

// Seccion a la que pertenece un cobro, segun su concepto
function categoriaDeCobro(concepto) {
    const c = normalizarTexto(concepto);
    if (c.startsWith("mensualidad")) return "Mensualidades";
    if (c.startsWith("consulta")) return "Consultas";
    if (c.startsWith("examen")) return "Exámenes";
    if (c.startsWith("medicamento")) return "Medicamentos";
    return "Otros cargos";
}

async function cargarCobros() {
    const contenedor = document.getElementById("contenedor-cobros");
    const filtro = document.getElementById("filtro-cobros").value;
    try {
        const respuesta = await fetch(`${CAJA_API_URL}/pagos` + (filtro ? `?estado=${filtro}` : ""));
        if (!respuesta.ok) throw new Error("Error al cargar cobros");
        pagosCache = await respuesta.json();
        pintarCobros();
    } catch (err) {
        console.error(err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudieron cargar los cobros.</p>";
    }
}

// Cobros agrupados por residente (con lo que debe y lo cancelado) y, dentro de cada uno, por seccion
function pintarCobros() {
    const contenedor = document.getElementById("contenedor-cobros");
    const buscado = normalizarTexto(document.getElementById("buscador-cobros").value.trim());
    const pagos = pagosCache.filter(p => !buscado
        || normalizarTexto(nombreDe(p.idPaciente)).includes(buscado)
        || normalizarTexto((mapaResidentes[p.idPaciente] || {}).noExpediente).includes(buscado));

    if (!pagos.length) { contenedor.innerHTML = "<p style='color:#777;'>No hay cobros para mostrar.</p>"; return; }

    const porResidente = new Map();
    pagos.forEach(p => {
        if (!porResidente.has(p.idPaciente)) porResidente.set(p.idPaciente, []);
        porResidente.get(p.idPaciente).push(p);
    });
    const suma = lista => lista.reduce((t, p) => t + Number(p.monto || 0), 0);
    const grupos = Array.from(porResidente.entries()).map(([id, cobros]) => ({
        id, cobros,
        pendiente: suma(cobros.filter(p => p.estado !== "Pagado")),
        cancelado: suma(cobros.filter(p => p.estado === "Pagado")),
    })).sort((a, b) => b.pendiente - a.pendiente || nombreDe(a.id).localeCompare(nombreDe(b.id)));

    const abierto = buscado !== "" || grupos.length <= 3;
    contenedor.innerHTML = grupos.map(g => `
        <details class="grupo-residente" ${abierto ? "open" : ""}>
            <summary>
                <span>${esc(nombreDe(g.id))}</span>
                <span class="grupo-totales">
                    ${g.pendiente > 0 ? `<span class="chip chip-debe">Debe ${quetzales(g.pendiente)}</span>` : `<span class="chip chip-aldia">Al día</span>`}
                    ${g.cancelado > 0 ? `<span class="chip chip-cancelado">Cancelado ${quetzales(g.cancelado)}</span>` : ""}
                </span>
            </summary>
            ${CATEGORIAS_COBRO.map(cat => {
                const items = g.cobros.filter(p => categoriaDeCobro(p.conceptoPago) === cat);
                if (!items.length) return "";
                return `<div class="grupo-seccion"><h4>${cat} (${items.length})</h4>${items.map(p => {
                    const pagado = p.estado === "Pagado";
                    const cuandoPago = pagado && p.fechaCancelado
                        ? ` · Pagado el ${fecha(p.fechaCancelado)}${p.canceladoPor ? ` (${esc(p.canceladoPor)})` : ""}` : "";
                    return `
                    <div class="fila-cobro">
                        <div><strong>${esc(p.conceptoPago)}</strong><small>${fecha(p.fechaPago)}${cuandoPago}</small></div>
                        <div class="fila-cobro-derecha">
                            <strong>${quetzales(p.monto)}</strong>
                            ${pagado ? `<span class="chip chip-aldia">Cancelado</span>`
                                     : `<span class="chip chip-debe">Pendiente</span><button onclick="marcarPagado(${p.idPago})" class="btn-guardar" style="padding:6px 10px;" title="Marcar como cancelado"><i class="fa-solid fa-check"></i></button>`}
                        </div>
                    </div>`;
                }).join("")}</div>`;
            }).join("")}
        </details>`).join("");
}

async function marcarPagado(idPago) {
    try {
        const respuesta = await fetch(`${CAJA_API_URL}/pagos/${idPago}/estado`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ estado: "Pagado" }),
        });
        if (!respuesta.ok) { mostrarModal("Error", await mensajeError(respuesta), "error"); return; }

        const datos = await respuesta.json().catch(() => ({}));
        const avisos = {
            "enviado": ["Cobro cancelado", "Se envió el comprobante de pago al correo del tutor.", "exito"],
            "sin-correo": ["Cobro cancelado", "El tutor no tiene un correo registrado, por eso no se envió comprobante.", "exito"],
            "fallo": ["Cobro cancelado, pero sin comprobante", "El pago quedó registrado, pero no se pudo enviar el correo al tutor.", "error"],
        };
        if (avisos[datos.comprobante]) mostrarModal(...avisos[datos.comprobante]);
        refrescarTodo();
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

// ------------------------------------------------------------ pagos a la fundacion (RF-11)
async function registrarAbono(event) {
    event.preventDefault();
    await enviar(`${CAJA_API_URL}/abonos-fundacion`, {
        monto: parseFloat(document.getElementById("monto-abono").value) || 0,
        nota: document.getElementById("nota-abono").value.trim() || null,
    }, "Pago a la fundación registrado correctamente.", "form-abono");
}

async function cargarCuentaFundacion() {
    const cuenta = document.getElementById("contenedor-cuenta-fundacion");
    const lista = document.getElementById("contenedor-abonos");
    try {
        const [rResumen, rAbonos] = await Promise.all([fetch(`${CAJA_API_URL}/resumen`), fetch(`${CAJA_API_URL}/abonos-fundacion`)]);
        if (!rResumen.ok || !rAbonos.ok) throw new Error("Error al cargar la cuenta con la fundación");
        const r = await rResumen.json();
        const abonos = await rAbonos.json();
        const pagado = r.pagadoAFundacion ?? 0;
        const saldo = r.saldoFundacion ?? (r.deudaConFundacion - pagado);

        const tarjeta = (titulo, valor, color) => `
            <div class="kpi ${color}">
                <span>${titulo}</span>
                <strong>${quetzales(valor)}</strong>
            </div>`;
        cuenta.innerHTML = `<div class="kpi-grid">
            ${tarjeta("Total adeudado", r.deudaConFundacion, "ambar")}
            ${tarjeta("Total pagado", pagado, "verde")}
            ${tarjeta("Saldo pendiente", saldo, "rojo")}
        </div>`;

        const aviso = document.getElementById("saldo-abono");
        if (aviso) aviso.textContent = `Saldo pendiente con la fundación: ${quetzales(saldo)}. Cada pago lo reduce.`;

        lista.innerHTML = abonos.length ? abonos.map(a => `
            <div class="fila-movimiento">
                <div><strong>${esc(a.nota || "Pago a la fundación")}</strong> <span style="color:#777; font-size:0.85rem;">(${fecha(a.fechaPago)})</span></div>
                <div class="monto verde">${quetzales(a.monto)}</div>
            </div>`).join("") : "<p style='color:#777;'>Aún no hay pagos registrados a la fundación.</p>";
    } catch (err) {
        console.error(err);
        cuenta.innerHTML = "<p style='color:#c62828;'>No se pudo cargar la cuenta con la fundación.</p>";
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

