// Package admin provides the server-rendered admin UI for Bifrost.
package admin

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
	"github.com/devzeebo/bifrost/domain/projectors"
)

// Handlers contains all admin UI HTTP handlers.
type Handlers struct {
	templates       *Templates
	authConfig      *AuthConfig
	projectionStore core.ProjectionStore
	eventStore      core.EventStore
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(templates *Templates, authConfig *AuthConfig, projectionStore core.ProjectionStore, eventStore core.EventStore) *Handlers {
	return &Handlers{
		templates:       templates,
		authConfig:      authConfig,
		projectionStore: projectionStore,
		eventStore:      eventStore,
	}
}

// LoginHandler handles GET and POST requests for the login page.
// GET: renders the login form
// POST: validates PAT, creates JWT, sets cookie, redirects to /admin/
func (h *Handlers) LoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodGet {
		h.showLoginForm(w, "")
		return
	}

	if r.Method == http.MethodPost {
		h.handleLogin(w, r)
		return
	}

	http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
}

func (h *Handlers) showLoginForm(w http.ResponseWriter, errorMsg string) {
	data := TemplateData{
		Title: "Login",
		Error: errorMsg,
	}
	h.templates.RenderLogin(w, data)
}

func (h *Handlers) handleLogin(w http.ResponseWriter, r *http.Request) {
	pat := strings.TrimSpace(r.FormValue("pat"))

	// Validate PAT is not empty
	if pat == "" {
		h.showLoginForm(w, "PAT is required")
		return
	}

	// Validate PAT using the middleware helper
	entry, patID, err := ValidatePAT(r.Context(), h.projectionStore, pat)
	if err != nil {
		errorMsg := h.getLoginErrorMessage(err)
		h.showLoginForm(w, errorMsg)
		return
	}

	// Generate JWT
	token, err := GenerateJWT(h.authConfig, entry.AccountID, patID)
	if err != nil {
		h.showLoginForm(w, "Failed to create session")
		return
	}

	// Set cookie and redirect
	SetAuthCookie(w, h.authConfig, token)
	http.Redirect(w, r, "/admin/", http.StatusSeeOther)
}

func (h *Handlers) getLoginErrorMessage(err error) string {
	switch err {
	case ErrInvalidToken:
		return "PAT not found or expired"
	case ErrPATRevoked:
		return "PAT has been revoked"
	case ErrAccountSuspended:
		return "Account is suspended"
	default:
		return "Authentication failed"
	}
}

// LogoutHandler handles POST requests to log out.
// It clears the auth cookie and redirects to the login page.
func (h *Handlers) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ClearAuthCookie(w, h.authConfig)
	http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
}

// RegisterRoutes registers all admin UI routes with the given mux.
// The publicMux is used for routes that don't require authentication (login, static).
// The authMux is used for routes that require authentication.
func (h *Handlers) RegisterRoutes(publicMux, authMux *http.ServeMux) {
	// Public routes (no auth required)
	publicMux.HandleFunc("GET /admin/login", h.LoginHandler)
	publicMux.HandleFunc("POST /admin/login", h.LoginHandler)

	// Static files (no auth required - CSS must be accessible for login page)
	publicMux.Handle("GET /admin/static/", http.StripPrefix("/admin/static/", StaticHandler()))

	// Authenticated routes
	authMux.HandleFunc("POST /admin/logout", h.LogoutHandler)
	authMux.HandleFunc("GET /admin/", h.DashboardHandler)
	authMux.HandleFunc("GET /admin", http.RedirectHandler("/admin/", http.StatusMovedPermanently).ServeHTTP)

	// Runes management (viewer+ for list/detail, member+ for actions)
	authMux.HandleFunc("GET /admin/runes", h.RunesListHandler)
	authMux.HandleFunc("GET /admin/runes/", h.RuneDetailHandler)
	authMux.HandleFunc("POST /admin/runes/{id}/claim", h.RuneClaimHandler)
	authMux.HandleFunc("POST /admin/runes/{id}/fulfill", h.RuneFulfillHandler)
	authMux.HandleFunc("POST /admin/runes/{id}/seal", h.RuneSealHandler)
	authMux.HandleFunc("POST /admin/runes/{id}/note", h.RuneNoteHandler)
}

