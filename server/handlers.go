package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
	"github.com/devzeebo/bifrost/domain/projectors"
)

// ProjectionEngine is the interface for running sync projections.
type ProjectionEngine interface {
	RunSync(ctx context.Context, events []core.Event) error
	RunCatchUpOnce(ctx context.Context)
}

// Handlers holds dependencies for HTTP route handlers.
type Handlers struct {
	eventStore      core.EventStore
	projectionStore core.ProjectionStore
	engine          ProjectionEngine
	mux             *http.ServeMux
}

// NewHandlers creates a new Handlers instance with the given dependencies.
func NewHandlers(eventStore core.EventStore, projectionStore core.ProjectionStore, engine ProjectionEngine) *Handlers {
	h := &Handlers{
		eventStore:      eventStore,
		projectionStore: projectionStore,
		engine:          engine,
		mux:             http.NewServeMux(),
	}
	h.mux.HandleFunc("GET /health", h.Health)
	h.mux.HandleFunc("POST /create-rune", h.CreateRune)
	h.mux.HandleFunc("POST /update-rune", h.UpdateRune)
	h.mux.HandleFunc("POST /claim-rune", h.ClaimRune)
	h.mux.HandleFunc("POST /unclaim-rune", h.UnclaimRune)
	h.mux.HandleFunc("POST /fulfill-rune", h.FulfillRune)
	h.mux.HandleFunc("POST /seal-rune", h.SealRune)
	h.mux.HandleFunc("POST /forge-rune", h.ForgeRune)
	h.mux.HandleFunc("POST /add-dependency", h.AddDependency)
	h.mux.HandleFunc("POST /remove-dependency", h.RemoveDependency)
	h.mux.HandleFunc("POST /add-note", h.AddNote)
	h.mux.HandleFunc("POST /shatter-rune", h.ShatterRune)
	h.mux.HandleFunc("POST /sweep-runes", h.SweepRunes)
	h.mux.HandleFunc("GET /runes", h.ListRunes)
	h.mux.HandleFunc("GET /rune", h.GetRune)
	h.mux.HandleFunc("POST /create-realm", h.CreateRealm)
	h.mux.HandleFunc("POST /suspend-realm", h.SuspendRealm)
	h.mux.HandleFunc("GET /realms", h.ListRealms)
	h.mux.HandleFunc("GET /realm", h.GetRealm)
	h.mux.HandleFunc("POST /assign-role", h.AssignRole)
	h.mux.HandleFunc("POST /revoke-role", h.RevokeRole)
	return h
}

// ServeHTTP delegates to the internal mux.
func (h *Handlers) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mux.ServeHTTP(w, r)
}

