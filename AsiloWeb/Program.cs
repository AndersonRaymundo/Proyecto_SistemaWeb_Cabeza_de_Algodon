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

    if (!db.Usuarios.Any())
    {
        db.Usuarios.AddRange(
            new Usuario { NombreUsuario = "admin", PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"), NombreCompleto = "Administrador del Sistema", Rol = "ADMINISTRADOR" },
            new Usuario { NombreUsuario = "doctor", PasswordHash = BCrypt.Net.BCrypt.HashPassword("doctor123"), NombreCompleto = "Dr. Raymundo", Rol = "DOCTOR" },
            new Usuario { NombreUsuario = "enfermero", PasswordHash = BCrypt.Net.BCrypt.HashPassword("enfermero123"), NombreCompleto = "Licda. Sofia Lopez", Rol = "ENFERMERO" },
            new Usuario { NombreUsuario = "farmacia", PasswordHash = BCrypt.Net.BCrypt.HashPassword("farmacia123"), NombreCompleto = "Encargado de Farmacia", Rol = "FARMACIA" }
        );
        db.SaveChanges();
    }
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

app.UseAuthorization();

// Mapear API Controllers normales
app.MapControllers();

// Mapear la ruta por defecto para las Vistas MVC (.cshtml)
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();