// DashboardHandler handles GET requests for the dashboard.
func (h *Handlers) DashboardHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := UsernameFromContext(r.Context())
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRoles(roles)

	// Get rune counts by status
	statusCounts := map[string]int{
		"draft":     0,
		"open":      0,
		"claimed":   0,
		"fulfilled": 0,
		"sealed":    0,
	}

	var recentRunes []projectors.RuneSummary
	totalRunes := 0

	if h.projectionStore != nil {
		rawRunes, err := h.projectionStore.List(r.Context(), realmID, "rune_list")
		if err == nil {
			totalRunes = len(rawRunes)
			for _, raw := range rawRunes {
				var rune projectors.RuneSummary
				if err := json.Unmarshal(raw, &rune); err != nil {
					continue
				}
				statusCounts[rune.Status]++
				recentRunes = append(recentRunes, rune)
			}

			// Sort recent runes by updated_at (most recent first)
			// Keep only top 10
			if len(recentRunes) > 1 {
				sortRecentRunes(recentRunes)
			}
			if len(recentRunes) > 10 {
				recentRunes = recentRunes[:10]
			}
		}
	}

	data := TemplateData{
		Title: "Dashboard",
		Account: &AccountInfo{
			Username: username,
			Roles:    roles,
		},
		Data: map[string]interface{}{
			"StatusCounts": statusCounts,
			"RecentRunes":  recentRunes,
			"TotalRunes":   totalRunes,
		},
	}

	h.templates.Render(w, "dashboard.html", data)
}

// sortRecentRunes sorts runes by UpdatedAt in descending order (most recent first).
func sortRecentRunes(runes []projectors.RuneSummary) {
	for i := 0; i < len(runes)-1; i++ {
		for j := i + 1; j < len(runes); j++ {
			if runes[i].UpdatedAt.Before(runes[j].UpdatedAt) {
				runes[i], runes[j] = runes[j], runes[i]
			}
		}
	}
}

// RunesListHandler handles GET /admin/runes - list all runes with optional filters.
func (h *Handlers) RunesListHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := UsernameFromContext(r.Context())
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRoles(roles)

	// Get filter params
	statusFilter := r.URL.Query().Get("status")
	priorityFilter := r.URL.Query().Get("priority")
	assigneeFilter := r.URL.Query().Get("assignee")

	// Get all runes from projection
	rawRunes, err := h.projectionStore.List(r.Context(), realmID, "rune_list")
	if err != nil {
		h.templates.Render(w, "runes/list.html", TemplateData{
			Title:   "Runes",
			Error:   "Failed to load runes",
			Account: &AccountInfo{Username: username, Roles: roles},
		})
		return
	}

	// Parse and filter runes
	runes := make([]projectors.RuneSummary, 0)
	for _, raw := range rawRunes {
		var rune projectors.RuneSummary
		if err := json.Unmarshal(raw, &rune); err != nil {
			continue
		}

		// Apply filters
		if statusFilter != "" && rune.Status != statusFilter {
			continue
		}
		if priorityFilter != "" {
			prio, err := strconv.Atoi(priorityFilter)
			if err == nil && rune.Priority != prio {
				continue
			}
		}
		if assigneeFilter != "" && rune.Claimant != assigneeFilter {
			continue
		}

		runes = append(runes, rune)
	}

	h.templates.Render(w, "runes/list.html", TemplateData{
		Title: "Runes",
		Account: &AccountInfo{
			Username: username,
			Roles:    roles,
		},
		Data: map[string]interface{}{
			"Runes":           runes,
			"StatusFilter":    statusFilter,
			"PriorityFilter":  priorityFilter,
			"AssigneeFilter":  assigneeFilter,
			"CanTakeAction":   canTakeAction(roles, realmID),
		},
	})
}