// RegisterRoutes registers all handler routes on the given mux with middleware.
func (h *Handlers) RegisterRoutes(mux *http.ServeMux, realmMiddleware, adminMiddleware func(http.Handler) http.Handler) {
	// Compose role-based middleware chains for realm endpoints (non-_admin realms)
	viewerAuth := func(next http.Handler) http.Handler {
		return realmMiddleware(RequireRole("viewer")(next))
	}
	memberAuth := func(next http.Handler) http.Handler {
		return realmMiddleware(RequireRole("member")(next))
	}
	adminRealmAuth := func(next http.Handler) http.Handler {
		return realmMiddleware(RequireRole("admin")(next))
	}

	// Admin endpoints use adminMiddleware (allows _admin realm) with role check
	adminAuth := func(next http.Handler) http.Handler {
		return adminMiddleware(RequireRole("admin")(next))
	}

	// Health check — no auth
	mux.HandleFunc("GET /health", h.Health)

	// Rune commands (member role minimum)
	mux.Handle("POST /api/create-rune", memberAuth(http.HandlerFunc(h.CreateRune)))
	mux.Handle("POST /api/update-rune", memberAuth(http.HandlerFunc(h.UpdateRune)))
	mux.Handle("POST /api/claim-rune", memberAuth(http.HandlerFunc(h.ClaimRune)))
	mux.Handle("POST /api/unclaim-rune", memberAuth(http.HandlerFunc(h.UnclaimRune)))
	mux.Handle("POST /api/fulfill-rune", memberAuth(http.HandlerFunc(h.FulfillRune)))
	mux.Handle("POST /api/seal-rune", memberAuth(http.HandlerFunc(h.SealRune)))
	mux.Handle("POST /api/forge-rune", memberAuth(http.HandlerFunc(h.ForgeRune)))
	mux.Handle("POST /api/add-dependency", memberAuth(http.HandlerFunc(h.AddDependency)))
	mux.Handle("POST /api/remove-dependency", memberAuth(http.HandlerFunc(h.RemoveDependency)))
	mux.Handle("POST /api/add-note", memberAuth(http.HandlerFunc(h.AddNote)))
	mux.Handle("POST /api/shatter-rune", memberAuth(http.HandlerFunc(h.ShatterRune)))
	mux.Handle("POST /api/sweep-runes", memberAuth(http.HandlerFunc(h.SweepRunes)))

	// Rune queries (viewer role minimum)
	mux.Handle("GET /api/runes", viewerAuth(http.HandlerFunc(h.ListRunes)))
	mux.Handle("GET /api/rune", viewerAuth(http.HandlerFunc(h.GetRune)))

	// Role management (admin role minimum, realm auth)
	mux.Handle("POST /api/assign-role", adminRealmAuth(http.HandlerFunc(h.AssignRole)))
	mux.Handle("POST /api/revoke-role", adminRealmAuth(http.HandlerFunc(h.RevokeRole)))

	// Admin commands (admin auth — allows _admin realm with role check)
	mux.Handle("POST /api/create-realm", adminAuth(http.HandlerFunc(h.CreateRealm)))
	mux.Handle("POST /api/suspend-realm", adminMiddleware(http.HandlerFunc(h.SuspendRealm)))
	mux.Handle("GET /api/realms", adminAuth(http.HandlerFunc(h.ListRealms)))
	mux.Handle("GET /api/realm", viewerAuth(http.HandlerFunc(h.GetRealm)))
}

// --- Command Handlers ---

func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handlers) CreateRune(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	var cmd domain.CreateRune
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	result, err := domain.HandleCreateRune(r.Context(), realmID, cmd, h.eventStore, h.projectionStore)
	if err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	writeJSON(w, http.StatusCreated, result)
}

