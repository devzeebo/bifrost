package admin

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHandleGetAccounts_UsesAccountDirectory(t *testing.T) {
	t.Run("lists accounts from account_directory projection", func(t *testing.T) {
		// Setup
		store := newMockProjectionStore()
		store.listData["account_directory"] = []json.RawMessage{
			json.RawMessage(`{"account_id":"acct-1","username":"alice","status":"active","realms":["realm-1"],"roles":{"realm-1":"admin"},"pats":[{"pat_id":"pat-1","key_hash":"hash-1","label":"my-pat","created_at":"2026-02-01T12:00:00Z"}],"created_at":"2026-01-15T10:00:00Z"}`),
			json.RawMessage(`{"account_id":"acct-2","username":"bob","status":"active","realms":[],"roles":{},"pats":[],"created_at":"2026-01-16T10:00:00Z"}`),
		}

		cfg := &RouteConfig{ProjectionStore: store}
		handler := handleGetAccounts(cfg)

		req := httptest.NewRequest("GET", "/api/accounts", nil)
		req = req.WithContext(context.WithValue(req.Context(), rolesKey, map[string]string{"_admin": "admin"}))
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var accounts []AccountListEntry
		err := json.NewDecoder(rec.Body).Decode(&accounts)
		require.NoError(t, err)
		require.Len(t, accounts, 2)

		// First account has 1 PAT
		assert.Equal(t, "acct-1", accounts[0].AccountID)
		assert.Equal(t, "alice", accounts[0].Username)
		assert.Equal(t, 1, accounts[0].PATCount)

		// Second account has 0 PATs
		assert.Equal(t, "acct-2", accounts[1].AccountID)
		assert.Equal(t, "bob", accounts[1].Username)
		assert.Equal(t, 0, accounts[1].PATCount)
	})
}

func TestHandleGetAccount_UsesAccountDirectory(t *testing.T) {
	t.Run("gets account from account_directory projection", func(t *testing.T) {
		// Setup
		store := newMockProjectionStore()
		entry := projectors.AccountDirectoryEntry{
			AccountID: "acct-1",
			Username:  "alice",
			Status:    "active",
			Realms:    []string{"realm-1"},
			Roles:     map[string]string{"realm-1": "admin"},
			PATs: []projectors.PATEntry{
				{PATID: "pat-1", KeyHash: "hash-1", Label: "my-pat", CreatedAt: time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC)},
			},
			CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
		}
		store.data[compositeKey("_admin", "account_directory", "acct-1")] = entry

		cfg := &RouteConfig{ProjectionStore: store}
		handler := handleGetAccount(cfg)

		req := httptest.NewRequest("GET", "/api/account?id=acct-1", nil)
		ctx := context.WithValue(req.Context(), accountIDKey, "acct-1")
		ctx = context.WithValue(ctx, rolesKey, map[string]string{"_admin": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var account AccountDetail
		err := json.NewDecoder(rec.Body).Decode(&account)
		require.NoError(t, err)

		assert.Equal(t, "acct-1", account.AccountID)
		assert.Equal(t, "alice", account.Username)
		assert.Equal(t, "active", account.Status)
		assert.Equal(t, 1, account.PATCount)
	})

	t.Run("returns not found when account does not exist in account_directory", func(t *testing.T) {
		store := newMockProjectionStore()
		cfg := &RouteConfig{ProjectionStore: store}
		handler := handleGetAccount(cfg)

		req := httptest.NewRequest("GET", "/api/account?id=nonexistent", nil)
		ctx := context.WithValue(req.Context(), accountIDKey, "nonexistent")
		ctx = context.WithValue(ctx, rolesKey, map[string]string{"_admin": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})
}

func TestHandleGetPats_UsesAccountDirectory(t *testing.T) {
	t.Run("gets PATs from account_directory.pats array", func(t *testing.T) {
		// Setup
		store := newMockProjectionStore()
		entry := projectors.AccountDirectoryEntry{
			AccountID: "acct-1",
			Username:  "alice",
			Status:    "active",
			Realms:    []string{},
			Roles:     map[string]string{},
			PATs: []projectors.PATEntry{
				{PATID: "pat-1", KeyHash: "hash-1", Label: "my-pat", CreatedAt: time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC)},
				{PATID: "pat-2", KeyHash: "hash-2", Label: "ci-token", CreatedAt: time.Date(2026, 2, 2, 12, 0, 0, 0, time.UTC)},
			},
			CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
		}
		store.data[compositeKey("_admin", "account_directory", "acct-1")] = entry

		cfg := &RouteConfig{ProjectionStore: store}
		handler := handleGetPats(cfg)

		req := httptest.NewRequest("GET", "/api/pats?account_id=acct-1", nil)
		ctx := context.WithValue(req.Context(), accountIDKey, "acct-1")
		ctx = context.WithValue(ctx, rolesKey, map[string]string{"_admin": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var pats []PatEntry
		err := json.NewDecoder(rec.Body).Decode(&pats)
		require.NoError(t, err)
		require.Len(t, pats, 2)

		assert.Equal(t, "pat-1", pats[0].ID)
		assert.Equal(t, "my-pat", pats[0].Label)
		assert.Equal(t, "pat-2", pats[1].ID)
		assert.Equal(t, "ci-token", pats[1].Label)
	})

	t.Run("returns empty list when account has no PATs", func(t *testing.T) {
		store := newMockProjectionStore()
		entry := projectors.AccountDirectoryEntry{
			AccountID: "acct-1",
			Username:  "alice",
			Status:    "active",
			Realms:    []string{},
			Roles:     map[string]string{},
			PATs:      []projectors.PATEntry{},
			CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
		}
		store.data[compositeKey("_admin", "account_directory", "acct-1")] = entry

		cfg := &RouteConfig{ProjectionStore: store}
		handler := handleGetPats(cfg)

		req := httptest.NewRequest("GET", "/api/pats?account_id=acct-1", nil)
		ctx := context.WithValue(req.Context(), accountIDKey, "acct-1")
		ctx = context.WithValue(ctx, rolesKey, map[string]string{"_admin": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var pats []PatEntry
		err := json.NewDecoder(rec.Body).Decode(&pats)
		require.NoError(t, err)
		assert.Len(t, pats, 0)
	})
}

func TestHandleRevokePat_UsesAccountDirectory(t *testing.T) {
	t.Run("rejects revoke when only one PAT remains using account_directory.pats length", func(t *testing.T) {
		// Setup
		store := newMockProjectionStore()
		entry := projectors.AccountDirectoryEntry{
			AccountID: "acct-1",
			Username:  "alice",
			Status:    "active",
			Realms:    []string{},
			Roles:     map[string]string{},
			PATs: []projectors.PATEntry{
				{PATID: "pat-1", KeyHash: "hash-1", Label: "my-pat", CreatedAt: time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC)},
			},
			CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
		}
		store.data[compositeKey("_admin", "account_directory", "acct-1")] = entry

		cfg := &RouteConfig{ProjectionStore: store}
		handler := handleRevokePat(cfg)

		body := `{"account_id":"acct-1","pat_id":"pat-1"}`
		req := httptest.NewRequest("POST", "/api/revoke-pat", strings.NewReader(body))
		ctx := context.WithValue(req.Context(), accountIDKey, "acct-1")
		ctx = context.WithValue(ctx, rolesKey, map[string]string{"_admin": "admin"})
		req = req.WithContext(ctx)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		// Should reject because len(pats) == 1
		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Contains(t, rec.Body.String(), "cannot revoke the last PAT")
	})
}
