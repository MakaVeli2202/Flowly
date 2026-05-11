FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy full context so this works whether Render builds from repo root
# or from Glanz-WebApp/Glanz.API as the root directory.
COPY . ./

RUN if [ -f Glanz.API.csproj ]; then \
			dotnet restore Glanz.API.csproj; \
		elif [ -f Glanz-WebApp/Glanz.API/Glanz.API.csproj ]; then \
			dotnet restore Glanz-WebApp/Glanz.API/Glanz.API.csproj; \
		else \
			echo "Glanz.API.csproj not found in build context"; \
			exit 1; \
		fi

RUN if [ -f Glanz.API.csproj ]; then \
			dotnet publish Glanz.API.csproj -c Release -o /app/publish /p:UseAppHost=false; \
		else \
			cd Glanz-WebApp/Glanz.API && dotnet publish Glanz.API.csproj -c Release -o /app/publish /p:UseAppHost=false; \
		fi

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish ./

EXPOSE 10000
ENTRYPOINT ["dotnet", "Glanz.API.dll"]
