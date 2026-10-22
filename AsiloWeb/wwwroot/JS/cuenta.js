// Cambiar la contrasena propia (boton de la llave en el encabezado de todas las pantallas).
// Es autonomo: arma su propia ventana, asi que no depende de otros scripts de la pagina.
(function () {
    const boton = document.getElementById("btn-mi-cuenta");
    if (!boton) return;

    const fondo = document.createElement("div");
    fondo.className = "panel-fondo";
    fondo.id = "panel-mi-cuenta";
    fondo.innerHTML = `
        <div class="panel" role="dialog" aria-modal="true">
            <div class="panel-cabecera">
                <h2><i class="fa-solid fa-key"></i> Cambiar mi contraseña</h2>
                <button type="button" class="panel-cerrar" data-cuenta-cerrar aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="panel-cuerpo">
                <form id="form-mi-cuenta" autocomplete="off">
                    <div class="grupo-campo"><label>Contraseña actual:</label>
                        <input type="password" id="cuenta-actual" required autocomplete="current-password"></div>
                    <div class="grupo-campo"><label>Contraseña nueva:</label>
                        <input type="password" id="cuenta-nueva" required autocomplete="new-password"></div>
                    <div class="grupo-campo"><label>Repetir la contraseña nueva:</label>
                        <input type="password" id="cuenta-nueva2" required autocomplete="new-password"></div>
                    <p style="color:#64748b; font-size:.85rem; margin:0 0 6px;">Al menos 8 caracteres, con letras y números.</p>
                    <p id="cuenta-mensaje" style="min-height:1.3em; margin:4px 0; font-weight:600;"></p>
                    <div class="panel-pie">
                        <button type="button" class="btn-guardar btn-secundario" data-cuenta-cerrar>Cancelar</button>
                        <button type="submit" class="btn-guardar"><i class="fa-solid fa-floppy-disk"></i> Guardar contraseña</button>
                    </div>
                </form>
            </div>
        </div>`;
    document.body.appendChild(fondo);

    const formulario = fondo.querySelector("#form-mi-cuenta");
    const mensaje = fondo.querySelector("#cuenta-mensaje");
    const decir = (texto, bien) => { mensaje.textContent = texto; mensaje.style.color = bien ? "#1e7e34" : "#c62828"; };
    const abrir = () => { formulario.reset(); decir("", true); fondo.classList.add("abierto"); document.body.classList.add("panel-abierto"); setTimeout(() => fondo.querySelector("#cuenta-actual").focus(), 80); };
    const cerrar = () => { fondo.classList.remove("abierto"); document.body.classList.remove("panel-abierto"); };

    boton.addEventListener("click", abrir);
    fondo.querySelectorAll("[data-cuenta-cerrar]").forEach(b => b.addEventListener("click", cerrar));
    fondo.addEventListener("mousedown", e => { if (e.target === fondo) cerrar(); });

    formulario.addEventListener("submit", async e => {
        e.preventDefault();
        const actual = fondo.querySelector("#cuenta-actual").value;
        const nueva = fondo.querySelector("#cuenta-nueva").value;
        // Misma regla que el servidor: 8 caracteres o mas, con letras y numeros
        if (nueva.length < 8 || !/[A-Za-z]/.test(nueva) || !/\d/.test(nueva)) { decir("La contraseña debe tener al menos 8 caracteres e incluir letras y números.", false); return; }
        if (nueva !== fondo.querySelector("#cuenta-nueva2").value) { decir("Las dos contraseñas nuevas no coinciden.", false); return; }
        if (nueva === actual) { decir("La contraseña nueva debe ser distinta de la actual.", false); return; }
        try {
            const respuesta = await fetch("/api/Auth/mi-contrasena", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ actual, nueva }),
            });
            const datos = await respuesta.json().catch(() => null);
            if (!respuesta.ok) { decir((datos && datos.message) || "No se pudo cambiar la contraseña.", false); return; }
            decir(datos.message || "Contraseña actualizada.", true);
            setTimeout(cerrar, 1400);
        } catch (err) {
            decir("No se pudo conectar con el servidor.", false);
        }
    });
})();
