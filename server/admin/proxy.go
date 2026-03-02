package admin

import (
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

// BetaAdminPrefix is the URL path prefix for the Vike beta admin UI (deprecated).
const BetaAdminPrefix = "/beta/admin"

// UIPrefix is the URL path prefix for the new Vike/React admin UI.
const UIPrefix = "/ui"

// NewVikeProxyHandler creates a reverse proxy to the Vite dev server for development.
// It forwards all requests to the target URL while preserving the request path.
// The prefix parameter is accepted for API consistency with NewVikeStaticHandler but is not needed for proxying.
func NewVikeProxyHandler(viteURL, _ string) (http.Handler, error) {
	target, err := url.Parse(viteURL)
	if err != nil {
		return nil, err
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	return proxy, nil
}

// NewVikeStaticHandler serves built Vike assets with SPA routing.
// The prefix is stripped from request paths before serving files.
func NewVikeStaticHandler(staticPath, prefix string) (http.Handler, error) {
	absPath, err := filepath.Abs(staticPath)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Strip the prefix to get the relative path
		relPath := strings.TrimPrefix(r.URL.Path, prefix)
		if relPath == "" || relPath == "/" {
			relPath = "/index.html"
		}

		// Remove leading slash for filepath.Join
		relPath = strings.TrimPrefix(relPath, "/")

		// Build the full filesystem path
		fullPath := filepath.Join(absPath, relPath)

		// Check if file exists
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			// File not found - serve index.html for SPA routing
			fullPath = filepath.Join(absPath, "index.html")
		}

		// Serve the file directly
		http.ServeFile(w, r, fullPath)
	}), nil
}
