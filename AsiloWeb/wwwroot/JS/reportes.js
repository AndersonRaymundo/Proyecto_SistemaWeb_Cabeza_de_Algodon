async function generarReportePDF(id, nombre, notas) {
    try {
        const response = await fetch("http://localhost:8002/generate-pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                patient_id: id,
                patient_name: nombre,
                notes: notas
            })
        });

        if (!response.ok) throw new Error("Error al generar el PDF");

        // Convertir la respuesta HTTP a un ArrayBuffer e instanciar el Blob PDF
        const arrayBuffer = await response.arrayBuffer();
        const blob = new Blob([arrayBuffer], { type: "application/pdf" });
        const downloadUrl = window.URL.createObjectURL(blob);

        mostrarVentanaEmergente(nombre, downloadUrl, `reporte_${id}.pdf`);
    } catch (error) {
        console.error("Error al conectar con el microservicio de PDF:", error);
        alert("⚠️ No se pudo generar el reporte. Verifica que el servidor esté activo.");
    }
}

function mostrarVentanaEmergente(titulo, urlDescarga, nombreArchivo) {
    const modalExistente = document.getElementById("modal-pdf");
    if (modalExistente) modalExistente.remove();

    const modalHTML = `
        <div id="modal-pdf" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; z-index:9999;">
            <div style="background:#fff; padding:25px; border-radius:10px; text-align:center; max-width:420px; width:90%; box-shadow:0 4px 12px rgba(0,0,0,0.3); font-family: sans-serif;">
                <div style="font-size: 45px; color: #28a745; margin-bottom: 10px;">📄</div>
                <h2 style="margin:0 0 10px 0; color:#333; font-size: 18px;">Reporte Generado con Éxito</h2>
                <p style="color:#666; font-size:14px; margin-bottom:20px;">Documento: <b>${titulo}</b></p>
                <div style="display:flex; gap:10px; justify-content:center;">
                    <a href="${urlDescarga}" download="${nombreArchivo}" style="background:#007bff; color:#fff; padding:10px 18px; text-decoration:none; border-radius:5px; font-weight:bold; font-size:14px;">Descargar PDF</a>
                    <button onclick="cerrarModalPDF()" style="background:#6c757d; color:#fff; border:none; padding:10px 18px; border-radius:5px; cursor:pointer; font-weight:bold; font-size:14px;">Cerrar</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML("beforeend", modalHTML);
}

function cerrarModalPDF() {
    const modal = document.getElementById("modal-pdf");
    if (modal) modal.remove();
}