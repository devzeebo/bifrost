package admin

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGenerateSigningKey(t *testing.T) {
	key1, err := GenerateSigningKey()
	require.NoError(t, err)
	assert.Len(t, key1, 32)

	key2, err := GenerateSigningKey()
	require.NoError(t, err)
	assert.NotEqual(t, key1, key2, "keys should be random")
}

func TestGenerateJWT(t *testing.T) {
	cfg := &AuthConfig{
		SigningKey:  make([]byte, 32),
		TokenExpiry: 24 * time.Hour,
	}
	_, err := rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	token, err := GenerateJWT(cfg, "account-123", "pat-456")
	require.NoError(t, err)
	assert.NotEmpty(t, token)
}

func TestValidateJWT(t *testing.T) {
	cfg := &AuthConfig{
		SigningKey:  make([]byte, 32),
		TokenExpiry: 24 * time.Hour,
	}
	_, err := rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	t.Run("valid token", func(t *testing.T) {
		token, err := GenerateJWT(cfg, "account-123", "pat-456")
		require.NoError(t, err)

		claims, err := ValidateJWT(cfg, token)
		require.NoError(t, err)
		assert.Equal(t, "account-123", claims.AccountID)
		assert.Equal(t, "pat-456", claims.PATID)
		assert.False(t, claims.ExpiresAt.Time.Before(time.Now()))
	})

	t.Run("invalid signature", func(t *testing.T) {
		token, err := GenerateJWT(cfg, "account-123", "pat-456")
		require.NoError(t, err)

		// Use different key for validation
		wrongCfg := &AuthConfig{
			SigningKey:  make([]byte, 32),
			TokenExpiry: 24 * time.Hour,
		}
		_, err = rand.Read(wrongCfg.SigningKey)
		require.NoError(t, err)

		_, err = ValidateJWT(wrongCfg, token)
		assert.Error(t, err)
	})

	t.Run("malformed token", func(t *testing.T) {
		_, err := ValidateJWT(cfg, "not-a-valid-token")
		assert.Error(t, err)
	})

	t.Run("empty token", func(t *testing.T) {
		_, err := ValidateJWT(cfg, "")
		assert.Error(t, err)
	})

	t.Run("wrong signing method", func(t *testing.T) {
		// Create a token with none signing method
		claims := AdminClaims{
			AccountID: "account-123",
			PATID:     "pat-456",
		}
		token := jwt.NewWithClaims(jwt.SigningMethodNone, claims)
		tokenString, err := token.SignedString(jwt.UnsafeAllowNoneSignatureType)
		require.NoError(t, err)

		_, err = ValidateJWT(cfg, tokenString)
		assert.Error(t, err)
		assert.ErrorContains(t, err, "unexpected signing method")
	})
}

func TestValidateJWT_Expiry(t *testing.T) {
	cfg := &AuthConfig{
		SigningKey:  make([]byte, 32),
		TokenExpiry: -1 * time.Hour, // Already expired
	}
	_, err := rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	token, err := GenerateJWT(cfg, "account-123", "pat-456")
	require.NoError(t, err)

	// Wait a moment to ensure expiry
	time.Sleep(10 * time.Millisecond)

	_, err = ValidateJWT(cfg, token)
	assert.Error(t, err)
	assert.ErrorIs(t, err, jwt.ErrTokenExpired)
}

