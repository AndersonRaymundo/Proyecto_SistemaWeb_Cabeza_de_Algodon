// Ventana propia para confirmar una accion. Reemplaza al confirm() del navegador, que se ve como
// "localhost dice" y no tiene el estilo del sistema. Esta en todas las pantallas (la carga el encabezado).
//
//   if (!await confirmar({ titulo: "Dar de baja", mensaje: "...", textoAceptar: "Dar de baja", peligro: true })) return;
//
// Devuelve true si la persona acepta y false si pulsa Volver, la tecla Esc o el fondo oscuro.
function confirmar({ titulo, mensaje, textoAceptar = "Aceptar", textoCancelar = "Volver", peligro = false }) {
    return new Promise(resolver => {
        const fondo = document.createElement("div");
        fondo.className = "panel-fondo abierto";
        fondo.innerHTML = `
            <div class="panel" role="alertdialog" aria-modal="true" aria-labelledby="confirmar-titulo">
                <div class="panel-cabecera"><h2 id="confirmar-titulo"></h2></div>
                <div class="panel-cuerpo">
                    <p class="confirmar-mensaje"></p>
                    <div class="panel-pie">
                        <button type="button" class="btn-guardar btn-secundario" data-no></button>
                        <button type="button" class="btn-guardar${peligro ? " btn-peligro" : ""}" data-si></button>
                    </div>
                </div>
            </div>`;
        fondo.querySelector("#confirmar-titulo").textContent = titulo;
        fondo.querySelector(".confirmar-mensaje").textContent = mensaje;
        fondo.querySelector("[data-no]").textContent = textoCancelar;
        fondo.querySelector("[data-si]").textContent = textoAceptar;

        const teclas = e => { if (e.key === "Escape") { e.stopPropagation(); cerrar(false); } };
        const cerrar = valor => {
            document.removeEventListener("keydown", teclas, true);
            fondo.remove();
            if (!document.querySelector(".panel-fondo.abierto")) document.body.classList.remove("panel-abierto");
            resolver(valor);
        };
        fondo.querySelector("[data-no]").addEventListener("click", () => cerrar(false));
        fondo.querySelector("[data-si]").addEventListener("click", () => cerrar(true));
        fondo.addEventListener("mousedown", e => { if (e.target === fondo) cerrar(false); });
        document.addEventListener("keydown", teclas, true);

        document.body.appendChild(fondo);
        document.body.classList.add("panel-abierto");
        // En una accion delicada el foco queda en "Volver", para que un Enter distraido no la confirme
        fondo.querySelector(peligro ? "[data-no]" : "[data-si]").focus();
    });
}