func (h *Handlers) UpdateRune(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	var cmd domain.UpdateRune
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := domain.HandleUpdateRune(r.Context(), realmID, cmd, h.eventStore); err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) ClaimRune(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	var cmd domain.ClaimRune
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := domain.HandleClaimRune(r.Context(), realmID, cmd, h.eventStore); err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) UnclaimRune(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	var cmd domain.UnclaimRune
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := domain.HandleUnclaimRune(r.Context(), realmID, cmd, h.eventStore); err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) FulfillRune(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	var cmd domain.FulfillRune
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := domain.HandleFulfillRune(r.Context(), realmID, cmd, h.eventStore); err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) SealRune(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	var cmd domain.SealRune
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := domain.HandleSealRune(r.Context(), realmID, cmd, h.eventStore); err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) ForgeRune(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	var cmd domain.ForgeRune
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := domain.HandleForgeRune(r.Context(), realmID, cmd, h.eventStore, h.projectionStore); err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) AddDependency(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	var cmd domain.AddDependency
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := domain.HandleAddDependency(r.Context(), realmID, cmd, h.eventStore, h.projectionStore); err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) RemoveDependency(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	var cmd domain.RemoveDependency
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := domain.HandleRemoveDependency(r.Context(), realmID, cmd, h.eventStore, h.projectionStore); err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) AssignRole(w http.ResponseWriter, r *http.Request) {
	_, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	var cmd domain.AssignRole
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Get caller's role in the target realm and check if they're a system admin
	callerRealmRole, _ := RoleFromContext(r.Context())
	accountID, _ := AccountIDFromContext(r.Context())
	isSysAdmin := false
	if accountID != "" {
		var accountEntry struct {
			Roles map[string]string `json:"roles"`
		}
		if err := h.projectionStore.Get(r.Context(), "_admin", "account_list", accountID, &accountEntry); err == nil {
			isSysAdmin = accountEntry.Roles["_admin"] == "admin" || accountEntry.Roles["_admin"] == "owner"
		}
	}

	// Role assignment rules:
	// - System admins can assign any role
	// - Realm owners can assign any role in their realm
	// - Realm admins can only assign member/viewer roles
	// - Members/viewers cannot assign roles at all
	if !isSysAdmin {
		// Must have at least admin role to assign roles
		if callerRealmRole != domain.RoleAdmin && callerRealmRole != domain.RoleOwner {
			writeError(w, http.StatusForbidden, "admin or owner role required to assign roles")
			return
		}
		if cmd.Role == domain.RoleOwner && callerRealmRole != domain.RoleOwner {
			writeError(w, http.StatusForbidden, "only owner can assign owner role")
			return
		}
		if cmd.Role == domain.RoleAdmin && callerRealmRole != domain.RoleOwner {
			writeError(w, http.StatusForbidden, "only owner can assign admin role")
			return
		}
	}

	if err := domain.HandleAssignRole(r.Context(), cmd, h.eventStore); err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) RevokeRole(w http.ResponseWriter, r *http.Request) {
	_, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	var cmd domain.RevokeRole
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// Look up target's current role
	callerRealmRole, _ := RoleFromContext(r.Context())
	targetRole, err := h.lookupAccountRole(r.Context(), cmd.AccountID, cmd.RealmID)
	if err != nil {
		handleDomainError(w, err)
		return
	}

	// Check if caller is a system admin
	accountID, _ := AccountIDFromContext(r.Context())
	isSysAdmin := false
	if accountID != "" {
		var accountEntry struct {
			Roles map[string]string `json:"roles"`
		}
		if err := h.projectionStore.Get(r.Context(), "_admin", "account_list", accountID, &accountEntry); err == nil {
			isSysAdmin = accountEntry.Roles["_admin"] == "admin" || accountEntry.Roles["_admin"] == "owner"
		}
	}

	// Role revocation rules:
	// - System admins can revoke any role
	// - Realm owners can revoke any role in their realm
	// - Realm admins can only revoke member/viewer roles
	// - Members/viewers cannot revoke roles at all
	if !isSysAdmin {
		// Must have at least admin role to revoke roles
		if callerRealmRole != domain.RoleAdmin && callerRealmRole != domain.RoleOwner {
			writeError(w, http.StatusForbidden, "admin or owner role required to revoke roles")
			return
		}
		if targetRole == domain.RoleOwner && callerRealmRole != domain.RoleOwner {
			writeError(w, http.StatusForbidden, "only owner can revoke owner role")
			return
		}
		if targetRole == domain.RoleAdmin && callerRealmRole != domain.RoleOwner {
			writeError(w, http.StatusForbidden, "only owner can revoke admin role")
			return
		}
	}

	if err := domain.HandleRevokeRole(r.Context(), cmd, h.eventStore); err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) lookupAccountRole(ctx context.Context, accountID, realmID string) (string, error) {
	streamID := "account-" + accountID
	events, err := h.eventStore.ReadStream(ctx, "_admin", streamID, 0)
	if err != nil {
		return "", err
	}
	state := domain.RebuildAccountState(events)
	if !state.Exists {
		return "", &core.NotFoundError{Entity: "account", ID: accountID}
	}
	return state.Realms[realmID], nil
}

func (h *Handlers) ShatterRune(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	var cmd domain.ShatterRune
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := domain.HandleShatterRune(r.Context(), realmID, cmd, h.eventStore); err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) SweepRunes(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	shattered, err := domain.HandleSweepRunes(r.Context(), realmID, h.eventStore, h.projectionStore)
	if err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	writeJSON(w, http.StatusOK, map[string][]string{"shattered": shattered})
}

