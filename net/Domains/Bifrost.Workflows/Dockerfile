FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY net/Domains/Bifrost.Workflows.Contracts net/Domains/Bifrost.Workflows.Contracts
COPY net/Domains/Bifrost.WorkItems.Contracts net/Domains/Bifrost.WorkItems.Contracts
COPY net/Infrastructure/Bifrost.Configuration net/Infrastructure/Bifrost.Configuration
COPY net/Infrastructure/Bifrost.Rpc.Abstractions net/Infrastructure/Bifrost.Rpc.Abstractions
COPY net/Infrastructure/Bifrost.Rpc.Generators net/Infrastructure/Bifrost.Rpc.Generators
COPY net/Infrastructure/Bifrost.Rpc net/Infrastructure/Bifrost.Rpc
COPY net/Infrastructure/Bifrost.MessageBus.Abstractions net/Infrastructure/Bifrost.MessageBus.Abstractions
COPY net/Domains/Bifrost.Workflows net/Domains/Bifrost.Workflows
RUN dotnet publish net/Domains/Bifrost.Workflows/Bifrost.Workflows.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Bifrost.Workflows.dll"]
