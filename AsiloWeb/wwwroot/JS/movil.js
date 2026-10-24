// Version para celular 
// 1) El menu lateral se abre como un cajon con el boton de hamburguesa.
// 2) Las tablas se muestran como tarjetas;
(function () {
    const ANCHO_MAXIMO_MOVIL = 760;

    // ---- Menu lateral como cajon -----------------------------------------------------------------
    const boton = document.getElementById("btn-menu-movil");
    if (boton) {
        const fondo = document.createElement("div");
        fondo.className = "menu-fondo";
        document.body.appendChild(fondo);

        const abrir = abierto => {
            document.body.classList.toggle("menu-abierto", abierto);
            boton.setAttribute("aria-expanded", String(abierto));
        };
        boton.addEventListener("click", () => abrir(!document.body.classList.contains("menu-abierto")));
        fondo.addEventListener("click", () => abrir(false));
        document.addEventListener("keydown", e => { if (e.key === "Escape" && document.body.classList.contains("menu-abierto")) abrir(false); });
        window.addEventListener("resize", () => { if (window.innerWidth > ANCHO_MAXIMO_MOVIL) abrir(false); });
    }

    // ---- Tablas como tarjetas --------------------------------------------------------------------
    // Las tablas se arman con JavaScript en cada pantalla, asi que el nombre de cada columna se copia
    // a cada celda (data-label) cada vez que aparece o cambia una tabla.
    function etiquetar(tabla) {
        const titulos = [...tabla.querySelectorAll("thead th")].map(th => th.textContent.trim());
        if (!titulos.length) return;
        tabla.querySelectorAll("tbody tr, tfoot tr").forEach(fila => {
            let columna = 0;
            [...fila.children].forEach(celda => {
                const abarca = celda.colSpan || 1;
                // una celda que abarca varias columnas (por ejemplo "Totales") queda sin nombre
                if (celda.dataset.label === undefined) celda.dataset.label = abarca > 1 ? "" : (titulos[columna] || "");
                columna += abarca;
            });
        });
    }
    const etiquetarTodas = () => document.querySelectorAll("table").forEach(etiquetar);

    let pendiente = null;
    new MutationObserver(() => { clearTimeout(pendiente); pendiente = setTimeout(etiquetarTodas, 40); })
        .observe(document.body, { childList: true, subtree: true });
    etiquetarTodas();
})();
