package server

import (
	"context"
	"database/sql"
	"encoding/base64"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	_ "modernc.org/sqlite"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/devzeebo/bifrost/providers/sqlite"
	"github.com/devzeebo/bifrost/server/admin"
)

func Run(ctx context.Context, cfg *Config) error {
	// 1. Open DB
	var db *sql.DB
	var err error
	switch cfg.DBDriver {
	case "sqlite":
		db, err = sql.Open("sqlite", cfg.DBPath)
		if err != nil {
			return fmt.Errorf("open database: %w", err)
		}
	default:
		return fmt.Errorf("unsupported DB driver: %q", cfg.DBDriver)
	}
	defer db.Close()

	// 2. Create stores
	eventStore, err := sqlite.NewEventStore(db)
	if err != nil {
		return fmt.Errorf("create event store: %w", err)
	}

	projectionStore, err := sqlite.NewProjectionStore(db)
	if err != nil {
		return fmt.Errorf("create projection store: %w", err)
	}

	checkpointStore, err := sqlite.NewCheckpointStore(db)
	if err != nil {
		return fmt.Errorf("create checkpoint store: %w", err)
	}

	// 3. Create projection engine and register projectors
	engine := core.NewProjectionEngine(
		eventStore,
		projectionStore,
		checkpointStore,
		core.WithPollInterval(cfg.CatchUpInterval),
	)

	engine.Register(projectors.NewRealmListProjector())
	engine.Register(projectors.NewRuneListProjector())
	engine.Register(projectors.NewRuneDetailProjector())
	engine.Register(projectors.NewDependencyGraphProjector())
	engine.Register(projectors.NewAccountLookupProjector())
	engine.Register(projectors.NewRuneChildCountProjector())

	// 4. Start catch-up in background
	if err := engine.StartCatchUp(ctx); err != nil {
		return fmt.Errorf("start catch-up: %w", err)
	}

	// 5. Set up HTTP routes with auth middleware
	mux := http.NewServeMux()
	auth := AuthMiddleware(projectionStore)
	realmAuth := func(h http.Handler) http.Handler { return auth(RequireRealm(h)) }
	adminAuth := func(h http.Handler) http.Handler { return auth(RequireAdmin(h)) }

	handlers := NewHandlers(eventStore, projectionStore, engine)
	handlers.RegisterRoutes(mux, realmAuth, adminAuth)

	// Register admin UI routes
	adminAuthConfig := admin.DefaultAuthConfig()
	if keyStr := os.Getenv("ADMIN_JWT_SIGNING_KEY"); keyStr != "" {
		key, err := base64.RawURLEncoding.DecodeString(keyStr)
		if err != nil {
			return fmt.Errorf("decode ADMIN_JWT_SIGNING_KEY: %w", err)
		}
		adminAuthConfig.SigningKey = key
	} else {
		// Generate a temporary key for development (will change on restart)
		log.Println("Warning: ADMIN_JWT_SIGNING_KEY not set, generating temporary key (sessions will invalidate on restart)")
		key, err := admin.GenerateSigningKey()
		if err != nil {
			return fmt.Errorf("generate signing key: %w", err)
		}
		adminAuthConfig.SigningKey = key
	}

	// Disable secure cookies for local development
	adminAuthConfig.CookieSecure = false

	if err := admin.RegisterRoutes(mux, &admin.RouteConfig{
		AuthConfig:      adminAuthConfig,
		ProjectionStore: projectionStore,
		EventStore:      eventStore,
	}); err != nil {
		return fmt.Errorf("register admin routes: %w", err)
	}

	// 6. Create and start HTTP server
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: mux,
		BaseContext: func(l net.Listener) context.Context {
			return ctx
		},
	}

	// 7. Listen for shutdown signals
	notifyCtx, stop := signal.NotifyContext(ctx, syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Start server in goroutine
	errCh := make(chan error, 1)
	go func() {
		log.Printf("bifrost server listening on :%d", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
		close(errCh)
	}()

	// Wait for context cancellation or signal
	<-notifyCtx.Done()
	log.Println("shutting down...")

	// 8. Graceful shutdown
	if err := engine.Stop(); err != nil {
		log.Printf("projection engine stop error: %v", err)
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("server shutdown: %w", err)
	}

	// Wait for ListenAndServe to return
	if err := <-errCh; err != nil {
		return err
	}

	return nil
}
