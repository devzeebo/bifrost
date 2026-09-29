FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY net/Bifrost.WorkItems.Contracts net/Bifrost.WorkItems.Contracts
COPY net/Bifrost.Rpc.Abstractions net/Bifrost.Rpc.Abstractions
COPY net/Bifrost.Rpc.Generators net/Bifrost.Rpc.Generators
COPY net/Bifrost.Rpc net/Bifrost.Rpc
COPY net/Bifrost.MessageBus.Abstractions net/Bifrost.MessageBus.Abstractions
COPY net/Bifrost.WorkItems net/Bifrost.WorkItems
RUN dotnet publish net/Bifrost.WorkItems/Bifrost.WorkItems.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://+:8080
ENV BIFROST_SOCKET=/run/bifrost/bus.sock
EXPOSE 8080
ENTRYPOINT ["dotnet", "Bifrost.WorkItems.dll"]
