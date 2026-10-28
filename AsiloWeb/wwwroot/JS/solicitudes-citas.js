// Solicitudes y Citas - Asilo Cabeza de Algodon
// Pacientes sigue siendo microservicio (8000). Las citas viven en el backend
// .NET (CitasController). Cubre RF-02/03/04 (solicitud + correo), RF-05 (agenda
// de la Fundacion), RF-07 (visita medica) y RF-12 (estado de pago por cita).

const PACIENTES_API_URL = "/api/Pacientes";
const CITAS_API_URL = "/api/Citas";
const USUARIOS_API_URL = "/api/Auth/usuarios";
const ESPECIALIDADES_API_URL = "/api/Auth/especialidades";
const DESCUENTO_API_URL = "/api/Config/descuento";

let mapaResidentes = {};      // idResidente -> { nombreCompleto, correoTutor }
let medicos = [];             // usuarios con rol DOCTOR
let enfermeros = [];          // usuarios con rol ENFERMERO (los que pueden acompañar al residente)
let especialidades = ["Medicina general", "Geriatría", "Cardiología", "Neurología", "Endocrinología", "Reumatología",
    "Traumatología", "Neumología", "Oftalmología", "Psiquiatría", "Urología", "Gastroenterología"];   // si el servidor no responde
let todosMedicos = [];          // todos los medicos, incluidos los dados de baja
let citasCache = [];            // las solicitudes cargadas (la ventana de cancelar las consulta)
let solicitudesVisibles = 10;  // paginacion: cuantas solicitudes se muestran (de 10 en 10)
let filtroEstadoActual = "";    // pestaña elegida: "" = todas, o Pendiente / Agendada / Atendida / Cancelada
let porcentajeDescuento = 0;  // descuento de la fundacion (RF-10)

// La pagina arranca cuando roles.js confirma la sesion (para conocer el rol)
function iniciar() {
    hacerBuscable("select-residente-solicitud");
    cargarEspecialidades();
    document.getElementById("form-cancelar-cita").addEventListener("submit", confirmarCancelacion);
    cargarSelectResidentes();
    cargarMedicos();
    cargarDescuento();
    cargarSolicitudes();

    const form = document.getElementById("form-solicitud");
    if (form) form.addEventListener("submit", registrarSolicitud);
    // pestañas de estado: al pulsar una se muestran solo las solicitudes de ese estado
    const pestanas = document.querySelectorAll("#filtro-estado [data-filtro]");
    pestanas.forEach(boton => boton.addEventListener("click", () => {
        filtroEstadoActual = boton.dataset.filtro;
        solicitudesVisibles = 10;
        pestanas.forEach(b => b.classList.toggle("activa", b === boton));
        cargarSolicitudes();
    }));
}
if (window.ROL_ACTUAL) iniciar();
else document.addEventListener("sesion-lista", iniciar, { once: true });

async function cargarSelectResidentes() {
    const select = document.getElementById("select-residente-solicitud");
    if (!select) return;
    try {
        const respuesta = await fetch(PACIENTES_API_URL);
        if (!respuesta.ok) throw new Error("Error al cargar residentes");
        const residentes = await respuesta.json();

        select.innerHTML = '<option value="">-- Seleccionar Residente --</option>';
        residentes.forEach(r => {
            mapaResidentes[r.idResidente] = { nombreCompleto: r.nombreCompleto, correoTutor: r.correoTutor, estado: r.estado };
            if (r.estado === false) return;   // un residente dado de baja no recibe nuevas solicitudes
            const opcion = document.createElement("option");
            opcion.value = r.idResidente;
            opcion.textContent = `${r.noExpediente} - ${r.nombreCompleto}`;
            select.appendChild(opcion);
        });
        cargarSolicitudes(); // para mostrar nombres ya resueltos
    } catch (err) {
        console.error("Error al cargar residentes:", err);
        select.innerHTML = '<option value="">-- No se pudo conectar con pacientes_service --</option>';
    }
}

// La especialidad de la solicitud se elige de una lista (la misma que se usa al registrar a los medicos)
async function cargarEspecialidades() {
    try {
        const respuesta = await fetch(ESPECIALIDADES_API_URL);
        if (respuesta.ok) { const lista = await respuesta.json(); if (Array.isArray(lista) && lista.length) especialidades = lista; }
    } catch (err) { /* se usa la lista de respaldo */ }
    document.getElementById("especialidad-solicitada").innerHTML = '<option value="">-- Seleccionar --</option>' +
        especialidades.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join("");
}

