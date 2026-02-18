BINARY_DIR := bin
SERVER_BINARY := bifrost-server
CLI_BINARY := bf
VIKE_PORT := 3000

# All Go workspace modules (derived from go.work)
ALL_MODULES := core domain domain/integration providers/sqlite server cli

# Resolve MODULES variable: use user-supplied list or default to all
ifdef MODULES
  GO_TARGETS := $(foreach m,$(MODULES),./$(m)/...)
else
  GO_TARGETS := $(foreach m,$(ALL_MODULES),./$(m)/...)
endif

.PHONY: build build-server build-cli build-admin-ui \
        test lint vet tidy \
        dev prod docker clean list help

# ── Build ─────────────────────────────────────────────────────────────────────

build: build-server build-cli

build-server:
	@echo "» building server → $(BINARY_DIR)/$(SERVER_BINARY)"
	go build -o $(BINARY_DIR)/$(SERVER_BINARY) ./server/cmd

build-cli:
	@echo "» building cli → $(BINARY_DIR)/$(CLI_BINARY)"
	go build -o $(BINARY_DIR)/$(CLI_BINARY) ./cli/cmd/bf
	ln -sf $(CLI_BINARY) $(BINARY_DIR)/bifrost

build-admin-ui:
	@echo "» building admin-ui for production"
	cd admin-ui && npm run build
	@echo "» admin-ui built to admin-ui/dist/"

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
	@echo "» starting dev mode (Go server on :8080, Vike on :$(VIKE_PORT))"
	@echo "» starting Go server..."
	$(BINARY_DIR)/$(SERVER_BINARY) & \
	SERVER_PID=$$!; \
	sleep 1; \
	echo "» starting Vike dev server (proxies /admin to :8080)..."; \
	cd admin-ui && npm run dev -- --port $(VIKE_PORT); \
	kill $$SERVER_PID 2>/dev/null || true; \
	wait $$SERVER_PID 2>/dev/null || true

prod: build-server build-admin-ui
	@echo "» starting production mode (Go server on :8080, serving built admin-ui)"
	BIFROST_ADMIN_UI_STATIC_PATH=admin-ui/dist $(BINARY_DIR)/$(SERVER_BINARY)

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
	@echo "  build            Build server + CLI binaries"
	@echo "  build-server     Build the server binary"
	@echo "  build-cli        Build the CLI binary"
	@echo "  build-admin-ui   Build the Vike admin-ui for production"
	@echo "  test             Run tests (all modules or MODULES=...)"
	@echo "  lint             Run golangci-lint (all modules or MODULES=...)"
	@echo "  vet              Run go vet (all modules or MODULES=...)"
	@echo "  tidy             Run go mod tidy (all modules or MODULES=...)"
	@echo "  dev              Start Go server + Vike dev server"
	@echo "  prod             Build admin-ui and start Go server (production mode)"
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
