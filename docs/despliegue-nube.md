# Despliegue en la nube

Guía para publicar el sistema del Asilo "Cabeza de Algodón" en una máquina virtual
con Docker, accesible por HTTPS desde cualquier navegador.

## Cómo queda armado

```
Internet ──443──► caddy (HTTPS) ──► web (ASP.NET Core) ──┬─► pacientes_service
                                                         ├─► email_service
                                                         ├─► pdf_service
                                                         └─► sqlserver (datos)
```

Solo `caddy` publica puertos (80 y 443). La base de datos y los tres microservicios
quedan en la red interna de Docker y **no son visibles desde internet**. El navegador
solo habla con el sitio web; este reenvía las llamadas a los microservicios con la
sesión iniciada y los permisos del rol.

Los archivos del despliegue son: `docker-compose.cloud.yml`, `Caddyfile`,
`.env.cloud.example` y `AsiloWeb/Dockerfile`.

## 1. Probarlo primero en tu computadora

Requiere Docker Desktop encendido y los puertos 80 y 443 libres.

```
copy .env.cloud.example .env.cloud
```

Abre `.env.cloud` y completa **todas** las contraseñas (`SA_PASSWORD`, `APP_DB_PASSWORD`
y las seis `PASS_*`). Usa solo letras y números en `SA_PASSWORD` y `APP_DB_PASSWORD`.
Deja `DOMINIO=localhost`.

> `SA_PASSWORD` solo se aplica la **primera vez** que se crea la base (volumen `sqldata`).
> Si la cambias después, SQL Server sigue con la anterior y el sistema no arranca.

La base de la nube es **independiente** de la de tu computadora: empieza vacía, solo con
los usuarios del sistema, y se llena con el uso real. Los datos de prueba de tu equipo no
pasan a la nube.

```
docker compose -f docker-compose.cloud.yml --env-file .env.cloud up -d --build
docker compose -f docker-compose.cloud.yml --env-file .env.cloud logs -f web
```

Entra a `https://localhost`. El navegador avisará que el certificado no es de confianza
(es un certificado de prueba): elige "Avanzado" y continúa. Para apagarlo:

```
docker compose -f docker-compose.cloud.yml --env-file .env.cloud down
```

Tu forma habitual de trabajar (`docker-compose up` más `dotnet run`) no cambia.

## 2. Publicarlo en una máquina virtual (Azure)

1. Crea una máquina virtual **Ubuntu Server 22.04** con **4 GB de RAM como mínimo**
   (SQL Server necesita al menos 2 GB). Revisa el costo en la calculadora de Azure.
2. En **Redes**, abre los puertos entrantes **80** y **443** (y 22 para conectarte por SSH).
3. En la **dirección IP pública**, asigna un **nombre DNS**. Será algo como
   `asilo-cabeza.eastus.cloudapp.azure.com`; ese es tu `DOMINIO`.
4. Conéctate por SSH e instala Docker:
   ```
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER      # cierra y vuelve a abrir la sesión
   ```
5. Descarga el proyecto y configúralo:
   ```
   git clone <URL-DEL-REPOSITORIO>
   cd <carpeta-del-repositorio>
   cp .env.cloud.example .env.cloud
   nano .env.cloud                    # DOMINIO = tu nombre DNS, y todas las contraseñas
   ```
6. Levántalo:
   ```
   docker compose -f docker-compose.cloud.yml --env-file .env.cloud up -d --build
   ```
7. Abre `https://TU-DOMINIO`. Caddy consigue el certificado HTTPS solo (tarda un minuto).

## 3. Operación diaria

| Qué | Comando |
|---|---|
| Ver el estado | `docker compose -f docker-compose.cloud.yml --env-file .env.cloud ps` |
| Ver el registro de la aplicación | `... logs -f web` |
| Actualizar tras un cambio | `git pull` y luego `... up -d --build` |
| Ahorrar crédito | Detén (desasigna) la máquina virtual desde el portal |

Los datos viven en el volumen `sqldata` y sobreviven a reinicios y actualizaciones.
**Nunca** uses `down -v` en la nube: borra el volumen y con él toda la base.

