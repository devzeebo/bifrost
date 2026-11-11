FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY net/Domains/Bifrost.Orchestrator.Contracts net/Domains/Bifrost.Orchestrator.Contracts
COPY net/Domains/Bifrost.WorkItems.Contracts net/Domains/Bifrost.WorkItems.Contracts
COPY net/Infrastructure/Bifrost.Rpc.Abstractions net/Infrastructure/Bifrost.Rpc.Abstractions
COPY net/Infrastructure/Bifrost.Rpc.Generators net/Infrastructure/Bifrost.Rpc.Generators
COPY net/Infrastructure/Bifrost.Rpc net/Infrastructure/Bifrost.Rpc
COPY net/Infrastructure/Bifrost.MessageBus.Abstractions net/Infrastructure/Bifrost.MessageBus.Abstractions
COPY net/Infrastructure/Bifrost.MessageBus.Wolverine net/Infrastructure/Bifrost.MessageBus.Wolverine
COPY net/Domains/Bifrost.WorkerNode net/Domains/Bifrost.WorkerNode
RUN dotnet publish net/Domains/Bifrost.WorkerNode/Bifrost.WorkerNode.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app
# Docker CLI only — daemon is the host via mounted docker.sock (DoD).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-27.3.1.tgz \
    | tar -xz -C /tmp \
  && mv /tmp/docker/docker /usr/local/bin/docker \
  && rm -rf /tmp/docker /var/lib/apt/lists/*
COPY --from=build /app .
ENV Bifrost__OutboxPath=/var/lib/bifrost/worker-node.db
ENTRYPOINT ["dotnet", "Bifrost.WorkerNode.dll"]
