// ===========================================================================
// ui.js  -  Utilidades de interfaz compartidas por las pantallas internas
//   * Pestañas      : <button data-pestana="id-del-contenido"> ... </button>
//   * Ventanas      : <button data-abrir="id-de-la-ventana"> abre un .panel-fondo
//                     <button data-cerrar> dentro de la ventana la cierra
//   Tambien se cierran con la tecla Esc o con un clic en el fondo oscuro.
// ===========================================================================
(function () {
    // ---------------------------------------------------------- ventanas
    function abrirPanel(id) {
        const panel = document.getElementById(id);
        if (!panel) return;
        panel.classList.add("abierto");
        document.body.classList.add("panel-abierto");
        const primerCampo = panel.querySelector("input:not([type=hidden]):not([readonly]), select, textarea");
        if (primerCampo) setTimeout(() => primerCampo.focus(), 60);
    }

    function cerrarPanel(id) {
        const panel = document.getElementById(id);
        if (panel) {
            panel.classList.remove("abierto");
            if (panel.dataset.efimero !== undefined) panel.remove(); // ventanas creadas por JS
        }
        if (!document.querySelector(".panel-fondo.abierto")) document.body.classList.remove("panel-abierto");
    }

    function cerrarPaneles() {
        document.querySelectorAll(".panel-fondo.abierto").forEach(p => cerrarPanel(p.id));
    }

    // ---------------------------------------------------------- pestañas
    function activarPestana(idContenido) {
        const boton = document.querySelector(`[data-pestana="${idContenido}"]`);
        if (!boton) return;
        const grupo = boton.parentElement.querySelectorAll("[data-pestana]");
        grupo.forEach(b => {
            const activa = b === boton;
            b.classList.toggle("activa", activa);
            const contenido = document.getElementById(b.dataset.pestana);
            if (contenido) contenido.classList.toggle("activa", activa);
        });
    }

    // ---------------------------------------------------------- eventos
    document.addEventListener("click", function (e) {
        const abrir = e.target.closest("[data-abrir]");
        if (abrir) { abrirPanel(abrir.dataset.abrir); return; }

        const cerrar = e.target.closest("[data-cerrar]");
        if (cerrar) {
            const panel = cerrar.closest(".panel-fondo");
            if (panel) cerrarPanel(panel.id);
            return;
        }

        if (e.target.classList && e.target.classList.contains("panel-fondo")) {
            cerrarPanel(e.target.id); // clic en el fondo oscuro
            return;
        }

        const pestana = e.target.closest("[data-pestana]");
        if (pestana) activarPestana(pestana.dataset.pestana);
    });

    document.addEventListener("keydown", function (e) {
        if (e.key !== "Escape") return;
        const abiertos = document.querySelectorAll(".panel-fondo.abierto");
        if (abiertos.length) cerrarPanel(abiertos[abiertos.length - 1].id);
    });

    window.abrirPanel = abrirPanel;
    window.cerrarPanel = cerrarPanel;
    window.cerrarPaneles = cerrarPaneles;
    window.activarPestana = activarPestana;
})();
