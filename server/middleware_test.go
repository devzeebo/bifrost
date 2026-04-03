package server

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestAuthMiddleware(t *testing.T) {
	t.Run("returns 401 when Authorization header is missing", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_without_auth_header()

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusUnauthorized)
		tc.next_handler_was_not_called()
	})

	t.Run("returns 401 when Authorization header is not Bearer scheme", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_auth_header("Basic abc123")
		tc.request_has_realm_header("realm-1")

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusUnauthorized)
		tc.next_handler_was_not_called()
	})

	t.Run("returns 401 when Bearer token is empty", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_auth_header("Bearer ")
		tc.request_has_realm_header("realm-1")

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusUnauthorized)
		tc.next_handler_was_not_called()
	})

	t.Run("returns 401 when Bearer token is malformed base64", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_auth_header("Bearer !!!not-base64!!!")
		tc.request_has_realm_header("realm-1")

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusUnauthorized)
		tc.next_handler_was_not_called()
	})

	t.Run("returns 401 when X-Bifrost-Realm header is missing", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_bearer_token(tc.rawKey)
		tc.request_has_no_realm_header()

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusUnauthorized)
		tc.next_handler_was_not_called()
	})

	t.Run("returns 401 when key is not found in projection", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_bearer_token(tc.rawKey)
		tc.request_has_realm_header("realm-1")
		tc.store_has_no_entries()

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusUnauthorized)
		tc.next_handler_was_not_called()
	})

	t.Run("returns 403 when account is suspended", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_bearer_token(tc.rawKey)
		tc.request_has_realm_header("realm-1")
		tc.store_has_account_with_roles("acct-1", "alice", "suspended", map[string]string{"realm-1": "member"})

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
	})

	t.Run("returns 403 when account has no role for requested realm", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_bearer_token(tc.rawKey)
		tc.request_has_realm_header("realm-2")
		tc.store_has_account_with_roles("acct-1", "alice", "active", map[string]string{"realm-1": "member"})

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
	})

	t.Run("extracts role from Roles map and stores in context", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_bearer_token(tc.rawKey)
		tc.request_has_realm_header("realm-1")
		tc.store_has_account_with_roles("acct-1", "alice", "active", map[string]string{"realm-1": "admin"})

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
		tc.context_has_realm_id("realm-1")
		tc.context_has_account_id("acct-1")
		tc.context_has_role("admin")
	})

	t.Run("falls back to Realms slice with member role for legacy data", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_bearer_token(tc.rawKey)
		tc.request_has_realm_header("realm-1")
		tc.store_has_account("acct-1", "alice", "active", []string{"realm-1"})

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
		tc.context_has_realm_id("realm-1")
		tc.context_has_account_id("acct-1")
		tc.context_has_role("member")
	})

	t.Run("returns 403 when account has neither Roles nor Realms for requested realm", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_bearer_token(tc.rawKey)
		tc.request_has_realm_header("realm-2")
		tc.store_has_account("acct-1", "alice", "active", []string{"realm-1"})

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
	})

	t.Run("returns 500 when projection store returns unexpected error", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_bearer_token(tc.rawKey)
		tc.request_has_realm_header("realm-1")
		tc.store_returns_error()

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusInternalServerError)
		tc.next_handler_was_not_called()
	})

	t.Run("resolves realm name to realm ID", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_bearer_token(tc.rawKey)
		tc.request_has_realm_header("my-realm-name") // using name instead of ID
		tc.store_has_realm("realm-1", "my-realm-name", "active") // must be called before account setup to populate realmNames
		tc.store_has_account_with_roles("acct-1", "alice", "active", map[string]string{"realm-1": "admin"})

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
		tc.context_has_realm_id("realm-1") // resolved to ID
		tc.context_has_account_id("acct-1")
		tc.context_has_role("admin")
	})

	t.Run("returns 403 when realm name exists but user has no access", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_bearer_token(tc.rawKey)
		tc.request_has_realm_header("other-realm")
		tc.store_has_realm("realm-2", "other-realm", "active")
		tc.store_has_account_with_roles("acct-1", "alice", "active", map[string]string{"realm-1": "admin"})

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
	})

	t.Run("returns 403 when realm name not found", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_bearer_token(tc.rawKey)
		tc.request_has_realm_header("nonexistent-realm")
		tc.store_has_account_with_roles("acct-1", "alice", "active", map[string]string{"realm-1": "admin"})

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
	})

	t.Run("returns 403 when realm name resolves only to suspended realms", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_bearer_token(tc.rawKey)
		tc.request_has_realm_header("my-realm")
		tc.store_has_realm("realm-1", "my-realm", "suspended")
		tc.store_has_account_with_roles("acct-1", "alice", "active", map[string]string{"realm-1": "admin"})

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
	})

	t.Run("returns 403 when realm name is ambiguous across multiple accessible non-suspended realms", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_bearer_token(tc.rawKey)
		tc.request_has_realm_header("shared-name")
		tc.store_has_realm("realm-1", "shared-name", "active")
		tc.store_has_realm("realm-2", "shared-name", "active")
		tc.store_has_account_with_roles("acct-1", "alice", "active", map[string]string{"realm-1": "admin", "realm-2": "member"})

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
		tc.response_body_contains("ambiguous")
	})

	t.Run("resolves realm name when matching realm is active and other same-named realm is suspended", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.request_with_bearer_token(tc.rawKey)
		tc.request_has_realm_header("my-realm")
		tc.store_has_realm("realm-1", "my-realm", "active")
		tc.store_has_realm("realm-2", "my-realm", "suspended")
		tc.store_has_account_with_roles("acct-1", "alice", "active", map[string]string{"realm-1": "admin", "realm-2": "member"})

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
		tc.context_has_realm_id("realm-1")
	})
}

