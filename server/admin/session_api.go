package admin

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

// LoginRequest is the request body for POST /ui/login.
type LoginRequest struct {
	PAT        string `json:"pat"`
	RememberMe bool   `json:"remember_me"`
}

const defaultSessionTTL = 4 * time.Hour

func getSessionTTL(cfg *AuthConfig, rememberMe bool) time.Duration {
	if rememberMe {
		return cfg.TokenExpiry
	}

	ttl := defaultSessionTTL
	if cfg.TokenExpiry > 0 && cfg.TokenExpiry < ttl {
		ttl = cfg.TokenExpiry
	}

	return ttl
}

// LoginResponse is the response for successful POST /ui/login.
type LoginResponse struct {
	AccountID  string            `json:"account_id"`
	Username   string            `json:"username"`
	Realms     []string          `json:"realms"`
	Roles      map[string]string `json:"roles"`
	IsSysAdmin bool              `json:"is_sysadmin"`
	RealmNames map[string]string `json:"realm_names"` // realm_id -> name
}

// SessionInfo is the response for GET /ui/session.
type SessionInfo struct {
	AccountID  string            `json:"account_id"`
	Username   string            `json:"username"`
	Realms     []string          `json:"realms"`
	Roles      map[string]string `json:"roles"`
	IsSysAdmin bool              `json:"is_sysadmin"`
	RealmNames map[string]string `json:"realm_names"` // realm_id -> name
}

// OnboardingCheckResponse is the response for GET /ui/check-onboarding.
// Returns the state of the system to determine what onboarding steps are needed.
// Note: A "sysadmin" is any account with admin or owner role in the _admin realm.
type OnboardingCheckResponse struct {
	NeedsSysAdmin bool `json:"needs_sysadmin"` // true if no sysadmin exists
	NeedsRealm    bool `json:"needs_realm"`    // true if no realms exist (excluding _admin)
	NeedsOnboarding bool `json:"needs_onboarding"` // true if either is needed
}

// CreateAdminRequest is the request body for POST /ui/onboarding/create-admin.
// Fields are conditionally required based on what's being created.
type CreateAdminRequest struct {
	Username      string `json:"username"`       // Required if creating sysadmin
	RealmName     string `json:"realm_name"`     // Required if creating realm
	CreateSysAdmin bool   `json:"create_sysadmin"` // Whether to create a sysadmin account
	CreateRealm    bool   `json:"create_realm"`    // Whether to create an initial realm
}

// CreateAdminResponse is the response for POST /ui/onboarding/create-admin.
// Fields are populated based on what was created.
type CreateAdminResponse struct {
	AccountID string `json:"account_id,omitempty"` // Set if sysadmin was created
	PAT       string `json:"pat,omitempty"`       // Set if sysadmin was created
	RealmID   string `json:"realm_id,omitempty"`  // Set if realm was created
}

// RegisterSessionAPIRoutes registers the session API routes for the Vike/React UI.
func RegisterSessionAPIRoutes(mux *http.ServeMux, cfg *RouteConfig) {
	mux.HandleFunc("POST /api/ui/login", handleUILogin(cfg))
	mux.HandleFunc("POST /api/ui/logout", handleUILogout(cfg))
	mux.HandleFunc("GET /api/ui/session", handleUISession(cfg))
	mux.HandleFunc("GET /api/ui/check-onboarding", handleCheckOnboarding(cfg))
	mux.HandleFunc("POST /api/ui/onboarding/create-admin", handleCreateAdmin(cfg))
}