async function cargarMedicos() {
    try {
        const respuesta = await fetch(USUARIOS_API_URL);
        if (!respuesta.ok) return;
        const usuarios = await respuesta.json();
        todosMedicos = usuarios.filter(u => u.rol === "DOCTOR");               // para mostrar el nombre en citas ya hechas
        medicos = todosMedicos.filter(u => u.activo !== false);               // solo los activos se ofrecen en la agenda
        enfermeros = usuarios.filter(u => u.rol === "ENFERMERO" && u.activo !== false);
        // el acompañante se elige de la lista de enfermeros del sistema (se guarda su nombre)
        document.getElementById("enfermero-asignado").innerHTML = '<option value="">-- Sin acompañante --</option>' +
            enfermeros.map(e => `<option value="${esc(e.nombreCompleto)}">${esc(e.nombreCompleto)}</option>`).join("");
        cargarSolicitudes();
    } catch (err) {
        console.error("Error al cargar médicos:", err);
    }
}

async function cargarDescuento() {
    try {
        const respuesta = await fetch(DESCUENTO_API_URL);
        if (respuesta.ok) porcentajeDescuento = (await respuesta.json()).porcentaje || 0;
    } catch (err) { /* sin descuento visible */ }
}

// ---------------------------------------------------------------- RF-02/03/04
async function registrarSolicitud(event) {
    event.preventDefault();

    const idResidente = document.getElementById("select-residente-solicitud").value;
    if (!idResidente) {
        mostrarModal("Falta información", "Seleccione un residente.", "error");
        return;
    }
    const info = mapaResidentes[idResidente] || {};

    const payload = {
        idPaciente: parseInt(idResidente, 10),
        especialidadSolicitada: document.getElementById("especialidad-solicitada").value,
        motivo: document.getElementById("motivo-remision").value,
        enfermeroAsignado: document.getElementById("enfermero-asignado").value || null,
        correoFamiliar: info.correoTutor || null,
    };

    try {
        const respuesta = await fetch(CITAS_API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!respuesta.ok) {
            mostrarModal("Error del servidor", await mensajeError(respuesta), "error");
            return;
        }
        const aviso = info.correoTutor ? " Se envió un correo al familiar." : " El residente no tiene correo de tutor registrado.";
        mostrarModal("¡Éxito!", "Solicitud enviada a la Fundación." + aviso, "exito");
        document.getElementById("form-solicitud").reset();
        cerrarPaneles();
        cargarSolicitudes();
    } catch (err) {
        console.error("Error de red:", err);
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

// ---------------------------------------------------------------- listado
const COLORES_ESTADO = {
    Pendiente: ["#fce8e6", "#c5221f"],
    Agendada: ["#fff3cd", "#8a6d00"],
    Atendida: ["#e6f4ea", "#1e7e34"],
    Cancelada: ["#eee", "#666"],
};
const COLORES_PAGO = {
    Pendiente: ["#fce8e6", "#c5221f"],
    Pagado: ["#e6f4ea", "#1e7e34"],
    "Sin cargos": ["#eee", "#666"],
};

function etiqueta(texto, [fondo, color]) {
    return `<span style="background:${fondo}; color:${color}; padding:2px 10px; border-radius:12px; font-size:0.8rem; font-weight:bold; margin-left:8px;">${esc(texto)}</span>`;
}

async function cargarSolicitudes() {
    const contenedor = document.getElementById("contenedor-solicitudes");
    if (!contenedor) return;

    try {
        const respuesta = await fetch(CITAS_API_URL);
        if (!respuesta.ok) throw new Error("Error al cargar solicitudes");
        const todas = await respuesta.json();
        if (!Array.isArray(todas)) throw new Error("Respuesta inesperada");

        // el numero de cada pestaña se calcula con todas las solicitudes
        document.querySelectorAll("#filtro-estado [data-cuenta]").forEach(c => {
            c.textContent = c.dataset.cuenta ? todas.filter(x => x.estado === c.dataset.cuenta).length : todas.length;
        });
        citasCache = todas;
        const citas = filtroEstadoActual ? todas.filter(c => c.estado === filtroEstadoActual) : todas;

        if (!Array.isArray(citas) || citas.length === 0) {
            contenedor.innerHTML = "<p style='color:#777;'>No hay solicitudes para mostrar.</p>";
            return;
        }

        const puedeAgendar = ["ADMINISTRADOR", "FUNDACION"].includes(rol());
        // RF-07: el medico asignado registra la visita; el administrador puede hacerlo siempre
        const idUsuario = parseInt(localStorage.getItem("id_usuario"), 10) || 0;
        const puedeAtender = c => rol() === "ADMINISTRADOR" || (rol() === "DOCTOR" && (!c.idDoctor || Number(c.idDoctor) === idUsuario));
        // La visita se habilita hasta el dia de la cita
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const esFutura = c => c.fechaCita && new Date(c.fechaCita) >= new Date(hoy.getTime() + 86400000);
        const botonVisita = c => esFutura(c)
            ? `<button type="button" class="btn-guardar" disabled title="Disponible a partir del día de la cita"><i class="fa-solid fa-clock"></i> Visita disponible el ${new Date(c.fechaCita).toLocaleDateString("es-GT")}</button>`
            : `<button type="button" class="btn-guardar" onclick="abrirVisita(${c.idCita})"><i class="fa-solid fa-user-doctor"></i> Registrar visita médica</button>`;

        const visibles = citas.slice(0, solicitudesVisibles);
        contenedor.innerHTML = visibles.map(c => {
            const nombre = (mapaResidentes[c.idPaciente] || {}).nombreCompleto || `Residente #${c.idPaciente}`;
            const medico = todosMedicos.find(m => m.idUsuario === c.idDoctor);
            const fechaCita = c.fechaCita ? new Date(c.fechaCita).toLocaleString("es-GT", { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "Sin agendar";

            const dadoDeBaja = (mapaResidentes[c.idPaciente] || {}).estado === false;

            let acciones = "";
            if (dadoDeBaja && c.estado !== "Atendida") {
                acciones = `<p style="margin:10px 0 0; color:#b45309; font-weight:600;"><i class="fa-solid fa-user-slash"></i> Residente dado de baja: no se puede agendar ni atender esta solicitud.</p>`;
            } else if (c.estado === "Pendiente" && puedeAgendar) {
                acciones = controlesAgenda(c, "Agendar cita");
            } else if (c.estado === "Agendada" && (puedeAtender(c) || puedeAgendar)) {
                acciones = `
                    <div style="margin-top:10px; display:flex; gap:8px; flex-wrap:wrap;">
                        ${puedeAtender(c) ? botonVisita(c) : ""}
                        ${puedeAgendar ? `<button type="button" class="btn-guardar btn-secundario" onclick="mostrarReprogramar(${c.idCita})"><i class="fa-solid fa-calendar-days"></i> Reprogramar</button>
                        <button type="button" class="btn-guardar btn-peligro" onclick="cancelarCita(${c.idCita})"><i class="fa-solid fa-ban"></i> Cancelar cita</button>` : ""}
                    </div>
                    ${puedeAgendar ? `<div id="bloque-reprogramar-${c.idCita}" style="display:none; margin-top:10px;">${controlesAgenda(c, "Guardar nueva fecha")}</div>` : ""}`;
            }

            let detalleVisita = "";
            if (c.estado === "Cancelada" && c.observaciones) {
                detalleVisita = `<p style="margin:2px 0; color:#b45309; font-weight:600;"><i class="fa-solid fa-ban"></i> ${esc(c.observaciones)}</p>`;
            } else if (c.estado === "Atendida") {
                detalleVisita = `
                    <p style="margin:2px 0;"><strong>Diagnóstico:</strong> ${esc(c.diagnosticoConsulta)}</p>
                    ${c.observaciones ? `<p style="margin:2px 0;"><strong>Observaciones:</strong> ${esc(c.observaciones)}</p>` : ""}
                    <p style="margin:2px 0;"><strong>Consulta:</strong> ${quetzales(c.costoTotal)}
                        ${etiqueta("Pago: " + c.estadoPago, COLORES_PAGO[c.estadoPago] || ["#eee", "#666"])}</p>`;
            }

            return `
                <div class="formulario-datos" style="margin-bottom: 10px;">
                    <p><strong>${esc(nombre)}</strong> - ${esc(c.especialidadSolicitada)}
                        ${etiqueta(c.estado, COLORES_ESTADO[c.estado] || ["#eee", "#666"])}</p>
                    <p style="margin:2px 0; color:#555;">${esc(c.motivo)}</p>
                    <p style="margin:2px 0; font-size:0.85rem; color:#777;">
                        Cita: ${esc(fechaCita)}${medico ? ` - Médico: ${esc(medico.nombreCompleto)}` : ""}
                        ${c.enfermeroAsignado ? ` - Acompaña: ${esc(c.enfermeroAsignado)}` : ""}
                    </p>
                    ${detalleVisita}
                    ${acciones}
                </div>`;
        }).join("") + (citas.length > visibles.length
            ? `<button type="button" class="btn-guardar btn-secundario btn-mas" onclick="solicitudesVisibles += 10; cargarSolicitudes();">Mostrar más (${citas.length - visibles.length} restantes)</button>` : "");
    } catch (err) {
        console.error("Error al cargar solicitudes:", err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo conectar con el servidor.</p>";
    }
}

// ---------------------------------------------------------------- RF-05 agenda
// Medico, dia y horario. Se ofrecen los medicos de la especialidad pedida; si ninguno la tiene
// registrada, se muestran todos y se avisa.
function controlesAgenda(c, textoBoton) {
    const deLaEspecialidad = medicos.filter(m => m.especialidad === c.especialidadSolicitada);
    const lista = deLaEspecialidad.length ? deLaEspecialidad : medicos;
    const nota = deLaEspecialidad.length
        ? `<small class="nota-especialidad">Médicos de ${esc(c.especialidadSolicitada)}</small>`
        : `<small class="nota-especialidad aviso">Ningún médico está registrado en ${esc(c.especialidadSolicitada)}: se muestran todos</small>`;
    const opciones = lista.map(m => `<option value="${m.idUsuario}">${esc(m.nombreCompleto)}${m.especialidad ? " · " + esc(m.especialidad) : ""}</option>`).join("");
    return `
        <div class="fila-controles">
            <div><label>Médico especialista</label>
                <select id="agenda-medico-${c.idCita}" onchange="cargarHorarios(${c.idCita})"><option value="">-- Seleccionar --</option>${opciones}</select>${nota}</div>
            <div><label>Día de la cita</label>
                <input type="date" id="agenda-dia-${c.idCita}" min="${fechaLocal()}" onchange="cargarHorarios(${c.idCita})"></div>
            <button type="button" class="btn-guardar" onclick="agendarCita(${c.idCita})"><i class="fa-solid fa-calendar-plus"></i> ${textoBoton}</button>
        </div>
        <input type="hidden" id="agenda-fecha-${c.idCita}">
        <div id="agenda-horarios-${c.idCita}" class="horarios-cita"></div>`;
}

function mostrarReprogramar(idCita) {
    const bloque = document.getElementById(`bloque-reprogramar-${idCita}`);
    bloque.style.display = bloque.style.display === "none" ? "block" : "none";
}

// Cancelar una cita agendada: una ventana del sistema con el resumen de la cita y el motivo
// (el horario queda libre y el familiar recibe un aviso)
function cancelarCita(idCita) {
    const c = citasCache.find(x => x.idCita === idCita);
    if (!c) return;
    const nombre = (mapaResidentes[c.idPaciente] || {}).nombreCompleto || `Residente #${c.idPaciente}`;
    const medico = todosMedicos.find(m => m.idUsuario === c.idDoctor);
    const fecha = c.fechaCita ? new Date(c.fechaCita).toLocaleString("es-GT", { weekday: "short", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) : "Sin fecha";
    document.getElementById("cancelar-cita-id").value = idCita;
    document.getElementById("cancelar-cita-resumen").innerHTML =
        `<strong>${esc(nombre)}</strong> · ${esc(c.especialidadSolicitada)}<br>${esc(fecha)}${medico ? ` · ${esc(medico.nombreCompleto)}` : ""}`;
    document.getElementById("cancelar-cita-motivo").value = "";
    document.querySelectorAll(".motivo-rapido").forEach(b => b.classList.remove("activo"));
    abrirPanel("panel-cancelar-cita");
}

// Los motivos frecuentes se pulsan; "Otro" deja el campo vacio para escribirlo
function elegirMotivoRapido(boton) {
    document.querySelectorAll(".motivo-rapido").forEach(b => b.classList.toggle("activo", b === boton));
    const campo = document.getElementById("cancelar-cita-motivo");
    campo.value = boton.textContent.trim() === "Otro" ? "" : boton.textContent.trim();
    campo.focus();
}

async function confirmarCancelacion(event) {
    event.preventDefault();
    const idCita = document.getElementById("cancelar-cita-id").value;
    const motivo = document.getElementById("cancelar-cita-motivo").value.trim();
    try {
        const respuesta = await fetch(`${CITAS_API_URL}/${idCita}/cancelar`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ motivo }),
        });
        if (!respuesta.ok) { mostrarModal("No se pudo cancelar", await mensajeError(respuesta), "error"); return; }
        cerrarPanel("panel-cancelar-cita");
        mostrarModal("Cita cancelada", "El horario quedó libre y se avisó por correo al familiar.", "exito");
        cargarSolicitudes();
    } catch (err) {
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

// "14:30" -> "2:30 p. m."  (con a. m. / p. m. no hay duda entre las 12 de la noche y del mediodia)
function etiquetaHora(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}

// Muestra los espacios del medico en el dia elegido: solo se puede elegir uno de los libres
async function cargarHorarios(idCita) {
    const idDoctor = document.getElementById(`agenda-medico-${idCita}`).value;
    const dia = document.getElementById(`agenda-dia-${idCita}`).value;
    const contenedor = document.getElementById(`agenda-horarios-${idCita}`);
    document.getElementById(`agenda-fecha-${idCita}`).value = "";
    if (!idDoctor || !dia) { contenedor.innerHTML = ""; return; }

    contenedor.innerHTML = '<span class="horarios-nota">Buscando horarios...</span>';
    try {
        const respuesta = await fetch(`${CITAS_API_URL}/disponibilidad?idDoctor=${idDoctor}&fecha=${dia}&idCita=${idCita}`);
        if (!respuesta.ok) throw new Error("Error al consultar la agenda");
        const datos = await respuesta.json();
        if (!datos.laborable) { contenedor.innerHTML = `<span class="horarios-nota">${esc(datos.mensaje)}</span>`; return; }

        const MOTIVOS = {
            pasado: "Ya pasó",
            medico: "El médico ya tiene una cita a esa hora",
            residente: "El residente ya tiene otra cita a esa hora"
        };
        if (!datos.horarios.some(h => h.estado === "libre")) {
            const todasPasaron = datos.horarios.every(h => h.estado === "pasado");
            contenedor.innerHTML = `<span class="horarios-nota">${todasPasaron
                ? "Los horarios de hoy ya pasaron. Elija otro día."
                : "No quedan horarios libres ese día. Elija otro día u otro médico."}</span>`;
            return;
        }
        contenedor.innerHTML = '<span class="horarios-nota">Horarios disponibles (los grises ya pasaron o están ocupados):</span><div class="horarios-lista">' +
            datos.horarios.map(h => {
                const libre = h.estado === "libre";
                const motivo = MOTIVOS[h.estado] || "No disponible";
                return `<button type="button" class="horario${libre ? "" : " ocupado"}" ${libre ? "" : `disabled title="${motivo}"`}
                            onclick="elegirHorario(${idCita}, '${h.hora}', this)">${etiquetaHora(h.hora)}${h.estado === "pasado" ? " · Ya pasó" : ""}</button>`;
            }).join("") + "</div>";
    } catch (err) {
        console.error(err);
        contenedor.innerHTML = '<span class="horarios-nota">No se pudieron cargar los horarios.</span>';
    }
}

function elegirHorario(idCita, hora, boton) {
    document.querySelectorAll(`#agenda-horarios-${idCita} .horario`).forEach(b => b.classList.remove("elegido"));
    boton.classList.add("elegido");
    document.getElementById(`agenda-fecha-${idCita}`).value = `${document.getElementById(`agenda-dia-${idCita}`).value}T${hora}`;
}

async function agendarCita(idCita) {
    const idDoctor = document.getElementById(`agenda-medico-${idCita}`).value;
    const fecha = document.getElementById(`agenda-fecha-${idCita}`).value;
    if (!idDoctor || !fecha) {
        mostrarModal("Falta información", "Seleccione el médico especialista, el día y uno de los horarios disponibles.", "error");
        return;
    }
    try {
        const respuesta = await fetch(`${CITAS_API_URL}/${idCita}/agendar`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fechaCita: fecha, idDoctor: parseInt(idDoctor, 10) }),
        });
        if (!respuesta.ok) {
            mostrarModal("No se pudo agendar", await mensajeError(respuesta), "error");
            return;
        }
        mostrarModal("¡Cita agendada!", "Se asignó el médico y el horario. El familiar recibió un aviso por correo.", "exito");
        cargarSolicitudes();
    } catch (err) {
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

// ---------------------------------------------------------------- RF-07 visita
function abrirVisita(idCita) {
    cerrarVisita();
    const nota = porcentajeDescuento > 0
        ? `Ingrese el <b>precio de lista</b>; el sistema aplica el descuento de la fundación (${porcentajeDescuento}%) y lo carga a la cuenta del familiar.`
        : "Ingrese el precio de la consulta; se carga a la cuenta del familiar.";

    document.body.insertAdjacentHTML("beforeend", `
        <div id="modalVisita" class="panel-fondo abierto" data-efimero>
            <div class="panel ancho" role="dialog" aria-modal="true">
                <div class="panel-cabecera">
                    <h2><i class="fa-solid fa-user-doctor"></i> Registrar visita médica</h2>
                    <button type="button" class="panel-cerrar" data-cerrar aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="panel-cuerpo">
                    <p>${nota}</p>
                    <form id="form-visita">
                        <div class="grupo-campo"><label>Diagnóstico:</label>
                            <textarea id="visita-diagnostico" rows="3" required></textarea></div>
                        <div class="fila-2">
                            <div class="grupo-campo"><label>Observaciones médicas:</label>
                                <input type="text" id="visita-observaciones"></div>
                            <div class="grupo-campo"><label>Precio de la consulta (Q):</label>
                                <input type="number" step="0.01" min="0" id="visita-precio" placeholder="0.00">
                                <small id="visita-final" style="color:#1e7e34;"></small></div>
                        </div>
                        <div class="grupo-campo"><label>Exámenes de laboratorio a solicitar (opcional):</label>
                            <div id="visita-examenes"></div>
                            <button type="button" class="btn-agregar" onclick="agregarExamen('visita-examenes')"><i class="fa-solid fa-plus"></i> Agregar examen</button></div>
                        <div class="grupo-campo"><label>Medicamentos a recetar (opcional):</label>
                            <div id="visita-medicamentos"></div>
                            <button type="button" class="btn-agregar" onclick="agregarMedicamento('visita-medicamentos')"><i class="fa-solid fa-plus"></i> Agregar medicamento</button></div>
                        <div class="panel-pie">
                            <button type="button" class="btn-guardar btn-secundario" data-cerrar>Cancelar</button>
                            <button type="submit" class="btn-guardar"><i class="fa-solid fa-floppy-disk"></i> Guardar visita</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>`);
    document.body.classList.add("panel-abierto");
    reiniciarListasClinicas("visita-examenes", "visita-medicamentos");

    document.getElementById("visita-precio").addEventListener("input", e => {
        const lista = parseFloat(e.target.value) || 0;
        document.getElementById("visita-final").textContent =
            lista > 0 ? `Se cobrará ${quetzales(lista * (1 - porcentajeDescuento / 100))} al familiar.` : "";
    });
    document.getElementById("form-visita").addEventListener("submit", ev => guardarVisita(ev, idCita));
}

function cerrarVisita() {
    if (document.getElementById("modalVisita")) cerrarPanel("modalVisita");
}

async function guardarVisita(event, idCita) {
    event.preventDefault();
    const valor = id => document.getElementById(id).value.trim();
    const payload = {
        diagnosticoConsulta: valor("visita-diagnostico"),
        observaciones: valor("visita-observaciones") || null,
        precioLista: parseFloat(valor("visita-precio")) || 0,
        examenes: leerExamenes("visita-examenes"),
        medicamentos: leerMedicamentos("visita-medicamentos"),
    };
    try {
        const respuesta = await fetch(`${CITAS_API_URL}/${idCita}/completar`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!respuesta.ok) {
            mostrarModal("No se pudo registrar la visita", await mensajeError(respuesta), "error");
            return;
        }
        cerrarVisita();
        mostrarModal("¡Visita registrada!", "Los exámenes pasan a Laboratorio, los medicamentos a Farmacia y la consulta se cargó a la cuenta del familiar.", "exito");
        cargarSolicitudes();
    } catch (err) {
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

