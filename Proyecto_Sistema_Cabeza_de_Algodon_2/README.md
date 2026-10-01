# Microservicios nuevos — Asilo Cabeza de Algodón

Estos 4 microservicios completan lo que pedía el enunciado y que aún no
tenías construido. Están hechos con el mismo stack que tus 3 actuales
(FastAPI + Pydantic + CORS), pero estos sí persisten datos: se conectan a tu
misma base **SQL Server `AsiloCabezaAlgodon`** usando SQLAlchemy + pyodbc, y
crean sus propias tablas automáticamente al arrancar (`Base.metadata.create_all`),
así no tienes que escribir scripts SQL a mano.

| Microservicio | Carpeta | Puerto | Tabla(s) |
|---|---|---|---|
| Login | `login_service` | 8007 | `Usuarios` |
| Pacientes | `pacientes_service` | 8000 | `Residentes` (existente) |
| Historial Médico | `historial_medico_service` | 8003 | `VisitasMedicas` |
| Solicitudes y Citas | `solicitudes_citas_service` | 8004 | `Solicitudes` |
| Laboratorio y Farmacia | `laboratorio_farmacia_service` | 8005 | `ExamenesLaboratorio`, `RecetasFarmacia` |
| Caja y Finanzas | `caja_service` | 8006 | `Donaciones`, `Cobros`, `Gastos`, `PagosFundacion` |

## `login_service` — nuevo

Maneja el acceso al sistema y los 4 roles que ya filtra tu `roles.js`
(ADMINISTRADOR, DOCTOR, ENFERMERO, FARMACIA). Contraseñas con hash bcrypt,
entrega un token JWT al autenticar. Al arrancar por primera vez crea 4
usuarios de prueba (uno por rol) si la tabla `Usuarios` está vacía — mira el
encabezado de `login_service/main.py` para ver las credenciales, y
cámbialas/bórralas antes de entregar.

## `pacientes_service` — reemplaza el que ya tenías

El `main.py` de esta carpeta reemplaza al que ya tenías (que en realidad
generaba PDFs). Ahora sí hace CRUD real de `Residentes`, usando exactamente
las mismas columnas que tu `Models/Residente.cs`, y expone las mismas rutas
que tu `pacientes.js` ya está llamando (`/api/Residentes`), así que **no
necesitas tocar el frontend** para este módulo.

Como ahora el microservicio es quien maneja Pacientes, te recomiendo dejar de
usar `ResidentesController.cs` en el proyecto .NET para esto (o eliminarlo),
para que no haya dos servicios distintos escribiendo la misma tabla al mismo
tiempo. Si quieres, cuando integremos todo lo quitamos junto con la
dependencia de `AppDbContext`/EF Core del `Program.cs`, si ya no la usas para
nada más.

## ⚠️ Punto importante: autenticación a SQL Server

Tu `appsettings.json` usa `Trusted_Connection=True` (autenticación integrada
de Windows). Eso funciona en tu app .NET porque corre en Windows, pero un
contenedor Docker (Linux) **no puede** usar esa autenticación contra tu SQL
Server. Para que estos 4 microservicios se conecten necesitas:

1. En SQL Server Management Studio, habilitar el modo de autenticación
   **"SQL Server and Windows Authentication mode"** (mixto) en las
   propiedades del servidor (Seguridad).
2. Crear un login de SQL Server (usuario/contraseña) con permisos sobre la
   base `AsiloCabezaAlgodon`.
3. Copiar `.env.example` a `.env` y poner ahí tu cadena de conexión real.
4. Si Docker Desktop corre en la misma PC que SQL Server, usa
   `host.docker.internal` en vez de `localhost` como servidor.

Si por ahora solo quieres probar rápido sin Docker, puedes correr cada
servicio directo con `uvicorn main:app --reload --port 8003` (por ejemplo) y
ahí sí podrías usar Trusted_Connection si trabajas en Windows nativo, cambiando
el `DATABASE_URL` a algo como:
`mssql+pyodbc://@localhost/AsiloCabezaAlgodon?driver=ODBC+Driver+17+for+SQL+Server&trusted_connection=yes`

## Endpoints principales

**Login (8007)**
- `POST /login` — recibe `{ nombreUsuario, contrasena }`, devuelve `{ token, idUsuario, nombreUsuario, nombreCompleto, rol }`
- `GET /usuarios`, `POST /usuarios`, `PUT /usuarios/{id}`, `DELETE /usuarios/{id}` — para cuando armes la pantalla de administración de usuarios

**Pacientes (8000)**
- `GET /api/Residentes`, `GET /api/Residentes/{id}`
- `POST /api/Residentes`, `PUT /api/Residentes/{id}`, `DELETE /api/Residentes/{id}`

**Historial Médico (8003)**
- `POST /visitas` — registra una ficha/visita médica
- `GET /visitas/residente/{id}` — historial completo de un residente (para la vista "Historial Médico")
- `GET /visitas/{id}`, `PUT /visitas/{id}`, `DELETE /visitas/{id}`

**Solicitudes y Citas (8004)**
- `POST /solicitudes` — el médico general crea la remisión (y notifica por correo al familiar vía tu `email_service`, si le mandas `correo_familiar`)
- `GET /solicitudes?estado=Pendiente` — el módulo de la Fundación consulta las pendientes
- `PUT /solicitudes/{id}/agendar` — la Fundación asigna fecha/hora y médico
- `PUT /solicitudes/{id}/estado` — para marcarla como Atendida/Cancelada

**Laboratorio y Farmacia (8005)**
- `POST /examenes`, `GET /examenes/residente/{id}`, `PUT /examenes/{id}` (para cargar resultados)
- `POST /recetas`, `GET /recetas/residente/{id}`
- `POST /registro-completo` — coincide con el formulario único de la vista (examen + receta en una sola llamada)

**Caja y Finanzas (8006)**
- `POST /donaciones`, `GET /donaciones`
- `POST /cobros`, `GET /cobros?estado=Pendiente`, `GET /cobros/residente/{id}`, `PUT /cobros/{id}/estado`
- `POST /gastos`, `GET /gastos`
- `POST /pagos-fundacion`, `GET /pagos-fundacion`
- `GET /resumen` — totales de donaciones, cobros pagados/pendientes, gastos y balance (útil para el módulo de Reportes)

Cada servicio expone además documentación interactiva automática en
`http://localhost:<puerto>/docs` (Swagger de FastAPI), útil para probar sin
necesidad de tener el frontend conectado todavía.

## Siguiente paso

Cuando quieras integrarlos, dime y te ayudo a:
- Actualizar el `docker-compose.yml` de tu proyecto (ya te dejo uno combinado aquí, con los 5 servicios que persisten datos)
- Escribir el JavaScript de `historial-medico.cshtml`, `laboratorio-farmacia.cshtml`,
  `caja.cshtml` y `solicitudes-citas.cshtml` para que consuman estos endpoints
  (igual a como ya funciona `pacientes.js`)
- Quitar/limpiar `ResidentesController.cs` y la dependencia de EF Core en el
  proyecto .NET, ya que Pacientes ahora lo maneja el microservicio