func (h *Handlers) AddNote(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	var cmd domain.AddNote
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := domain.HandleAddNote(r.Context(), realmID, cmd, h.eventStore); err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) CreateRealm(w http.ResponseWriter, r *http.Request) {
	var cmd domain.CreateRealm
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	result, err := domain.HandleCreateRealm(r.Context(), cmd, h.eventStore)
	if err != nil {
		handleDomainError(w, err)
		return
	}

	if accountID, ok := AccountIDFromContext(r.Context()); ok && accountID != "" {
		err = domain.HandleAssignRole(r.Context(), domain.AssignRole{
			AccountID: accountID,
			RealmID:   result.RealmID,
			Role:      domain.RoleOwner,
		}, h.eventStore)
		if err != nil {
			handleDomainError(w, err)
			return
		}
	}

	h.runSyncQuietly(r)
	writeJSON(w, http.StatusCreated, map[string]string{
		"realm_id": result.RealmID,
	})
}

func (h *Handlers) SuspendRealm(w http.ResponseWriter, r *http.Request) {
	var cmd domain.SuspendRealm
	if err := json.NewDecoder(r.Body).Decode(&cmd); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if cmd.RealmID == "" {
		writeError(w, http.StatusBadRequest, "realm_id is required")
		return
	}

	if err := domain.HandleSuspendRealm(r.Context(), cmd, h.eventStore); err != nil {
		handleDomainError(w, err)
		return
	}
	h.runSyncQuietly(r)
	w.WriteHeader(http.StatusNoContent)
}

// --- Query Handlers ---

func (h *Handlers) ListRunes(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	runes, err := h.projectionStore.List(r.Context(), realmID, "projection_rune_summary")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list runes")
		return
	}
	allRunes := append([]json.RawMessage(nil), runes...)

	statusFilter := r.URL.Query().Get("status")
	priorityFilter := r.URL.Query().Get("priority")
	assigneeFilter := r.URL.Query().Get("assignee")
	branchFilter := r.URL.Query().Get("branch")
	sagaFilter := r.URL.Query().Get("saga")

	if statusFilter != "" || priorityFilter != "" || assigneeFilter != "" || branchFilter != "" || sagaFilter != "" {
		var filtered []json.RawMessage
		for _, raw := range runes {
			var item map[string]any
			if json.Unmarshal(raw, &item) != nil {
				continue
			}
			if statusFilter != "" {
				if fmt.Sprintf("%v", item["status"]) != statusFilter {
					continue
				}
			}
			if priorityFilter != "" {
				if fmt.Sprintf("%v", item["priority"]) != priorityFilter {
					continue
				}
			}
			if assigneeFilter != "" {
				if fmt.Sprintf("%v", item["assignee"]) != assigneeFilter {
					continue
				}
			}
			if branchFilter != "" {
				if fmt.Sprintf("%v", item["branch"]) != branchFilter {
					continue
				}
			}
			if sagaFilter != "" {
				if fmt.Sprintf("%v", item["parent_id"]) != sagaFilter {
					continue
				}
			}
			filtered = append(filtered, raw)
		}
		runes = filtered
	}

	blockedFilter := r.URL.Query().Get("blocked")
	if blockedFilter == "false" {
		var unblocked []json.RawMessage
		for _, raw := range runes {
			var item map[string]any
			if json.Unmarshal(raw, &item) != nil {
				continue
			}
			runeID := fmt.Sprintf("%v", item["id"])
			var detail projectors.RuneDetail
			err := h.projectionStore.Get(r.Context(), realmID, "rune_detail", runeID, &detail)
			if err != nil {
				if isNotFound(err) {
					unblocked = append(unblocked, raw)
					continue
				}
				continue
			}
			isBlocked := false
			for _, dep := range detail.Dependencies {
				if dep.Relationship == domain.RelBlockedBy {
					var summary projectors.RuneSummary
					err := h.projectionStore.Get(r.Context(), realmID, "projection_rune_summary", dep.TargetID, &summary)
					if err != nil {
						isBlocked = true
						break
					}
					if summary.Status != "fulfilled" {
						isBlocked = true
						break
					}
				}
			}
			if !isBlocked {
				unblocked = append(unblocked, raw)
			}
		}
		runes = unblocked
	}

	allStatuses := make(map[string]string)
	for _, raw := range allRunes {
		var item map[string]any
		if json.Unmarshal(raw, &item) != nil {
			continue
		}
		runeID := fmt.Sprintf("%v", item["id"])
		status := fmt.Sprintf("%v", item["status"])
		if runeID != "" {
			allStatuses[runeID] = status
		}
	}

	isActiveStatus := func(status string) bool {
		return status != "fulfilled" && status != "sealed" && status != ""
	}

	augmented := make([]map[string]any, 0, len(runes))
	for _, raw := range runes {
		var item map[string]any
		if json.Unmarshal(raw, &item) != nil {
			continue
		}

		runeID := fmt.Sprintf("%v", item["id"])
		if runeID == "" {
			augmented = append(augmented, item)
			continue
		}

		var graph projectors.GraphEntry
		depCount := 0
		dependentCount := 0
		if err := h.projectionStore.Get(r.Context(), realmID, "dependency_graph", runeID, &graph); err == nil {
			for _, dep := range graph.Dependencies {
				if isActiveStatus(allStatuses[dep.TargetID]) {
					depCount++
				}
			}
			for _, dependent := range graph.Dependents {
				if isActiveStatus(allStatuses[dependent.SourceID]) {
					dependentCount++
				}
			}
		}

		item["dependencies_count"] = depCount
		item["dependents_count"] = dependentCount
		claimant, _ := item["claimant"].(string)
		if claimant != "" {
			var accountInfo map[string]any
			lookupKey := "accountinfo:" + claimant
			if err := h.projectionStore.Get(r.Context(), domain.AdminRealmID, "account_lookup", lookupKey, &accountInfo); err == nil {
				if username, ok := accountInfo["username"].(string); ok && username != "" {
					item["claimant_username"] = username
				} else {
					item["claimant_username"] = claimant
				}
			} else {
				item["claimant_username"] = claimant
			}
		}
		augmented = append(augmented, item)
	}

	isSagaFilter := r.URL.Query().Get("is_saga")
	if isSagaFilter == "true" || isSagaFilter == "false" {
		wantSaga := isSagaFilter == "true"
		filtered := make([]map[string]any, 0, len(augmented))
		for _, item := range augmented {
			runeID := fmt.Sprintf("%v", item["id"])
			if runeID == "" {
				continue
			}
			var entry projectors.RuneChildCountEntry
			err := h.projectionStore.Get(r.Context(), realmID, "projection_rune_child_count", runeID, &entry)
			if err != nil {
				if isNotFound(err) {
					entry.Count = 0
				} else {
					continue
				}
			}
			isSaga := entry.Count > 0
			if isSaga == wantSaga {
				filtered = append(filtered, item)
			}
		}
		augmented = filtered
	}

	writeJSON(w, http.StatusOK, augmented)
}

