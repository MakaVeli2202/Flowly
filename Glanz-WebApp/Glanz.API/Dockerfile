FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY Glanz.API.csproj ./
RUN dotnet restore Glanz.API.csproj

COPY . ./
RUN dotnet publish Glanz.API.csproj -c Release -o /app/publish /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish ./

EXPOSE 10000
ENTRYPOINT ["dotnet", "Glanz.API.dll"]
