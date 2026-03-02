package admin

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestUISessionAPI_Login tests the POST /ui/login endpoint.
func TestUISessionAPI_Login(t *testing.T) {
	store := newMockProjectionStoreWithAccount()
	cfg := &RouteConfig{
		AuthConfig:      DefaultAuthConfig(),
		ProjectionStore: store,
		EventStore:      nil,
	}

	// Generate signing key
	cfg.AuthConfig.SigningKey = make([]byte, 32)
	_, err := rand.Read(cfg.AuthConfig.SigningKey)
	require.NoError(t, err, "failed to generate signing key")

	mux := http.NewServeMux()
	_, err = RegisterRoutes(mux, cfg)
	require.NoError(t, err)

	// Register session API routes
	RegisterSessionAPIRoutes(mux, cfg)

	t.Run("login with valid PAT returns session info", func(t *testing.T) {
		// Use the valid token from the mock store
		validPAT := store.validToken

		loginReq := LoginRequest{PAT: validPAT}
		body, err := json.Marshal(loginReq)
		require.NoError(t, err)

		req := httptest.NewRequest("POST", "/api/ui/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		// Verify response contains session info
		var resp LoginResponse
		err = json.Unmarshal(rec.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.NotEmpty(t, resp.AccountID)
		assert.NotEmpty(t, resp.Username)
		assert.NotEmpty(t, resp.Realms)

		// Verify cookie is set
		cookies := rec.Result().Cookies()
		var foundAuthCookie bool
		for _, c := range cookies {
			if c.Name == cfg.AuthConfig.CookieName {
				foundAuthCookie = true
				assert.NotEmpty(t, c.Value)
				assert.True(t, c.HttpOnly)
				assert.Equal(t, "/ui", c.Path)
				assert.Equal(t, int((4 * time.Hour).Seconds()), c.MaxAge)
			}
		}
		assert.True(t, foundAuthCookie, "auth cookie should be set")
	})

	t.Run("login with remember me uses full session expiry", func(t *testing.T) {
		validPAT := store.validToken

		loginReq := LoginRequest{PAT: validPAT, RememberMe: true}
		body, err := json.Marshal(loginReq)
		require.NoError(t, err)

		req := httptest.NewRequest("POST", "/api/ui/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		cookies := rec.Result().Cookies()
		var foundAuthCookie bool
		for _, c := range cookies {
			if c.Name == cfg.AuthConfig.CookieName {
				foundAuthCookie = true
				assert.Equal(t, int(cfg.AuthConfig.TokenExpiry.Seconds()), c.MaxAge)
			}
		}
		assert.True(t, foundAuthCookie, "auth cookie should be set")
	})

	t.Run("login with invalid PAT returns 401", func(t *testing.T) {
		loginReq := LoginRequest{PAT: "invalid-pat-token"}
		body, err := json.Marshal(loginReq)
		require.NoError(t, err)

		req := httptest.NewRequest("POST", "/api/ui/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("login with empty PAT returns 400", func(t *testing.T) {
		loginReq := LoginRequest{PAT: ""}
		body, err := json.Marshal(loginReq)
		require.NoError(t, err)

		req := httptest.NewRequest("POST", "/api/ui/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})
}

// TestUISessionAPI_Logout tests the POST /ui/logout endpoint.
func TestUISessionAPI_Logout(t *testing.T) {
	cfg := &RouteConfig{
		AuthConfig:      DefaultAuthConfig(),
		ProjectionStore: newMockProjectionStoreWithAccount(),
		EventStore:      nil,
	}

	// Generate signing key
	cfg.AuthConfig.SigningKey = make([]byte, 32)
	_, err := rand.Read(cfg.AuthConfig.SigningKey)
	require.NoError(t, err, "failed to generate signing key")

	mux := http.NewServeMux()
	_, err = RegisterRoutes(mux, cfg)
	require.NoError(t, err)

	// Register session API routes
	RegisterSessionAPIRoutes(mux, cfg)

	t.Run("logout clears auth cookie", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/api/ui/logout", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		// Verify cookie is cleared
		cookies := rec.Result().Cookies()
		var foundClearedCookie bool
		for _, c := range cookies {
			if c.Name == cfg.AuthConfig.CookieName {
				foundClearedCookie = true
				assert.Equal(t, "", c.Value)
				assert.Equal(t, -1, c.MaxAge)
			}
		}
		assert.True(t, foundClearedCookie, "auth cookie should be cleared")
	})
}

// TestUISessionAPI_GetSession tests the GET /ui/session endpoint.
func TestUISessionAPI_GetSession(t *testing.T) {
	store := newMockProjectionStoreWithAccount()
	cfg := &RouteConfig{
		AuthConfig:      DefaultAuthConfig(),
		ProjectionStore: store,
		EventStore:      nil,
	}

	// Generate signing key
	cfg.AuthConfig.SigningKey = make([]byte, 32)
	_, err := rand.Read(cfg.AuthConfig.SigningKey)
	require.NoError(t, err, "failed to generate signing key")

	mux := http.NewServeMux()
	_, err = RegisterRoutes(mux, cfg)
	require.NoError(t, err)

	// Register session API routes
	RegisterSessionAPIRoutes(mux, cfg)

	t.Run("get session without auth returns 401", func(t *testing.T) {
		req := httptest.NewRequest("GET", "/api/ui/session", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("get session with valid auth returns session info", func(t *testing.T) {
		// First, login to get a valid session
		validPAT := store.validToken

		loginReq := LoginRequest{PAT: validPAT}
		body, err := json.Marshal(loginReq)
		require.NoError(t, err)

		loginHTTPReq := httptest.NewRequest("POST", "/api/ui/login", bytes.NewReader(body))
		loginHTTPReq.Header.Set("Content-Type", "application/json")
		loginRec := httptest.NewRecorder()
		mux.ServeHTTP(loginRec, loginHTTPReq)
		require.Equal(t, http.StatusOK, loginRec.Code)

		// Extract the cookie
		cookies := loginRec.Result().Cookies()
		var authCookie *http.Cookie
		for _, c := range cookies {
			if c.Name == cfg.AuthConfig.CookieName {
				authCookie = c
				break
			}
		}
		require.NotNil(t, authCookie, "auth cookie should be set after login")

		// Now get session with the cookie
		req := httptest.NewRequest("GET", "/api/ui/session", nil)
		req.AddCookie(authCookie)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var session SessionInfo
		err = json.Unmarshal(rec.Body.Bytes(), &session)
		require.NoError(t, err)
		assert.NotEmpty(t, session.AccountID)
		assert.NotEmpty(t, session.Username)
		assert.NotEmpty(t, session.Realms)
	})
}

// TestUISessionAPI_CheckOnboarding tests the GET /ui/check-onboarding endpoint.
func TestUISessionAPI_CheckOnboarding(t *testing.T) {
	t.Run("returns needs_onboarding=true when no accounts exist", func(t *testing.T) {
		cfg := &RouteConfig{
			AuthConfig:      DefaultAuthConfig(),
			ProjectionStore: newMockProjectionStore(), // Empty store
			EventStore:      nil,
		}

		cfg.AuthConfig.SigningKey = make([]byte, 32)
		_, err := rand.Read(cfg.AuthConfig.SigningKey)
		require.NoError(t, err, "failed to generate signing key")

		mux := http.NewServeMux()
		RegisterSessionAPIRoutes(mux, cfg)

		req := httptest.NewRequest("GET", "/api/ui/check-onboarding", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var resp OnboardingCheckResponse
		err = json.Unmarshal(rec.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.True(t, resp.NeedsOnboarding)
	})

	t.Run("returns needs_onboarding=false when accounts exist", func(t *testing.T) {
		cfg := &RouteConfig{
			AuthConfig:      DefaultAuthConfig(),
			ProjectionStore: newMockProjectionStoreWithAccount(),
			EventStore:      nil,
		}

		cfg.AuthConfig.SigningKey = make([]byte, 32)
		_, err := rand.Read(cfg.AuthConfig.SigningKey)
		require.NoError(t, err, "failed to generate signing key")

		mux := http.NewServeMux()
		RegisterSessionAPIRoutes(mux, cfg)

		req := httptest.NewRequest("GET", "/api/ui/check-onboarding", nil)
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var resp OnboardingCheckResponse
		err = json.Unmarshal(rec.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.False(t, resp.NeedsOnboarding)
	})
}

// TestUISessionAPI_CreateAdmin tests the POST /ui/onboarding/create-admin endpoint.
func TestUISessionAPI_CreateAdmin(t *testing.T) {
	t.Run("creates admin account during onboarding", func(t *testing.T) {
		cfg := &RouteConfig{
			AuthConfig:      DefaultAuthConfig(),
			ProjectionStore: newMockProjectionStore(), // Empty store
			EventStore:      newMockEventStore(),
		}

		cfg.AuthConfig.SigningKey = make([]byte, 32)
		_, err := rand.Read(cfg.AuthConfig.SigningKey)
		require.NoError(t, err, "failed to generate signing key")

		mux := http.NewServeMux()
		RegisterSessionAPIRoutes(mux, cfg)

		createReq := CreateAdminRequest{Username: "admin"}
		body, err := json.Marshal(createReq)
		require.NoError(t, err)

		req := httptest.NewRequest("POST", "/api/ui/onboarding/create-admin", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var resp CreateAdminResponse
		err = json.Unmarshal(rec.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.NotEmpty(t, resp.AccountID)
		assert.NotEmpty(t, resp.PAT)
	})

	t.Run("returns error when onboarding already complete", func(t *testing.T) {
		cfg := &RouteConfig{
			AuthConfig:      DefaultAuthConfig(),
			ProjectionStore: newMockProjectionStoreWithAccount(), // Has existing account
			EventStore:      nil,
		}

		cfg.AuthConfig.SigningKey = make([]byte, 32)
		_, err := rand.Read(cfg.AuthConfig.SigningKey)
		require.NoError(t, err, "failed to generate signing key")

		mux := http.NewServeMux()
		RegisterSessionAPIRoutes(mux, cfg)

		createReq := CreateAdminRequest{Username: "another-admin"}
		body, err := json.Marshal(createReq)
		require.NoError(t, err)

		req := httptest.NewRequest("POST", "/api/ui/onboarding/create-admin", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()

		mux.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})
}

// newMockProjectionStoreWithAccount creates a mock store with a pre-configured test account.
func newMockProjectionStoreWithAccount() *mockProjectionStore {
	store := newMockProjectionStore()

	// Create a valid PAT token
	rawKey := []byte("test-pat-secret-key-32-bytes-long!!")
	token := base64.RawURLEncoding.EncodeToString(rawKey)
	h := sha256.Sum256(rawKey)
	keyHash := base64.RawURLEncoding.EncodeToString(h[:])

	// Set up the account lookup entry using projectors.AccountLookupEntry
	store.data[compositeKey("_admin", "account_lookup", keyHash)] = projectors.AccountLookupEntry{
		AccountID: "account-test-123",
		Username:  "testuser",
		Status:    "active",
		Realms:    []string{"realm-1"},
		Roles:     map[string]string{"realm-1": "admin", "_admin": "admin"},
	}

	// Set up PAT reverse lookup
	store.data[compositeKey("_admin", "account_lookup", "pat:pat-test-123")] = keyHash
	store.data[compositeKey("_admin", "account_lookup", "keyhash_pat:"+keyHash)] = "pat-test-123"

	// Store the valid token for tests to use
	store.validToken = token

	// Add account list entry for onboarding check
	store.listData["account_list"] = []json.RawMessage{
		json.RawMessage(`{"account_id":"account-test-123","username":"testuser"}`),
	}

	return store
}
