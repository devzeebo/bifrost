package admin

import (
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewVikeProxyHandler(t *testing.T) {
	// Create a mock Vite dev server
	viteServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Return the path that was requested for verification
		w.Header().Set("X-Requested-Path", r.URL.Path)
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("<html>Vite Response</html>"))
	}))
	defer viteServer.Close()

	// Extract the host:port from the test server URL
	viteURL := viteServer.URL

	handler, err := NewVikeProxyHandler(viteURL, UIPrefix)
	require.NoError(t, err, "NewVikeProxyHandler should not error")

	tests := []struct {
		name           string
		requestPath    string
		wantPath       string // Path we expect to be sent to Vite
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
	// Create a temporary directory with test files
	tmpDir := t.TempDir()

	// Create index.html
	indexContent := []byte("<html>UI App</html>")
	require.NoError(t, writeFile(tmpDir, "index.html", indexContent))

	// Create a nested asset
	require.NoError(t, writeFile(tmpDir, "assets/index.js", []byte("console.log('ui')")))

	handler, err := NewVikeStaticHandler(tmpDir, UIPrefix)
	require.NoError(t, err, "NewVikeStaticHandler should not error")

	tests := []struct {
		name             string
		requestPath      string
		wantStatus       int
		wantBodyContains string
	}{
		{
			name:             "root path serves index.html",
			requestPath:      "/ui/",
			wantStatus:       http.StatusOK,
			wantBodyContains: "UI App",
		},
		{
			name:             "spa route serves index.html",
			requestPath:      "/ui/runes/123",
			wantStatus:       http.StatusOK,
			wantBodyContains: "UI App",
		},
		{
			name:             "static asset serves actual file",
			requestPath:      "/ui/assets/index.js",
			wantStatus:       http.StatusOK,
			wantBodyContains: "console.log('ui')",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.requestPath, nil)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			assert.Equal(t, tt.wantStatus, rec.Code)
			assert.Contains(t, rec.Body.String(), tt.wantBodyContains)
		})
	}
}

// Helper function to write files with directory creation
func writeFile(dir, path string, content []byte) error {
	fullPath := filepath.Join(dir, path)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return err
	}
	return os.WriteFile(fullPath, content, 0644)
}

func TestRegisterUIRoutes_DevelopmentMode(t *testing.T) {
	// Create a mock Vite dev server
	viteServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("<html>Vite Dev Response</html>"))
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
			name:           "/ui/ redirects to /ui/",
			path:           "/ui",
			wantStatus:     http.StatusMovedPermanently,
			wantBodyContains: "",
		},
		{
			name:           "/ui/ proxies to Vite",
			path:           "/ui/",
			wantStatus:     http.StatusOK,
			wantBodyContains: "Vite Dev Response",
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
	// Create a temporary directory with test files
	tmpDir := t.TempDir()
	require.NoError(t, writeFile(tmpDir, "index.html", []byte("<html>Production UI</html>")))
	require.NoError(t, writeFile(tmpDir, "assets/app.js", []byte("console.log('app')")))

	cfg := &RouteConfig{
		AuthConfig:      DefaultAuthConfig(),
		ProjectionStore: newMockProjectionStore(),
		EventStore:      nil,
		StaticPath:      tmpDir,
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
			name:             "/ui/ serves index.html",
			path:             "/ui/",
			wantStatus:       http.StatusOK,
			wantBodyContains: "Production UI",
		},
		{
			name:             "/ui/runes serves index.html (SPA)",
			path:             "/ui/runes",
			wantStatus:       http.StatusOK,
			wantBodyContains: "Production UI",
		},
		{
			name:             "/ui/assets/app.js serves actual file",
			path:             "/ui/assets/app.js",
			wantStatus:       http.StatusOK,
			wantBodyContains: "console.log('app')",
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
	cfg := &RouteConfig{
		AuthConfig:      DefaultAuthConfig(),
		ProjectionStore: newMockProjectionStore(),
		EventStore:      nil,
		// No StaticPath or ViteDevServerURL
	}

	// Generate signing key
	cfg.AuthConfig.SigningKey = make([]byte, 32)
	_, err := rand.Read(cfg.AuthConfig.SigningKey)
	require.NoError(t, err, "failed to generate signing key")

	mux := http.NewServeMux()
	result, err := RegisterRoutes(mux, cfg)
	require.NoError(t, err)
	_ = result

	// /ui/ should return 404 when no UI is configured
	req := httptest.NewRequest("GET", "/ui/", nil)
	rec := httptest.NewRecorder()

	mux.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusNotFound, rec.Code)
}
