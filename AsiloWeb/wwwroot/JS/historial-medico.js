// Historial Medico - Asilo Cabeza de Algodon
// Pacientes sigue siendo microservicio (8000). El expediente vive en el
// backend .NET: RF-06 (consulta del historial) y RF-07 (registro de la visita).

const PACIENTES_BUSQUEDA_URL = "/api/Pacientes/busqueda/autocomplete";
const HISTORIAL_API_URL = "/api/Historial";
const CITAS_API_URL = "/api/Citas";
const DESCUENTO_API_URL = "/api/Config/descuento";

let tomSelectInstance = null;
let porcentajeDescuento = 0;

const fechaLarga = f => (f ? new Date(f).toLocaleString("es-GT") : "-");

document.addEventListener("DOMContentLoaded", () => {
    reiniciarListasClinicas("eval-examenes", "eval-medicamentos");
    inicializarTomSelect();
    cargarDescuento();

    const form = document.getElementById("form-ficha-medica");
    if (form) form.addEventListener("submit", registrarFicha);

    const precio = document.getElementById("precio-consulta");
    if (precio) {
        precio.addEventListener("input", () => {
            const lista = parseFloat(precio.value) || 0;
            document.getElementById("precio-final").textContent =
                lista > 0 ? `Se cobrará ${quetzales(lista * (1 - porcentajeDescuento / 100))} al familiar (descuento de la fundación ${porcentajeDescuento}%).` : "";
        });
    }
});

async function cargarDescuento() {
    try {
        const r = await fetch(DESCUENTO_API_URL);
        if (r.ok) porcentajeDescuento = (await r.json()).porcentaje || 0;
    } catch (e) { /* sin descuento visible */ }
}

function inicializarTomSelect() {
    const selectElem = document.getElementById("select-paciente-historial");
    if (!selectElem) return;

    tomSelectInstance = new TomSelect("#select-paciente-historial", {
        valueField: "id",
        labelField: "text",
        searchField: "text",
        placeholder: "Escriba el nombre o expediente...",
        load: function (query, callback) {
            if (!query.length) return callback();
            fetch(`${PACIENTES_BUSQUEDA_URL}?q=${encodeURIComponent(query)}`)
                .then(response => response.json())
                .then(json => callback(json))
                .catch(() => callback());
        },
        onChange: function (idResidente) {
            document.getElementById("btnNuevaEvaluacion").disabled = !idResidente;
            if (idResidente) cargarHistorial(idResidente);
            else mostrarVacio();
        }
    });
}

function mostrarVacio() {
    document.getElementById("contenedor-historial").innerHTML =
        '<div class="formulario-datos"><p class="vacio">Seleccione un residente para consultar su expediente clínico.</p></div>';
}

