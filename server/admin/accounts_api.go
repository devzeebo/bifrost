package admin

import (
	"context"
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
	Realms    []string          `json:"realms"`
	Roles     map[string]string `json:"roles"`
	PATCount  int               `json:"pat_count"`
	CreatedAt string            `json:"created_at"`
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
	Label     string `json:"label"`
}

// CreatePatResponse is the response for POST /create-pat.
type CreatePatResponse struct {
	PAT   string `json:"pat"`
	PATID string `json:"pat_id"`
}

// RevokePatRequest is the request body for POST /revoke-pat.
type RevokePatRequest struct {
	AccountID string `json:"account_id"`
	PatID     string `json:"pat_id"`
}

// PatEntry is the JSON response for a PAT in the list.
type PatEntry struct {
	ID           string `json:"id"`
	Label        string `json:"label,omitempty"`
	TokenPreview string `json:"token_preview,omitempty"`
	CreatedAt    string `json:"created_at"`
	LastUsed     string `json:"last_used,omitempty"`
}


// RegisterAccountsAPIRoutes registers the accounts JSON API routes for the Vike/React UI.
func RegisterAccountsAPIRoutes(mux *http.ServeMux, cfg *RouteConfig) {
	authMiddleware := AuthMiddleware(cfg.AuthConfig, cfg.ProjectionStore)
	requireAdmin := RequireAdminMiddleware()

	// Account list and detail
	mux.Handle("GET /api/accounts", authMiddleware(requireAdmin(http.HandlerFunc(handleGetAccounts(cfg)))))
	mux.Handle("GET /api/account", authMiddleware(http.HandlerFunc(handleGetAccount(cfg))))

	// Account management
	mux.Handle("POST /api/create-account", authMiddleware(requireAdmin(http.HandlerFunc(handleCreateAccount(cfg)))))
	mux.Handle("POST /api/suspend-account", authMiddleware(requireAdmin(http.HandlerFunc(handleSuspendAccount(cfg)))))

	// Realm access management
	mux.Handle("POST /api/grant-realm", authMiddleware(requireAdmin(http.HandlerFunc(handleGrantRealm(cfg)))))
	mux.Handle("POST /api/revoke-realm", authMiddleware(requireAdmin(http.HandlerFunc(handleRevokeRealm(cfg)))))

	// PAT management
	mux.Handle("POST /api/create-pat", authMiddleware(http.HandlerFunc(handleCreatePat(cfg))))
	mux.Handle("POST /api/revoke-pat", authMiddleware(http.HandlerFunc(handleRevokePat(cfg))))
	mux.Handle("GET /api/pats", authMiddleware(http.HandlerFunc(handleGetPats(cfg))))
}

func canManageAccount(ctx context.Context, targetAccountID string) bool {
	if targetAccountID == "" {
		return false
	}

	if requesterAccountID, ok := AccountIDFromContext(ctx); ok && requesterAccountID == targetAccountID {
		return true
	}

	roles, ok := RolesFromContext(ctx)
	return ok && isAdmin(roles)
}

func handleGetAccounts(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Get all accounts from projection
		var accounts []AccountListEntry
		if cfg.ProjectionStore != nil {
			rawAccounts, err := cfg.ProjectionStore.List(r.Context(), domain.AdminRealmID, "account_directory")
			if err != nil {
				log.Printf("handleGetAccounts: failed to list accounts: %v", err)
				writeError(w, http.StatusInternalServerError, "failed to list accounts")
				return
			}
			accounts = make([]AccountListEntry, 0, len(rawAccounts))
			for _, raw := range rawAccounts {
				var account projectors.AccountDirectoryEntry
				if err := json.Unmarshal(raw, &account); err != nil {
					continue
				}
				accounts = append(accounts, AccountListEntry{
					AccountID: account.AccountID,
					Username:  account.Username,
					Status:    account.Status,
					Realms:    account.Realms,
					Roles:     account.Roles,
					PATCount:  account.PATCount(),
					CreatedAt: account.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
				})
			}
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(accounts); err != nil {
			log.Printf("handleGetAccounts: failed to encode response: %v", err)
		}
	}
}

func handleGetAccount(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		accountID := r.URL.Query().Get("id")
		if accountID == "" {
			writeError(w, http.StatusBadRequest, "id parameter required")
			return
		}

		if !canManageAccount(r.Context(), accountID) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		// Get account from projection
		var account projectors.AccountDirectoryEntry
		if cfg.ProjectionStore != nil {
			err := cfg.ProjectionStore.Get(r.Context(), domain.AdminRealmID, "account_directory", accountID, &account)
			if err != nil {
				writeError(w, http.StatusNotFound, "account not found")
				return
			}
		}

		detail := AccountDetail{
			AccountID: account.AccountID,
			Username:  account.Username,
			Status:    account.Status,
			Realms:    account.Realms,
			Roles:     account.Roles,
			PATCount:  account.PATCount(),
			CreatedAt: account.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(detail); err != nil {
			log.Printf("handleGetAccount: failed to encode response: %v", err)
		}
	}
}

