package admin

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStaticHandler(t *testing.T) {
	handler := StaticHandler()

	t.Run("serves style.css", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/style.css", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Header().Get("Content-Type"), "text/css")
		assert.Contains(t, rec.Body.String(), "--bg-primary: #0d1117")
		assert.Contains(t, rec.Body.String(), "--accent: #58a6ff")
	})

	t.Run("serves all CSS variables", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/style.css", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		body := rec.Body.String()
		variables := []string{
			"--bg-primary",
			"--bg-secondary",
			"--bg-tertiary",
			"--text-primary",
			"--text-secondary",
			"--border",
			"--accent",
			"--success",
			"--warning",
			"--danger",
		}
		for _, v := range variables {
			assert.Contains(t, body, v, "CSS should contain variable %s", v)
		}
	})

	t.Run("includes nav styles", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/style.css", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		body := rec.Body.String()
		assert.Contains(t, body, "nav {")
		assert.Contains(t, body, ".nav-brand")
		assert.Contains(t, body, ".nav-links")
		assert.Contains(t, body, ".nav-user")
	})

	t.Run("includes table styles", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/style.css", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		body := rec.Body.String()
		assert.Contains(t, body, "table {")
		assert.Contains(t, body, "thead")
		assert.Contains(t, body, "tbody tr:hover")
		assert.Contains(t, body, "th.sortable")
	})

	t.Run("includes card styles", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/style.css", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		body := rec.Body.String()
		assert.Contains(t, body, ".card {")
		assert.Contains(t, body, "border-radius: 6px")
		assert.Contains(t, body, "padding:")
	})

	t.Run("includes form styles with focus states", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/style.css", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		body := rec.Body.String()
		assert.Contains(t, body, "input[type=\"text\"]")
		assert.Contains(t, body, ":focus")
		assert.Contains(t, body, "box-shadow")
		assert.Contains(t, body, "border-color: var(--accent)")
	})

	t.Run("includes button styles", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/style.css", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		body := rec.Body.String()
		assert.Contains(t, body, ".btn-primary")
		assert.Contains(t, body, ".btn-secondary")
		assert.Contains(t, body, ".btn-danger")
	})

	t.Run("includes status badge styles", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/style.css", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		body := rec.Body.String()
		badgeClasses := []string{
			".badge-open",
			".badge-draft",
			".badge-claimed",
			".badge-fulfilled",
			".badge-sealed",
			".badge-shattered",
		}
		for _, c := range badgeClasses {
			assert.Contains(t, body, c, "CSS should contain badge class %s", c)
		}
	})

	t.Run("includes toast styles", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/style.css", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		body := rec.Body.String()
		assert.Contains(t, body, "#toasts")
		assert.Contains(t, body, ".toast")
		assert.Contains(t, body, "position: fixed")
		assert.Contains(t, body, "bottom:")
		assert.Contains(t, body, "right:")
	})

	t.Run("file not found returns 404", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/nonexistent.css", nil)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})
}

func TestRegisterRoutes_StaticFiles(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)

	store := newMockProjectionStore()
	handlers := NewHandlers(templates, cfg, store, nil)

	publicMux := http.NewServeMux()
	authMux := http.NewServeMux()
	handlers.RegisterRoutes(publicMux, authMux)

	t.Run("static files accessible without auth", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/admin/static/style.css", nil)
		rec := httptest.NewRecorder()
		publicMux.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Header().Get("Content-Type"), "text/css")
	})

	t.Run("static CSS contains dark theme", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/admin/static/style.css", nil)
		rec := httptest.NewRecorder()
		publicMux.ServeHTTP(rec, req)

		body := rec.Body.String()
		// Verify dark theme colors
		assert.Contains(t, body, "#0d1117") // bg-primary
		assert.Contains(t, body, "#161b22") // bg-secondary
		assert.Contains(t, body, "#21262d") // bg-tertiary
		assert.Contains(t, body, "#e6edf3") // text-primary
	})
}

func TestCSSEmbedded(t *testing.T) {
	// Verify CSS is embedded in binary by checking the staticFS variable
	handler := StaticHandler()
	require.NotNil(t, handler, "StaticHandler should not be nil")

	// Make a request to verify the embedded file is accessible
	req := httptest.NewRequest("GET", "/style.css", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	require.Equal(t, http.StatusOK, rec.Code, "Embedded CSS should be served")
	require.True(t, strings.Contains(rec.Body.String(), ":root"), "CSS should contain :root selector")
}
