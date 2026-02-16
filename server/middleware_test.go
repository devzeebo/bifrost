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
		tc.projection_store_has_no_entries()

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
		tc.projection_store_has_account_with_roles("acct-1", "alice", "suspended", map[string]string{"realm-1": "member"})

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
		tc.projection_store_has_account_with_roles("acct-1", "alice", "active", map[string]string{"realm-1": "member"})

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
		tc.projection_store_has_account_with_roles("acct-1", "alice", "active", map[string]string{"realm-1": "admin"})

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
		tc.projection_store_has_account("acct-1", "alice", "active", []string{"realm-1"})

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
		tc.projection_store_has_account("acct-1", "alice", "active", []string{"realm-1"})

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
		tc.projection_store_returns_error()

		// When
		tc.middleware_is_invoked()

		// Then
		tc.status_is(http.StatusInternalServerError)
		tc.next_handler_was_not_called()
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

func (tc *testContext) projection_store_has_no_entries() {
	tc.t.Helper()
	// store is already empty
}

func (tc *testContext) projection_store_has_account(accountID, username, status string, realms []string) {
	tc.t.Helper()
	entry := accountLookupEntry{
		AccountID: accountID,
		Username:  username,
		Status:    status,
		Realms:    realms,
	}
	tc.store.put("_admin", "account_lookup", tc.keyHash, entry)
}

func (tc *testContext) projection_store_has_account_with_roles(accountID, username, status string, roles map[string]string) {
	tc.t.Helper()
	realms := make([]string, 0, len(roles))
	for r := range roles {
		realms = append(realms, r)
	}
	entry := accountLookupEntry{
		AccountID: accountID,
		Username:  username,
		Status:    status,
		Realms:    realms,
		Roles:     roles,
	}
	tc.store.put("_admin", "account_lookup", tc.keyHash, entry)
}

func (tc *testContext) projection_store_returns_error() {
	tc.t.Helper()
	tc.store.forceError = true
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

	middleware := AuthMiddleware(tc.store)
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

func (m *mockProjectionStore) put(realmID, projectionName, key string, value any) {
	compositeKey := realmID + ":" + projectionName + ":" + key
	m.data[compositeKey] = value
}

func (m *mockProjectionStore) Get(_ context.Context, realmID string, projectionName string, key string, dest any) error {
	if m.forceError {
		return fmt.Errorf("forced store error")
	}
	compositeKey := realmID + ":" + projectionName + ":" + key
	val, ok := m.data[compositeKey]
	if !ok {
		return &core.NotFoundError{Entity: projectionName, ID: key}
	}
	dataBytes, err := json.Marshal(val)
	if err != nil {
		return err
	}
	return json.Unmarshal(dataBytes, dest)
}

func (m *mockProjectionStore) Put(_ context.Context, realmID string, projectionName string, key string, value any) error {
	compositeKey := realmID + ":" + projectionName + ":" + key
	m.data[compositeKey] = value
	return nil
}

func (m *mockProjectionStore) List(_ context.Context, realmID string, projectionName string) ([]json.RawMessage, error) {
	prefix := realmID + ":" + projectionName + ":"
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

func (m *mockProjectionStore) Delete(_ context.Context, realmID string, projectionName string, key string) error {
	compositeKey := realmID + ":" + projectionName + ":" + key
	delete(m.data, compositeKey)
	return nil
}
