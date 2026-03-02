package server

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/devzeebo/bifrost/server/admin"
)

type contextKey string

const realmIDKey contextKey = "realm_id"
const accountIDKey contextKey = "account_id"
const roleKey contextKey = "role"

type accountLookupEntry struct {
	AccountID string            `json:"account_id"`
	Username  string            `json:"username"`
	Status    string            `json:"status"`
	Realms    []string          `json:"realms"`
	Roles     map[string]string `json:"roles"`
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

// RoleFromContext extracts the role from the request context.
func RoleFromContext(ctx context.Context) (string, bool) {
	role, ok := ctx.Value(roleKey).(string)
	return role, ok
}

// RequireRole returns HTTP middleware that enforces a minimum role level per route.
func RequireRole(minRole string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			role, ok := RoleFromContext(r.Context())
			if !ok || domain.RoleLevel(role) < domain.RoleLevel(minRole) {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
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

// AuthConfig holds configuration for combined authentication (Bearer token + JWT cookie).
type AuthConfig struct {
	AdminAuthConfig *admin.AuthConfig
}

// AuthMiddleware returns HTTP middleware that authenticates via:
// 1. JWT cookie (for UI sessions), OR
// 2. Bearer token + X-Bifrost-Realm header (for API clients)
func AuthMiddleware(projectionStore core.ProjectionStore, authConfig *AuthConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Try JWT cookie auth first (for UI sessions)
			if authConfig != nil && authConfig.AdminAuthConfig != nil {
				if cookie, err := r.Cookie(authConfig.AdminAuthConfig.CookieName); err == nil {
					ctx, ok := authenticateViaJWT(r.Context(), cookie.Value, authConfig.AdminAuthConfig, projectionStore, r)
					if ok {
						next.ServeHTTP(w, r.WithContext(ctx))
						return
					}
				}
			}

			// Fall back to Bearer token auth (for API clients)
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

			ctx, ok := authenticateViaBearerToken(r.Context(), token, realmID, projectionStore)
			if !ok {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// authenticateViaJWT validates a JWT cookie and returns the context with auth info.
func authenticateViaJWT(ctx context.Context, token string, cfg *admin.AuthConfig, projectionStore core.ProjectionStore, r *http.Request) (context.Context, bool) {
	claims, err := admin.ValidateJWT(cfg, token)
	if err != nil {
		return nil, false
	}

	// Check that the PAT is still active
	entry, err := admin.CheckPATStatus(r.Context(), projectionStore, claims.PATID)
	if err != nil {
		return nil, false
	}

	// Get realm from header or cookie, fallback to first available
	realmID := r.Header.Get("X-Bifrost-Realm")
	if realmID == "" {
		realmID = getSelectedRealm(r, entry.Roles, entry.Realms)
	}

	if realmID == "" {
		return nil, false
	}

	// Get role for the realm
	role := entry.Roles[realmID]
	if role == "" {
		// Fallback to Realms slice for legacy data
		for _, realm := range entry.Realms {
			if realm == realmID {
				role = "member"
				break
			}
		}
	}

	if role == "" {
		return nil, false
	}

	ctx = context.WithValue(ctx, accountIDKey, claims.AccountID)
	ctx = context.WithValue(ctx, realmIDKey, realmID)
	ctx = context.WithValue(ctx, roleKey, role)
	return ctx, true
}

// getSelectedRealm returns the realm ID from cookie if valid, otherwise the first available realm.
func getSelectedRealm(r *http.Request, roles map[string]string, realms []string) string {
	// Check cookie first
	if cookie, err := r.Cookie("bifrost_selected_realm"); err == nil && cookie.Value != "" {
		if _, ok := roles[cookie.Value]; ok {
			return cookie.Value
		}
	}

	// Fallback to first realm from roles
	for realmID := range roles {
		if realmID != "_admin" {
			return realmID
		}
	}

	// Fallback to first realm from realms slice
	for _, realm := range realms {
		if realm != "_admin" {
			return realm
		}
	}

	return ""
}

// authenticateViaBearerToken validates a Bearer token and returns the context with auth info.
func authenticateViaBearerToken(ctx context.Context, token string, realmID string, projectionStore core.ProjectionStore) (context.Context, bool) {
	// Decode the raw key from base64url
	rawBytes, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return nil, false
	}

	// SHA-256 hash the raw bytes and encode as base64url
	h := sha256.Sum256(rawBytes)
	keyHash := base64.RawURLEncoding.EncodeToString(h[:])

	// Look up in account_lookup projection
	var entry projectors.AccountLookupEntry
	err = projectionStore.Get(ctx, "_admin", "account_lookup", keyHash, &entry)
	if err != nil {
		return nil, false
	}

	if entry.Status == "suspended" {
		return nil, false
	}

	// Extract role for the requested realm
	var role string
	if entry.Roles != nil {
		role = entry.Roles[realmID]
	}
	if role == "" {
		// Fallback to Realms slice for legacy data
		for _, realm := range entry.Realms {
			if realm == realmID {
				role = "member"
				break
			}
		}
	}

	if role == "" {
		return nil, false
	}

	ctx = context.WithValue(ctx, accountIDKey, entry.AccountID)
	ctx = context.WithValue(ctx, realmIDKey, realmID)
	ctx = context.WithValue(ctx, roleKey, role)
	return ctx, true
}
