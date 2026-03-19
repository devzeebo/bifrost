package admin

import (
	"crypto/rand"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newMockUIFS creates a mock filesystem for testing UI routes
func newMockUIFS() fs.FS {
	return fstest.MapFS{
		"index.html": &fstest.MapFile{
			Data: []byte("<!DOCTYPE html><html><body>Mock UI</body></html>"),
		},
	}
}

func TestNewVikeProxyHandler(t *testing.T) {
	// Create a mock Vite dev server
	viteServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Return the path that was requested for verification
		w.Header().Set("X-Requested-Path", r.URL.Path)
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("<html>Vite Response</html>"))
	}))
	defer viteServer.Close()

	// Extract the host:port from the test server URL
	viteURL := viteServer.URL

	handler, err := NewVikeProxyHandler(viteURL, UIPrefix)
	require.NoError(t, err, "NewVikeProxyHandler should not error")

	tests := []struct {
		name           string
		requestPath    string
		wantPath       string // Path we expect to be sent to Vite (with /ui prefix, since base: '/ui')
		wantStatus     int
		wantBodyContains string
	}{
		{
			name:           "root UI path proxies to Vite",
			requestPath:    "/ui/",
			wantPath:       "/ui/",
			wantStatus:     http.StatusOK,
			wantBodyContains: "Vite Response",
		},
		{
			name:           "UI subpath proxies to Vite",
			requestPath:    "/ui/runes",
			wantPath:       "/ui/runes",
			wantStatus:     http.StatusOK,
			wantBodyContains: "Vite Response",
		},
		{
			name:           "deep UI path proxies to Vite",
			requestPath:    "/ui/admin/accounts/123",
			wantPath:       "/ui/admin/accounts/123",
			wantStatus:     http.StatusOK,
			wantBodyContains: "Vite Response",
		},
		{
			name:           "static asset path proxies to Vite",
			requestPath:    "/ui/assets/index.js",
			wantPath:       "/ui/assets/index.js",
			wantStatus:     http.StatusOK,
			wantBodyContains: "Vite Response",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.requestPath, nil)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			assert.Equal(t, tt.wantStatus, rec.Code)
			assert.Contains(t, rec.Body.String(), tt.wantBodyContains)
			// Verify the path was correctly forwarded
			assert.Equal(t, tt.wantPath, rec.Header().Get("X-Requested-Path"))
		})
	}
}

func TestNewVikeProxyHandler_InvalidURL(t *testing.T) {
	// Go's url.Parse is quite lenient - it accepts paths without scheme
	// A truly invalid URL would be one with an invalid host format
	_, err := NewVikeProxyHandler("http://[invalid:host", UIPrefix)
	assert.Error(t, err, "NewVikeProxyHandler should error with invalid URL")
}

func TestNewVikeStaticHandler(t *testing.T) {
	// With embedded UI assets, the handler returns 404 when no dist files exist
	// (this is the case during tests without built UI)
	handler, err := NewVikeStaticHandler("", UIPrefix)
	require.NoError(t, err, "NewVikeStaticHandler should not error")

	tests := []struct {
		name       string
		requestPath string
		wantStatus int
	}{
		{
			name:       "root path returns 404 without embedded assets",
			requestPath: "/ui/",
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "spa route returns 404 without embedded assets",
			requestPath: "/ui/runes/123",
			wantStatus: http.StatusNotFound,
		},
		{
			name:       "static asset returns 404 without embedded assets",
			requestPath: "/ui/assets/index.js",
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.requestPath, nil)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			assert.Equal(t, tt.wantStatus, rec.Code)
		})
	}
}