func handleCreateAccount(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreateAccountRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}

		username := strings.TrimSpace(req.Username)
		if username == "" {
			writeError(w, http.StatusBadRequest, "username is required")
			return
		}

		// Create account via domain command
		result, err := domain.HandleCreateAccount(r.Context(), domain.CreateAccount{
			Username: username,
		}, cfg.EventStore, cfg.ProjectionStore)
		if err != nil {
			if strings.Contains(err.Error(), "already exists") {
				writeError(w, http.StatusConflict, "username already exists")
				return
			}
			log.Printf("handleCreateAccount: failed to create account: %v", err)
			handleDomainError(w, err)
			return
		}

		resp := CreateAccountResponse{
			AccountID: result.AccountID,
			PAT:       result.RawToken,
		}


		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			log.Printf("handleCreateAccount: failed to encode response: %v", err)
		}
	}
}

func handleSuspendAccount(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req SuspendAccountRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}

		if req.ID == "" {
			writeError(w, http.StatusBadRequest, "id is required")
			return
		}

		if !canManageAccount(r.Context(), req.ID) {
			writeError(w, http.StatusForbidden, "forbidden")
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
			handleDomainError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleGrantRealm(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req GrantRealmRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}

		if req.AccountID == "" || req.RealmID == "" || req.Role == "" {
			writeError(w, http.StatusBadRequest, "account_id, realm_id, and role are required")
			return
		}

		// Grant role via domain command
		err := domain.HandleAssignRole(r.Context(), domain.AssignRole{
			AccountID: req.AccountID,
			RealmID:   req.RealmID,
			Role:      req.Role,
		}, cfg.EventStore, cfg.ProjectionStore)
		if err != nil {
			log.Printf("handleGrantRealm: failed: %v", err)
			handleDomainError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleRevokeRealm(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req RevokeRealmRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}

		if req.AccountID == "" || req.RealmID == "" {
			writeError(w, http.StatusBadRequest, "account_id and realm_id are required")
			return
		}

		// Revoke role via domain command
		err := domain.HandleRevokeRole(r.Context(), domain.RevokeRole{
			AccountID: req.AccountID,
			RealmID:   req.RealmID,
		}, cfg.EventStore)
		if err != nil {
			log.Printf("handleRevokeRealm: failed: %v", err)
			handleDomainError(w, err)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

func handleCreatePat(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req CreatePatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}

		if req.AccountID == "" {
			writeError(w, http.StatusBadRequest, "account_id is required")
			return
		}

		if !canManageAccount(r.Context(), req.AccountID) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		label := strings.TrimSpace(req.Label)
		if label == "" {
			label = "PAT"
		}

		// Create PAT via domain command
		result, err := domain.HandleCreatePAT(r.Context(), domain.CreatePAT{
			AccountID: req.AccountID,
			Label:     label,
		}, cfg.EventStore)
		if err != nil {
			log.Printf("handleCreatePat: failed: %v", err)
			handleDomainError(w, err)
			return
		}

		resp := CreatePatResponse{
			PAT:   result.RawToken,
			PATID: result.PATID,
		}


		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		if err := json.NewEncoder(w).Encode(resp); err != nil {
			log.Printf("handleCreatePat: failed to encode response: %v", err)
		}
	}
}

func handleRevokePat(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req RevokePatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid JSON")
			return
		}

		if req.AccountID == "" || req.PatID == "" {
			writeError(w, http.StatusBadRequest, "account_id and pat_id are required")
			return
		}

		if !canManageAccount(r.Context(), req.AccountID) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		// Get account from account_directory to check PAT count
		var account projectors.AccountDirectoryEntry
		if cfg.ProjectionStore != nil {
			err := cfg.ProjectionStore.Get(r.Context(), domain.AdminRealmID, "account_directory", req.AccountID, &account)
			if err != nil {
				writeError(w, http.StatusNotFound, "account not found")
				return
			}
		}

		if len(account.PATs) <= 1 {
			writeError(w, http.StatusBadRequest, "cannot revoke the last PAT")
			return
		}

		// Revoke PAT via domain command
		err := domain.HandleRevokePAT(r.Context(), domain.RevokePAT{
			AccountID: req.AccountID,
			PATID:     req.PatID,
		}, cfg.EventStore)
		if err != nil {
			log.Printf("handleRevokePat: failed: %v", err)
			handleDomainError(w, err)
			return
		}


		w.WriteHeader(http.StatusNoContent)
	}
}

func handleGetPats(cfg *RouteConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		accountID := r.URL.Query().Get("account_id")
		if accountID == "" {
			writeError(w, http.StatusBadRequest, "account_id parameter required")
			return
		}

		if !canManageAccount(r.Context(), accountID) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		// Get account from account_directory projection
		var account projectors.AccountDirectoryEntry
		if cfg.ProjectionStore != nil {
			err := cfg.ProjectionStore.Get(r.Context(), domain.AdminRealmID, "account_directory", accountID, &account)
			if err != nil {
				writeError(w, http.StatusNotFound, "account not found")
				return
			}
		}

		// Build PAT list from account_directory.pats array
		pats := make([]PatEntry, 0, len(account.PATs))
		for _, pat := range account.PATs {
			pats = append(pats, PatEntry{
				ID:           pat.PATID,
				Label:        pat.Label,
				TokenPreview: "",
				CreatedAt:    pat.CreatedAt.Format("2006-01-02T15:04:05.000Z"),
			})
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(pats); err != nil {
			log.Printf("handleGetPats: failed to encode response: %v", err)
		}
	}
}
