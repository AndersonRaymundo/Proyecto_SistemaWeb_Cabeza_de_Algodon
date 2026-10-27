const API_URL = '/api/Pacientes';
const EMAIL_SERVICE_URL = '/api/Notificaciones/correo';
let idResidenteEdicion = null; // Almacena el ID cuando estamos editando un registro
let residentesCache = [];      // Ultima lista cargada (la usa la ficha completa)

document.addEventListener('DOMContentLoaded', () => {
    cargarResidentes();
});

// 1. OBTENER Y RENDERIZAR DATOS (GET)
async function cargarResidentes() {
    try {
        const respuesta = await fetch(API_URL);
        if (!respuesta.ok) throw new Error("Error en la petición GET");
        
        const residentes = await respuesta.json();
        residentesCache = Array.isArray(residentes) ? residentes : [];
        const tablaBody = document.getElementById('tablaResidentesBody');
        
        if (tablaBody) {
            if (!Array.isArray(residentes) || residentes.length === 0) {
                tablaBody.innerHTML = `<tr><td colspan="7" class="centrado" style="padding: 28px; color: #64748b;">Aún no hay residentes registrados.</td></tr>`;
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
                const par = r.parentescoTutor || r.ParentescoTutor || '';
                const est = (r.estado !== undefined ? r.estado : r.Estado) ?? true;
                const edad = calcularEdad(r.fechaNacimiento || r.FechaNacimiento);

                filas += `
                    <tr data-estado="${est ? 'activo' : 'inactivo'}">
                        <td>${esc(exp)}</td>
                        <td>${esc(nom)}</td>
                        <td>${edad === '-' ? '-' : edad + ' años'}</td>
                        <td>${esc(tut)}${par ? `<small class="parentesco-tabla">${esc(par)}</small>` : ''}</td>
                        <td>${esc(tel)}</td>
                        <td><span class="badge ${est ? 'badge-exito' : 'badge-peligro'}">${est ? 'Activo' : 'Inactivo'}</span></td>
                        <td class="centrado">
                            <button class="btn-icono gris" onclick="verFicha(${id})" title="Ver ficha completa">
                                <i class="fa-solid fa-id-card"></i>
                            </button>
                            <button class="btn-icono azul" onclick='abrirModalEmail("${correo}", "${nom}", "${tut}")' title="Enviar Correo al Tutor">
                                <i class="fa-solid fa-envelope"></i>
                            </button>
                            <button class="btn-icono celeste" onclick='prepararEdicion(${JSON.stringify(r)})' title="Editar">
                                <i class="fa-solid fa-pen-to-square"></i>
                            </button>
                            <button class="btn-icono ${est ? 'ambar' : 'verde'}" onclick="cambiarEstado(${id}, ${!est})" title="${est ? 'Dar de Baja' : 'Reactivar'}">
                                <i class="fa-solid ${est ? 'fa-user-slash' : 'fa-user-check'}"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            tablaBody.innerHTML = filas;
            filtrarResidentes();
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
    const patologias = leerLista('patologias');
    const medicamentosCajon = leerLista('medicamentos');

    // El parentesco es obligatorio al registrar (a los residentes anteriores se les puede completar al editar)
    const parentesco = leerParentesco();
    if (idResidenteEdicion === null && !parentesco) {
        mostrarModal("Falta el parentesco", "Indique qué parentesco tiene el tutor con el residente.", "error");
        return;
    }

    // El asilo atiende adultos mayores: la fecha debe ser real y, si es menor de EDAD_MINIMA, se pide confirmación
    const edad = calcularEdad(fechaNacFormatted);
    if (edad === '-' || edad < 0 || edad > EDAD_MAXIMA) {
        mostrarModal("Fecha de nacimiento inválida", `Revise la fecha de nacimiento: la edad debe estar entre 0 y ${EDAD_MAXIMA} años.`, "error");
        return;
    }
    if (edad < EDAD_MINIMA && !await confirmar({
        titulo: "Residente menor de " + EDAD_MINIMA + " años",
        mensaje: `Según la fecha de nacimiento, ${nombrePaciente || 'el residente'} tiene ${edad} años. El asilo atiende a adultos mayores (${EDAD_MINIMA} años o más). ¿Confirma que es correcto y desea guardarlo como un caso especial?`,
        textoAceptar: "Sí, guardar",
        textoCancelar: "Revisar la fecha"
    })) {
        document.getElementById('txtFechaNacimiento').focus();
        return;
    }

    const residentePayload = {
        idResidente: idResidenteEdicion || 0,
        noExpediente: document.getElementById('txtExpediente').value,
        nombreCompleto: nombrePaciente,
        fechaNacimiento: fechaNacFormatted,
        fechaIngreso: new Date().toISOString().split('T')[0],
        // Resumen en texto para el listado y los reportes (la columna admite 255 caracteres)
        patologia: resumenPatologias(patologias),
        nombreTutor: nombreTutor,
        telefonoTutor: document.getElementById('txtTelefono').value,
        correoTutor: correoTutor,
        parentescoTutor: parentesco || null,
        telefonoAlterno: document.getElementById('txtTelefonoAlterno').value.trim() || null
    };
    // Al registrar queda activo; al editar no se toca el estado (un residente dado de baja no se reactiva solo)
    if (idResidenteEdicion === null) residentePayload.estado = true;

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
            // RF-01: psicopatologia y medicamentos de cajon van a la ficha medica base
            let idGuardado = idResidenteEdicion;
            try {
                const guardado = await respuesta.clone().json();
                idGuardado = guardado.idResidente || idGuardado;
            } catch (e) { /* respuesta sin cuerpo */ }
            if (idGuardado) {
                await guardarFichaBase(idGuardado, patologias, medicamentosCajon);
            }

            mostrarModal("¡Éxito!", `Residente ${esEdicion ? 'actualizado' : 'registrado'} correctamente.`, "exito");
            
            // Envío automático de bienvenida únicamente al REGISTRAR (no al editar)
            if (!esEdicion && correoTutor) {
                dispararNotificacionAutomaticaIngreso(correoTutor, nombreTutor, nombrePaciente);
            }

            cancelarEdicion();
            cargarResidentes();
        } else {
            mostrarModal("No se pudo guardar", await mensajeError(respuesta), "error");
        }
    } catch (err) {
        console.error("Error de red:", err);
        mostrarModal("Error de Conexión", "No se pudo conectar con el servidor.", "error");
    }
}

// Guarda / actualiza la ficha medica base del residente en el backend .NET (TBL_FICHAS_MEDICAS)
async function guardarFichaBase(idPaciente, patologias, medicamentosCajon) {
    try {
        await fetch('/api/Historial/ficha-base', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                idPaciente: idPaciente,
                idDoctor: parseInt(localStorage.getItem('id_usuario'), 10) || 0,
                patologias: patologias,
                medicamentosCajon: medicamentosCajon
            })
        });
    } catch (err) {
        console.error('No se pudo guardar la ficha base:', err);
    }
}

// Carga las patologias y los medicamentos de cajon guardados al editar un residente
async function cargarFichaBase(idPaciente) {
    try {
        const res = await fetch(`/api/Historial/residente/${idPaciente}`);
        if (!res.ok) return;
        const fichas = await res.json();
        const ficha = fichas[fichas.length - 1] || {};
        // Si la ficha aun no tiene la lista, se queda la que salio del texto del residente
        if ((ficha.patologias || []).length) pintarLista('patologias', ficha.patologias);
        pintarLista('medicamentos', ficha.medicamentosCajon || []);
    } catch (err) {
        console.error('No se pudo cargar la ficha base:', err);
    }
}

// ---- Listas editables de la ficha base (un residente puede tener varias) --------
// Cada lista define sus campos; el primero es obligatorio (filas sin él se ignoran).
const LISTAS = {
    patologias: {
        contenedor: 'listaPatologias',
        vacio: 'Sin patologías registradas.',
        quitar: 'Quitar patología',
        campos: [
            { clave: 'nombre', placeholder: 'Patología (ej. Hipertensión)', maximo: 200 },
            { clave: 'observaciones', placeholder: 'Observaciones (ej. controlada)', maximo: 200 }
        ]
    },
    medicamentos: {
        contenedor: 'listaMedicamentosCajon',
        vacio: 'Sin medicamentos de cajón registrados.',
        quitar: 'Quitar medicamento',
        campos: [
            { clave: 'nombreMedicamento', placeholder: 'Medicamento (ej. Losartán)', maximo: 200 },
            { clave: 'dosis', placeholder: 'Dosis (ej. 50 mg)', maximo: 100 },
            { clave: 'frecuencia', placeholder: 'Frecuencia (ej. cada 12 h)', maximo: 100 }
        ]
    }
};

function actualizarVacio(tipo) {
    const lista = document.getElementById(LISTAS[tipo].contenedor);
    const aviso = lista.querySelector('.vacio');
    const hayFilas = lista.querySelector('.fila-lista') !== null;
    if (!hayFilas && !aviso) {
        const p = document.createElement('p');
        p.className = 'vacio';
        p.textContent = LISTAS[tipo].vacio;
        lista.append(p);
    } else if (hayFilas && aviso) {
        aviso.remove();
    }
}

function agregarFila(tipo, datos = {}) {
    const config = LISTAS[tipo];
    const fila = document.createElement('div');
    fila.className = `fila-lista campos-${config.campos.length}`;

    config.campos.forEach(campo => {
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = campo.placeholder;
        input.maxLength = campo.maximo;
        input.value = datos[campo.clave] || '';
        fila.append(input);
    });

    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.className = 'btn-icono rojo';
    quitar.title = config.quitar;
    quitar.innerHTML = '<i class="fa-solid fa-trash"></i>';
    quitar.onclick = () => { fila.remove(); actualizarVacio(tipo); };
    fila.append(quitar);

    document.getElementById(config.contenedor).append(fila);
    actualizarVacio(tipo);
    if (!datos[config.campos[0].clave]) fila.querySelector('input').focus();
}

function pintarLista(tipo, elementos) {
    document.getElementById(LISTAS[tipo].contenedor).innerHTML = '';
    elementos.forEach(e => agregarFila(tipo, e));
    actualizarVacio(tipo);
}

// Devuelve lo escrito en la lista como objetos { clave: valor }; vacíos = null
function leerLista(tipo) {
    const config = LISTAS[tipo];
    return [...document.querySelectorAll(`#${config.contenedor} .fila-lista`)]
        .map(fila => {
            const inputs = fila.querySelectorAll('input');
            const item = {};
            config.campos.forEach((campo, i) => { item[campo.clave] = inputs[i].value.trim() || null; });
            return item;
        })
        .filter(item => item[config.campos[0].clave]);
}

// "Hipertensión, Diabetes tipo 2" (recortado a los 255 caracteres de TBL_PACIENTES)
function resumenPatologias(patologias) {
    const texto = patologias.map(p => p.nombre).join(', ');
    return texto.length > 255 ? texto.slice(0, 254) + '…' : texto;
}

// Convierte el texto anterior ("A, B; C") en filas de la lista
function patologiasDesdeTexto(texto) {
    return (texto || '').split(/[,;]/).map(t => t.trim()).filter(Boolean).map(nombre => ({ nombre }));
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

// ---- Ventana de registro / edición ------------------------------------------
function textoBotonGuardar(editando) {
    const btn = document.getElementById('btnGuardarResidente');
    if (btn) {
        btn.innerHTML = editando
            ? '<i class="fa-solid fa-rotate"></i> Actualizar residente'
            : '<i class="fa-solid fa-floppy-disk"></i> Registrar residente';
    }
    const titulo = document.getElementById('tituloPanelResidente');
    if (titulo) titulo.textContent = editando ? 'Editar residente' : 'Registrar residente';
}

function resetearFormulario() {
    idResidenteEdicion = null;
    document.getElementById('formResidente').reset();
    alCambiarParentesco();
    pintarLista('patologias', []);
    pintarLista('medicamentos', []);
    textoBotonGuardar(false);
}

// Botón "Nuevo residente"
async function nuevoResidente() {
    resetearFormulario();
    abrirPanel('panel-residente');
    // El sistema propone el siguiente numero de expediente libre (EXP-AAAA-NNN)
    try {
        const respuesta = await fetch(`${API_URL}/siguiente-expediente`);
        if (respuesta.ok) {
            const datos = await respuesta.json();
            // solo si la persona todavia no escribio uno propio mientras llegaba la sugerencia
            const campo = document.getElementById('txtExpediente');
            if (!idResidenteEdicion && !campo.value) campo.value = datos.noExpediente || '';
        }
    } catch (e) { /* si no responde, el numero se escribe a mano */ }
}

// Cargar datos en el formulario para editar
function prepararEdicion(r) {
    idResidenteEdicion = r.idResidente || r.IdResidente;

    document.getElementById('txtExpediente').value = r.noExpediente || r.NoExpediente || '';
    document.getElementById('txtNombre').value = r.nombreCompleto || r.NombreCompleto || '';

    const fechaNac = r.fechaNacimiento || r.FechaNacimiento || '';
    document.getElementById('txtFechaNacimiento').value = fechaNac ? fechaNac.split('T')[0] : '';

    pintarLista('patologias', patologiasDesdeTexto(r.patologia || r.Patologia));
    document.getElementById('txtTutor').value = r.nombreTutor || r.NombreTutor || '';
    document.getElementById('txtTelefono').value = r.telefonoTutor || r.TelefonoTutor || '';
    document.getElementById('txtCorreo').value = r.correoTutor || r.CorreoTutor || '';
    asignarParentesco(r.parentescoTutor || r.ParentescoTutor || '');
    document.getElementById('txtTelefonoAlterno').value = r.telefonoAlterno || r.TelefonoAlterno || '';
    pintarLista('medicamentos', []);
    cargarFichaBase(idResidenteEdicion);

    textoBotonGuardar(true);
    abrirPanel('panel-residente');
}

// Cierra la ventana y deja el formulario limpio
function cancelarEdicion() {
    resetearFormulario();
    cerrarPanel('panel-residente');
}

// ---- Buscador y filtro de la tabla ----------------------------------------------
function normalizar(texto) {
    return (texto || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function filtrarResidentes() {
    const campo = document.getElementById('buscadorResidentes');
    const q = normalizar(campo ? campo.value : '');
    const estado = (document.getElementById('filtroEstadoResidentes') || {}).value || '';

    let total = 0, visibles = 0;
    document.querySelectorAll('#tablaResidentesBody tr[data-estado]').forEach(tr => {
        total++;
        const coincide = normalizar(tr.textContent).includes(q) && (!estado || tr.dataset.estado === estado);
        tr.style.display = coincide ? '' : 'none';
        if (coincide) visibles++;
    });

    const conteo = document.getElementById('conteoResidentes');
    if (conteo) conteo.textContent = total ? `${visibles} de ${total} residentes` : '';
}

// 3. BORRADO LÓGICO / CAMBIO DE ESTADO
async function cambiarEstado(id, nuevoEstado) {
    const accionTexto = nuevoEstado ? "reactivar" : "dar de baja";
    const acepta = await confirmar({
        titulo: nuevoEstado ? 'Reactivar residente' : 'Dar de baja a un residente',
        mensaje: nuevoEstado
            ? '¿Reactivar a este residente? Volverá a aparecer en las solicitudes, citas, cobros y despachos.'
            : '¿Dar de baja a este residente? Se conserva su historial, pero no se podrán registrar solicitudes, citas, cobros ni despachos nuevos.',
        textoAceptar: nuevoEstado ? 'Reactivar' : 'Dar de baja',
        peligro: !nuevoEstado,
    });
    if (!acepta) return;

    try {
        // Solo se envia el estado: asi no se vuelven a revisar los demas datos del residente
        // (por ejemplo, un expediente repetido de antes) y no hace falta consultarlo primero.
        const resPut = await fetch(`${API_URL}/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado: nuevoEstado })
        });

        if (resPut.ok) {
            mostrarModal("Estado Actualizado", `El residente ha sido ${nuevoEstado ? 'reactivado' : 'dado de baja'}.`, "exito");
            cargarResidentes();
        } else {
            mostrarModal("No se pudo actualizar", await mensajeError(resPut), "error");
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

// ---------------------------------------------------------------------------
// Edad en anos cumplidos a partir de la fecha de nacimiento (AAAA-MM-DD)
// ---------------------------------------------------------------------------
const EDAD_MINIMA = 60;   // adulto mayor: por debajo se pide confirmacion
const EDAD_MAXIMA = 120;  // por encima la fecha es un error de captura (el servidor tambien lo valida)

function calcularEdad(fechaIso) {
    if (!fechaIso) return '-';
    const [a, m, d] = String(fechaIso).substring(0, 10).split('-').map(Number);
    if (!a || !m || !d) return '-';
    const hoy = new Date();
    let edad = hoy.getFullYear() - a;
    if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) edad--;
    return edad;
}

// ---------------------------------------------------------------------------
// Ficha completa del residente: datos personales, tutor, patologias y medicamentos de cajon
// ---------------------------------------------------------------------------
async function verFicha(id) {
    const r = residentesCache.find(x => (x.idResidente || x.IdResidente) === id);
    if (!r) return;

    const fmt = f => { if (!f) return ''; const [a, m, d] = String(f).substring(0, 10).split('-'); return `${d}/${m}/${a}`; };
    const dato = (etiqueta, valor) => `<div class="dato-clinico"><span>${etiqueta}</span><span>${valor ? esc(valor) : '<em>Sin registrar</em>'}</span></div>`;
    const datoHtml = (etiqueta, html) => `<div class="dato-clinico"><span>${etiqueta}</span><span>${html || '<em>Sin registrar</em>'}</span></div>`;
    const titulo = txt => `<h3 class="subtitulo-ficha">${txt}</h3>`;

    const nac = r.fechaNacimiento || r.FechaNacimiento;
    const edad = calcularEdad(nac);
    const est = (r.estado !== undefined ? r.estado : r.Estado) ?? true;

    let patologias = '', cajon = '';
    try {
        const res = await fetch(`/api/Historial/residente/${id}`);
        if (res.ok) {
            const fichas = await res.json();
            const f = Array.isArray(fichas) ? fichas[0] : null;
            if (f) {
                patologias = (f.patologias || []).map(p =>
                    `<li><strong>${esc(p.nombre)}</strong>${p.observaciones ? `<span>${esc(p.observaciones)}</span>` : ''}</li>`).join('');
                cajon = (f.medicamentosCajon || []).map(m => {
                    const detalle = [m.dosis, m.frecuencia].filter(Boolean).join(' · ');
                    return `<li><strong>${esc(m.nombreMedicamento)}</strong>${detalle ? `<span>${esc(detalle)}</span>` : ''}</li>`;
                }).join('');
            }
        }
    } catch (e) { /* si no responde, se muestra la ficha sin las listas */ }

    document.getElementById('contenido-ficha-residente').innerHTML =
        titulo('Datos personales') +
        dato('Expediente', r.noExpediente || r.NoExpediente) +
        dato('Nombre completo', r.nombreCompleto || r.NombreCompleto) +
        dato('Fecha de nacimiento', fmt(nac)) +
        dato('Edad', edad === '-' ? '' : edad + ' años') +
        dato('Fecha de ingreso', fmt(r.fechaIngreso || r.FechaIngreso)) +
        dato('Estado', est ? 'Activo' : 'Inactivo (dado de baja)') +
        titulo('Tutor') +
        dato('Nombre', r.nombreTutor || r.NombreTutor) +
        dato('Parentesco', r.parentescoTutor || r.ParentescoTutor || 'No indicado') +
        dato('Teléfono', r.telefonoTutor || r.TelefonoTutor) +
        ((r.telefonoAlterno || r.TelefonoAlterno) ? dato('Teléfono alternativo', r.telefonoAlterno || r.TelefonoAlterno) : '') +
        dato('Correo', r.correoTutor || r.CorreoTutor) +
        titulo('Patologías / condiciones') +
        datoHtml('Listado', patologias ? `<ul class="lista-ficha">${patologias}</ul>` : '') +
        titulo('Medicamentos de cajón') +
        datoHtml('Listado', cajon ? `<ul class="lista-ficha">${cajon}</ul>` : '');
    abrirPanel('panel-ficha-residente');
}

// ---------------------------------------------------------------------------
// Parentesco del tutor: lista fija, y "Otro" para escribirlo a mano
// ---------------------------------------------------------------------------
function alCambiarParentesco() {
    const esOtro = document.getElementById('selParentesco').value === 'Otro';
    document.getElementById('grupoParentescoOtro').style.display = esOtro ? 'block' : 'none';
    if (!esOtro) document.getElementById('txtParentescoOtro').value = '';
}

function leerParentesco() {
    const valor = document.getElementById('selParentesco').value;
    return valor === 'Otro' ? document.getElementById('txtParentescoOtro').value.trim() : valor;
}

// Al editar: si el parentesco guardado esta en la lista se elige; si no, se muestra como "Otro" con su texto
function asignarParentesco(valor) {
    const lista = document.getElementById('selParentesco');
    const conocidos = [...lista.options].map(o => o.value).filter(v => v && v !== 'Otro');
    if (!valor) lista.value = '';
    else lista.value = conocidos.includes(valor) ? valor : 'Otro';
    alCambiarParentesco();
    if (lista.value === 'Otro') document.getElementById('txtParentescoOtro').value = valor;
}
