// Control de roles del menu (lado navegador).
//
// La seguridad REAL la hace el servidor (cookie de sesion + [Authorize] en cada
// pagina y en la API, RNF-02). Este script solo muestra u oculta opciones.
//
// Para que al navegar no haya parpadeos ni esperas:
//   1) Si el login ya dejo el rol guardado en el navegador, el menu se arma al
//      instante, sin esperar al servidor, y las pantallas empiezan a pedir sus
//      datos de inmediato.
//   2) En segundo plano se confirma con el servidor que la sesion sigue vigente.
//      Si ya no lo esta, se regresa al login.
//   3) Solo si no hay rol guardado (primera vez) se espera la respuesta del servidor.
(function () {
    const menu = document.querySelector(".menu-lateral");

    // ---- pinta el perfil, filtra el menu y avisa a la pantalla ----------------
    function aplicar(sesion) {
        const rol = sesion.rol;
        const nombre = sesion.nombreCompleto || sesion.nombreUsuario || "";

        const elRol = document.getElementById("rol-usuario");
        const elNombre = document.getElementById("nombre-usuario");
        const elAvatar = document.getElementById("avatar-usuario");
        if (elRol) elRol.textContent = rol;
        if (elNombre) elNombre.textContent = nombre;
        if (elAvatar && nombre) elAvatar.textContent = nombre.trim().charAt(0).toUpperCase();

        // opciones del menu y tarjetas de Inicio segun el rol
        document.querySelectorAll(".menu-lateral .opcion-menu, .tarjeta-modulo").forEach(opcion => {
            const permitidos = opcion.getAttribute("data-rol");
            if (permitidos && !permitidos.split(",").includes(rol)) opcion.style.display = "none";
        });
        if (menu) menu.style.visibility = "visible";

        // Pantalla de Inicio: saludo con el nombre y fecha de hoy
        const elSaludo = document.getElementById("bienvenida-nombre");
        if (elSaludo && nombre) elSaludo.textContent = nombre;
        const elFecha = document.getElementById("fecha-hoy");
        if (elFecha) {
            const f = new Date().toLocaleDateString("es-GT", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
            elFecha.textContent = f.charAt(0).toUpperCase() + f.slice(1);
        }

        // las pantallas leen el rol de aqui (Citas, Laboratorio y Farmacia)
        window.ROL_ACTUAL = rol;
        document.dispatchEvent(new CustomEvent("sesion-lista", { detail: sesion }));
    }

    function irAlLogin() {
        localStorage.clear();
        window.location.href = "/Auth/Login";
    }

    // ---- cierre de sesion (cierra tambien la sesion del servidor) ---------------
    const btnSalir = document.getElementById("btn-cerrar-sesion");
    if (btnSalir) {
        btnSalir.addEventListener("click", async function (evento) {
            evento.preventDefault();
            if (!confirm("¿Está seguro de que desea cerrar la sesión actual?")) return;
            try { await fetch("/api/Auth/logout", { method: "POST" }); } catch (e) { }
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = "/Auth/Login";
        });
    }

    // ---- 1) camino rapido: el rol ya esta guardado en el navegador --------------
    const rolGuardado = localStorage.getItem("rol_usuario");
    if (rolGuardado) {
        aplicar({
            idUsuario: parseInt(localStorage.getItem("id_usuario"), 10) || 0,
            nombreCompleto: localStorage.getItem("nombre_usuario") || "",
            rol: rolGuardado,
        });
    } else if (menu) {
        menu.style.visibility = "hidden"; // sin rol guardado, se espera al servidor
    }

    // ---- 2) confirmacion en segundo plano con el servidor -----------------------
    fetch("/api/Auth/sesion")
        .then(r => (r.ok ? r.json() : null))
        .then(sesion => {
            if (!sesion || !sesion.rol) { irAlLogin(); return; }

            localStorage.setItem("id_usuario", sesion.idUsuario);
            localStorage.setItem("nombre_usuario", sesion.nombreCompleto || sesion.nombreUsuario || "");
            localStorage.setItem("rol_usuario", sesion.rol);

            if (!rolGuardado) aplicar(sesion);                 // 3) primera vez
            else if (sesion.rol !== rolGuardado) location.reload(); // el rol cambio: recargar una vez
        })
        .catch(() => { /* servidor no disponible: se deja lo que ya se ve */ });
})();
