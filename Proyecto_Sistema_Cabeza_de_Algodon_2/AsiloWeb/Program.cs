using AsiloWeb.Services; // Namespace de tu conector C#

var builder = WebApplication.CreateBuilder(args);

// Habilitar Controladores CON VISTAS (.cshtml)
builder.Services.AddControllersWithViews();

// Nota: ya no se registra AppDbContext/EF Core aqui. El modulo de Pacientes
// (tabla Residentes) ahora lo maneja el microservicio "pacientes_service"
// (FastAPI, puerto 8000), consumido directamente desde el frontend
// (wwwroot/JS/pacientes.js). Si en el futuro este backend .NET necesita leer
// datos propios, se vuelve a agregar un DbContext aqui.

// Registrar el conector C# que consume el microservicio de Python (Puerto 8002)
builder.Services.AddHttpClient<PdfService>();

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
