document.addEventListener("DOMContentLoaded", function () {
    // 1. Obtener datos de la sesión
    const rolActual = localStorage.getItem("rol_usuario") || "ADMINISTRADOR";
    const nombreUsuario = localStorage.getItem("nombre_usuario") || "Dr. Raymundo";

    // 2. Insertar perfil en el Header
    const elRol = document.getElementById("rol-usuario");
    const elNombre = document.getElementById("nombre-usuario");
    if (elRol) elRol.textContent = rolActual;
    if (elNombre) elNombre.textContent = nombreUsuario;

    // 3. Filtrar opciones según el rol
    const opcionesMenu = document.querySelectorAll(".menu-lateral .opcion-menu");
    opcionesMenu.forEach(opcion => {
        const rolesPermitidos = opcion.getAttribute("data-rol");
        if (rolesPermitidos) {
            const listaRoles = rolesPermitidos.split(",");
            if (!listaRoles.includes(rolActual)) {
                opcion.style.display = "none";
            }
        }
    });

    // 4. MANEJO DE CIERRE DE SESIÓN CON CONFIRMACIÓN
    const btnSalir = document.getElementById("btn-cerrar-sesion");
    if (btnSalir) {
        btnSalir.addEventListener("click", function (evento) {
            evento.preventDefault();

            const confirmar = confirm("¿Está seguro de que desea cerrar la sesión actual?");
            if (confirmar) {
                localStorage.clear();
                sessionStorage.clear();
                const rutaLogin = this.getAttribute("href");
                window.location.href = rutaLogin;
            }
        });
    }
});