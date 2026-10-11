// Reportes (RF-14 / CU-05): el backend .NET arma el reporte con los datos reales
// de la base de datos y el microservicio de PDF (puerto 8002) dibuja el documento.

const PACIENTES_API_URL = "http://localhost:8000/api/Residentes";

const NOMBRES_ARCHIVO = {
    CostosCitas: "costos_citas",
    FichaMedica: "ficha_medica",
    CobrosPaciente: "cobros_paciente",
    PagosFundacion: "pagos_fundacion",
    Entradas: "entradas_de_dinero",
    ExamenesMedicamentos: "examenes_medicamentos",
};

document.addEventListener("DOMContentLoaded", cargarResidentes);

// Llena todos los <select> de residentes de las tarjetas
async function cargarResidentes() {
    const selects = document.querySelectorAll(".sel-residente");
    try {
        const respuesta = await fetch(PACIENTES_API_URL);
        if (!respuesta.ok) throw new Error("Error al cargar residentes");
        const residentes = await respuesta.json();

        selects.forEach(select => {
            const primera = select.options[0].outerHTML;
            select.innerHTML = primera + residentes.map(r =>
                `<option value="${r.idResidente}">${r.noExpediente} - ${r.nombreCompleto}</option>`).join("");
        });
    } catch (err) {
        console.error("Error al cargar residentes:", err);
        selects.forEach(s => { s.options[0].textContent = "No se pudo conectar con pacientes_service"; });
    }
}

// Lee los filtros de la tarjeta, pide el PDF al servidor y lo descarga
async function descargarReporte(boton) {
    const tarjeta = boton.closest(".tarjeta-reporte");
    const reporte = tarjeta.dataset.reporte;

    const params = new URLSearchParams();
    let faltaObligatorio = false;
    tarjeta.querySelectorAll("[data-param]").forEach(campo => {
        if (campo.value) params.append(campo.dataset.param, campo.value);
        else if (campo.classList.contains("sel-obligatorio")) faltaObligatorio = true;
    });
    if (faltaObligatorio) {
        mostrarModal("Falta información", "Seleccione un residente para este reporte.", "error");
        return;
    }

    const desde = params.get("desde"), hasta = params.get("hasta");
    if (desde && hasta && desde > hasta) {
        mostrarModal("Fechas inválidas", "La fecha inicial no puede ser mayor que la final.", "error");
        return;
    }

    const textoOriginal = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generando...';

    try {
        const respuesta = await fetch(`/Reportes/${reporte}?${params.toString()}`);
        if (!respuesta.ok) {
            const detalle = await respuesta.text();
            mostrarModal("No se pudo generar el reporte", detalle || `Error ${respuesta.status}`, "error");
            return;
        }
        const blob = await respuesta.blob();
        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `${NOMBRES_ARCHIVO[reporte] || "reporte"}_${new Date().toISOString().slice(0, 10)}.pdf`;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
        console.error("Error de red:", err);
        mostrarModal("Error de conexión", "No se pudo conectar con el servidor.", "error");
    } finally {
        boton.disabled = false;
        boton.innerHTML = textoOriginal;
    }
}

function mostrarModal(titulo, mensaje, tipo) {
    const existente = document.getElementById("customModal");
    if (existente) existente.remove();

    const color = tipo === "exito" ? "#2e7d32" : "#c62828";
    const icono = tipo === "exito" ? "fa-circle-check" : "fa-circle-xmark";
    const seguro = String(mensaje).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

    document.body.insertAdjacentHTML("beforeend", `
        <div id="customModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;">
            <div style="background: white; border-radius: 12px; padding: 25px; width: 90%; max-width: 420px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <i class="fa-solid ${icono}" style="font-size: 3rem; color: ${color}; margin-bottom: 15px;"></i>
                <h3 style="margin: 0 0 10px 0; color: #333;">${titulo}</h3>
                <p style="color: #666; margin-bottom: 20px; font-size: 0.95rem;">${seguro}</p>
                <button onclick="cerrarModal()" style="background: ${color}; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-weight: bold;">Aceptar</button>
            </div>
        </div>`);
}

function cerrarModal() {
    const modal = document.getElementById("customModal");
    if (modal) modal.remove();
}