Dos cosas que conviene saber:

- **`SA_PASSWORD` se define una sola vez.** SQL Server la guarda en el volumen la primera vez que
  arranca. Si después la cambias en `.env.cloud`, la base ya no la acepta y `sqlserver` queda
  `unhealthy`. Pon la clave definitiva **antes** del primer arranque. (`APP_DB_PASSWORD` sí se puede
  cambiar después: `db_init` la vuelve a aplicar en cada arranque.)
- **Las sesiones sobreviven a las actualizaciones.** Las llaves que firman la sesión se guardan en el
  volumen `webkeys`, así que al actualizar con `up -d --build` nadie tiene que volver a entrar. El
  registro de cada servicio se limita a 3 archivos de 10 MB para no llenar el disco.

### Usuarios de la base de datos

| Usuario | Lo usa | Permisos |
|---|---|---|
| `asilo_app` | La web y `pacientes_service` | Solo dentro de `AsiloCabezaAlgodon`: leer, escribir y crear tablas |
| `sa` | Tú, para administrar y los respaldos | Todo el servidor |

### Respaldos

El servicio `backup` hace un respaldo completo cada día (y uno al arrancar) y guarda
los últimos 7 días dentro del volumen. Un respaldo que solo vive en la misma máquina no
protege si la máquina se pierde: bájalos a otro lugar con regularidad.

```
# Ver que los respaldos se estén creando
docker compose -f docker-compose.cloud.yml --env-file .env.cloud logs backup

# Copiarlos a la carpeta "respaldos" (luego súbelos a OneDrive, Azure Storage, etc.)
docker compose -f docker-compose.cloud.yml --env-file .env.cloud cp sqlserver:/var/opt/mssql/backup ./respaldos
```

Para **restaurar** un respaldo (reemplaza la base actual):

```
docker compose -f docker-compose.cloud.yml --env-file .env.cloud stop web pacientes_service
docker compose -f docker-compose.cloud.yml --env-file .env.cloud exec sqlserver /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "TU_SA_PASSWORD" -Q "ALTER DATABASE AsiloCabezaAlgodon SET SINGLE_USER WITH ROLLBACK IMMEDIATE; RESTORE DATABASE AsiloCabezaAlgodon FROM DISK = N'/var/opt/mssql/backup/NOMBRE_DEL_ARCHIVO.bak' WITH REPLACE; ALTER DATABASE AsiloCabezaAlgodon SET MULTI_USER;"
docker compose -f docker-compose.cloud.yml --env-file .env.cloud up -d
```

### Ver las tablas de la base

La base no publica puertos, así que se consulta desde dentro del contenedor:

```
docker compose -f docker-compose.cloud.yml --env-file .env.cloud exec sqlserver /opt/mssql-tools18/bin/sqlcmd -C -S localhost -U sa -P "TU_SA_PASSWORD" -d AsiloCabezaAlgodon
```

En Azure, para usar SSMS o Azure Data Studio, crea un túnel SSH en lugar de abrir el
puerto 1433 en la máquina virtual.

## 4. Problemas frecuentes

| Síntoma | Causa probable |
|---|---|
| No aparece el candado HTTPS | Los puertos 80/443 están cerrados, o `DOMINIO` no apunta a la IP de la máquina |
| `web` se reinicia sin parar | `SA_PASSWORD` o `APP_DB_PASSWORD` no cumple la complejidad de SQL Server (12 o más caracteres, mayúsculas, minúsculas y números) |
| `sqlserver` queda `unhealthy` o `db_init` termina con error (`Login failed for user 'sa'`) | Se cambió `SA_PASSWORD` después de crear la base: vuelve a poner la clave original. Solo en una prueba local sin datos que perder, `down -v` y volver a levantar crea la base con la clave nueva |
| Un reporte da error 502 | `pdf_service` no está corriendo: revisa `ps` |
| No llegan los correos | Falta `SMTP_USER`/`SMTP_PASSWORD`, o se usó el puerto 25 (usa 587) |
| La máquina se congela | Tiene menos de 4 GB de RAM |
