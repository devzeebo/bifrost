package server

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"

	"github.com/devzeebo/bifrost/core"
)

type contextKey string

const realmIDKey contextKey = "realm_id"
const accountIDKey contextKey = "account_id"

type accountLookupEntry struct {
	AccountID string   `json:"account_id"`
	Username  string   `json:"username"`
	Status    string   `json:"status"`
	Realms    []string `json:"realms"`
}

// RealmIDFromContext extracts the realm ID from the request context.
func RealmIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(realmIDKey).(string)
	return id, ok
}

// AccountIDFromContext extracts the account ID from the request context.
func AccountIDFromContext(ctx context.Context) (string, bool) {
	id, ok := ctx.Value(accountIDKey).(string)
	return id, ok
}

// RequireRealm returns HTTP middleware that requires the request to have a non-admin realm ID in context.
func RequireRealm(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		realmID, ok := RealmIDFromContext(r.Context())
		if !ok || realmID == "_admin" {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// RequireAdmin returns HTTP middleware that requires the request to have the _admin realm in context.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		realmID, ok := RealmIDFromContext(r.Context())
		if !ok || realmID != "_admin" {
			http.Error(w, "Forbidden", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// AuthMiddleware returns HTTP middleware that authenticates via PAT and X-Bifrost-Realm header.
func AuthMiddleware(projectionStore core.ProjectionStore) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			if !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			token := strings.TrimPrefix(authHeader, "Bearer ")
			if token == "" {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			realmID := r.Header.Get("X-Bifrost-Realm")
			if realmID == "" {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Decode the raw key from base64url
			rawBytes, err := base64.RawURLEncoding.DecodeString(token)
			if err != nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// SHA-256 hash the raw bytes and encode as base64url
			h := sha256.Sum256(rawBytes)
			keyHash := base64.RawURLEncoding.EncodeToString(h[:])

			// Look up in account_lookup projection
			var entry accountLookupEntry
			err = projectionStore.Get(r.Context(), "_admin", "account_lookup", keyHash, &entry)
			if err != nil {
				var nfe *core.NotFoundError
				if errors.As(err, &nfe) {
					http.Error(w, "Unauthorized", http.StatusUnauthorized)
					return
				}
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			if entry.Status == "suspended" {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}

			// Check that the account has a grant for the requested realm
			hasGrant := false
			for _, realm := range entry.Realms {
				if realm == realmID {
					hasGrant = true
					break
				}
			}
			if !hasGrant {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}

			ctx := context.WithValue(r.Context(), accountIDKey, entry.AccountID)
			ctx = context.WithValue(ctx, realmIDKey, realmID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
