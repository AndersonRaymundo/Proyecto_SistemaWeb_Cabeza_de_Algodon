// Control de roles del menu (lado navegador).
// La seguridad REAL la hace el servidor (cookie de sesion + [Authorize] en cada
// pagina y en la API, RNF-02). Este script solo muestra u oculta las opciones
// del menu segun el rol que el servidor reporta para la sesion actual.
document.addEventListener("DOMContentLoaded", async function () {
    const menu = document.querySelector(".menu-lateral");
    if (menu) menu.style.visibility = "hidden"; // evita ver opciones que luego se ocultan

    let sesion = null;
    try {
        const respuesta = await fetch("/api/Auth/sesion");
        if (respuesta.ok) sesion = await respuesta.json();
    } catch (e) { /* servidor no disponible */ }

    // Sin sesion valida -> al login
    if (!sesion || !sesion.rol) {
        localStorage.clear();
        window.location.href = "/Auth/Login";
        return;
    }

    const rolActual = sesion.rol;
    const nombreUsuario = sesion.nombreCompleto || sesion.nombreUsuario || "";
    localStorage.setItem("id_usuario", sesion.idUsuario);
    localStorage.setItem("nombre_usuario", nombreUsuario);
    localStorage.setItem("rol_usuario", rolActual);

    // Perfil en el encabezado
    const elRol = document.getElementById("rol-usuario");
    const elNombre = document.getElementById("nombre-usuario");
    const elAvatar = document.getElementById("avatar-usuario");
    if (elRol) elRol.textContent = rolActual;
    if (elNombre) elNombre.textContent = nombreUsuario;
    if (elAvatar && nombreUsuario) elAvatar.textContent = nombreUsuario.trim().charAt(0).toUpperCase();

    // Filtrar opciones del menu segun el rol
    document.querySelectorAll(".menu-lateral .opcion-menu, .tarjeta-modulo").forEach(opcion => {
        const rolesPermitidos = opcion.getAttribute("data-rol");
        if (rolesPermitidos && !rolesPermitidos.split(",").includes(rolActual)) {
            opcion.style.display = "none";
        }
    });
    if (menu) menu.style.visibility = "visible";

    // Pantalla de Inicio: saludo con el nombre y fecha de hoy
    const elSaludo = document.getElementById("bienvenida-nombre");
    if (elSaludo && nombreUsuario) elSaludo.textContent = nombreUsuario;
    const elFecha = document.getElementById("fecha-hoy");
    if (elFecha) {
        const f = new Date().toLocaleDateString("es-GT", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
        elFecha.textContent = f.charAt(0).toUpperCase() + f.slice(1);
    }

    // Aviso para que cada pagina sepa el rol (lo usan Citas, Laboratorio y Farmacia)
    window.ROL_ACTUAL = rolActual;
    document.dispatchEvent(new CustomEvent("sesion-lista", { detail: sesion }));

    // Cierre de sesion con confirmacion (cierra tambien la sesion del servidor)
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
});
