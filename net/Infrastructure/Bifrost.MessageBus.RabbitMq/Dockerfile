FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY net/Infrastructure/Bifrost.Rpc.Abstractions net/Infrastructure/Bifrost.Rpc.Abstractions
COPY net/Infrastructure/Bifrost.Rpc.Generators net/Infrastructure/Bifrost.Rpc.Generators
COPY net/Infrastructure/Bifrost.Rpc net/Infrastructure/Bifrost.Rpc
COPY net/Infrastructure/Bifrost.MessageBus.Abstractions net/Infrastructure/Bifrost.MessageBus.Abstractions
COPY net/Infrastructure/Bifrost.MessageBus.RabbitMq net/Infrastructure/Bifrost.MessageBus.RabbitMq
RUN dotnet publish net/Infrastructure/Bifrost.MessageBus.RabbitMq/Bifrost.MessageBus.RabbitMq.csproj -c Release -o /app

FROM mcr.microsoft.com/dotnet/runtime:10.0
WORKDIR /app
COPY --from=build /app .
ENTRYPOINT ["dotnet", "Bifrost.MessageBus.RabbitMq.dll"]
