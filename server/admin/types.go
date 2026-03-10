package admin

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/devzeebo/bifrost/core"
)

// RealmInfo contains information about a realm for the UI.
type RealmInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// AccountInfo contains information about the authenticated user.
type AccountInfo struct {
	ID              string            `json:"id"`
	Username        string            `json:"username"`
	Roles           map[string]string `json:"roles"`
	CurrentRealm    string            `json:"current_realm"`
	AvailableRealms []RealmInfo       `json:"available_realms"`
	IsSysAdmin      bool              `json:"is_sysadmin"`
}

// RequireAdminMiddleware returns middleware that checks if the user has admin role.
func RequireAdminMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			roles, ok := RolesFromContext(r.Context())
			if !ok || !isAdmin(roles) {
				writeError(w, http.StatusForbidden, "forbidden")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// isAdmin checks if the user has admin or owner role in the _admin realm.
func isAdmin(roles map[string]string) bool {
	if roles == nil {
		return false
	}
	role, ok := roles["_admin"]
	if !ok {
		return false
	}
	return role == "admin" || role == "owner"
}

// writeError writes a JSON error response.
func writeError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}

// handleDomainError handles domain errors with appropriate HTTP status codes.
func handleDomainError(w http.ResponseWriter, err error) {
	var concErr *core.ConcurrencyError
	if errors.As(err, &concErr) {
		writeError(w, http.StatusConflict, err.Error())
		return
	}

	var nfErr *core.NotFoundError
	if errors.As(err, &nfErr) {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeError(w, http.StatusInternalServerError, err.Error())
}

// RequireMemberMiddleware returns middleware that checks if the user has member+ role in a specific realm.
func RequireMemberMiddleware(realmID string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			roles, ok := RolesFromContext(r.Context())
			if !ok {
				writeError(w, http.StatusForbidden, "forbidden")
				return
			}
			role, hasRealm := roles[realmID]
			if !hasRealm {
				writeError(w, http.StatusForbidden, "forbidden")
				return
			}
			// Allow member, admin, or owner
			if role == "viewer" {
				writeError(w, http.StatusForbidden, "forbidden")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
