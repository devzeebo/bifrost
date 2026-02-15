BINARY_DIR := bin
SERVER_BINARY := bifrost-server
CLI_BINARY := bf

.PHONY: build build-server build-cli docker test lint clean

build: build-server build-cli

build-server:
	go build -o $(BINARY_DIR)/$(SERVER_BINARY) ./server/cmd

build-cli:
	go build -o $(BINARY_DIR)/$(CLI_BINARY) ./cli/cmd/bf
	ln -sf $(CLI_BINARY) $(BINARY_DIR)/bifrost

docker:
	docker build -t bifrost:latest .

test:
	go test ./core/... ./providers/sqlite/... ./domain/... ./server/... ./cli/...

lint:
	golangci-lint run ./...

clean:
	rm -rf $(BINARY_DIR)/