func TestRequireRealm(t *testing.T) {
	t.Run("returns 403 when request has no realm in context", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_no_auth()

		// When
		tc.require_realm_is_invoked()

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
	})

	t.Run("calls next handler when request has realm in context", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_realm_id("realm-1")

		// When
		tc.require_realm_is_invoked()

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
	})
}

func TestRoleFromContext(t *testing.T) {
	t.Run("returns role when present in context", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), roleKey, "admin")
		role, ok := RoleFromContext(ctx)
		assert.True(t, ok)
		assert.Equal(t, "admin", role)
	})

	t.Run("returns false when not present in context", func(t *testing.T) {
		role, ok := RoleFromContext(context.Background())
		assert.False(t, ok)
		assert.Equal(t, "", role)
	})
}

func TestRequireRole(t *testing.T) {
	t.Run("passes for viewer when minimum role is viewer", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("viewer")

		// When
		tc.require_role_is_invoked("viewer")

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
	})

	t.Run("passes for member when minimum role is viewer", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("member")

		// When
		tc.require_role_is_invoked("viewer")

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
	})

	t.Run("passes for admin when minimum role is viewer", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("admin")

		// When
		tc.require_role_is_invoked("viewer")

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
	})

	t.Run("passes for owner when minimum role is viewer", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("owner")

		// When
		tc.require_role_is_invoked("viewer")

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
	})

	t.Run("rejects viewer when minimum role is member", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("viewer")

		// When
		tc.require_role_is_invoked("member")

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
	})

	t.Run("passes for member when minimum role is member", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("member")

		// When
		tc.require_role_is_invoked("member")

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
	})

	t.Run("passes for admin when minimum role is member", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("admin")

		// When
		tc.require_role_is_invoked("member")

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
	})

	t.Run("passes for owner when minimum role is member", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("owner")

		// When
		tc.require_role_is_invoked("member")

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
	})

	t.Run("rejects viewer when minimum role is admin", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("viewer")

		// When
		tc.require_role_is_invoked("admin")

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
	})

	t.Run("rejects member when minimum role is admin", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("member")

		// When
		tc.require_role_is_invoked("admin")

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
	})

	t.Run("passes for admin when minimum role is admin", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("admin")

		// When
		tc.require_role_is_invoked("admin")

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
	})

	t.Run("passes for owner when minimum role is admin", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("owner")

		// When
		tc.require_role_is_invoked("admin")

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
	})

	t.Run("rejects viewer when minimum role is owner", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("viewer")

		// When
		tc.require_role_is_invoked("owner")

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
	})

	t.Run("rejects member when minimum role is owner", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("member")

		// When
		tc.require_role_is_invoked("owner")

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
	})

	t.Run("rejects admin when minimum role is owner", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("admin")

		// When
		tc.require_role_is_invoked("owner")

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
	})

	t.Run("passes for owner when minimum role is owner", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_role("owner")

		// When
		tc.require_role_is_invoked("owner")

		// Then
		tc.status_is(http.StatusOK)
		tc.next_handler_was_called()
	})

	t.Run("returns 403 when no role in context", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.context_with_no_auth()

		// When
		tc.require_role_is_invoked("viewer")

		// Then
		tc.status_is(http.StatusForbidden)
		tc.next_handler_was_not_called()
	})
}

