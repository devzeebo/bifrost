FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY net/Bifrost.Orchestrator.Contracts net/Bifrost.Orchestrator.Contracts
COPY net/Bifrost.Rpc.Abstractions net/Bifrost.Rpc.Abstractions
COPY net/Bifrost.Rpc.Generators net/Bifrost.Rpc.Generators
COPY net/Bifrost.Rpc net/Bifrost.Rpc
COPY net/Bifrost.MessageBus.Abstractions net/Bifrost.MessageBus.Abstractions
COPY net/Bifrost.MessageBus.Wolverine net/Bifrost.MessageBus.Wolverine
COPY net/Bifrost.WorkerNode net/Bifrost.WorkerNode
RUN dotnet publish net/Bifrost.WorkerNode/Bifrost.WorkerNode.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app
COPY --from=build /app .
ENV BIFROST_SOCKET=/run/bifrost/bus.sock
ENV BIFROST_OUTBOX_PATH=/var/lib/bifrost/worker-node.db
ENTRYPOINT ["dotnet", "Bifrost.WorkerNode.dll"]
