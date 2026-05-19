FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy full context so this works whether Render builds from repo root
# or from Flowly-WebApp/Flowly.API as the root directory.
COPY . ./

RUN if [ -f Flowly.API.csproj ]; then \
			dotnet restore Flowly.API.csproj; \
		elif [ -f Flowly-WebApp/Flowly.API/Flowly.API.csproj ]; then \
			dotnet restore Flowly-WebApp/Flowly.API/Flowly.API.csproj; \
		else \
			echo "Flowly.API.csproj not found in build context"; \
			exit 1; \
		fi

RUN if [ -f Flowly.API.csproj ]; then \
			dotnet publish Flowly.API.csproj -c Release -o /app/publish /p:UseAppHost=false; \
		else \
			cd Flowly-WebApp/Flowly.API && dotnet publish Flowly.API.csproj -c Release -o /app/publish /p:UseAppHost=false; \
		fi

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app

# Needed by PostgreSQL driver/native auth paths on some hosts.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends libgssapi-krb5-2 \
	&& rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish ./

EXPOSE 10000
ENTRYPOINT ["dotnet", "Flowly.API.dll"]
