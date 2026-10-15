# ---------------------------------------------------------------------------
# Imagen de la aplicacion web (ASP.NET Core 8) para la nube.
# Se construye desde la carpeta AsiloWeb:  docker build -t asilo-web ./AsiloWeb
# ---------------------------------------------------------------------------

# 1) Compilar y publicar
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY BackendAsilo.csproj .
RUN dotnet restore
COPY . .
RUN dotnet publish BackendAsilo.csproj -c Release -o /app/publish /p:UseAppHost=false

# 2) Imagen final, solo con lo necesario para ejecutar
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "BackendAsilo.dll"]
