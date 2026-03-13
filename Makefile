BINARY_DIR := bin
SERVER_BINARY := bifrost-server
CLI_BINARY := bf
UI_PORT := 5173


# All Go workspace modules (derived from go.work)
ALL_MODULES := core domain domain/integration providers/sqlite server cli

# Resolve MODULES variable: use user-supplied list or default to all
ifdef MODULES
  GO_TARGETS := $(foreach m,$(MODULES),./$(m)/...)
else
  GO_TARGETS := $(foreach m,$(ALL_MODULES),./$(m)/...)
endif

.PHONY: build build-server build-cli build-ui ui-dist \
        test lint vet tidy \
        dev prod docker clean list help

# ── Build ─────────────────────────────────────────────────────────────────────

build: build-server build-cli

ui-dist:
	@echo "» building ui for production"
	cd ui && npm run build
	@echo "» copying ui dist to server/admin/ui/"
	rm -rf server/admin/ui
	cp -r ui/dist/client server/admin/ui
	@echo "» ui embedded in server binary"

build-server: ui-dist
	@echo "» building server → $(BINARY_DIR)/$(SERVER_BINARY)"
	go build -buildvcs=false -o $(BINARY_DIR)/$(SERVER_BINARY) ./server/cmd

build-cli:
	@echo "» building cli → $(BINARY_DIR)/$(CLI_BINARY)"
	go build -buildvcs=false -o $(BINARY_DIR)/$(CLI_BINARY) ./cli/cmd/bf
	ln -sf $(CLI_BINARY) $(BINARY_DIR)/bifrost

build-cli-debug:
	@echo "» building cli (debug) → $(BINARY_DIR)/$(CLI_BINARY)"
	go build -buildvcs=false -tags debug -o $(BINARY_DIR)/$(CLI_BINARY) ./cli/cmd/bf
	ln -sf $(CLI_BINARY) $(BINARY_DIR)/bifrost

build-ui: ui-dist

# ── Quality ───────────────────────────────────────────────────────────────────

test:
	@echo "» go test $(ARGS) $(GO_TARGETS)"
	go test $(ARGS) $(GO_TARGETS)

lint:
	@echo "» golangci-lint run $(ARGS) $(GO_TARGETS)"
	go tool golangci-lint run $(ARGS) $(GO_TARGETS)

vet:
	@echo "» go vet $(ARGS) $(GO_TARGETS)"
	go vet $(ARGS) $(GO_TARGETS)

tidy:
ifdef MODULES
	$(foreach m,$(MODULES),@echo "» go mod tidy  ($(m))" && cd $(m) && go mod tidy && cd $(CURDIR) &&) true
else
	$(foreach m,$(ALL_MODULES),@echo "» go mod tidy  ($(m))" && cd $(m) && go mod tidy && cd $(CURDIR) &&) true
endif

# ── Dev ───────────────────────────────────────────────────────────────────────

dev: build-server
	@echo "» killing any processes on ports 8080 and $(UI_PORT)..."
	@fuser -k 8080/tcp 2>/dev/null || true
	@fuser -k $(UI_PORT)/tcp 2>/dev/null || true
	@sleep 0.5
	@echo "» starting Go server on :8080..."
	$(BINARY_DIR)/$(SERVER_BINARY) & \
	SERVER_PID=$$!; \
	sleep 1; \
	echo "» starting Vike UI server on :$(UI_PORT) (proxies /api to :8080)..."; \
	cd ui && npm run dev -- --port $(UI_PORT); \
	kill $$SERVER_PID 2>/dev/null || true; \
	wait $$SERVER_PID 2>/dev/null || true

prod: build-server
	@echo "» starting production mode (Go server on :8080 with embedded UI)"
	$(BINARY_DIR)/$(SERVER_BINARY)

# ── Misc ──────────────────────────────────────────────────────────────────────

docker:
	docker build -t bifrost:latest .

clean:
	rm -rf $(BINARY_DIR)/

list:
	@echo "Available modules:"
	@$(foreach m,$(ALL_MODULES),echo "  $(m)";)

help:
	@echo "Usage: make <target> [MODULES=\"mod1 mod2\"] [ARGS=\"-v -count=1\"]"
	@echo ""
	@echo "Targets:"
	@echo "  build            Build server + CLI binaries (includes embedded UI)"
	@echo "  build-server     Build the server binary (includes embedded UI)"
	@echo "  build-cli        Build the CLI binary"
	@echo "  build-ui         Build the Vike UI and copy to server/admin/ui/"
	@echo "  ui-dist          Build UI and copy dist to server/admin/ui/ (alias for build-ui)"

	@echo "  test             Run tests (all modules or MODULES=...)"
	@echo "  lint             Run golangci-lint (all modules or MODULES=...)"
	@echo "  vet              Run go vet (all modules or MODULES=...)"
	@echo "  tidy             Run go mod tidy (all modules or MODULES=...)"
	@echo "  dev              Start Go server + Vike UI dev server"

	@echo "  prod             Build and start Go server (production mode, embedded UI)"

	@echo "  docker           Build Docker image"
	@echo "  clean            Remove build artifacts"
	@echo "  list             List available modules"
	@echo ""
	@echo "Modules: $(ALL_MODULES)"
	@echo ""
	@echo "Examples:"
	@echo "  make test                              # test everything"
	@echo "  make test MODULES=core                 # test only core"
	@echo "  make test MODULES=\"core domain\"         # test core and domain"
	@echo "  make lint MODULES=\"server cli\"           # lint server and cli"
	@echo "  make test MODULES=core ARGS=\"-v -count=1\"  # pass extra flags"
	@echo "  make dev                               # start dev mode"