// RuneDetailHandler handles GET /admin/runes/{id} - show rune details.
func (h *Handlers) RuneDetailHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := UsernameFromContext(r.Context())
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRoles(roles)

	// Extract rune ID from path (after /admin/runes/)
	runeID := strings.TrimPrefix(r.URL.Path, "/admin/runes/")
	if runeID == "" || strings.Contains(runeID, "/") {
		http.Error(w, "Invalid rune ID", http.StatusBadRequest)
		return
	}

	// Get rune detail from projection
	var rune projectors.RuneDetail
	err := h.projectionStore.Get(r.Context(), realmID, "rune_detail", runeID, &rune)
	if err != nil {
		data := TemplateData{
			Title:   "Rune Not Found",
			Error:   "Rune not found",
			Account: &AccountInfo{Username: username, Roles: roles},
		}
		w.WriteHeader(http.StatusNotFound)
		h.templates.Render(w, "runes/detail.html", data)
		return
	}

	h.templates.Render(w, "runes/detail.html", TemplateData{
		Title:   rune.Title,
		Account: &AccountInfo{Username: username, Roles: roles},
		Data: map[string]interface{}{
			"Rune":           rune,
			"CanTakeAction":  canTakeAction(roles, realmID),
			"CanClaim":       rune.Status == "open",
			"CanFulfill":     rune.Status == "claimed",
			"CanSeal":        rune.Status != "sealed" && rune.Status != "shattered",
			"CanAddNote":     rune.Status != "shattered",
		},
	})
}

// RuneClaimHandler handles POST /admin/runes/{id}/claim.
func (h *Handlers) RuneClaimHandler(w http.ResponseWriter, r *http.Request) {
	h.handleRuneAction(w, r, "claim")
}

// RuneFulfillHandler handles POST /admin/runes/{id}/fulfill.
func (h *Handlers) RuneFulfillHandler(w http.ResponseWriter, r *http.Request) {
	h.handleRuneAction(w, r, "fulfill")
}

// RuneSealHandler handles POST /admin/runes/{id}/seal.
func (h *Handlers) RuneSealHandler(w http.ResponseWriter, r *http.Request) {
	h.handleRuneAction(w, r, "seal")
}

// RuneNoteHandler handles POST /admin/runes/{id}/note.
func (h *Handlers) RuneNoteHandler(w http.ResponseWriter, r *http.Request) {
	h.handleRuneAction(w, r, "note")
}

// handleRuneAction is a generic handler for rune actions (claim, fulfill, seal, note).
func (h *Handlers) handleRuneAction(w http.ResponseWriter, r *http.Request, action string) {
	username, _ := UsernameFromContext(r.Context())
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRoles(roles)

	// Check member+ authorization
	if !canTakeAction(roles, realmID) {
		renderToastPartial(w, "error", "Unauthorized: member access required")
		return
	}

	runeID := r.PathValue("id")
	if runeID == "" {
		renderToastPartial(w, "error", "Rune ID is required")
		return
	}

	var err error

	switch action {
	case "claim":
		err = domain.HandleClaimRune(r.Context(), realmID, domain.ClaimRune{
			ID:      runeID,
			Claimant: username,
		}, h.eventStore)
	case "fulfill":
		err = domain.HandleFulfillRune(r.Context(), realmID, domain.FulfillRune{
			ID: runeID,
		}, h.eventStore)
	case "seal":
		reason := r.FormValue("reason")
		err = domain.HandleSealRune(r.Context(), realmID, domain.SealRune{
			ID:     runeID,
			Reason: reason,
		}, h.eventStore)
	case "note":
		noteText := strings.TrimSpace(r.FormValue("note"))
		if noteText == "" {
			renderToastPartial(w, "error", "Note cannot be empty")
			return
		}
		err = domain.HandleAddNote(r.Context(), realmID, domain.AddNote{
			RuneID: runeID,
			Text:   noteText,
		}, h.eventStore)
	}

	if err != nil {
		errorMsg := getActionErrorMessage(action, err)
		renderToastPartial(w, "error", errorMsg)
		return
	}

	// Get updated rune for partial response
	var rune projectors.RuneDetail
	if err := h.projectionStore.Get(r.Context(), realmID, "rune_detail", runeID, &rune); err != nil {
		renderToastPartial(w, "success", "Action completed")
		return
	}

	// Return partial HTML for htmx swap
	renderRuneActionsPartial(w, rune, canTakeAction(roles, realmID))
}

