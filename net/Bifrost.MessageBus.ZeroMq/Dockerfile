FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY net/Bifrost.Rpc.Abstractions net/Bifrost.Rpc.Abstractions
COPY net/Bifrost.Rpc.Generators net/Bifrost.Rpc.Generators
COPY net/Bifrost.Rpc net/Bifrost.Rpc
COPY net/Bifrost.MessageBus.Abstractions net/Bifrost.MessageBus.Abstractions
COPY net/Bifrost.MessageBus.ZeroMq net/Bifrost.MessageBus.ZeroMq
RUN dotnet publish net/Bifrost.MessageBus.ZeroMq/Bifrost.MessageBus.ZeroMq.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app
COPY --from=build /app .
ENV BIFROST_BUS_SOCKET=/run/bifrost/bus.sock
ENV BIFROST_INSTANCE_ID=bus
ENV BIFROST_ROLE=primary
ENTRYPOINT ["dotnet", "Bifrost.MessageBus.ZeroMq.dll"]
