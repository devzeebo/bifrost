package server

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
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
					ctx, err := authenticateViaJWT(r.Context(), cookie.Value, authConfig.AdminAuthConfig, projectionStore, r)
					if err == nil {
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

			ctx, err := authenticateViaBearerToken(r.Context(), token, realmID, projectionStore)
			if err != nil {
				if authErr, ok := err.(*AuthError); ok {
					http.Error(w, authErr.Message, authErr.Status)
				} else {
					http.Error(w, "Unauthorized", http.StatusUnauthorized)
				}
				return
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// authenticateViaJWT validates a JWT cookie and returns the context with auth info.
// Returns an AuthError for authentication/authorization failures.
func authenticateViaJWT(ctx context.Context, token string, cfg *admin.AuthConfig, projectionStore core.ProjectionStore, r *http.Request) (context.Context, error) {
	claims, err := admin.ValidateJWT(cfg, token)
	if err != nil {
		return nil, ErrUnauthorized("Unauthorized")
	}

	// Check that the PAT is still active
	entry, err := admin.CheckPATStatus(r.Context(), projectionStore, claims.PATID)
	if err != nil {
		return nil, ErrUnauthorized("Unauthorized")
	}

	// Get realm from header or cookie, fallback to first available
	realmID := r.Header.Get("X-Bifrost-Realm")
	if realmID == "" {
		realmID = getSelectedRealm(r, entry.Roles, entry.Realms)
	}

	if realmID == "" {
		return nil, ErrForbidden("No realm selected")
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
		return nil, ErrForbidden("No access to realm")
	}

	ctx = context.WithValue(ctx, accountIDKey, claims.AccountID)
	ctx = context.WithValue(ctx, realmIDKey, realmID)
	ctx = context.WithValue(ctx, roleKey, role)
	return ctx, nil
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
// Returns an AuthError for authentication/authorization failures.
func authenticateViaBearerToken(ctx context.Context, token string, realmID string, projectionStore core.ProjectionStore) (context.Context, error) {
	// Decode the raw key from base64url
	rawBytes, err := base64.RawURLEncoding.DecodeString(token)
	if err != nil {
		return nil, ErrUnauthorized("Unauthorized")
	}

	// SHA-256 hash the raw bytes and encode as base64url
	h := sha256.Sum256(rawBytes)
	keyHash := base64.RawURLEncoding.EncodeToString(h[:])

	// Look up PAT ID from keyHash reverse lookup
	var patID string
	if err := projectionStore.Get(ctx, "_admin", "projection_pat_id", keyHash, &patID); err != nil {
		var notFound *core.NotFoundError
		if errors.As(err, &notFound) {
			return nil, ErrUnauthorized("Unauthorized")
		}
		return nil, ErrInternal("Internal server error")
	}

	// Look up PAT entry to get account ID
	var patEntry projectors.PATIDEntry
	if err := projectionStore.Get(ctx, "_admin", "projection_pat_by_id", patID, &patEntry); err != nil {
		var notFound *core.NotFoundError
		if errors.As(err, &notFound) {
			return nil, ErrUnauthorized("Unauthorized")
		}
		return nil, ErrInternal("Internal server error")
	}

	// Look up account auth entry
	var entry projectors.AccountAuthEntry
	err = projectionStore.Get(ctx, "_admin", "projection_account_auth", patEntry.AccountID, &entry)
	if err != nil {
		// If the error is NotFoundError, it means the token is invalid
		var notFound *core.NotFoundError
		if errors.As(err, &notFound) {
			return nil, ErrUnauthorized("Unauthorized")
		}
		// Other errors are internal server errors
		return nil, ErrInternal("Internal server error")
	}

	if entry.Status == "suspended" {
		return nil, ErrForbidden("Account suspended")
	}

	// Resolve realm ID (handles both realm IDs and realm names)
	resolvedRealmID, err := resolveRealmID(ctx, realmID, entry.Roles, entry.Realms, projectionStore)
	if err != nil {
		return nil, err
	}

	// Extract role for the requested realm
	var role string
	if entry.Roles != nil {
		role = entry.Roles[resolvedRealmID]
	}
	if role == "" {
		// Fallback to Realms slice for legacy data
		for _, realm := range entry.Realms {
			if realm == resolvedRealmID {
				role = "member"
				break
			}
		}
	}

	if role == "" {
		return nil, ErrForbidden("No access to realm")
	}

	ctx = context.WithValue(ctx, accountIDKey, entry.AccountID)
	ctx = context.WithValue(ctx, realmIDKey, resolvedRealmID)
	ctx = context.WithValue(ctx, roleKey, role)
	return ctx, nil
}

// resolveRealmID resolves a realm identifier (ID or name) to a realm ID.
// Returns an AuthError if the realm cannot be found or accessed.
func resolveRealmID(ctx context.Context, realmIdent string, roles map[string]string, realms []string, projectionStore core.ProjectionStore) (string, error) {
	// First, check if it's already a valid realm ID (exists in roles or realms)
	if roles != nil {
		if _, ok := roles[realmIdent]; ok {
			return realmIdent, nil
		}
	}
	for _, r := range realms {
		if r == realmIdent {
			return realmIdent, nil
		}
	}

	// Not found as ID, try to resolve as a realm name
	// Look up realm_directory in _admin realm
	entries, err := projectionStore.List(ctx, "_admin", "realm_directory")
	if err != nil {
		return "", ErrInternal("Internal server error")
	}

	for _, raw := range entries {
		var realm projectors.RealmDirectoryEntry
		if err := json.Unmarshal(raw, &realm); err != nil {
			continue
		}
		if realm.Name == realmIdent {
			// Found by name, check if user has access
			if roles != nil {
				if _, ok := roles[realm.RealmID]; ok {
					return realm.RealmID, nil
				}
			}
			for _, r := range realms {
				if r == realm.RealmID {
					return realm.RealmID, nil
				}
			}
			// Found realm but user doesn't have access
			return "", ErrForbidden("No access to realm")
		}
	}

	// Realm not found by ID or name
	return "", ErrForbidden("No access to realm")
}

// AuthError represents an authentication/authorization error with HTTP status
type AuthError struct {
	Status  int
	Message string
}

func (e *AuthError) Error() string {
	return e.Message
}

// ErrUnauthorized returns a 401 auth error
func ErrUnauthorized(msg string) *AuthError {
	return &AuthError{Status: http.StatusUnauthorized, Message: msg}
}

// ErrForbidden returns a 403 auth error
func ErrForbidden(msg string) *AuthError {
	return &AuthError{Status: http.StatusForbidden, Message: msg}
}

// ErrInternal returns a 500 auth error
func ErrInternal(msg string) *AuthError {
	return &AuthError{Status: http.StatusInternalServerError, Message: msg}
}