func TestRealmIDFromContext(t *testing.T) {
	t.Run("returns realm ID when present", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), realmIDKey, "realm-42")
		id, ok := RealmIDFromContext(ctx)
		assert.True(t, ok)
		assert.Equal(t, "realm-42", id)
	})

	t.Run("returns false when not present", func(t *testing.T) {
		id, ok := RealmIDFromContext(context.Background())
		assert.False(t, ok)
		assert.Equal(t, "", id)
	})
}

func TestAccountIDFromContext(t *testing.T) {
	t.Run("returns account ID when present", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), accountIDKey, "acct-42")
		id, ok := AccountIDFromContext(ctx)
		assert.True(t, ok)
		assert.Equal(t, "acct-42", id)
	})

	t.Run("returns false when not present", func(t *testing.T) {
		id, ok := AccountIDFromContext(context.Background())
		assert.False(t, ok)
		assert.Equal(t, "", id)
	})
}

// --- Test Context ---

type testContext struct {
	t *testing.T

	// Input
	rawKey  string
	keyHash string

	// Dependencies
	store *mockProjectionStore

	// HTTP
	request  *http.Request
	recorder *httptest.ResponseRecorder

	// Captured from next handler
	nextCalled  bool
	capturedCtx context.Context

	// Test data
	realmNames map[string]string
}

func newTestContext(t *testing.T) *testContext {
	t.Helper()

	// Generate a deterministic test key
	rawBytes := []byte("test-key-bytes-that-are-32-bytes!")
	rawKey := base64.RawURLEncoding.EncodeToString(rawBytes)
	h := sha256.Sum256(rawBytes)
	keyHash := base64.RawURLEncoding.EncodeToString(h[:])

	return &testContext{
		t:        t,
		rawKey:   rawKey,
		keyHash:  keyHash,
		store:    newMockProjectionStore(),
		recorder: httptest.NewRecorder(),
	}
}

// --- Given ---

func (tc *testContext) request_without_auth_header() {
	tc.t.Helper()
	tc.request = httptest.NewRequest(http.MethodGet, "/test", nil)
}

func (tc *testContext) request_with_auth_header(value string) {
	tc.t.Helper()
	if tc.request == nil {
		tc.request = httptest.NewRequest(http.MethodGet, "/test", nil)
	}
	tc.request.Header.Set("Authorization", value)
}

func (tc *testContext) request_with_bearer_token(rawKey string) {
	tc.t.Helper()
	if tc.request == nil {
		tc.request = httptest.NewRequest(http.MethodGet, "/test", nil)
	}
	tc.request.Header.Set("Authorization", "Bearer "+rawKey)
}

func (tc *testContext) request_has_realm_header(realmID string) {
	tc.t.Helper()
	if tc.request == nil {
		tc.request = httptest.NewRequest(http.MethodGet, "/test", nil)
	}
	tc.request.Header.Set("X-Bifrost-Realm", realmID)
}

