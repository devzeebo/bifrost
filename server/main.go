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
	_ "github.com/jackc/pgx/v5/stdlib"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/devzeebo/bifrost/providers/sqlite"
	"github.com/devzeebo/bifrost/providers/postgres"
	"github.com/devzeebo/bifrost/server/admin"
)

// registerProjectors registers all projectors with the engine
func registerProjectors(engine core.ProjectionEngine) error {
	// Account projections (realm: _admin)
	if err := engine.Register(projectors.NewAccountAuthProjector()); err != nil {
		return err
	}
	if err := engine.Register(projectors.NewAccountDirectoryProjector()); err != nil {
		return err
	}
	if err := engine.Register(projectors.NewUsernameLookupProjector()); err != nil {
		return err
	}
	if err := engine.Register(projectors.NewPATIDProjector()); err != nil {
		return err
	}
	if err := engine.Register(projectors.NewPATKeyhashProjector()); err != nil {
		return err
	}

	// System projections (realm: _admin)
	if err := engine.Register(projectors.NewSystemStatusProjector()); err != nil {
		return err
	}

	// Realm projections (realm: _admin)
	if err := engine.Register(projectors.NewRealmDirectoryProjector()); err != nil {
		return err
	}
	if err := engine.Register(projectors.NewRealmNameLookupProjector()); err != nil {
		return err
	}

	// Rune projections (realm: per-realm)
	if err := engine.Register(projectors.NewRuneSummaryProjector()); err != nil {
		return err
	}
	if err := engine.Register(projectors.NewRuneDetailProjector()); err != nil {
		return err
	}
	if err := engine.Register(projectors.NewRuneDependencyGraphProjector()); err != nil {
		return err
	}
	if err := engine.Register(projectors.NewDependencyExistenceProjector()); err != nil {
		return err
	}
	if err := engine.Register(projectors.NewDependencyCycleCheckProjector()); err != nil {
		return err
	}
	if err := engine.Register(projectors.NewRuneChildCountProjector()); err != nil {
		return err
	}
	if err := engine.Register(projectors.NewRuneRetroProjector()); err != nil {
		return err
	}

	return nil
}

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
	case "postgres":
		db, err = sql.Open("pgx", cfg.DBPath)
		if err != nil {
			return fmt.Errorf("open database: %w", err)
		}
	default:
		return fmt.Errorf("unsupported DB driver: %q", cfg.DBDriver)
	}
	defer db.Close()

	// 2. Create stores
	var eventStore core.EventStore
	var projectionStore core.ProjectionStore
	var checkpointStore core.CheckpointStore

	switch cfg.DBDriver {
	case "sqlite":
		eventStore, err = sqlite.NewEventStore(db)
		if err != nil {
			return fmt.Errorf("create event store: %w", err)
		}
		projectionStore, err = sqlite.NewProjectionStore(db)
		if err != nil {
			return fmt.Errorf("create projection store: %w", err)
		}
		checkpointStore, err = sqlite.NewCheckpointStore(db)
		if err != nil {
			return fmt.Errorf("create checkpoint store: %w", err)
		}
	case "postgres":
		eventStore, err = postgres.NewEventStore(db)
		if err != nil {
			return fmt.Errorf("create event store: %w", err)
		}
		projectionStore, err = postgres.NewProjectionStore(db)
		if err != nil {
			return fmt.Errorf("create projection store: %w", err)
		}
		checkpointStore, err = postgres.NewCheckpointStore(db)
		if err != nil {
			return fmt.Errorf("create checkpoint store: %w", err)
		}
	}

	// 3. Create projection engine and register projectors
	engine := core.NewProjectionEngine(
		eventStore,
		projectionStore,
		checkpointStore,
		core.WithPollInterval(cfg.CatchUpInterval),
	)

	// Register all projectors
	if err := registerProjectors(engine); err != nil {
		log.Fatalf("failed to register projectors: %v", err)
	}

	// 4. Start catch-up in background
	if err := engine.StartCatchUp(ctx); err != nil {
		return fmt.Errorf("start catch-up: %w", err)
	}

	// 5. Set up admin auth config (used by both API and UI routes)
	adminAuthConfig := admin.DefaultAuthConfig()
	
	// Priority: 1. Environment variable, 2. YAML config, 3. Generate temporary
	if keyStr := os.Getenv("ADMIN_JWT_SIGNING_KEY"); keyStr != "" {
		key, err := base64.RawURLEncoding.DecodeString(keyStr)
		if err != nil {
			return fmt.Errorf("decode ADMIN_JWT_SIGNING_KEY: %w", err)
		}
		adminAuthConfig.SigningKey = key
	} else if cfg.JWTSigningKey != "" {
		key, err := base64.RawURLEncoding.DecodeString(cfg.JWTSigningKey)
		if err != nil {
			return fmt.Errorf("decode jwt_signing_key from config: %w", err)
		}
		adminAuthConfig.SigningKey = key
	} else {
		// Generate a temporary key for development (will change on restart)
		log.Println("Warning: ADMIN_JWT_SIGNING_KEY not set and jwt_signing_key not configured, generating temporary key (sessions will invalidate on restart)")
		key, err := admin.GenerateSigningKey()
		if err != nil {
			return fmt.Errorf("generate signing key: %w", err)
		}
		adminAuthConfig.SigningKey = key
	}

	// Disable secure cookies for local development
	adminAuthConfig.CookieSecure = false

	// 6. Set up HTTP routes with auth middleware
	mux := http.NewServeMux()
	auth := AuthMiddleware(projectionStore, &AuthConfig{AdminAuthConfig: adminAuthConfig})
	realmAuth := func(h http.Handler) http.Handler { return auth(RequireRealm(h)) }
	adminAuth := func(h http.Handler) http.Handler { return auth(RequireAdmin(h)) }

	handlers := NewHandlers(eventStore, projectionStore, engine)
	handlers.RegisterRoutes(mux, realmAuth, adminAuth)

	// Register admin UI routes
	result, err := admin.RegisterRoutes(mux, &admin.RouteConfig{
		AuthConfig:       adminAuthConfig,
		ProjectionStore:  projectionStore,
		EventStore:       eventStore,
		ViteDevServerURL: cfg.ViteDevServerURL,
	})
	if err != nil {
		return fmt.Errorf("register admin routes: %w", err)
	}

	// Use the wrapped handler (may include Vike proxy)
	handler := result.Handler

	// 6. Create and start HTTP server
	srv := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Port),
		Handler: handler,
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
