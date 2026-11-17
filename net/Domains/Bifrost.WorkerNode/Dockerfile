FROM node:22-bookworm AS agent
WORKDIR /src/agent
COPY agent/package.json agent/package-lock.json agent/tsconfig.json agent/vite.config.ts ./
COPY agent/packages ./packages
COPY agent/apps ./apps
COPY agent/scripts ./scripts
# Agent package.json pins npm 12 via devEngines; image default may be older.
RUN npm install -g npm@12.2.1 \
  && npm ci \
  && npm run build -w @bifrost-ai/tools \
  && npm run build -w @bifrost-ai/engines \
  && npm run build -w @bifrost-ai/engine-fireworks \
  && npm run build -w @bifrost-ai/harness \
  && npm run build -w @bifrost-ai/tool-random-number \
  && npm run build -w @bifrost-ai/cli

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY net/Domains/Bifrost.Orchestrator.Contracts net/Domains/Bifrost.Orchestrator.Contracts
COPY net/Domains/Bifrost.WorkItems.Contracts net/Domains/Bifrost.WorkItems.Contracts
COPY net/Domains/Bifrost.Skills.Contracts net/Domains/Bifrost.Skills.Contracts
COPY net/Infrastructure/Bifrost.Rpc.Abstractions net/Infrastructure/Bifrost.Rpc.Abstractions
COPY net/Infrastructure/Bifrost.Rpc.Generators net/Infrastructure/Bifrost.Rpc.Generators
COPY net/Infrastructure/Bifrost.Rpc net/Infrastructure/Bifrost.Rpc
COPY net/Infrastructure/Bifrost.MessageBus.Abstractions net/Infrastructure/Bifrost.MessageBus.Abstractions
COPY net/Infrastructure/Bifrost.MessageBus.Wolverine net/Infrastructure/Bifrost.MessageBus.Wolverine
COPY net/Domains/Bifrost.WorkerNode net/Domains/Bifrost.WorkerNode
RUN dotnet publish net/Domains/Bifrost.WorkerNode/Bifrost.WorkerNode.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app
# Docker CLI for script containers (DoD via mounted docker.sock) + Node for in-image harness.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl xz-utils \
  && curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-27.3.1.tgz \
    | tar -xz -C /tmp \
  && mv /tmp/docker/docker /usr/local/bin/docker \
  && rm -rf /tmp/docker \
  && curl -fsSL https://nodejs.org/dist/v22.18.0/node-v22.18.0-linux-x64.tar.xz \
    | tar -xJ -C /usr/local --strip-components=1 \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app .
COPY --from=agent /src/agent /opt/bifrost/agent
COPY docker/run-harness.mjs /opt/bifrost/run-harness.mjs
ENV Bifrost__OutboxPath=/var/lib/bifrost/worker-node.db \
    Bifrost__Harness__Executable=node \
    Bifrost__Harness__Arguments__0=/opt/bifrost/run-harness.mjs \
    Bifrost__Harness__Identity=bifrost-harness \
    Bifrost__Harness__ExecutionTimeout=01:00:00 \
    Bifrost__AgentRoot=/opt/bifrost/agent \
    BIFROST_AGENT_ROOT=/opt/bifrost/agent
ENTRYPOINT ["dotnet", "Bifrost.WorkerNode.dll"]