func TestCheckPATStatus(t *testing.T) {
	ctx := context.Background()

	t.Run("active PAT", func(t *testing.T) {
		store := newMockProjectionStore()
		store.data[compositeKey("_admin", "account_lookup", "pat:pat-123")] = "keyhash-abc"
		store.data[compositeKey("_admin", "account_lookup", "keyhash-abc")] = projectors.AccountLookupEntry{
			AccountID: "account-456",
			Username:  "testuser",
			Status:    "active",
			Roles:     map[string]string{"realm-1": "member"},
		}

		entry, err := CheckPATStatus(ctx, store, "pat-123")
		require.NoError(t, err)
		assert.Equal(t, "account-456", entry.AccountID)
		assert.Equal(t, "testuser", entry.Username)
		assert.Equal(t, "active", entry.Status)
	})

	t.Run("revoked PAT - not found in lookup", func(t *testing.T) {
		store := newMockProjectionStore()

		_, err := CheckPATStatus(ctx, store, "pat-123")
		assert.ErrorIs(t, err, ErrPATRevoked)
	})

	t.Run("revoked PAT - entry deleted", func(t *testing.T) {
		store := newMockProjectionStore()
		store.data[compositeKey("_admin", "account_lookup", "pat:pat-123")] = "keyhash-abc"
		// keyhash-abc entry doesn't exist (deleted on revocation)

		_, err := CheckPATStatus(ctx, store, "pat-123")
		assert.ErrorIs(t, err, ErrPATRevoked)
	})

	t.Run("suspended account", func(t *testing.T) {
		store := newMockProjectionStore()
		store.data[compositeKey("_admin", "account_lookup", "pat:pat-123")] = "keyhash-abc"
		store.data[compositeKey("_admin", "account_lookup", "keyhash-abc")] = projectors.AccountLookupEntry{
			AccountID: "account-456",
			Username:  "testuser",
			Status:    "suspended",
		}

		_, err := CheckPATStatus(ctx, store, "pat-123")
		assert.ErrorIs(t, err, ErrAccountSuspended)
	})

	t.Run("projection store error", func(t *testing.T) {
		store := newMockProjectionStore()
		store.getError = errors.New("db error")

		_, err := CheckPATStatus(ctx, store, "pat-123")
		assert.Error(t, err)
		assert.NotErrorIs(t, err, ErrPATRevoked)
	})
}

func TestValidatePAT(t *testing.T) {
	ctx := context.Background()

	// Helper to create a valid PAT token
	createPATToken := func(t *testing.T) (string, string) {
		rawKey := make([]byte, 32)
		_, err := rand.Read(rawKey)
		require.NoError(t, err)
		token := base64.RawURLEncoding.EncodeToString(rawKey)
		h := sha256.Sum256(rawKey)
		keyHash := base64.RawURLEncoding.EncodeToString(h[:])
		return token, keyHash
	}

	t.Run("valid PAT", func(t *testing.T) {
		store := newMockProjectionStore()
		token, keyHash := createPATToken(t)
		store.data[compositeKey("_admin", "account_lookup", keyHash)] = projectors.AccountLookupEntry{
			AccountID: "account-456",
			Username:  "testuser",
			Status:    "active",
			Roles:     map[string]string{"realm-1": "member"},
		}
		store.data[compositeKey("_admin", "account_lookup", "keyhash_pat:"+keyHash)] = "pat-789"

		entry, patID, err := ValidatePAT(ctx, store, token)
		require.NoError(t, err)
		assert.Equal(t, "account-456", entry.AccountID)
		assert.Equal(t, "pat-789", patID)
	})

	t.Run("invalid base64", func(t *testing.T) {
		store := newMockProjectionStore()

		_, _, err := ValidatePAT(ctx, store, "!!!invalid-base64!!!")
		assert.ErrorIs(t, err, ErrInvalidToken)
	})

	t.Run("PAT not found", func(t *testing.T) {
		store := newMockProjectionStore()
		token, _ := createPATToken(t)

		_, _, err := ValidatePAT(ctx, store, token)
		assert.ErrorIs(t, err, ErrInvalidToken)
	})

	t.Run("suspended account", func(t *testing.T) {
		store := newMockProjectionStore()
		token, keyHash := createPATToken(t)
		store.data[compositeKey("_admin", "account_lookup", keyHash)] = projectors.AccountLookupEntry{
			AccountID: "account-456",
			Username:  "testuser",
			Status:    "suspended",
		}

		_, _, err := ValidatePAT(ctx, store, token)
		assert.ErrorIs(t, err, ErrAccountSuspended)
	})

	t.Run("PAT ID reverse lookup missing", func(t *testing.T) {
		store := newMockProjectionStore()
		token, keyHash := createPATToken(t)
		store.data[compositeKey("_admin", "account_lookup", keyHash)] = projectors.AccountLookupEntry{
			AccountID: "account-456",
			Username:  "testuser",
			Status:    "active",
		}
		// Missing "keyhash_pat:"+keyHash entry

		_, _, err := ValidatePAT(ctx, store, token)
		assert.ErrorIs(t, err, ErrInvalidToken)
	})
}

