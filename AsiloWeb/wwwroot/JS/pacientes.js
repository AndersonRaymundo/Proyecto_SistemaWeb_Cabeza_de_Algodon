const API_URL = 'http://localhost:8000/api/Residentes';
const EMAIL_SERVICE_URL = 'http://localhost:8001/send-email';
let idResidenteEdicion = null; // Almacena el ID cuando estamos editando un registro

document.addEventListener('DOMContentLoaded', () => {
    cargarResidentes();
});

// 1. OBTENER Y RENDERIZAR DATOS (GET)
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
                const correo = r.correoTutor || r.CorreoTutor || '';
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
                            <button onclick='abrirModalEmail("${correo}", "${nom}", "${tut}")' title="Enviar Correo al Tutor" style="background: #007bff; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin-right: 4px;">
                                <i class="fa-solid fa-envelope"></i>
                            </button>
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
    const correoTutor = document.getElementById('txtCorreo').value;
    const nombreTutor = document.getElementById('txtTutor').value;
    const nombrePaciente = document.getElementById('txtNombre').value;

    const residentePayload = {
        idResidente: idResidenteEdicion || 0,
        noExpediente: document.getElementById('txtExpediente').value,
        nombreCompleto: nombrePaciente,
        fechaNacimiento: fechaNacFormatted,
        fechaIngreso: new Date().toISOString().split('T')[0],
        patologia: document.getElementById('txtPatologia').value,
        nombreTutor: nombreTutor,
        telefonoTutor: document.getElementById('txtTelefono').value,
        correoTutor: correoTutor,
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
            
            // Envío automático de bienvenida únicamente al REGISTRAR (no al editar)
            if (!esEdicion && correoTutor) {
                dispararNotificacionAutomaticaIngreso(correoTutor, nombreTutor, nombrePaciente);
            }

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

// Envío automático de correo
function dispararNotificacionAutomaticaIngreso(correo, tutor, paciente) {
    fetch(EMAIL_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            recipient: correo,
            subject: `Bienvenido a Asilo Cabeza de Algodón - ${paciente}`,
            body: `<div style="font-family: Arial, sans-serif;">
                     <h2>Asilo Cabeza de Algodón</h2>
                     <p>Estimado(a) <b>${tutor || 'Tutor/Encargado'}</b>,</p>
                     <p>Le confirmamos que el registro de ingreso para el residente <b>${paciente}</b> ha sido completado exitosamente en nuestro sistema.</p>
                     <p>Cualquier consulta o aviso adicional se le informará a través de este medio.</p>
                   </div>`
        })
    }).catch(err => console.error("Error en notificación automática:", err));
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

// 4. FUNCIONES DE MODAL PARA ENVIAR CORREOS
function abrirModalEmail(correo, nombrePaciente, nombreTutor) {
    if (!correo || correo.trim() === '' || correo === '-') {
        mostrarModal("Aviso", "Este residente no tiene un correo de tutor registrado.", "error");
        return;
    }

    document.getElementById('emailDestino').value = correo;
    document.getElementById('emailResidenteNombre').value = nombrePaciente;
    document.getElementById('emailMensaje').value = '';
    actualizarAsuntoPredeterminado();

    const modal = document.getElementById('modalEmail');
    if (modal) modal.style.display = 'flex';
}

function cerrarModalEmail() {
    const modal = document.getElementById('modalEmail');
    if (modal) modal.style.display = 'none';
}

function actualizarAsuntoPredeterminado() {
    const tipo = document.getElementById('emailTipo').value;
    const paciente = document.getElementById('emailResidenteNombre').value;
    const inputAsunto = document.getElementById('emailAsunto');

    switch (tipo) {
        case 'MEDICAMENTO':
            inputAsunto.value = `Aviso de Medicamentos - ${paciente}`;
            break;
        case 'CITA':
            inputAsunto.value = `Recordatorio de Cita Médica - ${paciente}`;
            break;
        case 'ESTADO':
            inputAsunto.value = `Reporte de Estado de Salud - ${paciente}`;
            break;
        default:
            inputAsunto.value = `Aviso Importante - ${paciente}`;
            break;
    }
}

async function enviarCorreoTutor(event) {
    event.preventDefault();

    const recipient = document.getElementById('emailDestino').value;
    const subject = document.getElementById('emailAsunto').value;
    const mensajeTexto = document.getElementById('emailMensaje').value;
    const paciente = document.getElementById('emailResidenteNombre').value;

    const btnSubmit = document.getElementById('btnEnviarEmailSubmit');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Enviando...`;

    const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #1a365d; padding: 20px; text-align: center; color: white;">
                <h2 style="margin: 0;">Asilo Cabeza de Algodón</h2>
                <p style="margin: 5px 0 0 0; font-size: 14px;">Notificación del Residente: <b>${paciente}</b></p>
            </div>
            <div style="padding: 25px; color: #333333;">
                <p>${mensajeTexto.replace(/\n/g, '<br>')}</p>
                <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 25px 0;">
                <p style="font-size: 12px; color: #777777; text-align: center;">
                    Este es un mensaje enviado desde el Asilo Cabeza de Algodón.
                </p>
            </div>
        </div>
    `;

    try {
        const res = await fetch(EMAIL_SERVICE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: recipient,
                subject: subject,
                body: htmlBody
            })
        });

        if (res.ok) {
            cerrarModalEmail();
            mostrarModal("¡Correo Enviado!", `Se envió la notificación exitosamente a ${recipient}`, "exito");
        } else {
            mostrarModal("Error", "No se pudo procesar el envío del correo.", "error");
        }
    } catch (err) {
        console.error("Error enviando correo:", err);
        mostrarModal("Error de Conexión", "No se logró comunicación con el microservicio de correos.", "error");
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Enviar Correo`;
    }
}

// 5. MODAL DINÁMICO UI GENERÁL
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