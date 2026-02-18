package admin

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoginHandler_Get(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	handlers := NewHandlers(templates, cfg, nil, nil)

	req := httptest.NewRequest("GET", "/admin/login", nil)
	rec := httptest.NewRecorder()

	handlers.LoginHandler(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "Bifrost Admin")
	assert.Contains(t, rec.Body.String(), "Personal Access Token")
	assert.Contains(t, rec.Header().Get("Content-Type"), "text/html")
}

func TestLoginHandler_Post(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("valid PAT - successful login", func(t *testing.T) {
		store := newMockProjectionStore()

		// Create a valid PAT
		rawKey := make([]byte, 32)
		_, err := rand.Read(rawKey)
		require.NoError(t, err)
		pat := base64.RawURLEncoding.EncodeToString(rawKey)
		h := sha256.Sum256(rawKey)
		keyHash := base64.RawURLEncoding.EncodeToString(h[:])

		store.data[compositeKey("_admin", "account_lookup", keyHash)] = projectors.AccountLookupEntry{
			AccountID: "account-123",
			Username:  "testuser",
			Status:    "active",
			Roles:     map[string]string{"realm-1": "member"},
		}
		store.data[compositeKey("_admin", "account_lookup", "keyhash_pat:"+keyHash)] = "pat-456"

		handlers := NewHandlers(templates, cfg, store, nil)

		form := url.Values{}
		form.Set("pat", pat)
		req := httptest.NewRequest("POST", "/admin/login", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		rec := httptest.NewRecorder()

		handlers.LoginHandler(rec, req)

		// Should redirect to /admin/
		assert.Equal(t, http.StatusSeeOther, rec.Code)
		assert.Equal(t, "/admin/", rec.Header().Get("Location"))

		// Should set cookie
		cookies := rec.Result().Cookies()
		var authCookie *http.Cookie
		for _, c := range cookies {
			if c.Name == "admin_token" {
				authCookie = c
				break
			}
		}
		require.NotNil(t, authCookie)
		assert.NotEmpty(t, authCookie.Value)
		assert.True(t, authCookie.HttpOnly)
	})

	t.Run("empty PAT - shows error", func(t *testing.T) {
		store := newMockProjectionStore()
		handlers := NewHandlers(templates, cfg, store, nil)

		form := url.Values{}
		form.Set("pat", "")
		req := httptest.NewRequest("POST", "/admin/login", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		rec := httptest.NewRecorder()

		handlers.LoginHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "PAT is required")
	})

	t.Run("whitespace-only PAT - shows error", func(t *testing.T) {
		store := newMockProjectionStore()
		handlers := NewHandlers(templates, cfg, store, nil)

		form := url.Values{}
		form.Set("pat", "   ")
		req := httptest.NewRequest("POST", "/admin/login", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		rec := httptest.NewRecorder()

		handlers.LoginHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "PAT is required")
	})

	t.Run("invalid PAT format - shows error", func(t *testing.T) {
		store := newMockProjectionStore()
		handlers := NewHandlers(templates, cfg, store, nil)

		form := url.Values{}
		form.Set("pat", "!!!invalid-base64!!!")
		req := httptest.NewRequest("POST", "/admin/login", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		rec := httptest.NewRecorder()

		handlers.LoginHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "PAT not found or expired")
	})

	t.Run("PAT not found - shows error", func(t *testing.T) {
		store := newMockProjectionStore()
		handlers := NewHandlers(templates, cfg, store, nil)

		// Create a PAT that doesn't exist in the store
		rawKey := make([]byte, 32)
		_, err := rand.Read(rawKey)
		require.NoError(t, err)
		pat := base64.RawURLEncoding.EncodeToString(rawKey)

		form := url.Values{}
		form.Set("pat", pat)
		req := httptest.NewRequest("POST", "/admin/login", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		rec := httptest.NewRecorder()

		handlers.LoginHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "PAT not found or expired")
	})

	t.Run("suspended account - shows error", func(t *testing.T) {
		store := newMockProjectionStore()

		rawKey := make([]byte, 32)
		_, err := rand.Read(rawKey)
		require.NoError(t, err)
		pat := base64.RawURLEncoding.EncodeToString(rawKey)
		h := sha256.Sum256(rawKey)
		keyHash := base64.RawURLEncoding.EncodeToString(h[:])

		store.data[compositeKey("_admin", "account_lookup", keyHash)] = projectors.AccountLookupEntry{
			AccountID: "account-123",
			Username:  "testuser",
			Status:    "suspended",
		}

		handlers := NewHandlers(templates, cfg, store, nil)

		form := url.Values{}
		form.Set("pat", pat)
		req := httptest.NewRequest("POST", "/admin/login", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		rec := httptest.NewRecorder()

		handlers.LoginHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Account is suspended")
	})
}

func TestLogoutHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	handlers := NewHandlers(templates, cfg, nil, nil)

	t.Run("POST logout - clears cookie and redirects", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/admin/logout", nil)
		rec := httptest.NewRecorder()

		handlers.LogoutHandler(rec, req)

		assert.Equal(t, http.StatusSeeOther, rec.Code)
		assert.Equal(t, "/admin/login", rec.Header().Get("Location"))

		// Check cookie is cleared
		cookies := rec.Result().Cookies()
		var authCookie *http.Cookie
		for _, c := range cookies {
			if c.Name == "admin_token" {
				authCookie = c
				break
			}
		}
		require.NotNil(t, authCookie)
		assert.Equal(t, "", authCookie.Value)
		assert.Equal(t, -1, authCookie.MaxAge)
	})

	t.Run("GET logout - method not allowed", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/admin/logout", nil)
		rec := httptest.NewRecorder()

		handlers.LogoutHandler(rec, req)

		assert.Equal(t, http.StatusMethodNotAllowed, rec.Code)
	})
}

