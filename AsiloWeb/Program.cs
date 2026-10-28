using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using AsiloWeb.Data;
using AsiloWeb.Models;
using AsiloWeb.Services; // Namespace de los conectores C# a los microservicios

var builder = WebApplication.CreateBuilder(args);

// Habilitar Controladores CON VISTAS (.cshtml)
builder.Services.AddControllersWithViews();

// Entity Framework Core -> SQL Server (autenticacion integrada de Windows,
// ya que .NET corre nativo en Windows, sin los problemas de Docker/Linux).
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("ConexionSQL")));

// Conectores a los 3 microservicios (Pacientes, Correo y PDF).
// Las direcciones salen de la configuracion ("Servicios:Pacientes", etc.) para
// poder cambiarlas segun el entorno: en tu equipo son localhost y en la nube
// (docker compose) son los nombres internos de cada contenedor.
string Servicio(string nombre, string porDefecto) =>
    builder.Configuration[$"Servicios:{nombre}"] ?? porDefecto;

builder.Services.AddHttpClient<PdfService>(c => c.BaseAddress = new Uri(Servicio("Pdf", "http://localhost:8002")));
builder.Services.AddHttpClient<EmailService>(c => c.BaseAddress = new Uri(Servicio("Correo", "http://localhost:8001")));
builder.Services.AddHttpClient<PacientesService>(c => c.BaseAddress = new Uri(Servicio("Pacientes", "http://localhost:8000")));
// Cliente que usa PacientesProxyController: el navegador ya no habla directo
// con el microservicio de Pacientes, todo pasa por este sitio con sesion y roles.
builder.Services.AddHttpClient("pacientes", c => c.BaseAddress = new Uri(Servicio("Pacientes", "http://localhost:8000")));

// Detras del servidor HTTPS de la nube (Caddy) la app debe saber que el
// visitante entro por https para generar bien cookies y redirecciones.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

// Servicios de negocio (descuento de la fundacion, cobro automatico, ficha base)
builder.Services.AddScoped<FacturacionService>();
builder.Services.AddScoped<ExpedienteService>();
builder.Services.AddSingleton<AgendaService>();

