package admin

import (
	"context"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	// accountLookupRealm is the realm used for account lookup
	accountLookupRealm = "_admin"
	// accountLookupProjection is the projection name for account lookup
	accountLookupProjection = "account_lookup"
)

func TestRegisterRoutesConfig(t *testing.T) {
	cfg := &RouteConfig{
		AuthConfig:      DefaultAuthConfig(),
		ProjectionStore: newMockProjectionStore(),
		EventStore:      nil,
	}

	// Generate signing key
	cfg.AuthConfig.SigningKey = make([]byte, 32)
	_, err := rand.Read(cfg.AuthConfig.SigningKey)
	require.NoError(t, err, "failed to generate signing key")

	mux := http.NewServeMux()
	result, err := RegisterRoutes(mux, cfg)
	require.NoError(t, err)
	_ = result // Use result.Handler if needed

	tests := []struct {
		name       string
		method     string
		path       string
		setupAuth  func(req *http.Request)
		wantStatus int
	}{
		// Public routes
		{
			name:       "GET /admin/login is public",
			method:     "GET",
			path:       "/admin/login",
			setupAuth:  nil,
			wantStatus: http.StatusOK,
		},
		{
			name:       "POST /admin/login is public",
			method:     "POST",
			path:       "/admin/login",
			setupAuth:  nil,
			wantStatus: http.StatusOK, // Returns login page even for POST without data
		},
		{
			name:       "GET /admin/static/style.css is public",
			method:     "GET",
			path:       "/admin/static/style.css",
			setupAuth:  nil,
			wantStatus: http.StatusOK,
		},

		// Protected routes - redirect to login without auth
		{
			name:       "GET /admin/ redirects without auth",
			method:     "GET",
			path:       "/admin/",
			setupAuth:  nil,
			wantStatus: http.StatusSeeOther,
		},
		{
			name:       "GET /admin/runes redirects without auth",
			method:     "GET",
			path:       "/admin/runes",
			setupAuth:  nil,
			wantStatus: http.StatusSeeOther,
		},

		// Admin-only routes - 403 for non-admin
		{
			name:   "GET /admin/realms returns 403 for non-admin",
			method: "GET",
			path:   "/admin/realms",
			setupAuth: func(req *http.Request) {
				// Create a token for a non-admin user (unique ID for test isolation)
				store := cfg.ProjectionStore.(*mockProjectionStore)
				store.data[compositeKey(accountLookupRealm, accountLookupProjection, "pat:pat-realms-test")] = "keyhash-realms-test"
				store.data[compositeKey(accountLookupRealm, accountLookupProjection, "keyhash-realms-test")] = projectors.AccountLookupEntry{
					AccountID: "account-realms-test",
					Username:  "member",
					Status:    "active",
					Roles:     map[string]string{"realm-1": "member"},
				}
				token, _ := GenerateJWT(cfg.AuthConfig, "account-realms-test", "pat-realms-test")
				req.AddCookie(&http.Cookie{Name: "admin_token", Value: token})
			},
			wantStatus: http.StatusForbidden,
		},
		{
			name:   "GET /admin/accounts returns 403 for non-admin",
			method: "GET",
			path:   "/admin/accounts",
			setupAuth: func(req *http.Request) {
				// Create a token for a non-admin user (unique ID for test isolation)
				store := cfg.ProjectionStore.(*mockProjectionStore)
				store.data[compositeKey(accountLookupRealm, accountLookupProjection, "pat:pat-accounts-test")] = "keyhash-accounts-test"
				store.data[compositeKey(accountLookupRealm, accountLookupProjection, "keyhash-accounts-test")] = projectors.AccountLookupEntry{
					AccountID: "account-accounts-test",
					Username:  "member",
					Status:    "active",
					Roles:     map[string]string{"realm-1": "member"},
				}
				token, _ := GenerateJWT(cfg.AuthConfig, "account-accounts-test", "pat-accounts-test")
				req.AddCookie(&http.Cookie{Name: "admin_token", Value: token})
			},
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			if tt.setupAuth != nil {
				tt.setupAuth(req)
			}
			rec := httptest.NewRecorder()

			mux.ServeHTTP(rec, req)

			assert.Equal(t, tt.wantStatus, rec.Code, "path: %s", tt.path)
		})
	}
}

