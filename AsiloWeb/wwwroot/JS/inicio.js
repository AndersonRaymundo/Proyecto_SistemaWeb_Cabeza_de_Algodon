// Inicio: vista general del medico. Muestra sus citas agendadas y cuales ya pasaron
// sin que se haya registrado la visita. Los demas roles no ven esta seccion.
(async function () {
    const seccion = document.getElementById("mi-agenda");
    if (!seccion) return;
    const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const cuando = f => new Date(f).toLocaleString("es-GT", { weekday: "short", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true });

    try {
        const sesion = await (await fetch("/api/Auth/sesion")).json();
        if (sesion.rol !== "DOCTOR") return;

        const [respCitas, respResidentes] = await Promise.all([fetch("/api/Citas?estado=Agendada"), fetch("/api/Pacientes")]);
        if (!respCitas.ok) return;
        const citas = await respCitas.json();
        const residentes = respResidentes.ok ? await respResidentes.json() : [];
        const nombres = Object.fromEntries(residentes.map(r => [r.idResidente, r.nombreCompleto]));

        const mias = citas
            .filter(c => Number(c.idDoctor) === Number(sesion.idUsuario) && c.fechaCita)
            .sort((a, b) => new Date(a.fechaCita) - new Date(b.fechaCita));

        const ahora = new Date();
        const hoy = ahora.toDateString();
        const porRegistrar = mias.filter(c => new Date(c.fechaCita) < ahora);
        const deHoy = mias.filter(c => new Date(c.fechaCita).toDateString() === hoy);

        seccion.style.display = "block";
        document.getElementById("mi-agenda-resumen").innerHTML = `
            <span class="chip chip-cancelado">${mias.length} cita(s) agendada(s)</span>
            <span class="chip ${deHoy.length ? "chip-debe" : "chip-aldia"}">${deHoy.length} para hoy</span>
            <span class="chip ${porRegistrar.length ? "chip-debe" : "chip-aldia"}">${porRegistrar.length} por registrar</span>`;

        document.getElementById("mi-agenda-lista").innerHTML = mias.length
            ? mias.slice(0, 8).map(c => {
                const pasada = new Date(c.fechaCita) < ahora;
                const esHoy = new Date(c.fechaCita).toDateString() === hoy;
                return `<div class="fila-agenda">
                    <div><strong>${esc(nombres[c.idPaciente] || "Residente #" + c.idPaciente)}</strong>
                        <small>${esc(c.especialidadSolicitada)} · ${esc(c.motivo)}</small></div>
                    <div class="fila-agenda-derecha">
                        <span>${esc(cuando(c.fechaCita))}</span>
                        ${pasada ? '<span class="chip chip-debe">Registrar visita</span>' : (esHoy ? '<span class="chip chip-cancelado">Hoy</span>' : "")}
                    </div></div>`;
            }).join("") + `<p style="margin-top:12px;"><a href="/Citas" class="btn-guardar" style="text-decoration:none; display:inline-block;">Ir a Solicitudes y Citas</a></p>`
            : '<p style="color:#64748b;">No tiene citas agendadas por ahora.</p>';
    } catch (err) {
        console.error("No se pudo cargar la agenda del medico:", err);
    }
})();