func (tc *testContext) request_has_no_realm_header() {
	tc.t.Helper()
	// no realm header set — this is the default
}

func (tc *testContext) store_has_no_entries() {
	tc.t.Helper()
	// store is already empty
}

func (tc *testContext) store_has_account(accountID, username, status string, realms []string) {
	tc.t.Helper()
	// Set up the PAT ID lookup
	tc.store.put("_admin", "pat_by_keyhash", tc.keyHash, "pat-test-123")
	// Set up the PAT entry
	patEntry := map[string]any{
		"pat_id":     "pat-test-123",
		"key_hash":   tc.keyHash,
		"account_id": accountID,
	}
	tc.store.put("_admin", "pat_by_id", "pat-test-123", patEntry)
	// Set up the account auth entry
	entry := map[string]any{
		"account_id": accountID,
		"username":   username,
		"status":     status,
		"realms":     realms,
	}
	tc.store.put("_admin", "account_auth", accountID, entry)
}

func (tc *testContext) store_has_account_with_roles(accountID, username, status string, roles map[string]string) {
	tc.t.Helper()
	realms := make([]string, 0, len(roles))
	for r := range roles {
		realms = append(realms, r)
	}
	// Set up the PAT ID lookup
	tc.store.put("_admin", "pat_by_keyhash", tc.keyHash, "pat-test-123")
	// Set up the PAT entry
	patEntry := map[string]any{
		"pat_id":     "pat-test-123",
		"key_hash":   tc.keyHash,
		"account_id": accountID,
	}
	tc.store.put("_admin", "pat_by_id", "pat-test-123", patEntry)
	// Set up the account auth entry
	entry := map[string]any{
		"account_id":  accountID,
		"username":    username,
		"status":      status,
		"realms":      realms,
		"roles":       roles,
		"realm_names": tc.realmNames,
	}
	tc.store.put("_admin", "account_auth", accountID, entry)
}

func (tc *testContext) store_returns_error() {
	tc.t.Helper()
	tc.store.forceError = true
}

func (tc *testContext) store_has_realm(realmID, name, status string) {
	tc.t.Helper()
	entry := map[string]any{
		"realm_id":   realmID,
		"name":       name,
		"status":     status,
		"created_at": "2026-01-01T00:00:00Z",
	}
	tc.store.put(realmID, "realm_directory", realmID, entry)
	// Also populate realmNames for account auth entry
	if tc.realmNames == nil {
		tc.realmNames = make(map[string]string)
	}
	tc.realmNames[realmID] = name
}

func (tc *testContext) context_with_realm_id(realmID string) {
	tc.t.Helper()
	tc.request = httptest.NewRequest(http.MethodGet, "/test", nil)
	ctx := context.WithValue(tc.request.Context(), realmIDKey, realmID)
	tc.request = tc.request.WithContext(ctx)
}

func (tc *testContext) context_with_no_auth() {
	tc.t.Helper()
	tc.request = httptest.NewRequest(http.MethodGet, "/test", nil)
}

func (tc *testContext) context_with_role(role string) {
	tc.t.Helper()
	tc.request = httptest.NewRequest(http.MethodGet, "/test", nil)
	ctx := context.WithValue(tc.request.Context(), roleKey, role)
	tc.request = tc.request.WithContext(ctx)
}

// --- When ---

func (tc *testContext) middleware_is_invoked() {
	tc.t.Helper()
	require.NotNil(tc.t, tc.request, "request must be set before invoking middleware")

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.nextCalled = true
		tc.capturedCtx = r.Context()
		w.WriteHeader(http.StatusOK)
	})

	middleware := AuthMiddleware(tc.store, nil)
	handler := middleware(next)
	handler.ServeHTTP(tc.recorder, tc.request)
}

