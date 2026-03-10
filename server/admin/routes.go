package admin

import (
	"fmt"
	"net/http"

	"github.com/devzeebo/bifrost/core"
)

// RouteConfig holds the configuration for registering admin routes.
type RouteConfig struct {
	AuthConfig       *AuthConfig
	ProjectionStore  core.ProjectionStore
	EventStore       core.EventStore
	ViteDevServerURL string // URL of Vite dev server (development mode, e.g., "http://localhost:3000")
	UIProxyURL       string // URL of Vike production server (e.g., "http://ui:3000")
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
	case cfg.UIProxyURL != "":
		// Production mode: proxy to Vike production server
		handler, err = NewVikeProxyHandler(cfg.UIProxyURL, UIPrefix)
		if err != nil {
			return fmt.Errorf("failed to create Vike proxy handler: %w", err)
		}
	default:
		// No UI configured
		return nil
	}

	// Handle /ui and /ui/* paths - proxy to Vike server
	// Note: Vike expects /ui without trailing slash (base: '/ui' in vite.config.ts)
	// Redirect /ui/ to /ui to match Vike's expectation
	mux.Handle(UIPrefix+"/", http.StripPrefix(UIPrefix, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// If the path is just "/", redirect to /ui (no trailing slash)
		if r.URL.Path == "/" {
			http.Redirect(w, r, UIPrefix, http.StatusMovedPermanently)
			return
		}
		// Otherwise, prepend /ui to the path and proxy
		r.URL.Path = UIPrefix + r.URL.Path
		handler.ServeHTTP(w, r)
	})))
	mux.Handle(UIPrefix, handler)

	return nil
}
