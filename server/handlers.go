package server

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
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
	h.mux.HandleFunc("POST /fulfill-rune", h.FulfillRune)
	h.mux.HandleFunc("POST /seal-rune", h.SealRune)
	h.mux.HandleFunc("POST /add-dependency", h.AddDependency)
	h.mux.HandleFunc("POST /remove-dependency", h.RemoveDependency)
	h.mux.HandleFunc("POST /add-note", h.AddNote)
	h.mux.HandleFunc("GET /runes", h.ListRunes)
	h.mux.HandleFunc("GET /rune", h.GetRune)
	h.mux.HandleFunc("POST /create-realm", h.CreateRealm)
	h.mux.HandleFunc("GET /realms", h.ListRealms)
	return h
}

// ServeHTTP delegates to the internal mux.
func (h *Handlers) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	h.mux.ServeHTTP(w, r)
}

// RegisterRoutes registers all handler routes on the given mux with middleware.
func (h *Handlers) RegisterRoutes(mux *http.ServeMux, realmMiddleware, adminMiddleware func(http.Handler) http.Handler) {
	// Health check — no auth
	mux.HandleFunc("GET /health", h.Health)

	// Rune commands (realm auth)
	mux.Handle("POST /create-rune", realmMiddleware(http.HandlerFunc(h.CreateRune)))
	mux.Handle("POST /update-rune", realmMiddleware(http.HandlerFunc(h.UpdateRune)))
	mux.Handle("POST /claim-rune", realmMiddleware(http.HandlerFunc(h.ClaimRune)))
	mux.Handle("POST /fulfill-rune", realmMiddleware(http.HandlerFunc(h.FulfillRune)))
	mux.Handle("POST /seal-rune", realmMiddleware(http.HandlerFunc(h.SealRune)))
	mux.Handle("POST /add-dependency", realmMiddleware(http.HandlerFunc(h.AddDependency)))
	mux.Handle("POST /remove-dependency", realmMiddleware(http.HandlerFunc(h.RemoveDependency)))
	mux.Handle("POST /add-note", realmMiddleware(http.HandlerFunc(h.AddNote)))

	// Rune queries (realm auth)
	mux.Handle("GET /runes", realmMiddleware(http.HandlerFunc(h.ListRunes)))
	mux.Handle("GET /rune", realmMiddleware(http.HandlerFunc(h.GetRune)))

	// Admin commands (admin auth)
	mux.Handle("POST /create-realm", adminMiddleware(http.HandlerFunc(h.CreateRealm)))
	mux.Handle("GET /realms", adminMiddleware(http.HandlerFunc(h.ListRealms)))
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
	h.runSyncQuietly(r)
	writeJSON(w, http.StatusCreated, map[string]string{
		"realm_id": result.RealmID,
	})
}

// --- Query Handlers ---

func (h *Handlers) ListRunes(w http.ResponseWriter, r *http.Request) {
	realmID, ok := RealmIDFromContext(r.Context())
	if !ok {
		writeError(w, http.StatusForbidden, "realm ID required")
		return
	}
	runes, err := h.projectionStore.List(r.Context(), realmID, "rune_list")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list runes")
		return
	}

	statusFilter := r.URL.Query().Get("status")
	priorityFilter := r.URL.Query().Get("priority")
	assigneeFilter := r.URL.Query().Get("assignee")

	if statusFilter != "" || priorityFilter != "" || assigneeFilter != "" {
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
			filtered = append(filtered, raw)
		}
		runes = filtered
	}

	writeJSON(w, http.StatusOK, runes)
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
	writeJSON(w, http.StatusOK, realms)
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