func TestRegisterRoutes_WithAdminAuth(t *testing.T) {
	store := newMockProjectionStore()
	cfg := &RouteConfig{
		AuthConfig:      DefaultAuthConfig(),
		ProjectionStore: store,
		EventStore:      nil,
	}

	// Generate signing key
	cfg.AuthConfig.SigningKey = make([]byte, 32)
	_, err := rand.Read(cfg.AuthConfig.SigningKey)
	require.NoError(t, err, "failed to generate signing key")

	// Set up admin user in store using composite keys
	store.data[compositeKey(accountLookupRealm, accountLookupProjection, "pat:pat-admin")] = "keyhash-admin"
	store.data[compositeKey(accountLookupRealm, accountLookupProjection, "keyhash-admin")] = projectors.AccountLookupEntry{
		AccountID: "account-admin",
		Username:  "adminuser",
		Status:    "active",
		Roles:     map[string]string{"_admin": "admin"},
	}

	mux := http.NewServeMux()
	result, err := RegisterRoutes(mux, cfg)
	require.NoError(t, err)
	_ = result // Use result.Handler if needed

	// Generate token for admin user
	token, err := GenerateJWT(cfg.AuthConfig, "account-admin", "pat-admin")
	require.NoError(t, err)

	tests := []struct {
		name       string
		method     string
		path       string
		wantStatus int
	}{
		{
			name:       "GET /admin/ returns 200 for admin",
			method:     "GET",
			path:       "/admin/",
			wantStatus: http.StatusOK,
		},
		{
			name:       "GET /admin/runes returns 200 for admin",
			method:     "GET",
			path:       "/admin/runes",
			wantStatus: http.StatusOK,
		},
		{
			name:       "GET /admin/realms returns 200 for admin",
			method:     "GET",
			path:       "/admin/realms",
			wantStatus: http.StatusOK,
		},
		{
			name:       "GET /admin/accounts returns 200 for admin",
			method:     "GET",
			path:       "/admin/accounts",
			wantStatus: http.StatusOK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.path, nil)
			req.AddCookie(&http.Cookie{Name: "admin_token", Value: token})
			rec := httptest.NewRecorder()

			mux.ServeHTTP(rec, req)

			assert.Equal(t, tt.wantStatus, rec.Code)
		})
	}
}

func TestRequireAdminMiddleware(t *testing.T) {
	requireAdmin := RequireAdminMiddleware()

	handler := requireAdmin(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))

	tests := []struct {
		name       string
		roles      map[string]string
		wantStatus int
	}{
		{
			name:       "admin role passes",
			roles:      map[string]string{"_admin": "admin"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "member role is forbidden",
			roles:      map[string]string{"_admin": "member"},
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "no _admin role is forbidden",
			roles:      map[string]string{"realm-1": "admin"},
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "nil roles is forbidden",
			roles:      nil,
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "empty roles is forbidden",
			roles:      map[string]string{},
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			ctx := context.WithValue(req.Context(), rolesKey, tt.roles)
			req = req.WithContext(ctx)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			assert.Equal(t, tt.wantStatus, rec.Code)
		})
	}
}

func TestRequireMemberMiddleware(t *testing.T) {
	requireMember := RequireMemberMiddleware("realm-1")

	handler := requireMember(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))

	tests := []struct {
		name       string
		roles      map[string]string
		wantStatus int
	}{
		{
			name:       "admin passes",
			roles:      map[string]string{"realm-1": "admin"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "member passes",
			roles:      map[string]string{"realm-1": "member"},
			wantStatus: http.StatusOK,
		},
		{
			name:       "viewer is forbidden",
			roles:      map[string]string{"realm-1": "viewer"},
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "no role in realm is forbidden",
			roles:      map[string]string{"realm-2": "admin"},
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "nil roles is forbidden",
			roles:      nil,
			wantStatus: http.StatusForbidden,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			ctx := context.WithValue(req.Context(), rolesKey, tt.roles)
			req = req.WithContext(ctx)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			assert.Equal(t, tt.wantStatus, rec.Code)
		})
	}
}