func (h *Handlers) GetRune(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	runeID := r.URL.Query().Get("id")
	if runeID == "" {
		writeError(w, http.StatusBadRequest, "id query parameter is required")
		return
	}
	var detail any
	err := h.projectionStore.Get(r.Context(), realmID, "rune_detail", runeID, &detail)
	if err != nil {
		if isNotFound(err) {
			writeError(w, http.StatusNotFound, "rune not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to get rune")
		return
	}
	writeJSON(w, http.StatusOK, detail)
}

func (h *Handlers) ListRealms(w http.ResponseWriter, r *http.Request) {
	realms, err := h.projectionStore.List(r.Context(), "_admin", "realm_list")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list realms")
		return
	}

	// Filter realms based on user's access
	accountID, hasAccountID := AccountIDFromContext(r.Context())
	if hasAccountID && accountID != "" {
		var accountEntry struct {
			Roles map[string]string `json:"roles"`
		}
		if err := h.projectionStore.Get(r.Context(), "_admin", "account_list", accountID, &accountEntry); err == nil {
			// System admins (admin/owner in _admin realm) can see all realms
			isSysAdmin := accountEntry.Roles["_admin"] == "admin" || accountEntry.Roles["_admin"] == "owner"
			if !isSysAdmin {
				// Filter to only realms the user has access to
				var filteredRealms []json.RawMessage
				for _, raw := range realms {
					var realm struct {
						RealmID string `json:"realm_id"`
					}
					if err := json.Unmarshal(raw, &realm); err != nil {
						continue
					}
					if _, hasAccess := accountEntry.Roles[realm.RealmID]; hasAccess {
						filteredRealms = append(filteredRealms, raw)
					}
				}
				realms = filteredRealms
			}
		}
	}

	writeJSON(w, http.StatusOK, realms)
}