func handleUILogin(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}

		// Validate PAT is not empty
		pat := strings.TrimSpace(req.PAT)
		if pat == "" {
			writeError(w, http.StatusBadRequest, "PAT is required")
			return
		}

		// Validate PAT
		entry, patID, err := ValidatePAT(r.Context(), cfg.ProjectionStore, pat)
		if err != nil {
			if errors.Is(err, ErrInvalidToken) || errors.Is(err, ErrPATRevoked) {
				writeError(w, http.StatusUnauthorized, "invalid or revoked PAT")
				return
			}
			if errors.Is(err, ErrAccountSuspended) {
				writeError(w, http.StatusUnauthorized, "account suspended")
				return
			}
			writeError(w, http.StatusUnauthorized, "authentication failed")
			return
		}

		sessionTTL := getSessionTTL(cfg.AuthConfig, req.RememberMe)

		// Generate JWT
		token, err := GenerateJWTWithExpiry(cfg.AuthConfig, entry.AccountID, patID, sessionTTL)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create session")
			return
		}

		// Set auth cookie with path /ui for Vike UI
		setUIAuthCookie(w, cfg.AuthConfig, token, sessionTTL)

		// Return session info
		// Check if sysadmin
		isSysAdmin := false
		if role, ok := entry.Roles["_admin"]; ok {
			isSysAdmin = role == "admin" || role == "owner"
		}

		// Get realm names
		realmNames := getRealmNames(r.Context(), cfg.ProjectionStore, entry.Realms)

		// Return session info
		resp := LoginResponse{
			AccountID:  entry.AccountID,
			Username:   entry.Username,
			Realms:     entry.Realms,
			Roles:      entry.Roles,
			IsSysAdmin: isSysAdmin,
			RealmNames: realmNames,
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			log.Printf("handleUISession: failed to encode response: %v", err)
		}
	}
}

func handleUILogout(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		clearUIAuthCookie(w, cfg.AuthConfig)
		w.WriteHeader(http.StatusOK)
	}
}

// getRealmNames fetches realm names for the given realm IDs.
func getRealmNames(ctx context.Context, projectionStore core.ProjectionStore, realmIDs []string) map[string]string {
	names := make(map[string]string)
	for _, realmID := range realmIDs {
		if realmID == "_admin" {
			names[realmID] = "System Admin"
			continue
		}
		var realm struct {
			Name string `json:"name"`
		}
		if err := projectionStore.Get(ctx, "_admin", "realm_list", realmID, &realm); err == nil {
			names[realmID] = realm.Name
		} else {
			names[realmID] = realmID // Fallback to ID
		}
	}
	return names
}

func handleUISession(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get session cookie
		cookie, err := r.Cookie(cfg.AuthConfig.CookieName)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		// Validate JWT
		claims, err := ValidateJWT(cfg.AuthConfig, cookie.Value)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		// Check PAT status
		entry, err := CheckPATStatus(r.Context(), cfg.ProjectionStore, claims.PATID)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}

		// Check if sysadmin
		isSysAdmin := false
		if role, ok := entry.Roles["_admin"]; ok {
			isSysAdmin = role == "admin" || role == "owner"
		}

		// Get realm names
		realmNames := getRealmNames(r.Context(), cfg.ProjectionStore, entry.Realms)

		// Return session info
		resp := SessionInfo{
			AccountID:  entry.AccountID,
			Username:   entry.Username,
			Realms:     entry.Realms,
			Roles:      entry.Roles,
			IsSysAdmin: isSysAdmin,
			RealmNames: realmNames,
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			log.Printf("handleUISession: failed to encode response: %v", err)
		}
	}
}

func handleCheckOnboarding(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		needsSysAdmin := true
		needsRealm := true

		if cfg.ProjectionStore != nil {
			// Check if any sysadmin exists (account with admin/owner role in _admin realm)
			rawAccounts, err := cfg.ProjectionStore.List(r.Context(), "_admin", "account_list")
			if err == nil {
				for _, raw := range rawAccounts {
					var account struct {
						Roles map[string]string `json:"roles"`
					}
					if err := json.Unmarshal(raw, &account); err != nil {
						continue
					}
					if account.Roles["_admin"] == "admin" || account.Roles["_admin"] == "owner" {
						needsSysAdmin = false
						break
					}
				}
			}

			// Check if any realms exist (excluding _admin)
			rawRealms, err := cfg.ProjectionStore.List(r.Context(), "_admin", "realm_list")
			if err == nil {
				for _, raw := range rawRealms {
					var realm struct {
						RealmID string `json:"realm_id"`
					}
					if err := json.Unmarshal(raw, &realm); err != nil {
						continue
					}
					if realm.RealmID != "_admin" {
						needsRealm = false
						break
					}
				}
			}
		}

		resp := OnboardingCheckResponse{
			NeedsSysAdmin:  needsSysAdmin,
			NeedsRealm:     needsRealm,
			NeedsOnboarding: needsSysAdmin || needsRealm,
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			log.Printf("handleCheckOnboarding: failed to encode response: %v", err)
		}
	}
}