func TestAuthMiddleware(t *testing.T) {
	cfg := &AuthConfig{
		SigningKey:     make([]byte, 32),
		TokenExpiry:    24 * time.Hour,
		CookieName:     "admin_token",
		CookieSecure:   true,
		CookieSameSite: http.SameSiteStrictMode,
	}
	_, err := rand.Read(cfg.SigningKey)
	require.NoError(t, err)

	// Handler that returns 200 if authenticated
	protectedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		accountID, ok := AccountIDFromContext(r.Context())
		if !ok {
			http.Error(w, "no account in context", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("account: " + accountID))
	})

	t.Run("valid JWT with active PAT", func(t *testing.T) {
		store := newMockProjectionStore()
		store.data[compositeKey("_admin", "account_lookup", "pat:pat-123")] = "keyhash-abc"
		store.data[compositeKey("_admin", "account_lookup", "keyhash-abc")] = projectors.AccountLookupEntry{
			AccountID: "account-456",
			Username:  "testuser",
			Status:    "active",
			Roles:     map[string]string{"realm-1": "admin"},
		}

		token, err := GenerateJWT(cfg, "account-456", "pat-123")
		require.NoError(t, err)

		req := httptest.NewRequest("GET", "/admin/", nil)
		req.AddCookie(&http.Cookie{
			Name:  "admin_token",
			Value: token,
		})
		rec := httptest.NewRecorder()

		middleware := AuthMiddleware(cfg, store)
		middleware(protectedHandler).ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Contains(t, rec.Body.String(), "account-456")
	})

	t.Run("missing cookie redirects to login", func(t *testing.T) {
		store := newMockProjectionStore()

		req := httptest.NewRequest("GET", "/admin/", nil)
		rec := httptest.NewRecorder()

		middleware := AuthMiddleware(cfg, store)
		middleware(protectedHandler).ServeHTTP(rec, req)

		assert.Equal(t, http.StatusSeeOther, rec.Code)
		assert.Equal(t, "/admin/login", rec.Header().Get("Location"))
	})

	t.Run("invalid JWT redirects to login", func(t *testing.T) {
		store := newMockProjectionStore()

		req := httptest.NewRequest("GET", "/admin/", nil)
		req.AddCookie(&http.Cookie{
			Name:  "admin_token",
			Value: "invalid-token",
		})
		rec := httptest.NewRecorder()

		middleware := AuthMiddleware(cfg, store)
		middleware(protectedHandler).ServeHTTP(rec, req)

		assert.Equal(t, http.StatusSeeOther, rec.Code)
		assert.Equal(t, "/admin/login", rec.Header().Get("Location"))
	})

	t.Run("expired JWT redirects to login", func(t *testing.T) {
		store := newMockProjectionStore()

		expiredCfg := &AuthConfig{
			SigningKey:  cfg.SigningKey,
			TokenExpiry: -1 * time.Hour,
		}
		token, err := GenerateJWT(expiredCfg, "account-456", "pat-123")
		require.NoError(t, err)

		// Small delay to ensure token is expired
		time.Sleep(10 * time.Millisecond)

		req := httptest.NewRequest("GET", "/admin/", nil)
		req.AddCookie(&http.Cookie{
			Name:  "admin_token",
			Value: token,
		})
		rec := httptest.NewRecorder()

		middleware := AuthMiddleware(cfg, store)
		middleware(protectedHandler).ServeHTTP(rec, req)

		assert.Equal(t, http.StatusSeeOther, rec.Code)
		assert.Equal(t, "/admin/login", rec.Header().Get("Location"))
	})

	t.Run("revoked PAT redirects to login", func(t *testing.T) {
		store := newMockProjectionStore()
		// PAT not in store (revoked)

		token, err := GenerateJWT(cfg, "account-456", "pat-123")
		require.NoError(t, err)

		req := httptest.NewRequest("GET", "/admin/", nil)
		req.AddCookie(&http.Cookie{
			Name:  "admin_token",
			Value: token,
		})
		rec := httptest.NewRecorder()

		middleware := AuthMiddleware(cfg, store)
		middleware(protectedHandler).ServeHTTP(rec, req)

		assert.Equal(t, http.StatusSeeOther, rec.Code)
		assert.Equal(t, "/admin/login", rec.Header().Get("Location"))
	})

	t.Run("suspended account redirects to login", func(t *testing.T) {
		store := newMockProjectionStore()
		store.data[compositeKey("_admin", "account_lookup", "pat:pat-123")] = "keyhash-abc"
		store.data[compositeKey("_admin", "account_lookup", "keyhash-abc")] = projectors.AccountLookupEntry{
			AccountID: "account-456",
			Username:  "testuser",
			Status:    "suspended",
		}

		token, err := GenerateJWT(cfg, "account-456", "pat-123")
		require.NoError(t, err)

		req := httptest.NewRequest("GET", "/admin/", nil)
		req.AddCookie(&http.Cookie{
			Name:  "admin_token",
			Value: token,
		})
		rec := httptest.NewRecorder()

		middleware := AuthMiddleware(cfg, store)
		middleware(protectedHandler).ServeHTTP(rec, req)

		assert.Equal(t, http.StatusSeeOther, rec.Code)
		assert.Equal(t, "/admin/login", rec.Header().Get("Location"))
	})

	t.Run("clears cookie on auth failure", func(t *testing.T) {
		store := newMockProjectionStore()

		req := httptest.NewRequest("GET", "/admin/", nil)
		req.AddCookie(&http.Cookie{
			Name:  "admin_token",
			Value: "invalid-token",
		})
		rec := httptest.NewRecorder()

		middleware := AuthMiddleware(cfg, store)
		middleware(protectedHandler).ServeHTTP(rec, req)

		cookies := rec.Result().Cookies()
		var adminCookie *http.Cookie
		for _, c := range cookies {
			if c.Name == "admin_token" {
				adminCookie = c
				break
			}
		}
		require.NotNil(t, adminCookie)
		assert.Equal(t, "", adminCookie.Value)
		assert.Equal(t, -1, adminCookie.MaxAge)
	})
}