// getRealmIDFromRoles extracts the realm ID from the roles map.
// Returns the first non-_admin realm found, or "_admin" if only admin role.
func getRealmIDFromRoles(roles map[string]string) string {
	for realmID := range roles {
		if realmID != "_admin" {
			return realmID
		}
	}
	return "_admin"
}

// canTakeAction returns true if the user has member+ role in the realm.
func canTakeAction(roles map[string]string, realmID string) bool {
	role, ok := roles[realmID]
	if !ok {
		return false
	}
	return role == "admin" || role == "member"
}

// getActionErrorMessage returns a user-friendly error message for action failures.
func getActionErrorMessage(action string, err error) string {
	// Check for specific error types
	errStr := err.Error()

	switch {
	case strings.Contains(errStr, "not found"):
		return "Rune not found"
	case strings.Contains(errStr, "already claimed"):
		return "Rune is already claimed"
	case strings.Contains(errStr, "already fulfilled"):
		return "Rune is already fulfilled"
	case strings.Contains(errStr, "already sealed"):
		return "Rune is already sealed"
	case strings.Contains(errStr, "cannot claim draft"):
		return "Draft runes must be forged first"
	case strings.Contains(errStr, "not claimed"):
		return "Rune must be claimed first"
	case strings.Contains(errStr, "shattered"):
		return "Cannot modify shattered rune"
	default:
		return "Action failed: " + action
	}
}

// renderToastPartial renders a toast notification as HTML partial for htmx.
func renderToastPartial(w http.ResponseWriter, toastType, message string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	var class string
	switch toastType {
	case "error":
		class = "toast-error"
	case "success":
		class = "toast-success"
	default:
		class = "toast-info"
	}

	// Create a toast element that htmx will swap into the toasts container
	// Using oob-swap to update the toasts area
	w.Write([]byte(`<div class="toast ` + class + `" hx-swap-oob="beforeend:#toasts">` + message + `</div>`))
}

// renderRuneActionsPartial renders the actions partial for htmx swap.
func renderRuneActionsPartial(w http.ResponseWriter, rune projectors.RuneDetail, canTakeAction bool) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	// Render the status badge and actions as a partial
	w.Write([]byte(`<span class="badge badge-` + rune.Status + `">` + rune.Status + `</span>`))

	if !canTakeAction {
		return
	}

	// Action buttons based on status
	w.Write([]byte(`<div class="rune-actions">`))

	switch rune.Status {
	case "open":
		w.Write([]byte(`<button class="btn btn-primary" hx-post="/admin/runes/` + rune.ID + `/claim" hx-target="closest .rune-detail" hx-swap="outerHTML">Claim</button>`))
	case "claimed":
		w.Write([]byte(`<button class="btn btn-success" hx-post="/admin/runes/` + rune.ID + `/fulfill" hx-target="closest .rune-detail" hx-swap="outerHTML">Fulfill</button>`))
	}

	if rune.Status != "sealed" && rune.Status != "shattered" {
		w.Write([]byte(`<button class="btn btn-secondary" hx-post="/admin/runes/` + rune.ID + `/seal" hx-target="closest .rune-detail" hx-swap="outerHTML">Seal</button>`))
	}

	w.Write([]byte(`</div>`))
}
