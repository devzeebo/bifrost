package admin

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"

	"github.com/devzeebo/bifrost/domain"
	"github.com/devzeebo/bifrost/domain/projectors"
)

// AccountListEntry is the JSON response for an account in the list.
type AccountListEntry struct {
	AccountID string            `json:"account_id"`
	Username  string            `json:"username"`
	Status    string            `json:"status"`
	Realms    []string          `json:"realms"`
	Roles     map[string]string `json:"roles"`
	PATCount  int               `json:"pat_count"`
	CreatedAt string            `json:"created_at"`
}

// AccountDetail is the JSON response for a single account.
type AccountDetail struct {
	AccountID string            `json:"account_id"`
	Username  string            `json:"username"`
	Status    string            `json:"status"`
	Roles     map[string]string `json:"roles"`
}

// CreateAccountRequest is the request body for POST /create-account.
type CreateAccountRequest struct {
	Username string `json:"username"`
}

// CreateAccountResponse is the response for POST /create-account.
type CreateAccountResponse struct {
	AccountID string `json:"account_id"`
	PAT       string `json:"pat"`
}

// SuspendAccountRequest is the request body for POST /suspend-account.
type SuspendAccountRequest struct {
	ID      string `json:"id"`
	Suspend bool   `json:"suspend"`
}

// GrantRealmRequest is the request body for POST /grant-realm.
type GrantRealmRequest struct {
	AccountID string `json:"account_id"`
	RealmID   string `json:"realm_id"`
	Role      string `json:"role"`
}

// RevokeRealmRequest is the request body for POST /revoke-realm.
type RevokeRealmRequest struct {
	AccountID string `json:"account_id"`
	RealmID   string `json:"realm_id"`
}

// CreatePatRequest is the request body for POST /create-pat.
type CreatePatRequest struct {
	AccountID string `json:"account_id"`
}

// CreatePatResponse is the response for POST /create-pat.
type CreatePatResponse struct {
	PAT string `json:"pat"`
}

// RevokePatRequest is the request body for POST /revoke-pat.
type RevokePatRequest struct {
	AccountID string `json:"account_id"`
	PatID     string `json:"pat_id"`
}

// PatEntry is the JSON response for a PAT in the list.
type PatEntry struct {
	ID        string `json:"id"`
	CreatedAt string `json:"created_at"`
	LastUsed  string `json:"last_used,omitempty"`
}

// RegisterAccountsAPIRoutes registers the accounts JSON API routes for the Vike/React UI.
func RegisterAccountsAPIRoutes(mux *http.ServeMux, cfg *RouteConfig) {
	authMiddleware := AuthMiddleware(cfg.AuthConfig, cfg.ProjectionStore)
	requireAdmin := RequireAdminMiddleware()

	// Account list and detail
	mux.Handle("GET /api/accounts", authMiddleware(requireAdmin(http.HandlerFunc(handleGetAccounts(cfg)))))
	mux.Handle("GET /api/account", authMiddleware(requireAdmin(http.HandlerFunc(handleGetAccount(cfg)))))

	// Account management
	mux.Handle("POST /api/create-account", authMiddleware(requireAdmin(http.HandlerFunc(handleCreateAccount(cfg)))))
	mux.Handle("POST /api/suspend-account", authMiddleware(requireAdmin(http.HandlerFunc(handleSuspendAccount(cfg)))))

	// Realm access management
	mux.Handle("POST /api/grant-realm", authMiddleware(requireAdmin(http.HandlerFunc(handleGrantRealm(cfg)))))
	mux.Handle("POST /api/revoke-realm", authMiddleware(requireAdmin(http.HandlerFunc(handleRevokeRealm(cfg)))))

	// PAT management
	mux.Handle("POST /api/create-pat", authMiddleware(requireAdmin(http.HandlerFunc(handleCreatePat(cfg)))))
	mux.Handle("POST /api/revoke-pat", authMiddleware(requireAdmin(http.HandlerFunc(handleRevokePat(cfg)))))
	mux.Handle("GET /api/pats", authMiddleware(requireAdmin(http.HandlerFunc(handleGetPats(cfg)))))
}