func (tc *testContext) require_realm_is_invoked() {
	tc.t.Helper()
	require.NotNil(tc.t, tc.request, "request must be set before invoking middleware")

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.nextCalled = true
		tc.capturedCtx = r.Context()
		w.WriteHeader(http.StatusOK)
	})

	middleware := RequireRealm(next)
	middleware.ServeHTTP(tc.recorder, tc.request)
}

func (tc *testContext) require_role_is_invoked(minRole string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.request, "request must be set before invoking middleware")

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.nextCalled = true
		tc.capturedCtx = r.Context()
		w.WriteHeader(http.StatusOK)
	})

	middleware := RequireRole(minRole)(next)
	middleware.ServeHTTP(tc.recorder, tc.request)
}

// --- Then ---

func (tc *testContext) status_is(code int) {
	tc.t.Helper()
	assert.Equal(tc.t, code, tc.recorder.Code)
}

func (tc *testContext) next_handler_was_called() {
	tc.t.Helper()
	assert.True(tc.t, tc.nextCalled, "expected next handler to be called")
}

func (tc *testContext) next_handler_was_not_called() {
	tc.t.Helper()
	assert.False(tc.t, tc.nextCalled, "expected next handler NOT to be called")
}

func (tc *testContext) context_has_realm_id(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.capturedCtx, "next handler was not called, no context captured")
	id, ok := RealmIDFromContext(tc.capturedCtx)
	assert.True(tc.t, ok, "expected realm ID in context")
	assert.Equal(tc.t, expected, id)
}

func (tc *testContext) context_has_account_id(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.capturedCtx, "next handler was not called, no context captured")
	id, ok := AccountIDFromContext(tc.capturedCtx)
	assert.True(tc.t, ok, "expected account ID in context")
	assert.Equal(tc.t, expected, id)
}

func (tc *testContext) context_has_role(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.capturedCtx, "next handler was not called, no context captured")
	role, ok := RoleFromContext(tc.capturedCtx)
	assert.True(tc.t, ok, "expected role in context")
	assert.Equal(tc.t, expected, role)
}

func (tc *testContext) response_body_contains(substring string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.recorder.Body.String(), substring)
}

// --- Mock Projection Store ---

type mockProjectionStore struct {
	data       map[string]any
	forceError bool
}

func newMockProjectionStore() *mockProjectionStore {
	return &mockProjectionStore{
		data: make(map[string]any),
	}
}

func (m *mockProjectionStore) put(realmID, table, key string, value any) {
	compositeKey := realmID + ":" + table + ":" + key
	m.data[compositeKey] = value
}

func (m *mockProjectionStore) Get(_ context.Context, realmID string, table string, key string, dest any) error {
	if m.forceError {
		return fmt.Errorf("forced store error")
	}
	compositeKey := realmID + ":" + table + ":" + key
	val, ok := m.data[compositeKey]
	if !ok {
		return &core.NotFoundError{Entity: table, ID: key}
	}
	dataBytes, err := json.Marshal(val)
	if err != nil {
		return err
	}
	return json.Unmarshal(dataBytes, dest)
}

func (m *mockProjectionStore) Put(_ context.Context, realmID string, table string, key string, value any) error {
	compositeKey := realmID + ":" + table + ":" + key
	m.data[compositeKey] = value
	return nil
}

func (m *mockProjectionStore) List(_ context.Context, realmID string, table string) ([]json.RawMessage, error) {
	prefix := realmID + ":" + table + ":"
	var results []json.RawMessage
	for k, v := range m.data {
		if len(k) > len(prefix) && k[:len(prefix)] == prefix {
			data, err := json.Marshal(v)
			if err != nil {
				return nil, err
			}
			results = append(results, json.RawMessage(data))
		}
	}
	return results, nil
}

func (m *mockProjectionStore) Delete(_ context.Context, realmID string, table string, key string) error {
	compositeKey := realmID + ":" + table + ":" + key
	delete(m.data, compositeKey)
	return nil
}

func (m *mockProjectionStore) CreateTable(_ context.Context, table string) error {
	return nil
}

func (m *mockProjectionStore) ClearTable(_ context.Context, table string) error {
	return nil
}