func TestRegisterUIRoutes_DevelopmentMode(t *testing.T) {
	// Create a mock Vite dev server
	viteServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("<html>Vite Dev Response</html>"))
	}))
	defer viteServer.Close()

	cfg := &RouteConfig{
		AuthConfig:       DefaultAuthConfig(),
		ProjectionStore:  newMockProjectionStore(),
		EventStore:       nil,
		ViteDevServerURL: viteServer.URL,
	}

	// Generate signing key
	cfg.AuthConfig.SigningKey = make([]byte, 32)
	_, err := rand.Read(cfg.AuthConfig.SigningKey)
	require.NoError(t, err, "failed to generate signing key")

	mux := http.NewServeMux()
	result, err := RegisterRoutes(mux, cfg)
	require.NoError(t, err)
	_ = result

	tests := []struct {
		name           string
		path           string
		wantStatus     int
		wantBodyContains string
	}{
		{
			name:           "/ui proxies to Vite",
			path:           "/ui",
			wantStatus:     http.StatusOK,
			wantBodyContains: "Vite Dev Response",
		},
		{
			name:           "/ui/ redirects to /ui",
			path:           "/ui/",
			wantStatus:     http.StatusMovedPermanently,
			wantBodyContains: "",
		},
		{
			name:           "/ui/runes proxies to Vite",
			path:           "/ui/runes",
			wantStatus:     http.StatusOK,
			wantBodyContains: "Vite Dev Response",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.path, nil)
			rec := httptest.NewRecorder()

			mux.ServeHTTP(rec, req)

			assert.Equal(t, tt.wantStatus, rec.Code)
			if tt.wantBodyContains != "" {
				assert.Contains(t, rec.Body.String(), tt.wantBodyContains)
			}
		})
	}
}

func TestRegisterUIRoutes_ProductionMode(t *testing.T) {
	// Production mode serves static files from mock filesystem
	cfg := &RouteConfig{
		AuthConfig:       DefaultAuthConfig(),
		ProjectionStore:  newMockProjectionStore(),
		EventStore:       nil,
		UIFS:             newMockUIFS(), // Use mock filesystem
	}

	// Generate signing key
	cfg.AuthConfig.SigningKey = make([]byte, 32)
	_, err := rand.Read(cfg.AuthConfig.SigningKey)
	require.NoError(t, err, "failed to generate signing key")

	mux := http.NewServeMux()
	result, err := RegisterRoutes(mux, cfg)
	require.NoError(t, err)
	_ = result

	tests := []struct {
		name             string
		path             string
		wantStatus       int
		wantBodyContains string
	}{
		{
			name:             "/ui should serve index.html",
			path:             "/ui",
			wantStatus:       http.StatusOK,
			wantBodyContains: "<!DOCTYPE html>",
		},
		{
			name:             "/ui/runes should fallback to index.html (SPA routing)",
			path:             "/ui/runes",
			wantStatus:       http.StatusOK,
			wantBodyContains: "<!DOCTYPE html>",
		},
		{
			name:             "/ui/admin/accounts should fallback to index.html",
			path:             "/ui/admin/accounts",
			wantStatus:       http.StatusOK,
			wantBodyContains: "<!DOCTYPE html>",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.path, nil)
			rec := httptest.NewRecorder()

			mux.ServeHTTP(rec, req)

			assert.Equal(t, tt.wantStatus, rec.Code)
			assert.Contains(t, rec.Body.String(), tt.wantBodyContains)
		})
	}
}

func TestRegisterUIRoutes_NoUI(t *testing.T) {
	// When no UI filesystem is configured and no embedded files exist,
	// the routes are registered but return 404
	cfg := &RouteConfig{
		AuthConfig:      DefaultAuthConfig(),
		ProjectionStore: newMockProjectionStore(),
		EventStore:      nil,
		// No ViteDevServerURL and no UIFS = no UI available
	}

	// Generate signing key
	cfg.AuthConfig.SigningKey = make([]byte, 32)
	_, err := rand.Read(cfg.AuthConfig.SigningKey)
	require.NoError(t, err, "failed to generate signing key")

	mux := http.NewServeMux()
	result, err := RegisterRoutes(mux, cfg)
	require.NoError(t, err)
	_ = result

	// /ui returns 404 when no UI files available
	req := httptest.NewRequest("GET", "/ui", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	// Without UI files, returns 404
	assert.Equal(t, http.StatusNotFound, rec.Code)
}
