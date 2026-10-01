# Migración: de "8 microservicios" a "MVC en Capas + 3 microservicios"

Esto alinea el proyecto con tu **Diseño Arquitectónico** y tu **Fase de
Análisis** ya entregados: MVC en capas para el núcleo del sistema, y
microservicios **solo** para las 3 tareas puntuales que el ingeniero asignó
así (Pacientes, PDF, Correo).

## Qué cambió

**Se eliminan estos 5 microservicios** (ya no hacen falta, quedan
reemplazados por Controllers de .NET con Entity Framework):
- `login_service` → `Controllers/AuthController.cs`
- `historial_medico_service` → `Controllers/HistorialController.cs`
- `solicitudes_citas_service` → `Controllers/CitasController.cs`
- `laboratorio_farmacia_service` → `Controllers/LaboratorioFarmaciaController.cs`
- `caja_service` → `Controllers/CajaController.cs`

**Se mantienen igual (siguen siendo microservicios):**
- `pacientes_service` — se actualizó solo para usar el nombre de tabla
  oficial del ERD (`TBL_PACIENTES` en vez de `Residentes`), sin cambiar
  ninguna ruta que ya usa `pacientes.js`.
- `pdf_service`, `email_service` — sin cambios. El backend .NET ahora sí
  llama a `email_service` automáticamente desde `CitasController` (RF-04).

## Nombres de tabla — alineados a tu ERD oficial

| Tabla del ERD | Quién la maneja ahora | Notas |
|---|---|---|
| `TBL_PACIENTES` | `pacientes_service` (microservicio) | Antes se llamaba `Residentes` |
| `TBL_USUARIOS` | `AuthController` (.NET) | Incluye bloqueo tras 3 intentos fallidos (CU-01) |
| `TBL_FICHAS_MEDICAS` | `HistorialController` (.NET) | Ficha base (diagnóstico crónico) |
| `TBL_CITAS_MEDICAS` | `CitasController` (.NET) | Solicitud → Agenda → Visita, todo en una tabla (como en tu ERD) |
| `TBL_EXAMENES_LAB` | `LaboratorioFarmaciaController` (.NET) | Ligada a `TBL_FICHAS_MEDICAS`, como en tu ERD |
| `TBL_DONACIONES` | `CajaController` (.NET) | — |
| `TBL_PAGOS_FUNDACION` | `CajaController` (.NET) | Cobros/pagos por paciente (RF-13) |

**Agregadas sobre el ERD, justificadas por tus propios requerimientos**
(documentado también como comentario en cada modelo C#):
- `TBL_MEDICAMENTOS_RECETADOS` — RF-09 pide controlar el despacho de
  farmacia con su costo; el ERD no traía tabla para esto.
- `TBL_GASTOS` — RF-13 pide registrar gastos operativos (agua, luz); el ERD
  no traía tabla para esto.
- Columnas de costo/estado de pago en `TBL_CITAS_MEDICAS` y
  `TBL_PAGOS_FUNDACION` — RF-10 y RF-12 piden cobrar y controlar mora.
- `bloqueado_hasta` en `TBL_USUARIOS` — para saber cuándo se levanta
  automáticamente el bloqueo de 15 minutos (CU-01).

La "deuda del asilo con la fundación" (RF-11) **no se guarda en una tabla
aparte** (el ERD tampoco la tenía): se calcula al vuelo sumando los costos
ya registrados en citas, exámenes y medicamentos — lo ves en
`GET /api/Caja/resumen` como `deudaConFundacion`.

## Qué tienes que hacer tú

1. **Detén y borra los 5 contenedores que ya no se usan:**
   ```
   docker rm -f login_microservice historial_medico_microservice solicitudes_citas_microservice laboratorio_farmacia_microservice caja_microservice
   ```
2. **Borra esas 5 carpetas** de tu proyecto (`login_service`,
   `historial_medico_service`, `solicitudes_citas_service`,
   `laboratorio_farmacia_service`, `caja_service`).
3. **Reemplaza** tu `docker-compose.yml` y tu `.env` con los de este
   paquete (ya no se necesita `JWT_SECRET_KEY`).
4. **Corre el script `migracion_bd.sql`** en SSMS (con tu usuario de
   Windows) — renombra tu tabla de pacientes al nombre oficial y limpia las
   tablas huérfanas de los microservicios eliminados.
5. **Reemplaza tu carpeta `AsiloWeb`** con la de `AsiloWeb-actualizado.zip`.
6. Levanta todo:
   ```
   docker-compose up --build
   ```
   (ahora solo construye 3 servicios, mucho más rápido)
   ```
   cd AsiloWeb
   dotnet run
   ```

Los 4 usuarios de prueba (`admin`/`admin123`, `doctor`/`doctor123`,
`enfermero`/`enfermero123`, `farmacia`/`farmacia123`) se vuelven a crear
automáticamente la primera vez que arranca `.NET`, ahora en `TBL_USUARIOS`.

## Ventaja extra

El login, fichas médicas, citas, laboratorio/farmacia y caja ya NO dependen
de Docker, ODBC, ni del login SQL `asilo_app` — corren dentro de `.NET`
usando autenticación de Windows (`Trusted_Connection=True`, la que ya
tenías en tu `appsettings.json`). Solo `pacientes_service` (por ser
microservicio en contenedor Linux) sigue necesitando esa cuenta SQL.
