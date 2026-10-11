using Microsoft.AspNetCore.Authentication.Cookies;
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

// Conectores a los 3 microservicios que SI siguen siendo microservicios
// (Pacientes lo consume el frontend directo por JS; PDF y Correo se
// consumen desde el backend .NET).
builder.Services.AddHttpClient<PdfService>();
builder.Services.AddHttpClient<EmailService>();
builder.Services.AddHttpClient<PacientesService>();

// Servicios de negocio (descuento de la fundacion, cobro automatico, ficha base)
builder.Services.AddScoped<FacturacionService>();
builder.Services.AddScoped<ExpedienteService>();

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

    var semillas = new[]
    {
        (Login: "admin",       Clave: "admin123",       Nombre: "Administrador del Sistema", Rol: "ADMINISTRADOR"),
        (Login: "doctor",      Clave: "doctor123",      Nombre: "Dr. Raymundo",             Rol: "DOCTOR"),
        (Login: "enfermero",   Clave: "enfermero123",   Nombre: "Licda. Sofia Lopez",       Rol: "ENFERMERO"),
        (Login: "farmacia",    Clave: "farmacia123",    Nombre: "Encargado de Farmacia",    Rol: "FARMACIA"),
        (Login: "fundacion",   Clave: "fundacion123",   Nombre: "Personal de la Fundacion", Rol: "FUNDACION"),
        (Login: "laboratorio", Clave: "laboratorio123", Nombre: "Personal de Laboratorio",  Rol: "LABORATORIO")
    };

    foreach (var semilla in semillas)
    {
        if (!db.Usuarios.Any(u => u.NombreUsuario == semilla.Login))
        {
            db.Usuarios.Add(new Usuario
            {
                NombreUsuario = semilla.Login,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(semilla.Clave),
                NombreCompleto = semilla.Nombre,
                Rol = semilla.Rol
            });
        }
    }
    db.SaveChanges();
}

// Configurar el pipeline HTTP
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Habilitar carpetas publicas (wwwroot: css, js, imagenes)
app.UseStaticFiles();

app.UseRouting();

app.UseCors("PermitirFrontend");

app.UseAuthentication();
app.UseAuthorization();

// Mapear API Controllers normales
app.MapControllers();

// Mapear la ruta por defecto para las Vistas MVC (.cshtml)
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
