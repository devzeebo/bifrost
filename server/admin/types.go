package admin

import (
	"net/http"
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
				http.Error(w, "Forbidden", http.StatusForbidden)
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
