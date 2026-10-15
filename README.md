# Sistema de Administración del Asilo de Ancianos "Cabeza de Algodón"

Proyecto final de Análisis y Diseño de Sistemas II, Universidad Mariano Gálvez de Guatemala, sede Mazatenango.

Sistema web para administrar un asilo de ancianos: registro de residentes, solicitudes de evaluación y citas
médicas, historial clínico, laboratorio y farmacia, control de cobros, donaciones y gastos, pagos a la fundación
que presta los servicios médicos, y reportes en PDF.

## Módulos

| Módulo | Qué permite hacer |
|---|---|
| Pacientes | Registrar residentes con su tutor, patologías y medicamentos de cajón, y enviar correos al tutor |
| Solicitudes y Citas | Solicitar evaluaciones, agendar citas (fundación) y registrar la visita médica |
| Historial Médico | Consultar el expediente de cada residente y registrar evaluaciones |
| Laboratorio y Farmacia | Registrar resultados de exámenes y despachar medicamentos |
| Caja y Finanzas | Cobros a familiares, donaciones, gastos y pagos a la fundación, con el resumen y el balance |
| Reportes | Siete reportes en PDF |
| Configuración | Parámetros vigentes del sistema (solo lectura) |

Roles: Administrador, Doctor, Enfermero, Farmacia, Fundación y Laboratorio. Cada uno ve en el menú solo lo que
le corresponde, y el servidor rechaza cualquier acceso que no le corresponda.

## Arquitectura

MVC en capas para el núcleo del sistema y tres servicios auxiliares independientes:

```
Navegador --HTTPS--> AsiloWeb (ASP.NET Core 8, MVC + Entity Framework) --> SQL Server
                        |--> pacientes_service  (FastAPI, puerto 8000)   registro de residentes
                        |--> email_service      (FastAPI, puerto 8001)   envío de correos por SMTP
                        `--> pdf_service        (FastAPI, puerto 8002)   generación de reportes PDF
```

El navegador solo habla con AsiloWeb; los servicios auxiliares no se exponen directamente.

## Estructura del repositorio

```
AsiloWeb/                   Aplicación web: Controllers, Models, Services, Views, Migrations, wwwroot
pacientes_service/          Microservicio de pacientes
email_service/              Microservicio de correo
pdf_service/                Microservicio de reportes PDF
docs/                       Guía de despliegue en la nube
docker-compose.yml          Servicios auxiliares para desarrollo local
docker-compose.cloud.yml    Despliegue completo en la nube (HTTPS con Caddy)
.env.example                Variables de desarrollo (copiar como .env)
.env.cloud.example          Variables de la nube (copiar como .env.cloud)
```

## Requisitos

- .NET 8 SDK
- Docker Desktop
- SQL Server (Express o superior) para el desarrollo local

## Ejecutar en desarrollo

1. Copie `.env.example` como `.env` y complete la conexión a SQL Server y el correo.
2. Levante los servicios auxiliares:
   ```
   docker-compose up --build
   ```
3. En otra terminal, inicie la aplicación web:
   ```
   cd AsiloWeb
   dotnet run
   ```
4. Abra http://localhost:5168

Las migraciones de la base de datos se aplican solas al iniciar la aplicación. Para registrar un cambio en los modelos:

```
cd AsiloWeb
dotnet ef migrations add NombreDelCambio
```

Los usuarios de prueba (uno por rol) se crean en el primer arranque. Sus claves de prueba solo existen en modo de
desarrollo; en cualquier otro entorno cada clave debe indicarse en la configuración.

## Desplegar en la nube

Vea [docs/despliegue-nube.md](docs/despliegue-nube.md).

## Seguridad

- Los archivos `.env` y `.env.cloud` contienen claves y nunca se suben al repositorio.
- Use contraseñas de aplicación para el correo, no la contraseña de la cuenta.