func handleCreateAdmin(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Determine what's actually needed
		needsSysAdmin := true
		needsRealm := true

		if cfg.ProjectionStore != nil {
			// Check if any sysadmin exists
			rawAccounts, err := cfg.ProjectionStore.List(r.Context(), "_admin", "account_list")
			if err == nil {
				for _, raw := range rawAccounts {
					var account struct {
						Roles map[string]string `json:"roles"`
					}
					if err := json.Unmarshal(raw, &account); err != nil {
						continue
					}
					if account.Roles["_admin"] == "admin" || account.Roles["_admin"] == "owner" {
						needsSysAdmin = false
						break
					}
				}
			}

			// Check if any realms exist (excluding _admin)
			rawRealms, err := cfg.ProjectionStore.List(r.Context(), "_admin", "realm_list")
			if err == nil {
				for _, raw := range rawRealms {
					var realm struct {
						RealmID string `json:"realm_id"`
					}
					if err := json.Unmarshal(raw, &realm); err != nil {
						continue
					}
					if realm.RealmID != "_admin" {
						needsRealm = false
						break
					}
				}
			}
		}

		// Parse request
		var req CreateAdminRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}

		// Validate request against what's actually needed
		if req.CreateSysAdmin && !needsSysAdmin {
			writeError(w, http.StatusBadRequest, "sysadmin already exists")
			return
		}
		if req.CreateRealm && !needsRealm {
			writeError(w, http.StatusBadRequest, "realm already exists")
			return
		}
		if !req.CreateSysAdmin && !req.CreateRealm {
			writeError(w, http.StatusBadRequest, "must specify at least one of create_sysadmin or create_realm")
			return
		}
		if req.CreateSysAdmin && strings.TrimSpace(req.Username) == "" {
			writeError(w, http.StatusBadRequest, "username is required when creating sysadmin")
			return
		}
		if req.CreateRealm && strings.TrimSpace(req.RealmName) == "" {
			writeError(w, http.StatusBadRequest, "realm_name is required when creating realm")
			return
		}

		var resp CreateAdminResponse

		// Conditionally create realm
		if req.CreateRealm {
			realmResult, err := domain.HandleCreateRealm(r.Context(), domain.CreateRealm{
				Name: strings.TrimSpace(req.RealmName),
			}, cfg.EventStore)
			if err != nil {
				handleDomainError(w, err)
				return
			}
			resp.RealmID = realmResult.RealmID
		}

		// Conditionally create sysadmin
		if req.CreateSysAdmin {
			result, err := domain.HandleCreateAccount(r.Context(), domain.CreateAccount{
				Username: strings.TrimSpace(req.Username),
			}, cfg.EventStore, cfg.ProjectionStore)
			if err != nil {
				handleDomainError(w, err)
				return
			}

			// Grant admin role in _admin realm
			err = domain.HandleAssignRole(r.Context(), domain.AssignRole{
				AccountID: result.AccountID,
				RealmID:   "_admin",
				Role:      "admin",
			}, cfg.EventStore)
			if err != nil {
				handleDomainError(w, err)
				return
			}

			// Grant owner role in the realm if we created one
			if resp.RealmID != "" {
				err = domain.HandleAssignRole(r.Context(), domain.AssignRole{
					AccountID: result.AccountID,
					RealmID:   resp.RealmID,
					Role:      "owner",
				}, cfg.EventStore)
				if err != nil {
					handleDomainError(w, err)
					return
				}
			}

			resp.AccountID = result.AccountID
			resp.PAT = result.RawToken
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			log.Printf("handleCreateAdmin: failed to encode response: %v", err)
		}
	}
}

// setUIAuthCookie sets the authentication cookie for the UI.
func setUIAuthCookie(w http.ResponseWriter, cfg *AuthConfig, token string, sessionTTL time.Duration) {
	http.SetCookie(w, &http.Cookie{
		Name:     cfg.CookieName,
		Value:    token,
		Path:     "/",
		MaxAge:   int(sessionTTL.Seconds()),
		HttpOnly: true,
		Secure:   cfg.CookieSecure,
		SameSite: cfg.CookieSameSite,
	})
}

// clearUIAuthCookie clears the authentication cookie.
func clearUIAuthCookie(w http.ResponseWriter, cfg *AuthConfig) {
	http.SetCookie(w, &http.Cookie{
		Name:     cfg.CookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   cfg.CookieSecure,
		SameSite: cfg.CookieSameSite,
	})
}
