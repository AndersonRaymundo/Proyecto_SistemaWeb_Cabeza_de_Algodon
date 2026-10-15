// Reportes (RF-14 / CU-05): el backend .NET arma el reporte con los datos reales
// de la base de datos y el microservicio de PDF (puerto 8002) dibuja el documento.

const PACIENTES_API_URL = "/api/Pacientes";

const NOMBRES_ARCHIVO = {
    CostosCitas: "costos_citas",
    FichaMedica: "ficha_medica",
    CobrosPaciente: "cobros_paciente",
    PagosFundacion: "pagos_fundacion",
    Entradas: "entradas_de_dinero",
    Examenes: "examenes_por_paciente",
    Medicamentos: "medicamentos_por_paciente",
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