func TestContextHelpers(t *testing.T) {
	ctx := context.Background()

	t.Run("AccountIDFromContext", func(t *testing.T) {
		ctx := context.WithValue(ctx, accountIDKey, "account-123")
		id, ok := AccountIDFromContext(ctx)
		assert.True(t, ok)
		assert.Equal(t, "account-123", id)

		_, ok = AccountIDFromContext(context.Background())
		assert.False(t, ok)
	})

	t.Run("PATIDFromContext", func(t *testing.T) {
		ctx := context.WithValue(ctx, patIDKey, "pat-456")
		id, ok := PATIDFromContext(ctx)
		assert.True(t, ok)
		assert.Equal(t, "pat-456", id)

		_, ok = PATIDFromContext(context.Background())
		assert.False(t, ok)
	})

	t.Run("UsernameFromContext", func(t *testing.T) {
		ctx := context.WithValue(ctx, usernameKey, "testuser")
		username, ok := UsernameFromContext(ctx)
		assert.True(t, ok)
		assert.Equal(t, "testuser", username)

		_, ok = UsernameFromContext(context.Background())
		assert.False(t, ok)
	})

	t.Run("RolesFromContext", func(t *testing.T) {
		roles := map[string]string{"realm-1": "admin"}
		ctx := context.WithValue(ctx, rolesKey, roles)
		r, ok := RolesFromContext(ctx)
		assert.True(t, ok)
		assert.Equal(t, roles, r)

		_, ok = RolesFromContext(context.Background())
		assert.False(t, ok)
	})
}

func TestSetAuthCookie(t *testing.T) {
	cfg := &AuthConfig{
		CookieName:     "admin_token",
		CookieSecure:   true,
		CookieSameSite: http.SameSiteStrictMode,
	}

	rec := httptest.NewRecorder()
	SetAuthCookie(rec, cfg, "test-token")

	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 1)
	assert.Equal(t, "admin_token", cookies[0].Name)
	assert.Equal(t, "test-token", cookies[0].Value)
	assert.Equal(t, "/admin", cookies[0].Path)
	assert.True(t, cookies[0].HttpOnly)
	assert.True(t, cookies[0].Secure)
	assert.Equal(t, http.SameSiteStrictMode, cookies[0].SameSite)
}