// RF-06: ficha base + consultas + examenes + medicamentos del residente
async function cargarHistorial(idResidente) {
    const contenedor = document.getElementById("contenedor-historial");
    contenedor.innerHTML = "<p>Cargando expediente...</p>";

    try {
        const respuesta = await fetch(`${HISTORIAL_API_URL}/expediente/${idResidente}`);
        if (!respuesta.ok) throw new Error("Error al cargar el expediente");
        const { ficha, citas, examenes, medicamentos } = await respuesta.json();

        const vacio = txt => `<p class="vacio">${txt}</p>`;
        const dato = (etiqueta, valor) => `<div class="dato-clinico"><span>${etiqueta}</span><span>${valor || "<em>Sin registrar</em>"}</span></div>`;

        const textoPatologias = f => (f.patologias || []).map(p => p.observaciones ? `${p.nombre} (${p.observaciones})` : p.nombre).join(", ");
        const textoCajon = f => (f.medicamentosCajon || []).map(m => [m.nombreMedicamento, m.dosis, m.frecuencia].filter(Boolean).join(" ")).join(", ");

        const fichaHtml = ficha
            ? dato("Patologías / condiciones", esc(textoPatologias(ficha) || ficha.diagnosticoBase)) + dato("Medicamentos de cajón", esc(textoCajon(ficha)))
            : vacio("Este residente aún no tiene ficha base. Se crea al registrarlo en Pacientes.");

        const consultasHtml = citas.length ? citas.map(c => `
            <div class="registro-clinico">
                <p class="titulo">${fechaLarga(c.fechaCita || c.fechaSolicitud)} - ${esc(c.especialidadSolicitada)}
                    <span style="color:#64748b; font-weight:600; font-size:.82rem;">(${esc(c.estado)})</span></p>
                ${c.medicoNombre ? `<p><strong>Médico tratante:</strong> ${esc(c.medicoNombre)}</p>` : ""}
<p><strong>Motivo:</strong> ${esc(c.motivo)}</p>
                ${c.diagnosticoConsulta ? `<p><strong>Diagnóstico:</strong> ${esc(c.diagnosticoConsulta)}</p>` : ""}
                ${c.observaciones ? `<p><strong>Observaciones:</strong> ${esc(c.observaciones)}</p>` : ""}
            </div>`).join("") : vacio("Sin consultas registradas.");

        const examenesHtml = examenes.length ? examenes.map(e => `
            <div class="registro-clinico">
                <p class="titulo">${esc(e.tipoExamen)} <span style="color:#64748b; font-weight:600; font-size:.82rem;">(${fechaLarga(e.fechaRegistro)})</span></p>
                <p>${e.resultados ? esc(e.resultados) : "<em>Resultado pendiente</em>"}</p>
            </div>`).join("") : vacio("Sin exámenes registrados.");

        const medicacionHtml = medicamentos.length ? medicamentos.map(m => `
            <div class="registro-clinico">
                <p class="titulo">${esc(m.nombreMedicamento)}
                    <span style="color:#64748b; font-weight:600; font-size:.82rem;">(${m.despachado ? "despachado" : "pendiente en farmacia"})</span></p>
                <p>${m.cantidad ? esc(m.cantidad) : ""}${m.cantidad && m.tiempoAplicacion ? " - " : ""}${m.tiempoAplicacion ? esc(m.tiempoAplicacion) : ""}</p>
                <p style="color:#64748b; font-size:.85rem;">${fechaLarga(m.fechaDespacho)}</p>
            </div>`).join("") : vacio("Sin medicación registrada.");

        const pestana = (id, icono, texto, n, activa) =>
            `<button type="button" class="pestana${activa ? " activa" : ""}" data-pestana="${id}"><i class="fa-solid ${icono}"></i> ${texto}${n === null ? "" : ` <span class="contador">${n}</span>`}</button>`;
        const contenido = (id, titulo, cuerpo, activa) =>
            `<section id="${id}" class="pestana-contenido${activa ? " activa" : ""}"><div class="formulario-datos"><h2>${titulo}</h2>${cuerpo}</div></section>`;

        const html = `
            <div class="pestanas">
                ${pestana("exp-ficha", "fa-file-medical", "Ficha base", null, true)}
                ${pestana("exp-consultas", "fa-stethoscope", "Consultas", citas.length, false)}
                ${pestana("exp-examenes", "fa-microscope", "Exámenes", examenes.length, false)}
                ${pestana("exp-medicacion", "fa-pills", "Medicación", medicamentos.length, false)}
            </div>
            ${contenido("exp-ficha", '<i class="fa-solid fa-file-medical"></i> Ficha médica base', fichaHtml, true)}
            ${contenido("exp-consultas", '<i class="fa-solid fa-stethoscope"></i> Consultas y visitas médicas', consultasHtml, false)}
            ${contenido("exp-examenes", '<i class="fa-solid fa-microscope"></i> Exámenes de laboratorio', examenesHtml, false)}
            ${contenido("exp-medicacion", '<i class="fa-solid fa-pills"></i> Medicación recetada / aplicada', medicacionHtml, false)}`;

        contenedor.innerHTML = html;
    } catch (err) {
        console.error("Error al cargar el expediente:", err);
        contenedor.innerHTML = "<p style='color:#c62828;'>No se pudo cargar el expediente.</p>";
    }
}

// RF-07: registrar la consulta (con examen y medicamento opcionales)
async function registrarFicha(event) {
    event.preventDefault();

    const idResidente = tomSelectInstance ? tomSelectInstance.getValue() : "";
    if (!idResidente) {
        mostrarModal("Falta información", "Seleccione primero un residente.", "error");
        return;
    }

    const val = id => document.getElementById(id).value.trim();
    const idDoctorGuardado = parseInt(localStorage.getItem("id_usuario"), 10);

    const payload = {
        idPaciente: parseInt(idResidente, 10),
        idDoctor: Number.isNaN(idDoctorGuardado) ? null : idDoctorGuardado,
        motivo: val("motivo"),
        diagnosticoConsulta: val("diagnostico"),
        examenes: leerExamenes("eval-examenes"),
        medicamentos: leerMedicamentos("eval-medicamentos"),
        precioLista: parseFloat(val("precio-consulta")) || 0,
        observaciones: val("observaciones") || null,
    };

    try {
        const respuesta = await fetch(`${CITAS_API_URL}/registro-directo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (respuesta.ok) {
            mostrarModal("¡Éxito!", "Ficha clínica registrada correctamente.", "exito");
            document.getElementById("form-ficha-medica").reset();
            reiniciarListasClinicas("eval-examenes", "eval-medicamentos");
            document.getElementById("precio-final").textContent = "";
            cerrarPaneles();
            cargarHistorial(idResidente);
        } else {
            mostrarModal("Error del servidor", (await respuesta.text()) || `Error ${respuesta.status}`, "error");
        }
    } catch (err) {
        console.error("Error de red:", err);
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    }
}