// Sesion en el servidor con cookie (RNF-02). Las paginas redirigen al Login
// y la API responde 401/403 cuando no hay sesion o no alcanza el rol.
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "AsiloAuth";
        options.Cookie.HttpOnly = true;
        options.LoginPath = "/Auth/Login";
        options.AccessDeniedPath = "/Home/MENU";
        options.ExpireTimeSpan = TimeSpan.FromHours(8);
        options.SlidingExpiration = true;
        // En cada peticion se confirma que la cuenta siga activa y con el mismo rol: si se dio de baja o se le cambio
        // el rol, la sesion abierta deja de valer y la persona vuelve al Login.
        options.Events.OnValidatePrincipal = async ctx =>
        {
            var texto = ctx.Principal?.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(texto, out var idUsuario)) return;
            var rolEnSesion = ctx.Principal?.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
            var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
            var cuenta = await db.Usuarios.AsNoTracking()
                .Where(u => u.IdUsuario == idUsuario)
                .Select(u => new { u.Activo, u.Rol })
                .FirstOrDefaultAsync();
            if (cuenta == null || !cuenta.Activo || cuenta.Rol != rolEnSesion)
            {
                ctx.RejectPrincipal();
                await ctx.HttpContext.SignOutAsync();
            }
        };
        options.Events.OnRedirectToLogin = ctx =>
        {
            if (ctx.Request.Path.StartsWithSegments("/api"))
                ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            else
                ctx.Response.Redirect(ctx.RedirectUri);
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = ctx =>
        {
            if (ctx.Request.Path.StartsWithSegments("/api"))
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            else
                ctx.Response.Redirect(ctx.RedirectUri);
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Configurar CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("PermitirFrontend", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// Crear/actualizar la base de datos con Migrations (no EnsureCreated: esta
// base ya tiene otras tablas creadas por pacientes_service, y EnsureCreated
// se niega a crear nada mas si detecta que la base "ya tiene tablas").
// IMPORTANTE: la primera vez, hay que generar la migracion (una sola vez):
//   dotnet ef migrations add InitialCreate
//   dotnet ef database update
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();

    // Usuarios de prueba (el doctor es el medico general)
    var semillas = new[]
    {
        (Login: "admin",       Clave: "admin123",       Nombre: "Administrador del Sistema", Rol: "ADMINISTRADOR", Especialidad: (string?)null),
        (Login: "doctor",      Clave: "doctor123",      Nombre: "Dr. Raymundo",             Rol: "DOCTOR",        Especialidad: (string?)"Medicina general"),
        (Login: "enfermero",   Clave: "enfermero123",   Nombre: "Licda. Sofía López",       Rol: "ENFERMERO",     Especialidad: (string?)null),
        (Login: "farmacia",    Clave: "farmacia123",    Nombre: "Encargado de Farmacia",    Rol: "FARMACIA",      Especialidad: (string?)null),
        (Login: "fundacion",   Clave: "fundacion123",   Nombre: "Personal de la Fundación", Rol: "FUNDACION",     Especialidad: (string?)null),
        (Login: "laboratorio", Clave: "laboratorio123", Nombre: "Personal de Laboratorio",  Rol: "LABORATORIO",   Especialidad: (string?)null)
    };

    // Correo del admin (Semillas:correo_admin)
    var correoAdmin = builder.Configuration["Semillas:correo_admin"];
    correoAdmin = string.IsNullOrWhiteSpace(correoAdmin) ? null : correoAdmin.Trim();

    foreach (var semilla in semillas)
    {
        if (!db.Usuarios.Any(u => u.NombreUsuario == semilla.Login))
        {
            // La clave viene de la configuracion ("Semillas:admin", etc.). Las claves
            // de prueba del codigo solo valen en desarrollo: fuera de el, si falta la
            // clave de un usuario, ese usuario no se crea.
            var claveConfigurada = builder.Configuration[$"Semillas:{semilla.Login}"];
            var clave = !string.IsNullOrWhiteSpace(claveConfigurada)
                ? claveConfigurada
                : (app.Environment.IsDevelopment() ? semilla.Clave : null);
            if (clave == null)
            {
                app.Logger.LogWarning("No se creo el usuario {Login}: falta la clave Semillas:{Login} en la configuracion.", semilla.Login, semilla.Login);
                continue;
            }

            db.Usuarios.Add(new Usuario
            {
                NombreUsuario = semilla.Login,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(clave),
                NombreCompleto = semilla.Nombre,
                Rol = semilla.Rol,
                Especialidad = semilla.Especialidad,
                Email = semilla.Rol == "ADMINISTRADOR" ? correoAdmin : null
            });
        }
    }

    var admin = db.Usuarios.FirstOrDefault(u => u.NombreUsuario == "admin");
    if (admin != null && string.IsNullOrWhiteSpace(admin.Email))
    {
        if (correoAdmin != null && !db.Usuarios.Any(u => u.Email == correoAdmin))
            admin.Email = correoAdmin;
        else
            app.Logger.LogWarning("El usuario admin no tiene correo: no podra recuperar su contrasena. Asignelo en Configuracion o con Semillas:correo_admin.");
    }
    db.SaveChanges();
}

// Primero lo primero: tomar la direccion y el protocolo reales del visitante
app.UseForwardedHeaders();

// Configurar el pipeline HTTP
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Habilitar carpetas publicas (wwwroot: css, js, imagenes).
// Los css y js llevan ?v=<huella> en las paginas (asp-append-version), asi que el
// navegador puede guardarlos una semana: si el archivo cambia, la direccion cambia
// y se descarga de nuevo. Esto evita volver a pedirlos en cada pantalla.
app.UseStaticFiles(new StaticFileOptions
{
    OnPrepareResponse = ctx =>
        ctx.Context.Response.Headers["Cache-Control"] = "public,max-age=604800"
});

// Que el navegador no guarde las paginas (para que no se vean al darle atras despues de salir)
app.Use(async (contexto, siguiente) =>
{
    contexto.Response.OnStarting(() =>
    {
        if (!contexto.Response.Headers.ContainsKey("Cache-Control"))
            contexto.Response.Headers.CacheControl = "no-store";
        return Task.CompletedTask;
    });
    await siguiente();
});

app.UseRouting();

app.UseCors("PermitirFrontend");

app.UseAuthentication();
app.UseAuthorization();

// Mapear API Controllers normales
app.MapControllers();

// Comprobacion simple de que el sitio esta vivo (sin sesion)
app.MapGet("/salud", () => Results.Ok("ok")).AllowAnonymous();

// Mapear la ruta por defecto para las Vistas MVC (.cshtml)
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
