FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY go.work go.work
COPY go.work.sum go.work.sum
COPY core/ core/
COPY providers/ providers/
COPY domain/ domain/
COPY server/ server/
COPY cli/ cli/
RUN go work sync
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags='-s -w' -o /bin/bifrost-server ./server/cmd
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags='-s -w' -o /bin/bf ./cli/cmd/bf

FROM alpine:3.19
RUN apk --no-cache add ca-certificates
COPY --from=builder /bin/bifrost-server /usr/local/bin/bifrost-server
COPY --from=builder /bin/bf /usr/local/bin/bf
RUN ln -s /usr/local/bin/bf /usr/local/bin/bifrost
EXPOSE 8080
VOLUME /data
ENV BIFROST_DB_PATH=/data/bifrost.db
# bf admin is available via: docker exec <container> bf admin <command>
# It uses BIFROST_DB_PATH (/data/bifrost.db) by default — the same DB as the server.
ENTRYPOINT ["bifrost-server"]
