# Stage 1: Build UI
FROM node:22-alpine AS ui-builder
WORKDIR /ui
COPY ui/package.json ui/package-lock.json* ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# Stage 2: Build Go binaries
FROM golang:1.25-alpine AS builder
WORKDIR /src
COPY go.work go.work
COPY go.work.sum go.work.sum
COPY core/ core/
COPY providers/ providers/
COPY domain/ domain/
COPY server/ server/
COPY cli/ cli/
COPY tools/ tools/
# Copy built UI files for embedding
COPY --from=ui-builder /ui/dist/client server/admin/ui
RUN go work sync
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags='-s -w' -o /bin/bifrost-server ./server/cmd
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags='-s -w' -o /bin/bf ./cli/cmd/bf

# Stage 3: Runtime
FROM alpine:3.19
RUN apk --no-cache add ca-certificates
COPY --from=builder /bin/bifrost-server /usr/local/bin/bifrost-server
COPY --from=builder /bin/bf /usr/local/bin/bf
RUN ln -s /usr/local/bin/bf /usr/local/bin/bifrost
VOLUME /data

# Default to SQLite for backward compatibility
ENV BIFROST_DB_DRIVER=sqlite
ENV BIFROST_DB_PATH=/data/bifrost.db

# bf admin is available via: docker exec <container> bf admin <command>
# It uses BIFROST_DB_PATH (/data/bifrost.db) by default — the same DB as the server.
ENTRYPOINT ["bifrost-server"]
