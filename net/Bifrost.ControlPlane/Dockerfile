FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY net/Bifrost.Contracts net/Bifrost.Contracts
COPY net/Bifrost.Rpc.Abstractions net/Bifrost.Rpc.Abstractions
COPY net/Bifrost.Rpc.Generators net/Bifrost.Rpc.Generators
COPY net/Bifrost.Rpc net/Bifrost.Rpc
COPY net/Bifrost.MessageBus.Abstractions net/Bifrost.MessageBus.Abstractions
COPY net/Bifrost.ControlPlane net/Bifrost.ControlPlane
RUN dotnet publish net/Bifrost.ControlPlane/Bifrost.ControlPlane.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_URLS=http://+:8080
ENV BIFROST_BUS_SOCKET=/run/bifrost/bus.sock
EXPOSE 8080
ENTRYPOINT ["dotnet", "Bifrost.ControlPlane.dll"]