// RealmDetailResponse is the response structure for GET /realm
type RealmDetailResponse struct {
	RealmID   string        `json:"realm_id"`
	Name      string        `json:"name"`
	Status    string        `json:"status"`
	CreatedAt time.Time     `json:"created_at"`
	Members   []RealmMember `json:"members"`
}

// RealmMember represents a member of a realm
type RealmMember struct {
	AccountID string `json:"account_id"`
	Username  string `json:"username"`
	Role      string `json:"role"`
}

func (h *Handlers) GetRealm(w http.ResponseWriter, r *http.Request) {
	realmID := r.URL.Query().Get("id")
	if realmID == "" {
		writeError(w, http.StatusBadRequest, "id parameter required")
		return
	}

	// Check if user has access to this realm
	accountID, hasAccountID := AccountIDFromContext(r.Context())
	if hasAccountID && accountID != "" {
		// Look up user's roles to check access
		var accountEntry struct {
			Roles map[string]string `json:"roles"`
		}
		if err := h.projectionStore.Get(r.Context(), "_admin", "account_list", accountID, &accountEntry); err == nil {
			// System admins (admin/owner in _admin realm) can view any realm
			isAdminRealmRole := accountEntry.Roles["_admin"] == "admin" || accountEntry.Roles["_admin"] == "owner"
			// Regular users can only view realms they're a member of
			_, hasRealmAccess := accountEntry.Roles[realmID]
			if !isAdminRealmRole && !hasRealmAccess {
				writeError(w, http.StatusForbidden, "access denied to this realm")
				return
			}
		}
	}


	// Get realm info using Get method
	// Get realm info using Get method
	var realmInfo struct {
		RealmID   string    `json:"realm_id"`
		Name      string    `json:"name"`
		Status    string    `json:"status"`
		CreatedAt time.Time `json:"created_at"`
	}
	err := h.projectionStore.Get(r.Context(), "_admin", "realm_list", realmID, &realmInfo)
	if err != nil {
		writeError(w, http.StatusNotFound, "realm not found")
		return
	}

	// Get members by scanning account list
	rawAccounts, err := h.projectionStore.List(r.Context(), "_admin", "account_list")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get members")
		return
	}

	var members []RealmMember
	for _, raw := range rawAccounts {
		var account struct {
			AccountID string            `json:"account_id"`
			Username  string            `json:"username"`
			Roles     map[string]string `json:"roles"`
		}
		if err := json.Unmarshal(raw, &account); err != nil {
			continue
		}
		if role, ok := account.Roles[realmID]; ok {
			members = append(members, RealmMember{
				AccountID: account.AccountID,
				Username:  account.Username,
				Role:      role,
			})
		}
	}

	response := RealmDetailResponse{
		RealmID:   realmInfo.RealmID,
		Name:      realmInfo.Name,
		Status:    realmInfo.Status,
		CreatedAt: realmInfo.CreatedAt,
		Members:   members,
	}

	writeJSON(w, http.StatusOK, response)
}

// --- Helpers ---

func writeJSON(w http.ResponseWriter, statusCode int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}

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

	msg := err.Error()
	if isValidationError(msg) {
		writeError(w, http.StatusBadRequest, msg)
		return
	}

	writeError(w, http.StatusInternalServerError, msg)
}

func isValidationError(msg string) bool {
	prefixes := []string{
		"cannot ",
		"rune ",
		"realm ",
		"unknown ",
	}
	for _, p := range prefixes {
		if strings.HasPrefix(msg, p) {
			return true
		}
	}
	return false
}

func isNotFound(err error) bool {
	var nfe *core.NotFoundError
	return errors.As(err, &nfe)
}

func (h *Handlers) runSyncQuietly(r *http.Request) {
	h.engine.RunCatchUpOnce(r.Context())
}