func TestClearAuthCookie(t *testing.T) {
	cfg := &AuthConfig{
		CookieName:     "admin_token",
		CookieSecure:   true,
		CookieSameSite: http.SameSiteStrictMode,
	}

	rec := httptest.NewRecorder()
	ClearAuthCookie(rec, cfg)

	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 1)
	assert.Equal(t, "admin_token", cookies[0].Name)
	assert.Equal(t, "", cookies[0].Value)
	assert.Equal(t, "/admin", cookies[0].Path)
	assert.Equal(t, -1, cookies[0].MaxAge)
	assert.True(t, cookies[0].HttpOnly)
	assert.True(t, cookies[0].Secure)
}

func TestDefaultAuthConfig(t *testing.T) {
	cfg := DefaultAuthConfig()
	assert.Equal(t, 12*time.Hour, cfg.TokenExpiry) // SOC 2 CC6.1 requires max 12-hour session
	assert.Equal(t, "admin_token", cfg.CookieName)
	assert.True(t, cfg.CookieSecure)
	assert.Equal(t, http.SameSiteStrictMode, cfg.CookieSameSite)
}

// compositeKey creates a composite key from realm, projection, and key for proper isolation in tests.
func compositeKey(realm, projection, key string) string {
	return fmt.Sprintf("%s/%s/%s", realm, projection, key)
}

// mockProjectionStore implements core.ProjectionStore for testing
type mockProjectionStore struct {
	data      map[string]interface{}
	listData  map[string][]json.RawMessage
	getError  error
	listError error
}

func newMockProjectionStore() *mockProjectionStore {
	return &mockProjectionStore{
		data:     make(map[string]interface{}),
		listData: make(map[string][]json.RawMessage),
	}
}

func (m *mockProjectionStore) Get(ctx context.Context, realm, projection, key string, dest interface{}) error {
	if m.getError != nil {
		return m.getError
	}
	ckey := compositeKey(realm, projection, key)
	val, ok := m.data[ckey]
	if !ok {
		return &core.NotFoundError{Entity: projection, ID: key}
	}

	// Copy value to dest
	switch d := dest.(type) {
	case *string:
		if s, ok := val.(string); ok {
			*d = s
		}
	case *projectors.AccountLookupEntry:
		if e, ok := val.(projectors.AccountLookupEntry); ok {
			*d = e
		}
	case *[]string:
		if s, ok := val.([]string); ok {
			*d = s
		}
	case *projectors.RuneDetail:
		if e, ok := val.(projectors.RuneDetail); ok {
			*d = e
		}
	case *projectors.RuneSummary:
		if e, ok := val.(projectors.RuneSummary); ok {
			*d = e
		}
	case *projectors.RealmListEntry:
		if e, ok := val.(projectors.RealmListEntry); ok {
			*d = e
		}
	case *projectors.AccountListEntry:
		if e, ok := val.(projectors.AccountListEntry); ok {
			*d = e
		}
	default:
		return fmt.Errorf("mockProjectionStore.Get: unhandled dest type %T", dest)
	}
	return nil
}

func (m *mockProjectionStore) Put(ctx context.Context, realm, projection, key string, value interface{}) error {
	ckey := compositeKey(realm, projection, key)
	m.data[ckey] = value
	return nil
}

func (m *mockProjectionStore) Delete(ctx context.Context, realm, projection, key string) error {
	ckey := compositeKey(realm, projection, key)
	delete(m.data, ckey)
	return nil
}

func (m *mockProjectionStore) List(ctx context.Context, realm, projection string) ([]json.RawMessage, error) {
	if m.listError != nil {
		return nil, m.listError
	}
	// Use projection as key for list data (tests set this up)
	if data, ok := m.listData[projection]; ok {
		return data, nil
	}
	return []json.RawMessage{}, nil
}