func TestGetLoginErrorMessage(t *testing.T) {
	handlers := &Handlers{}

	tests := []struct {
		err      error
		expected string
	}{
		{ErrInvalidToken, "PAT not found or expired"},
		{ErrPATRevoked, "PAT has been revoked"},
		{ErrAccountSuspended, "Account is suspended"},
		{errors.New("unknown error"), "Authentication failed"},
	}

	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			msg := handlers.getLoginErrorMessage(tt.err)
			assert.Equal(t, tt.expected, msg)
		})
	}
}

func TestRegisterRoutes(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err, "failed to generate signing key")

	store := newMockProjectionStore()
	handlers := NewHandlers(templates, cfg, store, nil)

	publicMux := http.NewServeMux()
	authMux := http.NewServeMux()
	handlers.RegisterRoutes(publicMux, authMux)

	// Test public routes
	t.Run("GET /admin/login is public", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/admin/login", nil)
		rec := httptest.NewRecorder()
		publicMux.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusOK, rec.Code)
	})

	t.Run("POST /admin/login is public", func(t *testing.T) {
		form := url.Values{}
		form.Set("pat", "test")
		req := httptest.NewRequest("POST", "/admin/login", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		rec := httptest.NewRecorder()
		publicMux.ServeHTTP(rec, req)
		assert.NotEqual(t, http.StatusNotFound, rec.Code)
	})

	// Test authenticated routes
	t.Run("POST /admin/logout requires auth", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/admin/logout", nil)
		rec := httptest.NewRecorder()
		authMux.ServeHTTP(rec, req)
		assert.NotEqual(t, http.StatusNotFound, rec.Code)
	})

	t.Run("GET /admin/ requires auth", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/admin/", nil)
		rec := httptest.NewRecorder()
		authMux.ServeHTTP(rec, req)
		assert.NotEqual(t, http.StatusNotFound, rec.Code)
	})
}

func TestDashboardHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("shows username in dashboard", func(t *testing.T) {
		handlers := NewHandlers(templates, cfg, nil, nil)

		req := httptest.NewRequest("GET", "/admin/", nil)
		ctx := contextWithUser(req.Context(), "testuser", map[string]string{"test-realm": "viewer"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.DashboardHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "testuser")
	})

	t.Run("shows rune statistics", func(t *testing.T) {
		store := newMockProjectionStore()
		store.listData["rune_list"] = []json.RawMessage{
			json.RawMessage(`{"id":"bf-1","title":"Rune 1","status":"open","priority":2,"updated_at":"2024-01-03T00:00:00Z"}`),
			json.RawMessage(`{"id":"bf-2","title":"Rune 2","status":"open","priority":1,"updated_at":"2024-01-02T00:00:00Z"}`),
			json.RawMessage(`{"id":"bf-3","title":"Rune 3","status":"claimed","priority":3,"claimant":"testuser","updated_at":"2024-01-01T00:00:00Z"}`),
		}

		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/", nil)
		ctx := contextWithUser(req.Context(), "testuser", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.DashboardHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Total: 3")
		assert.Contains(t, rec.Body.String(), "Rune 1")
	})

	t.Run("shows empty state when no runes", func(t *testing.T) {
		store := newMockProjectionStore()

		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/", nil)
		ctx := contextWithUser(req.Context(), "testuser", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.DashboardHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Total: 0")
		assert.Contains(t, rec.Body.String(), "No recent activity")
	})
}

// Helper to create context with username
func contextWithUsername(ctx context.Context, username string) context.Context {
	return context.WithValue(ctx, usernameKey, username)
}

// Helper to create context with username and roles
func contextWithUser(ctx context.Context, username string, roles map[string]string) context.Context {
	ctx = context.WithValue(ctx, usernameKey, username)
	ctx = context.WithValue(ctx, rolesKey, roles)
	return ctx
}

// mockEventStore implements core.EventStore for testing
type mockEventStore struct {
	streams map[string][]core.Event
	err     error
}

func newMockEventStore() *mockEventStore {
	return &mockEventStore{
		streams: make(map[string][]core.Event),
	}
}

func (m *mockEventStore) Append(ctx context.Context, realmID string, streamID string, expectedVersion int, events []core.EventData) ([]core.Event, error) {
	if m.err != nil {
		return nil, m.err
	}
	key := realmID + "|" + streamID
	existing := m.streams[key]
	result := make([]core.Event, len(events))
	for i, evt := range events {
		dataBytes, _ := json.Marshal(evt.Data)
		result[i] = core.Event{
			RealmID:   realmID,
			StreamID:  streamID,
			Version:   len(existing) + i,
			EventType: evt.EventType,
			Data:      dataBytes,
		}
	}
	m.streams[key] = append(existing, result...)
	return result, nil
}

func (m *mockEventStore) ReadStream(ctx context.Context, realmID string, streamID string, fromVersion int) ([]core.Event, error) {
	if m.err != nil {
		return nil, m.err
	}
	key := realmID + "|" + streamID
	return m.streams[key], nil
}

func (m *mockEventStore) ReadAll(ctx context.Context, realmID string, fromGlobalPosition int64) ([]core.Event, error) {
	if m.err != nil {
		return nil, m.err
	}
	var all []core.Event
	for _, events := range m.streams {
		all = append(all, events...)
	}
	return all, nil
}

func (m *mockEventStore) ListRealmIDs(ctx context.Context) ([]string, error) {
	if m.err != nil {
		return nil, m.err
	}
	return []string{"test-realm"}, nil
}

func TestRunesListHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("shows empty list when no runes", func(t *testing.T) {
		store := newMockProjectionStore()
		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/runes", nil)
		ctx := contextWithUser(req.Context(), "testuser", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RunesListHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "No runes found")
	})

	t.Run("shows runes list with filters", func(t *testing.T) {
		store := newMockProjectionStore()

		// Add some runes to the projection
		store.listData["rune_list"] = []json.RawMessage{
			json.RawMessage(`{"id":"bf-1234","title":"Test Rune 1","status":"open","priority":2,"created_at":"2024-01-01T00:00:00Z","updated_at":"2024-01-01T00:00:00Z"}`),
			json.RawMessage(`{"id":"bf-5678","title":"Test Rune 2","status":"claimed","priority":1,"claimant":"testuser","created_at":"2024-01-02T00:00:00Z","updated_at":"2024-01-02T00:00:00Z"}`),
		}

		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/runes?status=open", nil)
		ctx := contextWithUser(req.Context(), "testuser", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RunesListHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Test Rune 1")
	})

	t.Run("viewer does not see action buttons", func(t *testing.T) {
		store := newMockProjectionStore()
		store.listData["rune_list"] = []json.RawMessage{
			json.RawMessage(`{"id":"bf-1234","title":"Test Rune","status":"open","priority":2}`),
		}

		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/runes", nil)
		ctx := contextWithUser(req.Context(), "viewer", map[string]string{"test-realm": "viewer"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RunesListHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		// Verify that action buttons are not present for viewer role
		body := rec.Body.String()
		// Check for specific htmx action button patterns (not generic words like "Claim" which appear in status dropdowns)
		assert.NotContains(t, body, "hx-post=\"/admin/runes/bf-1234/claim\"", "viewer should not see Claim action button")
		assert.NotContains(t, body, "hx-post=\"/admin/runes/bf-1234/fulfill\"", "viewer should not see Fulfill action button")
		assert.NotContains(t, body, ">Claim</button>", "viewer should not see Claim button text")
		assert.NotContains(t, body, ">Fulfill</button>", "viewer should not see Fulfill button text")
	})
}

func TestRuneDetailHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("shows rune details", func(t *testing.T) {
		store := newMockProjectionStore()
		store.data[compositeKey("test-realm", "rune_detail", "bf-1234")] = projectors.RuneDetail{
			ID:          "bf-1234",
			Title:       "Test Rune",
			Status:      "open",
			Priority:    2,
			Description: "Test description",
		}

		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/runes/bf-1234", nil)
		ctx := contextWithUser(req.Context(), "testuser", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RuneDetailHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Test Rune")
	})

	t.Run("shows 404 for non-existent rune", func(t *testing.T) {
		store := newMockProjectionStore()
		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/runes/bf-nonexistent", nil)
		ctx := contextWithUser(req.Context(), "testuser", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RuneDetailHandler(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
		assert.Contains(t, rec.Body.String(), "not found")
	})
}

func TestGetRealmIDFromRoles(t *testing.T) {
	tests := []struct {
		name     string
		roles    map[string]string
		expected string
	}{
		{
			name:     "single realm",
			roles:    map[string]string{"realm-1": "member"},
			expected: "realm-1",
		},
		{
			name:     "admin only",
			roles:    map[string]string{"_admin": "admin"},
			expected: "_admin",
		},
		{
			name:     "admin and realm",
			roles:    map[string]string{"_admin": "admin", "realm-1": "member"},
			expected: "realm-1", // First non-_admin realm
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := getRealmIDFromRoles(tt.roles)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestCanTakeAction(t *testing.T) {
	tests := []struct {
		name     string
		roles    map[string]string
		realmID  string
		expected bool
	}{
		{
			name:     "owner can take action",
			roles:    map[string]string{"realm-1": "owner"},
			realmID:  "realm-1",
			expected: true,
		},
		{
			name:     "admin can take action",
			roles:    map[string]string{"realm-1": "admin"},
			realmID:  "realm-1",
			expected: true,
		},
		{
			name:     "member can take action",
			roles:    map[string]string{"realm-1": "member"},
			realmID:  "realm-1",
			expected: true,
		},
		{
			name:     "viewer cannot take action",
			roles:    map[string]string{"realm-1": "viewer"},
			realmID:  "realm-1",
			expected: false,
		},
		{
			name:     "no role in realm",
			roles:    map[string]string{"realm-2": "member"},
			realmID:  "realm-1",
			expected: false,
		},
		{
			name:     "system admin can take action in any realm",
			roles:    map[string]string{"_admin": "admin"},
			realmID:  "realm-1",
			expected: true,
		},
		{
			name:     "system owner can take action in any realm",
			roles:    map[string]string{"_admin": "owner"},
			realmID:  "realm-1",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := canTakeAction(tt.roles, tt.realmID)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestCanViewRealm(t *testing.T) {
	tests := []struct {
		name     string
		roles    map[string]string
		realmID  string
		expected bool
	}{
		{
			name:     "owner can view realm",
			roles:    map[string]string{"realm-1": "owner"},
			realmID:  "realm-1",
			expected: true,
		},
		{
			name:     "admin can view realm",
			roles:    map[string]string{"realm-1": "admin"},
			realmID:  "realm-1",
			expected: true,
		},
		{
			name:     "member can view realm",
			roles:    map[string]string{"realm-1": "member"},
			realmID:  "realm-1",
			expected: true,
		},
		{
			name:     "viewer can view realm",
			roles:    map[string]string{"realm-1": "viewer"},
			realmID:  "realm-1",
			expected: true,
		},
		{
			name:     "no role in realm",
			roles:    map[string]string{"realm-2": "member"},
			realmID:  "realm-1",
			expected: false,
		},
		{
			name:     "nil roles",
			roles:    nil,
			realmID:  "realm-1",
			expected: false,
		},
		{
			name:     "empty roles",
			roles:    map[string]string{},
			realmID:  "realm-1",
			expected: false,
		},
		{
			name:     "system admin can view any realm",
			roles:    map[string]string{"_admin": "admin"},
			realmID:  "realm-1",
			expected: true,
		},
		{
			name:     "system owner can view any realm",
			roles:    map[string]string{"_admin": "owner"},
			realmID:  "realm-1",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := canViewRealm(tt.roles, tt.realmID)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestIsRealmAdmin(t *testing.T) {
	tests := []struct {
		name     string
		roles    map[string]string
		realmID  string
		expected bool
	}{
		{
			name:     "owner is realm admin",
			roles:    map[string]string{"realm-1": "owner"},
			realmID:  "realm-1",
			expected: true,
		},
		{
			name:     "admin is realm admin",
			roles:    map[string]string{"realm-1": "admin"},
			realmID:  "realm-1",
			expected: true,
		},
		{
			name:     "member is not realm admin",
			roles:    map[string]string{"realm-1": "member"},
			realmID:  "realm-1",
			expected: false,
		},
		{
			name:     "viewer is not realm admin",
			roles:    map[string]string{"realm-1": "viewer"},
			realmID:  "realm-1",
			expected: false,
		},
		{
			name:     "no role in realm",
			roles:    map[string]string{"realm-2": "admin"},
			realmID:  "realm-1",
			expected: false,
		},
		{
			name:     "nil roles",
			roles:    nil,
			realmID:  "realm-1",
			expected: false,
		},
		{
			name:     "empty roles",
			roles:    map[string]string{},
			realmID:  "realm-1",
			expected: false,
		},
		{
			name:     "system admin can admin any realm",
			roles:    map[string]string{"_admin": "admin"},
			realmID:  "realm-1",
			expected: true,
		},
		{
			name:     "system owner can admin any realm",
			roles:    map[string]string{"_admin": "owner"},
			realmID:  "realm-1",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isRealmAdmin(tt.roles, tt.realmID)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestDashboardHandler_UnauthorizedNoRoles(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	handlers := NewHandlers(templates, cfg, nil, nil)

	req := httptest.NewRequest("GET", "/admin/", nil)
	ctx := contextWithUser(req.Context(), "testuser", map[string]string{})
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	handlers.DashboardHandler(rec, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Contains(t, rec.Body.String(), "Forbidden")
}

func TestRunesListHandler_UnauthorizedNoRoles(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	handlers := NewHandlers(templates, cfg, nil, nil)

	req := httptest.NewRequest("GET", "/admin/runes", nil)
	ctx := contextWithUser(req.Context(), "testuser", map[string]string{})
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	handlers.RunesListHandler(rec, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Contains(t, rec.Body.String(), "Forbidden")
}

func TestRuneDetailHandler_UnauthorizedNoRoles(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	handlers := NewHandlers(templates, cfg, nil, nil)

	req := httptest.NewRequest("GET", "/admin/runes/bf-123", nil)
	ctx := contextWithUser(req.Context(), "testuser", map[string]string{})
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	handlers.RuneDetailHandler(rec, req)

	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Contains(t, rec.Body.String(), "Forbidden")
}

func TestRenderToastPartial(t *testing.T) {
	rec := httptest.NewRecorder()

	renderToastPartial(rec, "error", "Test error message")

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Body.String(), "toast-error")
	assert.Contains(t, rec.Body.String(), "Test error message")
	assert.Contains(t, rec.Body.String(), "hx-swap-oob")
}

func TestRealmsListHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("admin can see realms list", func(t *testing.T) {
		store := newMockProjectionStore()
		store.listData["realm_list"] = []json.RawMessage{
			json.RawMessage(`{"realm_id":"realm-1","name":"Test Realm","status":"active","created_at":"2024-01-01T00:00:00Z"}`),
		}

		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/realms", nil)
		ctx := contextWithUser(req.Context(), "admin", map[string]string{"_admin": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RealmsListHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Test Realm")
	})

	t.Run("non-admin gets 403", func(t *testing.T) {
		store := newMockProjectionStore()
		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/realms", nil)
		ctx := contextWithUser(req.Context(), "member", map[string]string{"realm-1": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RealmsListHandler(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})
}

func TestRealmDetailHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("shows realm details", func(t *testing.T) {
		store := newMockProjectionStore()
		store.data[compositeKey(domain.AdminRealmID, "realm_list", "realm-1")] = projectors.RealmListEntry{
			RealmID:   "realm-1",
			Name:      "Test Realm",
			Status:    "active",
			CreatedAt: time.Now(),
		}

		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/realms/realm-1", nil)
		ctx := contextWithUser(req.Context(), "admin", map[string]string{"_admin": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RealmDetailHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Test Realm")
	})

	t.Run("shows 404 for non-existent realm", func(t *testing.T) {
		store := newMockProjectionStore()
		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/realms/nonexistent", nil)
		ctx := contextWithUser(req.Context(), "admin", map[string]string{"_admin": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RealmDetailHandler(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})

	t.Run("non-admin gets 403", func(t *testing.T) {
		store := newMockProjectionStore()
		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/realms/realm-1", nil)
		ctx := contextWithUser(req.Context(), "member", map[string]string{"realm-1": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RealmDetailHandler(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})

	t.Run("realm admin can view their realm", func(t *testing.T) {
		store := newMockProjectionStore()
		store.data[compositeKey(domain.AdminRealmID, "realm_list", "realm-1")] = projectors.RealmListEntry{
			RealmID:   "realm-1",
			Name:      "Test Realm",
			Status:    "active",
			CreatedAt: time.Now(),
		}

		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/realms/realm-1", nil)
		ctx := contextWithUser(req.Context(), "admin", map[string]string{"realm-1": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RealmDetailHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Test Realm")
	})

	t.Run("realm owner can view their realm", func(t *testing.T) {
		store := newMockProjectionStore()
		store.data[compositeKey(domain.AdminRealmID, "realm_list", "realm-1")] = projectors.RealmListEntry{
			RealmID:   "realm-1",
			Name:      "Test Realm",
			Status:    "active",
			CreatedAt: time.Now(),
		}

		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/realms/realm-1", nil)
		ctx := contextWithUser(req.Context(), "owner", map[string]string{"realm-1": "owner"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RealmDetailHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Test Realm")
	})

	t.Run("realm admin cannot view other realm", func(t *testing.T) {
		store := newMockProjectionStore()
		store.data[compositeKey(domain.AdminRealmID, "realm_list", "realm-2")] = projectors.RealmListEntry{
			RealmID:   "realm-2",
			Name:      "Other Realm",
			Status:    "active",
			CreatedAt: time.Now(),
		}

		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/realms/realm-2", nil)
		ctx := contextWithUser(req.Context(), "admin", map[string]string{"realm-1": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RealmDetailHandler(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})
}

func TestRealmRoleHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("realm admin cannot assign admin role", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("account_id", "account-123")
		form.Set("action", "assign")
		form.Set("role", "admin")

		req := httptest.NewRequest("POST", "/admin/realms/realm-1/roles", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		ctx := contextWithUser(req.Context(), "realmadmin", map[string]string{"realm-1": "admin"})
		req = req.WithContext(ctx)
		req.SetPathValue("id", "realm-1")
		rec := httptest.NewRecorder()

		handlers.RealmRoleHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code) // Returns toast error
		assert.Contains(t, rec.Body.String(), "viewer or member roles")
	})

	t.Run("realm admin cannot assign owner role", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("account_id", "account-123")
		form.Set("action", "assign")
		form.Set("role", "owner")

		req := httptest.NewRequest("POST", "/admin/realms/realm-1/roles", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		ctx := contextWithUser(req.Context(), "realmadmin", map[string]string{"realm-1": "admin"})
		req = req.WithContext(ctx)
		req.SetPathValue("id", "realm-1")
		rec := httptest.NewRecorder()

		handlers.RealmRoleHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code) // Returns toast error
		assert.Contains(t, rec.Body.String(), "viewer or member roles")
	})

	t.Run("member cannot assign roles", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("account_id", "account-123")
		form.Set("action", "assign")
		form.Set("role", "viewer")

		req := httptest.NewRequest("POST", "/admin/realms/realm-1/roles", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		ctx := contextWithUser(req.Context(), "member", map[string]string{"realm-1": "member"})
		req = req.WithContext(ctx)
		req.SetPathValue("id", "realm-1")
		rec := httptest.NewRecorder()

		handlers.RealmRoleHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code) // Returns toast error
		assert.Contains(t, rec.Body.String(), "Forbidden")
	})

	t.Run("realm admin cannot manage other realm", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("account_id", "account-123")
		form.Set("action", "assign")
		form.Set("role", "member")

		req := httptest.NewRequest("POST", "/admin/realms/realm-2/roles", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		ctx := contextWithUser(req.Context(), "realmadmin", map[string]string{"realm-1": "admin"})
		req = req.WithContext(ctx)
		req.SetPathValue("id", "realm-2")
		rec := httptest.NewRecorder()

		handlers.RealmRoleHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code) // Returns toast error
		assert.Contains(t, rec.Body.String(), "Forbidden")
	})

	t.Run("realm owner can manage roles in their realm", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		// Realm owner should pass authorization check (will fail at domain level due to mock)
		form := url.Values{}
		form.Set("account_id", "account-123")
		form.Set("action", "assign")
		form.Set("role", "member")

		req := httptest.NewRequest("POST", "/admin/realms/realm-1/roles", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		ctx := contextWithUser(req.Context(), "owner", map[string]string{"realm-1": "owner"})
		req = req.WithContext(ctx)
		req.SetPathValue("id", "realm-1")
		rec := httptest.NewRecorder()

		handlers.RealmRoleHandler(rec, req)

		// Authorization passes (returns 200 with error because domain command fails in mock)
		// This verifies owner is authorized, domain failure is expected
		assert.NotContains(t, rec.Body.String(), "Forbidden")
	})

	t.Run("missing realm ID returns error", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("account_id", "account-123")
		form.Set("action", "assign")
		form.Set("role", "viewer")

		req := httptest.NewRequest("POST", "/admin/realms//roles", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		ctx := contextWithUser(req.Context(), "admin", map[string]string{"realm-1": "admin"})
		req = req.WithContext(ctx)
		// Don't set path value
		rec := httptest.NewRecorder()

		handlers.RealmRoleHandler(rec, req)

		assert.Contains(t, rec.Body.String(), "Realm ID is required")
	})

	t.Run("missing account ID returns error", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("action", "assign")
		form.Set("role", "viewer")

		req := httptest.NewRequest("POST", "/admin/realms/realm-1/roles", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		ctx := contextWithUser(req.Context(), "admin", map[string]string{"realm-1": "admin"})
		req = req.WithContext(ctx)
		req.SetPathValue("id", "realm-1")
		rec := httptest.NewRecorder()

		handlers.RealmRoleHandler(rec, req)

		assert.Contains(t, rec.Body.String(), "Account ID is required")
	})
}

func TestIsAdmin(t *testing.T) {
	tests := []struct {
		name     string
		roles    map[string]string
		expected bool
	}{
		{
			name:     "admin in _admin realm",
			roles:    map[string]string{"_admin": "admin"},
			expected: true,
		},
		{
			name:     "member in _admin realm",
			roles:    map[string]string{"_admin": "member"},
			expected: false,
		},
		{
			name:     "admin in different realm",
			roles:    map[string]string{"realm-1": "admin"},
			expected: false,
		},
		{
			name:     "nil roles",
			roles:    nil,
			expected: false,
		},
		{
			name:     "empty roles",
			roles:    map[string]string{},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isAdmin(tt.roles)
			assert.Equal(t, tt.expected, result)
		})
	}
}

// Helper to create context with username, roles, and account ID
func contextWithUserAndID(ctx context.Context, username string, roles map[string]string, accountID string) context.Context {
	ctx = context.WithValue(ctx, usernameKey, username)
	ctx = context.WithValue(ctx, rolesKey, roles)
	ctx = context.WithValue(ctx, accountIDKey, accountID)
	return ctx
}

func TestAccountsListHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("admin can see accounts list", func(t *testing.T) {
		store := newMockProjectionStore()
		store.listData["account_list"] = []json.RawMessage{
			json.RawMessage(`{"account_id":"acct-1","username":"testuser","status":"active","realms":["realm-1"],"roles":{"realm-1":"member"},"pat_count":1,"created_at":"2024-01-01T00:00:00Z"}`),
		}

		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/accounts", nil)
		ctx := contextWithUser(req.Context(), "admin", map[string]string{"_admin": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.AccountsListHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "testuser")
	})

	t.Run("non-admin gets 403", func(t *testing.T) {
		store := newMockProjectionStore()
		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/accounts", nil)
		ctx := contextWithUser(req.Context(), "member", map[string]string{"realm-1": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.AccountsListHandler(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})
}

func TestAccountDetailHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("shows account details", func(t *testing.T) {
		store := newMockProjectionStore()
		store.data[compositeKey(domain.AdminRealmID, "account_list", "acct-1")] = projectors.AccountListEntry{
			AccountID: "acct-1",
			Username:  "testuser",
			Status:    "active",
			Realms:    []string{"realm-1"},
			Roles:     map[string]string{"realm-1": "member"},
			PATCount:  1,
			CreatedAt: time.Now(),
		}

		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/accounts/acct-1", nil)
		ctx := contextWithUserAndID(req.Context(), "admin", map[string]string{"_admin": "admin"}, "admin-1")
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.AccountDetailHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "testuser")
	})

	t.Run("shows 404 for non-existent account", func(t *testing.T) {
		store := newMockProjectionStore()
		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/accounts/nonexistent", nil)
		ctx := contextWithUser(req.Context(), "admin", map[string]string{"_admin": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.AccountDetailHandler(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})

	t.Run("non-admin gets 403", func(t *testing.T) {
		store := newMockProjectionStore()
		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/accounts/acct-1", nil)
		ctx := contextWithUser(req.Context(), "member", map[string]string{"realm-1": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.AccountDetailHandler(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})

	t.Run("hides suspend button for self", func(t *testing.T) {
		store := newMockProjectionStore()
		store.data[compositeKey(domain.AdminRealmID, "account_list", "acct-1")] = projectors.AccountListEntry{
			AccountID: "acct-1",
			Username:  "adminuser",
			Status:    "active",
			Realms:    []string{},
			Roles:     map[string]string{"_admin": "admin"},
			PATCount:  1,
			CreatedAt: time.Now(),
		}

		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/accounts/acct-1", nil)
		ctx := contextWithUserAndID(req.Context(), "adminuser", map[string]string{"_admin": "admin"}, "acct-1")
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.AccountDetailHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		// Self-modification prevention - shouldn't see suspend form
		assert.NotContains(t, rec.Body.String(), "Suspend Account")
	})
}

func TestPATsListHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("shows PATs list for account", func(t *testing.T) {
		store := newMockProjectionStore()
		store.data[compositeKey(domain.AdminRealmID, "account_list", "acct-1")] = projectors.AccountListEntry{
			AccountID: "acct-1",
			Username:  "testuser",
			Status:    "active",
			Realms:    []string{},
			Roles:     map[string]string{},
			PATCount:  2,
			CreatedAt: time.Now(),
		}

		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/accounts/acct-1/pats", nil)
		req.SetPathValue("id", "acct-1")
		ctx := contextWithUser(req.Context(), "admin", map[string]string{"_admin": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.PATsListHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "testuser")
		assert.Contains(t, rec.Body.String(), "Create PAT")
	})

	t.Run("shows 404 for non-existent account", func(t *testing.T) {
		store := newMockProjectionStore()
		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/accounts/nonexistent/pats", nil)
		req.SetPathValue("id", "nonexistent")
		ctx := contextWithUser(req.Context(), "admin", map[string]string{"_admin": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.PATsListHandler(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})

	t.Run("non-admin gets 403", func(t *testing.T) {
		store := newMockProjectionStore()
		handlers := NewHandlers(templates, cfg, store, nil)

		req := httptest.NewRequest("GET", "/admin/accounts/acct-1/pats", nil)
		req.SetPathValue("id", "acct-1")
		ctx := contextWithUser(req.Context(), "member", map[string]string{"realm-1": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.PATsListHandler(rec, req)

		assert.Equal(t, http.StatusForbidden, rec.Code)
	})
}

func TestCreateRuneHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("viewer cannot create runes", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("title", "Test Rune")
		form.Set("priority", "2")
		form.Set("branch", "feat/test")

		req := httptest.NewRequest("POST", "/admin/runes/create", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		ctx := contextWithUser(req.Context(), "viewer", map[string]string{"test-realm": "viewer"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.CreateRuneHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Unauthorized")
	})

	t.Run("title is required", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("title", "")
		form.Set("priority", "2")

		req := httptest.NewRequest("POST", "/admin/runes/create", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		ctx := contextWithUser(req.Context(), "member", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.CreateRuneHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Title is required")
	})

	t.Run("member can create rune", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("title", "Test Rune")
		form.Set("description", "A test rune")
		form.Set("priority", "2")
		form.Set("branch", "feat/test")

		req := httptest.NewRequest("POST", "/admin/runes/create", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("HX-Request", "true")
		ctx := contextWithUser(req.Context(), "member", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.CreateRuneHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Rune Created")
		// Verify event was appended
		assert.Len(t, eventStore.streams, 1)
	})

	t.Run("non-htmx request redirects to rune detail", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("title", "Test Rune")
		form.Set("priority", "2")
		form.Set("branch", "feat/test")

		req := httptest.NewRequest("POST", "/admin/runes/create", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		ctx := contextWithUser(req.Context(), "member", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.CreateRuneHandler(rec, req)

		assert.Equal(t, http.StatusSeeOther, rec.Code)
		assert.Contains(t, rec.Header().Get("Location"), "/admin/runes/")
	})
}

func TestUpdateRuneHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("viewer cannot update runes", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("title", "Updated Title")

		req := httptest.NewRequest("POST", "/admin/runes/bf-1234/update", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.SetPathValue("id", "bf-1234")
		ctx := contextWithUser(req.Context(), "viewer", map[string]string{"test-realm": "viewer"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.UpdateRuneHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Unauthorized")
	})

	t.Run("missing rune id returns error", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("title", "Updated Title")

		req := httptest.NewRequest("POST", "/admin/runes//update", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		ctx := contextWithUser(req.Context(), "member", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.UpdateRuneHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Rune ID is required")
	})

	t.Run("member can update rune title", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()

		// Pre-populate event store with rune creation event
		// This is needed because HandleUpdateRune reads events to rebuild state
		createdData := domain.RuneCreated{
			ID:          "bf-1234",
			Title:       "Original Title",
			Description: "Original description",
			Priority:    2,
		}
		createdBytes, _ := json.Marshal(createdData)
		eventStore.streams["test-realm|rune-bf-1234"] = []core.Event{
			{
				RealmID:   "test-realm",
				StreamID:  "rune-bf-1234",
				Version:   0,
				EventType: domain.EventRuneCreated,
				Data:      createdBytes,
			},
		}

		// Add rune to projection for the response
		store.data[compositeKey("test-realm", "rune_detail", "bf-1234")] = projectors.RuneDetail{
			ID:          "bf-1234",
			Title:       "Updated Title",
			Description: "Original description",
			Status:      "open",
			Priority:    2,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("title", "Updated Title")

		req := httptest.NewRequest("POST", "/admin/runes/bf-1234/update", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.Header.Set("HX-Request", "true")
		req.SetPathValue("id", "bf-1234")
		ctx := contextWithUser(req.Context(), "member", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.UpdateRuneHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		// Verify update event was appended (should have 2 events now)
		assert.Len(t, eventStore.streams["test-realm|rune-bf-1234"], 2)
	})

	t.Run("member can update priority", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()

		// Add existing rune to projection
		store.data[compositeKey("test-realm", "rune_detail", "bf-1234")] = projectors.RuneDetail{
			ID:        "bf-1234",
			Title:     "Test Rune",
			Status:    "open",
			Priority:  3,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("priority", "1")

		req := httptest.NewRequest("POST", "/admin/runes/bf-1234/update", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.SetPathValue("id", "bf-1234")
		ctx := contextWithUser(req.Context(), "member", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.UpdateRuneHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
	})
}

func TestRuneForgeHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("viewer cannot forge runes", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		req := httptest.NewRequest("POST", "/admin/runes/bf-1234/forge", nil)
		req.SetPathValue("id", "bf-1234")
		ctx := contextWithUser(req.Context(), "viewer", map[string]string{"test-realm": "viewer"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RuneForgeHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Unauthorized")
	})

	t.Run("missing rune id returns error", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		req := httptest.NewRequest("POST", "/admin/runes//forge", nil)
		ctx := contextWithUser(req.Context(), "member", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RuneForgeHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Rune ID is required")
	})

	t.Run("member can forge draft rune", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()

		// Pre-populate event store with rune creation event (draft status)
		createdData := domain.RuneCreated{
			ID:          "bf-1234",
			Title:       "Draft Rune",
			Description: "A draft rune",
			Priority:    2,
		}
		createdBytes, _ := json.Marshal(createdData)
		eventStore.streams["test-realm|rune-bf-1234"] = []core.Event{
			{
				RealmID:   "test-realm",
				StreamID:  "rune-bf-1234",
				Version:   0,
				EventType: domain.EventRuneCreated,
				Data:      createdBytes,
			},
		}

		// Add rune to projection for the response (forged = open status)
		store.data[compositeKey("test-realm", "rune_detail", "bf-1234")] = projectors.RuneDetail{
			ID:          "bf-1234",
			Title:       "Draft Rune",
			Description: "A draft rune",
			Status:      "open",
			Priority:    2,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}

		handlers := NewHandlers(templates, cfg, store, eventStore)

		req := httptest.NewRequest("POST", "/admin/runes/bf-1234/forge", nil)
		req.Header.Set("HX-Request", "true")
		req.SetPathValue("id", "bf-1234")
		ctx := contextWithUser(req.Context(), "member", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RuneForgeHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		// Verify forge event was appended (should have 2 events now)
		assert.Len(t, eventStore.streams["test-realm|rune-bf-1234"], 2)
	})
}

func TestAddDependencyHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("viewer cannot add dependencies", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("target_id", "bf-5678")
		form.Set("relationship", "blocks")

		req := httptest.NewRequest("POST", "/admin/runes/bf-1234/dependencies", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.SetPathValue("id", "bf-1234")
		ctx := contextWithUser(req.Context(), "viewer", map[string]string{"test-realm": "viewer"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.AddDependencyHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Unauthorized")
	})

	t.Run("missing target id returns error", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("relationship", "blocks")

		req := httptest.NewRequest("POST", "/admin/runes/bf-1234/dependencies", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.SetPathValue("id", "bf-1234")
		ctx := contextWithUser(req.Context(), "member", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.AddDependencyHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Target rune ID is required")
	})

	t.Run("missing relationship returns error", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("target_id", "bf-5678")

		req := httptest.NewRequest("POST", "/admin/runes/bf-1234/dependencies", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.SetPathValue("id", "bf-1234")
		ctx := contextWithUser(req.Context(), "member", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.AddDependencyHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Relationship type is required")
	})
}

func TestRemoveDependencyHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("viewer cannot remove dependencies", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("target_id", "bf-5678")
		form.Set("relationship", "blocks")

		req := httptest.NewRequest("DELETE", "/admin/runes/bf-1234/dependencies", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.SetPathValue("id", "bf-1234")
		ctx := contextWithUser(req.Context(), "viewer", map[string]string{"test-realm": "viewer"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RemoveDependencyHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Unauthorized")
	})
}

func TestRuneUnclaimHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("viewer cannot unclaim runes", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		req := httptest.NewRequest("POST", "/admin/runes/bf-1234/unclaim", nil)
		req.SetPathValue("id", "bf-1234")
		ctx := contextWithUser(req.Context(), "viewer", map[string]string{"test-realm": "viewer"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RuneUnclaimHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Unauthorized")
	})

	t.Run("missing rune id returns error", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		req := httptest.NewRequest("POST", "/admin/runes//unclaim", nil)
		ctx := contextWithUser(req.Context(), "member", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RuneUnclaimHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Rune ID is required")
	})
}

func TestRuneShatterHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("viewer cannot shatter runes", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("confirm", "true")

		req := httptest.NewRequest("POST", "/admin/runes/bf-1234/shatter", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.SetPathValue("id", "bf-1234")
		ctx := contextWithUser(req.Context(), "viewer", map[string]string{"test-realm": "viewer"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RuneShatterHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Unauthorized")
	})

	t.Run("requires confirmation", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		req := httptest.NewRequest("POST", "/admin/runes/bf-1234/shatter", nil)
		req.SetPathValue("id", "bf-1234")
		ctx := contextWithUser(req.Context(), "member", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.RuneShatterHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Shatter requires confirmation")
	})
}

func TestSweepRunesHandler(t *testing.T) {
	templates, err := NewTemplates()
	require.NoError(t, err)

	cfg := DefaultAuthConfig()
	cfg.SigningKey = make([]byte, 32)
	_, err = rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("non-admin cannot sweep runes", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		form := url.Values{}
		form.Set("confirm", "true")

		req := httptest.NewRequest("POST", "/admin/runes/sweep", strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		ctx := contextWithUser(req.Context(), "member", map[string]string{"test-realm": "member"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.SweepRunesHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Unauthorized")
	})

	t.Run("requires confirmation", func(t *testing.T) {
		store := newMockProjectionStore()
		eventStore := newMockEventStore()
		handlers := NewHandlers(templates, cfg, store, eventStore)

		req := httptest.NewRequest("POST", "/admin/runes/sweep", nil)
		ctx := contextWithUser(req.Context(), "admin", map[string]string{"_admin": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handlers.SweepRunesHandler(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "Sweep requires confirmation")
	})
}
