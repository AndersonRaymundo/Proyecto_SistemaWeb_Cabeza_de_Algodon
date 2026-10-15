// Pantalla de Configuracion (solo lectura): muestra los parametros vigentes del sistema.
(function () {
    const descuento = document.getElementById("valor-descuento");
    const usuario = document.getElementById("valor-usuario");
    const rol = document.getElementById("valor-rol");

    usuario.textContent = localStorage.getItem("nombre_usuario") || "—";
    rol.textContent = localStorage.getItem("rol_usuario") || "—";

    fetch("/api/Config/descuento")
        .then(r => (r.ok ? r.json() : Promise.reject()))
        .then(d => { descuento.textContent = d.porcentaje + "%"; })
        .catch(() => { descuento.textContent = "No disponible"; });
})();
