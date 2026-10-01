const API_URL = 'http://localhost:8000/api/Residentes';
let idResidenteEdicion = null; // Almacena el ID cuando estamos editando un registro

document.addEventListener('DOMContentLoaded', () => {
    cargarResidentes();
});

// 1. OBTENER Y RENDRERIZAR DATOS (GET)
async function cargarResidentes() {
    try {
        const respuesta = await fetch(API_URL);
        if (!respuesta.ok) throw new Error("Error en la petición GET");
        
        const residentes = await respuesta.json();
        const tablaBody = document.getElementById('tablaResidentesBody');
        
        if (tablaBody) {
            if (!Array.isArray(residentes) || residentes.length === 0) {
                tablaBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 15px; color: #777;">No hay residentes registrados.</td></tr>`;
                return;
            }

            let filas = '';
            residentes.forEach(r => {
                const id = r.idResidente || r.IdResidente;
                const exp = r.noExpediente || r.NoExpediente || '-';
                const nom = r.nombreCompleto || r.NombreCompleto || '-';
                const tut = r.nombreTutor || r.NombreTutor || '-';
                const tel = r.telefonoTutor || r.TelefonoTutor || '-';
                const est = (r.estado !== undefined ? r.estado : r.Estado) ?? true;

                filas += `
                    <tr style="border-bottom: 1px solid #e9ecef;">
                        <td style="padding: 12px; font-weight: 600; color: #2c3e50;">${exp}</td>
                        <td style="padding: 12px; color: #333;">${nom}</td>
                        <td style="padding: 12px; color: #555;">${tut}</td>
                        <td style="padding: 12px; color: #555;">${tel}</td>
                        <td style="padding: 12px;">
                            <span style="background: ${est ? '#e6f4ea' : '#fce8e6'}; color: ${est ? '#1e7e34' : '#c5221f'}; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; font-weight: bold;">
                                ${est ? 'Activo' : 'Inactivo'}
                            </span>
                        </td>
                        <td style="padding: 12px; text-align: center;">
                            <button onclick='prepararEdicion(${JSON.stringify(r)})' title="Editar" style="background: #17a2b8; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 4px;">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button onclick="cambiarEstado(${id}, ${!est})" title="${est ? 'Dar de Baja' : 'Reactivar'}" style="background: ${est ? '#ffc107' : '#28a745'}; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">
                                <i class="fa-solid ${est ? 'fa-user-slash' : 'fa-user-check'}"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            tablaBody.innerHTML = filas;
        }
    } catch (err) {
        console.error("Error al cargar la tabla:", err);
    }
}

// 2. CREAR (POST) O ACTUALIZAR (PUT)
async function guardarResidente(event) {
    event.preventDefault();

    const rawFechaNac = document.getElementById('txtFechaNacimiento').value;
    const fechaNacFormatted = rawFechaNac ? rawFechaNac.split('T')[0] : '';

    const residentePayload = {
        idResidente: idResidenteEdicion || 0,
        noExpediente: document.getElementById('txtExpediente').value,
        nombreCompleto: document.getElementById('txtNombre').value,
        fechaNacimiento: fechaNacFormatted,
        fechaIngreso: new Date().toISOString().split('T')[0], // Se asigna automáticamente la fecha de hoy
        patologia: document.getElementById('txtPatologia').value,
        nombreTutor: document.getElementById('txtTutor').value,
        telefonoTutor: document.getElementById('txtTelefono').value,
        correoTutor: document.getElementById('txtCorreo').value,
        estado: true
    };

    const esEdicion = idResidenteEdicion !== null;
    const url = esEdicion ? `${API_URL}/${idResidenteEdicion}` : API_URL;
    const metodo = esEdicion ? 'PUT' : 'POST';

    try {
        const respuesta = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(residentePayload)
        });

        if (respuesta.ok) {
            mostrarModal("¡Éxito!", `Residente ${esEdicion ? 'actualizado' : 'registrado'} correctamente.`, "exito");
            cancelarEdicion();
            cargarResidentes();
        } else {
            const errorTexto = await respuesta.text();
            mostrarModal("Error del Servidor", errorTexto, "error");
        }
    } catch (err) {
        console.error("Error de red:", err);
        mostrarModal("Error de Conexión", "No se pudo conectar con el servidor.", "error");
    }
}

// Cargar datos en el formulario para editar
function prepararEdicion(r) {
    idResidenteEdicion = r.idResidente || r.IdResidente;

    document.getElementById('txtExpediente').value = r.noExpediente || r.NoExpediente || '';
    document.getElementById('txtNombre').value = r.nombreCompleto || r.NombreCompleto || '';
    
    const fechaNac = r.fechaNacimiento || r.FechaNacimiento || '';
    document.getElementById('txtFechaNacimiento').value = fechaNac ? fechaNac.split('T')[0] : '';
    
    document.getElementById('txtPatologia').value = r.patologia || r.Patologia || '';
    document.getElementById('txtTutor').value = r.nombreTutor || r.NombreTutor || '';
    document.getElementById('txtTelefono').value = r.telefonoTutor || r.TelefonoTutor || '';
    document.getElementById('txtCorreo').value = r.correoTutor || r.CorreoTutor || '';

    const btnGuardar = document.querySelector('.btn-guardar');
    if (btnGuardar) {
        btnGuardar.innerHTML = `<i class="fa-solid fa-rotate"></i> Actualizar Residente`;
        btnGuardar.style.background = '#17a2b8';
    }

    if (!document.getElementById('btnCancelarEdicion')) {
        const btnCancelar = document.createElement('button');
        btnCancelar.id = 'btnCancelarEdicion';
        btnCancelar.type = 'button';
        btnCancelar.className = 'btn-guardar';
        btnCancelar.style.background = '#6c757d';
        btnCancelar.style.marginLeft = '10px';
        btnCancelar.innerHTML = `<i class="fa-solid fa-xmark"></i> Cancelar`;
        btnCancelar.onclick = cancelarEdicion;
        btnGuardar.parentNode.appendChild(btnCancelar);
    }
}

function cancelarEdicion() {
    idResidenteEdicion = null;
    document.getElementById('formResidente').reset();

    const btnGuardar = document.querySelector('.btn-guardar');
    if (btnGuardar) {
        btnGuardar.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Registrar Residente`;
        btnGuardar.style.background = '';
    }

    const btnCancelar = document.getElementById('btnCancelarEdicion');
    if (btnCancelar) btnCancelar.remove();
}

// 3. BORRADO LÓGICO / CAMBIO DE ESTADO
async function cambiarEstado(id, nuevoEstado) {
    const accionTexto = nuevoEstado ? "reactivar" : "dar de baja";
    if (!confirm(`¿Está seguro de que desea ${accionTexto} a este residente?`)) return;

    try {
        const resGet = await fetch(`${API_URL}/${id}`);
        if (!resGet.ok) throw new Error("No se pudo obtener la información actual.");
        
        const residente = await resGet.json();
        residente.estado = nuevoEstado;

        const resPut = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(residente)
        });

        if (resPut.ok) {
            mostrarModal("Estado Actualizado", `El residente ha sido ${nuevoEstado ? 'reactivado' : 'dado de baja'}.`, "exito");
            cargarResidentes();
        } else {
            mostrarModal("Error", "No se pudo actualizar el estado en el servidor.", "error");
        }
    } catch (err) {
        console.error("Error al cambiar estado:", err);
        mostrarModal("Error", "Error de comunicación con el Backend.", "error");
    }
}

// 4. MODAL DINÁMICO UI
function mostrarModal(titulo, mensaje, tipo) {
    let modalExistente = document.getElementById('customModal');
    if (modalExistente) modalExistente.remove();

    const colorIcono = tipo === 'exito' ? '#2e7d32' : '#c62828';
    const icono = tipo === 'exito' ? 'fa-circle-check' : 'fa-circle-xmark';

    const modalHTML = `
        <div id="customModal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;">
            <div style="background: white; border-radius: 12px; padding: 25px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                <i class="fa-solid ${icono}" style="font-size: 3rem; color: ${colorIcono}; margin-bottom: 15px;"></i>
                <h3 style="margin: 0 0 10px 0; color: #333;">${titulo}</h3>
                <p style="color: #666; margin-bottom: 20px; font-size: 0.95rem;">${mensaje}</p>
                <button onclick="cerrarModal()" style="background: ${colorIcono}; color: white; border: none; padding: 10px 24px; border-radius: 6px; cursor: pointer; font-weight: bold;">
                    Aceptar
                </button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function cerrarModal() {
    const modal = document.getElementById('customModal');
    if (modal) modal.remove();
}