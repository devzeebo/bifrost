FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY net/Bifrost.Rpc.Abstractions net/Bifrost.Rpc.Abstractions
COPY net/Bifrost.Rpc.Generators net/Bifrost.Rpc.Generators
COPY net/Bifrost.Rpc net/Bifrost.Rpc
COPY net/Bifrost.MessageBus.Abstractions net/Bifrost.MessageBus.Abstractions
COPY net/Bifrost.MessageBus.RabbitMq net/Bifrost.MessageBus.RabbitMq
RUN dotnet publish net/Bifrost.MessageBus.RabbitMq/Bifrost.MessageBus.RabbitMq.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app
COPY --from=build /app .
ENV BIFROST_SOCKET=/run/bifrost/bus.sock
ENV BIFROST_INSTANCE_ID=work-items
ENV BIFROST_ROLE=primary
ENV BUS_ENDPOINT=amqp://bifrost:bifrost@rabbitmq:5672/
ENV BUS_SUBSCRIBERS=work-items,orchestrator,worker
ENTRYPOINT ["dotnet", "Bifrost.MessageBus.RabbitMq.dll"]
