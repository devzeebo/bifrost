package admin

import (
	"fmt"
	"net/http"

	"github.com/devzeebo/bifrost/core"
)

// RouteConfig holds the configuration for registering admin routes.
type RouteConfig struct {
	AuthConfig      *AuthConfig
	ProjectionStore core.ProjectionStore
	EventStore      core.EventStore
	// Vike UI configuration (production only)
	StaticPath string // Path to built Vike assets (production mode)
	// Vike UI configuration (development only)
	ViteDevServerURL string // URL of Vite dev server (development mode)
}

// RegisterRoutesResult contains the result of registering admin routes.
type RegisterRoutesResult struct {
	Handler http.Handler // The main handler to use (may be wrapped with Vike proxy)
}

// RegisterRoutes registers API routes and UI proxy routes.
// This is a simplified version without the old template-based admin UI.
func RegisterRoutes(mux *http.ServeMux, cfg *RouteConfig) (*RegisterRoutesResult, error) {
	// Register session API routes for Vike/React UI
	RegisterSessionAPIRoutes(mux, cfg)

	// Register accounts JSON API routes for Vike/React UI
	RegisterAccountsAPIRoutes(mux, cfg)

	// Register new /ui/ routes (development or production)
	if err := registerUIRoutes(mux, cfg); err != nil {
		return nil, err
	}

	return &RegisterRoutesResult{Handler: mux}, nil
}

// registerUIRoutes registers the new Vike/React admin UI on /ui/*.
// In development mode, requests are proxied to the Vite dev server.
// In production mode, requests are served from built static assets.
func registerUIRoutes(mux *http.ServeMux, cfg *RouteConfig) error {
	var handler http.Handler
	var err error

	switch {
	case cfg.ViteDevServerURL != "":
		// Development mode: proxy to Vite dev server
		handler, err = NewVikeProxyHandler(cfg.ViteDevServerURL, UIPrefix)
		if err != nil {
			return fmt.Errorf("failed to create Vike proxy handler: %w", err)
		}
	case cfg.StaticPath != "":
		// Production mode: serve static files
		handler, err = NewVikeStaticHandler(cfg.StaticPath, UIPrefix)
		if err != nil {
			return fmt.Errorf("failed to create Vike static handler: %w", err)
		}
	default:
		// No UI configured, nothing to register
		return nil
	}

	// Catch-all: serve everything under /ui/
	mux.Handle(UIPrefix+"/", handler)
	mux.Handle(UIPrefix, http.RedirectHandler(UIPrefix+"/", http.StatusMovedPermanently))

	return nil
}