func handleGetAccounts(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get all accounts from projection
		var accounts []AccountListEntry
		if cfg.ProjectionStore != nil {
			rawAccounts, err := cfg.ProjectionStore.List(r.Context(), domain.AdminRealmID, "account_list")
			if err != nil {
				log.Printf("handleGetAccounts: failed to list accounts: %v", err)
				http.Error(w, "failed to list accounts", http.StatusInternalServerError)
				return
			}
			accounts = make([]AccountListEntry, 0, len(rawAccounts))
			for _, raw := range rawAccounts {
				var account projectors.AccountListEntry
				if err := json.Unmarshal(raw, &account); err != nil {
					continue
				}
				accounts = append(accounts, AccountListEntry{
					AccountID: account.AccountID,
					Username:  account.Username,
					Status:    account.Status,
					Realms:    account.Realms,
					Roles:     account.Roles,
					PATCount:  account.PATCount,
					CreatedAt: account.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
				})
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(accounts)
	}
}

func handleGetAccount(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		accountID := r.URL.Query().Get("id")
		if accountID == "" {
			http.Error(w, "id parameter required", http.StatusBadRequest)
			return
		}

		// Get account from projection
		var account projectors.AccountListEntry
		if cfg.ProjectionStore != nil {
			err := cfg.ProjectionStore.Get(r.Context(), domain.AdminRealmID, "account_list", accountID, &account)
			if err != nil {
				http.Error(w, "account not found", http.StatusNotFound)
				return
			}
		}

		detail := AccountDetail{
			AccountID: account.AccountID,
			Username:  account.Username,
			Status:    account.Status,
			Roles:     account.Roles,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(detail)
	}
}

func handleCreateAccount(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreateAccountRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		username := strings.TrimSpace(req.Username)
		if username == "" {
			http.Error(w, "username is required", http.StatusBadRequest)
			return
		}

		// Create account via domain command
		result, err := domain.HandleCreateAccount(r.Context(), domain.CreateAccount{
			Username: username,
		}, cfg.EventStore, cfg.ProjectionStore)
		if err != nil {
			if strings.Contains(err.Error(), "already exists") {
				http.Error(w, "username already exists", http.StatusConflict)
				return
			}
			log.Printf("handleCreateAccount: failed to create account: %v", err)
			http.Error(w, "failed to create account", http.StatusInternalServerError)
			return
		}

		resp := CreateAccountResponse{
			AccountID: result.AccountID,
			PAT:       result.RawToken,
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(resp)
	}
}

func handleSuspendAccount(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req SuspendAccountRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if req.ID == "" {
			http.Error(w, "id is required", http.StatusBadRequest)
			return
		}

		// Suspend/unsuspend account via domain command
		var reason string
		if req.Suspend {
			reason = "suspended via admin UI"
		} else {
			reason = "unsuspended via admin UI"
		}

		err := domain.HandleSuspendAccount(r.Context(), domain.SuspendAccount{
			AccountID: req.ID,
			Reason:    reason,
		}, cfg.EventStore)
		if err != nil {
			log.Printf("handleSuspendAccount: failed: %v", err)
			http.Error(w, "failed to suspend account", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleGrantRealm(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req GrantRealmRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if req.AccountID == "" || req.RealmID == "" || req.Role == "" {
			http.Error(w, "account_id, realm_id, and role are required", http.StatusBadRequest)
			return
		}

		// Grant role via domain command
		err := domain.HandleAssignRole(r.Context(), domain.AssignRole{
			AccountID: req.AccountID,
			RealmID:   req.RealmID,
			Role:      req.Role,
		}, cfg.EventStore)
		if err != nil {
			log.Printf("handleGrantRealm: failed: %v", err)
			http.Error(w, "failed to grant realm access", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleRevokeRealm(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req RevokeRealmRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if req.AccountID == "" || req.RealmID == "" {
			http.Error(w, "account_id and realm_id are required", http.StatusBadRequest)
			return
		}

		// Revoke role via domain command
		err := domain.HandleRevokeRole(r.Context(), domain.RevokeRole{
			AccountID: req.AccountID,
			RealmID:   req.RealmID,
		}, cfg.EventStore)
		if err != nil {
			log.Printf("handleRevokeRealm: failed: %v", err)
			http.Error(w, "failed to revoke realm access", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleCreatePat(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreatePatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if req.AccountID == "" {
			http.Error(w, "account_id is required", http.StatusBadRequest)
			return
		}

		// Create PAT via domain command
		result, err := domain.HandleCreatePAT(r.Context(), domain.CreatePAT{
			AccountID: req.AccountID,
		}, cfg.EventStore)
		if err != nil {
			log.Printf("handleCreatePat: failed: %v", err)
			http.Error(w, "failed to create PAT", http.StatusInternalServerError)
			return
		}

		resp := CreatePatResponse{
			PAT: result.RawToken,
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(resp)
	}
}

func handleRevokePat(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req RevokePatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid JSON", http.StatusBadRequest)
			return
		}

		if req.AccountID == "" || req.PatID == "" {
			http.Error(w, "account_id and pat_id are required", http.StatusBadRequest)
			return
		}

		// Revoke PAT via domain command
		err := domain.HandleRevokePAT(r.Context(), domain.RevokePAT{
			AccountID: req.AccountID,
			PATID:     req.PatID,
		}, cfg.EventStore)
		if err != nil {
			log.Printf("handleRevokePat: failed: %v", err)
			http.Error(w, "failed to revoke PAT", http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleGetPats(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		accountID := r.URL.Query().Get("account_id")
		if accountID == "" {
			http.Error(w, "account_id parameter required", http.StatusBadRequest)
			return
		}

		// Get account to check it exists and get PAT count
		var account projectors.AccountListEntry
		if cfg.ProjectionStore != nil {
			err := cfg.ProjectionStore.Get(r.Context(), domain.AdminRealmID, "account_list", accountID, &account)
			if err != nil {
				http.Error(w, "account not found", http.StatusNotFound)
				return
			}
		}

		// Get PAT key hashes for this account
		var keyHashes []string
		if cfg.ProjectionStore != nil {
			err := cfg.ProjectionStore.Get(r.Context(), domain.AdminRealmID, "account_lookup", "account:"+accountID, &keyHashes)
			if err != nil {
				// No PATs yet, return empty list
				keyHashes = []string{}
			}
		}

		// Build PAT list from key hashes
		pats := make([]PatEntry, 0, len(keyHashes))
		for _, keyHash := range keyHashes {
			// Look up PAT ID from key hash
			var patID string
			if err := cfg.ProjectionStore.Get(r.Context(), domain.AdminRealmID, "account_lookup", "keyhash_pat:"+keyHash, &patID); err != nil {
				continue
			}
			pats = append(pats, PatEntry{
				ID: patID,
			})
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(pats)
	}
}
