// Package admin provides the server-rendered admin UI for Bifrost.
package admin

import (
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

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
		log.Printf("LoginHandler: failed to generate JWT for account %s: %v", entry.AccountID, err)
		h.showLoginForm(w, "Failed to create session")
		return
	}

	// Set cookie and redirect
	SetAuthCookie(w, h.authConfig, token)
	http.Redirect(w, r, "/admin/", http.StatusSeeOther)
}

func (h *Handlers) getLoginErrorMessage(err error) string {
	switch {
	case errors.Is(err, ErrInvalidToken):
		return "PAT not found or expired"
	case errors.Is(err, ErrPATRevoked):
		return "PAT has been revoked"
	case errors.Is(err, ErrAccountSuspended):
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

// SwitchRealmHandler handles POST requests to switch the active realm.
func (h *Handlers) SwitchRealmHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	roles, _ := RolesFromContext(r.Context())
	realmID := r.FormValue("realm")

	// Validate the realm is accessible
	if _, ok := roles[realmID]; !ok {
		renderToastPartial(w, "error", "Access denied to this realm")
		return
	}

	SetRealmCookie(w, realmID, h.authConfig)

	// Check if HTMX request
	if r.Header.Get("HX-Request") == "true" {
		renderToastPartial(w, "success", "Realm switched successfully")
		// Trigger page refresh
		w.Write([]byte(`<div hx-get="/admin/" hx-trigger="load" hx-target="body" hx-swap="outerHTML"></div>`))
		return
	}

	// Redirect to dashboard
	http.Redirect(w, r, "/admin/", http.StatusSeeOther)
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

	// Runes management (viewer+ for list/detail, member+ for actions, admin for sweep)
	authMux.HandleFunc("GET /admin/runes", h.RunesListHandler)
	authMux.HandleFunc("GET /admin/runes/", h.RuneDetailHandler)
	authMux.HandleFunc("POST /admin/runes/create", h.CreateRuneHandler)
	authMux.HandleFunc("POST /admin/runes/sweep", h.SweepRunesHandler)
	authMux.HandleFunc("POST /admin/runes/{id}/update", h.UpdateRuneHandler)
	authMux.HandleFunc("POST /admin/runes/{id}/forge", h.RuneForgeHandler)
	authMux.HandleFunc("POST /admin/runes/{id}/dependencies", h.AddDependencyHandler)
	authMux.HandleFunc("DELETE /admin/runes/{id}/dependencies", h.RemoveDependencyHandler)
	authMux.HandleFunc("POST /admin/runes/{id}/claim", h.RuneClaimHandler)
	authMux.HandleFunc("POST /admin/runes/{id}/unclaim", h.RuneUnclaimHandler)
	authMux.HandleFunc("POST /admin/runes/{id}/fulfill", h.RuneFulfillHandler)
	authMux.HandleFunc("POST /admin/runes/{id}/shatter", h.RuneShatterHandler)
	authMux.HandleFunc("POST /admin/runes/{id}/seal", h.RuneSealHandler)
	authMux.HandleFunc("POST /admin/runes/{id}/note", h.RuneNoteHandler)

	// Realms management (admin-only)
	authMux.HandleFunc("GET /admin/realms", h.RealmsListHandler)
	authMux.HandleFunc("GET /admin/realms/", h.RealmDetailHandler)
	authMux.HandleFunc("POST /admin/realms/create", h.CreateRealmHandler)
	authMux.HandleFunc("POST /admin/realms/{id}/suspend", h.SuspendRealmHandler)

	// Accounts management (admin-only)
	authMux.HandleFunc("GET /admin/accounts", h.AccountsListHandler)
	authMux.HandleFunc("GET /admin/accounts/", h.AccountDetailHandler)
	authMux.HandleFunc("POST /admin/accounts/create", h.CreateAccountHandler)
	authMux.HandleFunc("POST /admin/accounts/{id}/suspend", h.SuspendAccountHandler)
	authMux.HandleFunc("POST /admin/accounts/{id}/roles", h.UpdateRolesHandler)
	authMux.HandleFunc("GET /admin/accounts/{id}/pats", h.PATsListHandler)
	authMux.HandleFunc("POST /admin/accounts/{id}/pats", h.PATActionHandler)
}

// DashboardHandler handles GET requests for the dashboard.
func (h *Handlers) DashboardHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := UsernameFromContext(r.Context())
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRequest(r, roles)

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
		if err != nil {
			log.Printf("DashboardHandler: failed to list runes for realm %s: %v", realmID, err)
		} else {
			totalRunes = len(rawRunes)
			// Pre-allocate slice with known capacity
			recentRunes = make([]projectors.RuneSummary, 0, totalRunes)
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
		Title:   "Dashboard",
		Account: h.buildAccountInfo(r, username, roles),
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
	sort.Slice(runes, func(i, j int) bool {
		return runes[i].UpdatedAt.After(runes[j].UpdatedAt)
	})
}

// RunesListHandler handles GET /admin/runes - list all runes with optional filters.
func (h *Handlers) RunesListHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := UsernameFromContext(r.Context())
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRequest(r, roles)

	// Get filter params
	statusFilter := r.URL.Query().Get("status")
	priorityFilter := r.URL.Query().Get("priority")
	assigneeFilter := r.URL.Query().Get("assignee")
	expandForm := r.URL.Query().Get("expand_form") == "true"

	// Build filter params string for preserving filters in HTMX requests
	filterParams := buildFilterParams(statusFilter, priorityFilter, assigneeFilter)

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

	// Parse priority filter once before the loop
	var priorityPrio int
	var hasPriorityFilter bool
	if priorityFilter != "" {
		if prio, err := strconv.Atoi(priorityFilter); err == nil {
			priorityPrio = prio
			hasPriorityFilter = true
		}
	}

	// Parse and filter runes (pre-allocate with known capacity)
	runes := make([]projectors.RuneSummary, 0, len(rawRunes))
	for _, raw := range rawRunes {
		var rune projectors.RuneSummary
		if err := json.Unmarshal(raw, &rune); err != nil {
			continue
		}

		// Apply filters
		if statusFilter != "" && rune.Status != statusFilter {
			continue
		}
		if hasPriorityFilter && rune.Priority != priorityPrio {
			continue
		}
		if assigneeFilter != "" && rune.Claimant != assigneeFilter {
			continue
		}

		runes = append(runes, rune)
	}

	h.templates.Render(w, "runes/list.html", TemplateData{
		Title:   "Runes",
		Account: h.buildAccountInfo(r, username, roles),
		Data: map[string]interface{}{
			"Runes":           runes,
			"StatusFilter":    statusFilter,
			"PriorityFilter":  priorityFilter,
			"AssigneeFilter":  assigneeFilter,
			"CanTakeAction":   canTakeAction(roles, realmID),
			"IsAdmin":         isAdmin(roles),
			"ExpandForm":      expandForm,
			"FilterParams":    filterParams,
		},
	})
}

// RuneDetailHandler handles GET /admin/runes/{id} - show rune details.
func (h *Handlers) RuneDetailHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := UsernameFromContext(r.Context())
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRequest(r, roles)

	// Extract rune ID from path
	runeID, errMsg := extractPathID(r.URL.Path, "/admin/runes/")
	if errMsg != "" {
		http.Error(w, errMsg, http.StatusBadRequest)
		return
	}

	// Guard against nil projectionStore
	if h.projectionStore == nil {
		http.Error(w, "Service unavailable", http.StatusServiceUnavailable)
		return
	}

	// Get rune detail from projection
	var rune projectors.RuneDetail
	err := h.projectionStore.Get(r.Context(), realmID, "rune_detail", runeID, &rune)
	if err != nil {
		data := TemplateData{
			Title:   "Rune Not Found",
			Error:   "Rune not found",
			Account: h.buildAccountInfo(r, username, roles),
		}
		w.WriteHeader(http.StatusNotFound)
		h.templates.Render(w, "runes/detail.html", data)
		return
	}

	h.templates.Render(w, "runes/detail.html", TemplateData{
		Title:   rune.Title,
		Account: h.buildAccountInfo(r, username, roles),
		Data: map[string]interface{}{
			"Rune":           rune,
			"CanTakeAction":  canTakeAction(roles, realmID),
			"CanForge":       rune.Status == "draft",
			"CanClaim":       rune.Status == "open",
			"CanUnclaim":     rune.Status == "claimed",
			"CanFulfill":     rune.Status == "claimed",
			"CanSeal":        rune.Status != "sealed" && rune.Status != "shattered",
			"CanShatter":     rune.Status == "fulfilled" || rune.Status == "sealed",
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
	username, ok := UsernameFromContext(r.Context())
	if !ok || username == "" {
		renderToastPartial(w, "error", "Unauthorized: username not found")
		return
	}
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRequest(r, roles)

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
	default:
		renderToastPartial(w, "error", "Unknown action")
		return
	}

	if err != nil {
		errorMsg := getActionErrorMessage(action, err)
		renderToastPartial(w, "error", errorMsg)
		return
	}

	// Get updated rune for partial response with retry for eventual consistency
	if h.projectionStore == nil {
		renderToastPartial(w, "success", "Action completed - refresh to see changes")
		return
	}
	var rune projectors.RuneDetail
	const maxRetries = 3
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		if err := h.projectionStore.Get(r.Context(), realmID, "rune_detail", runeID, &rune); err != nil {
			lastErr = err
			// Context-aware sleep to respect client disconnects
			delay := time.Duration(i+1) * 50 * time.Millisecond // Brief backoff: 50ms, 100ms, 150ms
			select {
			case <-time.After(delay):
			case <-r.Context().Done():
				renderToastPartial(w, "error", "Request cancelled")
				return
			}
			continue
		}
		lastErr = nil
		break
	}
	if lastErr != nil {
		log.Printf("handleRuneAction: failed to get rune after %s action after %d retries: %v", action, maxRetries, lastErr)
		renderToastPartial(w, "success", "Action completed - refresh to see changes")
		return
	}

	// Return partial HTML for htmx swap
	renderRuneActionsPartial(w, rune, canTakeAction(roles, realmID))
}

// getRealmIDFromRoles extracts the realm ID from the roles map.
// Returns the lexicographically first non-admin realm found, or the admin realm ID if only admin role.
// DEPRECATED: Use getRealmIDFromRequest instead which respects cookie selection.
func getRealmIDFromRoles(roles map[string]string) string {
	first := ""
	for realmID := range roles {
		if realmID == domain.AdminRealmID {
			continue
		}
		if first == "" || realmID < first {
			first = realmID
		}
	}
	if first != "" {
		return first
	}
	return domain.AdminRealmID
}

// getRealmIDFromRequest gets the selected realm from cookie, falling back to the first available realm.
func getRealmIDFromRequest(r *http.Request, roles map[string]string) string {
	// First check cookie for selected realm
	if selectedRealm := GetSelectedRealm(r, roles); selectedRealm != "" {
		return selectedRealm
	}
	// Fall back to first available realm
	return getRealmIDFromRoles(roles)
}

// buildFilterParams builds a URL-encoded string of filter parameters.
func buildFilterParams(status, priority, assignee string) string {
	v := url.Values{}
	if status != "" {
		v.Set("status", status)
	}
	if priority != "" {
		v.Set("priority", priority)
	}
	if assignee != "" {
		v.Set("assignee", assignee)
	}
	return v.Encode()
}

// buildAccountInfo creates an AccountInfo with realm information.
func (h *Handlers) buildAccountInfo(r *http.Request, username string, roles map[string]string) *AccountInfo {
	accountID, _ := AccountIDFromContext(r.Context())

	// Get selected realm from cookie
	selectedRealm := GetSelectedRealm(r, roles)

	// Build available realms
	availableRealms := BuildAvailableRealms(r.Context(), h.projectionStore, roles)

	return &AccountInfo{
		ID:              accountID,
		Username:        username,
		Roles:           roles,
		CurrentRealm:    selectedRealm,
		AvailableRealms: availableRealms,
	}
}

// canTakeAction returns true if the user has member+ role in the realm.
func canTakeAction(roles map[string]string, realmID string) bool {
	role, ok := roles[realmID]
	if !ok {
		return false
	}
	return role == "admin" || role == "member"
}

// extractPathID extracts an entity ID from a URL path after a prefix.
// Returns an error message if the ID is empty or contains a slash.
func extractPathID(path, prefix string) (string, string) {
	id := strings.TrimPrefix(path, prefix)
	if id == "" {
		return "", "ID is required"
	}
	if strings.Contains(id, "/") {
		return "", "Invalid ID format"
	}
	return id, ""
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
	}

	// Log the unexpected error for diagnostics but return a generic message to the user
	log.Printf("getActionErrorMessage: unexpected error for action %q: %v", action, err)
	return "An unexpected error occurred. Please try again."
}

// renderToastPartial renders a toast notification as HTML partial for htmx.
func renderToastPartial(w http.ResponseWriter, toastType, message string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	var class, icon string
	switch toastType {
	case "error":
		class = "toast-error"
		icon = "✕"
	case "success":
		class = "toast-success"
		icon = "✓"
	case "warning":
		class = "toast-warning"
		icon = "⚠"
	default:
		class = "toast-info"
		icon = "ℹ"
	}

	// Escape dynamic values to prevent XSS
	escapedClass := html.EscapeString(class)
	escapedIcon := html.EscapeString(icon)
	escapedMessage := html.EscapeString(message)

	// Create a toast element with icon and message
	// CSS handles auto-dismiss animation after 5 seconds
	htmlContent := `<div class="toast ` + escapedClass + `" hx-swap-oob="beforeend:#toasts">
		<span class="toast-icon">` + escapedIcon + `</span>
		<span class="toast-message">` + escapedMessage + `</span>
	</div>`

	if _, err := w.Write([]byte(htmlContent)); err != nil {
		log.Printf("renderToastPartial: failed to write response: %v", err)
	}
}

// renderRuneActionsPartial renders the actions partial for htmx swap.
func renderRuneActionsPartial(w http.ResponseWriter, rune projectors.RuneDetail, canTakeAction bool) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	// Escape dynamic values to prevent XSS
	escapedStatus := html.EscapeString(rune.Status)
	escapedID := html.EscapeString(rune.ID)

	// Render the status badge and actions as a partial
	writeHTML(w, `<span class="badge badge-`+escapedStatus+`">`+escapedStatus+`</span>`)

	if !canTakeAction {
		return
	}

	// Action buttons based on status
	writeHTML(w, `<div class="rune-actions">`)

	switch rune.Status {
	case "open":
		writeHTML(w, `<button class="btn btn-primary" hx-post="/admin/runes/`+escapedID+`/claim" hx-target="closest .rune-detail" hx-swap="outerHTML">Claim</button>`)
	case "claimed":
		writeHTML(w, `<button class="btn btn-success" hx-post="/admin/runes/`+escapedID+`/fulfill" hx-target="closest .rune-detail" hx-swap="outerHTML">Fulfill</button>`)
	}

	if rune.Status != "sealed" && rune.Status != "shattered" {
		writeHTML(w, `<button class="btn btn-secondary" hx-post="/admin/runes/`+escapedID+`/seal" hx-target="closest .rune-detail" hx-swap="outerHTML">Seal</button>`)
	}

	writeHTML(w, `</div>`)
}

// writeHTML writes HTML to the response and logs any errors.
func writeHTML(w http.ResponseWriter, html string) {
	if _, err := w.Write([]byte(html)); err != nil {
		log.Printf("writeHTML: failed to write response: %v", err)
	}
}

// RealmsListHandler handles GET /admin/realms - list all realms (admin-only).
func (h *Handlers) RealmsListHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := UsernameFromContext(r.Context())
	roles, _ := RolesFromContext(r.Context())

	// Check admin authorization
	if !isAdmin(roles) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Check for expand_form parameter
	expandForm := r.URL.Query().Get("expand_form") == "true"

	// Get all realms from projection
	var realms []projectors.RealmListEntry
	if h.projectionStore != nil {
		rawRealms, err := h.projectionStore.List(r.Context(), domain.AdminRealmID, "realm_list")
		if err != nil {
			log.Printf("RealmsListHandler: failed to list realms: %v", err)
		} else {
			realms = make([]projectors.RealmListEntry, 0, len(rawRealms))
			for _, raw := range rawRealms {
				var realm projectors.RealmListEntry
				if err := json.Unmarshal(raw, &realm); err != nil {
					continue
				}
				realms = append(realms, realm)
			}
		}
	}

	h.templates.Render(w, "realms/list.html", TemplateData{
		Title:   "Realms",
		Account: h.buildAccountInfo(r, username, roles),
		Data: map[string]interface{}{
			"Realms":     realms,
			"ExpandForm": expandForm,
		},
	})
}

// RealmDetailHandler handles GET /admin/realms/{id} - show realm details (admin-only).
func (h *Handlers) RealmDetailHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := UsernameFromContext(r.Context())
	roles, _ := RolesFromContext(r.Context())

	// Check admin authorization
	if !isAdmin(roles) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Extract realm ID from path
	realmID, errMsg := extractPathID(r.URL.Path, "/admin/realms/")
	if errMsg != "" {
		http.Error(w, errMsg, http.StatusBadRequest)
		return
	}

	// Check projection store availability
	if h.projectionStore == nil {
		http.Error(w, "Service unavailable", http.StatusServiceUnavailable)
		return
	}

	// Get realm detail
	var realm projectors.RealmListEntry
	err := h.projectionStore.Get(r.Context(), domain.AdminRealmID, "realm_list", realmID, &realm)
	if err != nil {
		data := TemplateData{
			Title:   "Realm Not Found",
			Error:   "Realm not found",
			Account: h.buildAccountInfo(r, username, roles),
		}
		w.WriteHeader(http.StatusNotFound)
		h.templates.Render(w, "realms/detail.html", data)
		return
	}

	// Get members of this realm
	var members []projectors.AccountListEntry
	rawAccounts, err := h.projectionStore.List(r.Context(), domain.AdminRealmID, "account_list")
	if err != nil {
		log.Printf("RealmDetailHandler: failed to list accounts: %v", err)
	} else {
		members = make([]projectors.AccountListEntry, 0, len(rawAccounts))
		for _, raw := range rawAccounts {
			var account projectors.AccountListEntry
			if err := json.Unmarshal(raw, &account); err != nil {
				continue
			}
			// Check if this account has a role in this realm
			if _, hasRole := account.Roles[realmID]; hasRole {
				members = append(members, account)
			}
		}
	}

	h.templates.Render(w, "realms/detail.html", TemplateData{
		Title:   realm.Name,
		Account: h.buildAccountInfo(r, username, roles),
		Data: map[string]interface{}{
			"Realm":   realm,
			"Members": members,
		},
	})
}

// CreateRealmHandler handles POST /admin/realms/create (admin-only).
func (h *Handlers) CreateRealmHandler(w http.ResponseWriter, r *http.Request) {
	roles, _ := RolesFromContext(r.Context())

	// Check admin authorization
	if !isAdmin(roles) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	name := strings.TrimSpace(r.FormValue("name"))
	if name == "" {
		renderToastPartial(w, "error", "Name is required")
		return
	}

	// Check for duplicate name
	if h.projectionStore != nil {
		rawRealms, err := h.projectionStore.List(r.Context(), domain.AdminRealmID, "realm_list")
		if err != nil {
			renderToastPartial(w, "error", "Failed to check for duplicate realm name")
			return
		}
		for _, raw := range rawRealms {
			var existing projectors.RealmListEntry
			if err := json.Unmarshal(raw, &existing); err == nil {
				if existing.Name == name {
					renderToastPartial(w, "error", "Realm name already exists")
					return
				}
			}
		}
	}

	// Create realm via domain command
	_, err := domain.HandleCreateRealm(r.Context(), domain.CreateRealm{Name: name}, h.eventStore)
	if err != nil {
		renderToastPartial(w, "error", "Failed to create realm")
		return
	}

	// Check if HTMX request
	if r.Header.Get("HX-Request") == "true" {
		renderRealmCreatedPartial(w)
		return
	}

	// Redirect to realms list
	http.Redirect(w, r, "/admin/realms", http.StatusSeeOther)
}

// SuspendRealmHandler handles POST /admin/realms/{id}/suspend (admin-only).
func (h *Handlers) SuspendRealmHandler(w http.ResponseWriter, r *http.Request) {
	roles, _ := RolesFromContext(r.Context())

	// Check admin authorization
	if !isAdmin(roles) {
		renderToastPartial(w, "error", "Forbidden")
		return
	}

	realmID := r.PathValue("id")
	if realmID == "" {
		renderToastPartial(w, "error", "Realm ID is required")
		return
	}

	// Get reason from form
	reason := r.FormValue("reason")

	// Suspend realm via domain command
	err := domain.HandleSuspendRealm(r.Context(), domain.SuspendRealm{
		RealmID: realmID,
		Reason:  reason,
	}, h.eventStore)

	if err != nil {
		if strings.Contains(err.Error(), "already suspended") {
			renderToastPartial(w, "error", "Realm already suspended")
			return
		}
		if strings.Contains(err.Error(), "not found") {
			renderToastPartial(w, "error", "Realm not found")
			return
		}
		renderToastPartial(w, "error", "Failed to suspend realm")
		return
	}

	// Redirect to realms list
	http.Redirect(w, r, "/admin/realms", http.StatusSeeOther)
}

// isAdmin returns true if the user has admin or owner role in the admin realm.
func isAdmin(roles map[string]string) bool {
	if roles == nil {
		return false
	}
	role, ok := roles[domain.AdminRealmID]
	return ok && (role == "admin" || role == "owner")
}

// AccountsListHandler handles GET /admin/accounts - list all accounts (admin-only).
func (h *Handlers) AccountsListHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := UsernameFromContext(r.Context())
	roles, _ := RolesFromContext(r.Context())

	// Check admin authorization
	if !isAdmin(roles) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Check for expand_form parameter
	expandForm := r.URL.Query().Get("expand_form") == "true"

	// Get all accounts from projection
	var accounts []projectors.AccountListEntry
	if h.projectionStore != nil {
		rawAccounts, err := h.projectionStore.List(r.Context(), domain.AdminRealmID, "account_list")
		if err != nil {
			log.Printf("AccountsListHandler: failed to list accounts: %v", err)
		} else {
			accounts = make([]projectors.AccountListEntry, 0, len(rawAccounts))
			for _, raw := range rawAccounts {
				var account projectors.AccountListEntry
				if err := json.Unmarshal(raw, &account); err != nil {
					continue
				}
				accounts = append(accounts, account)
			}
		}
	}

	h.templates.Render(w, "accounts/list.html", TemplateData{
		Title:   "Accounts",
		Account: h.buildAccountInfo(r, username, roles),
		Data: map[string]interface{}{
			"Accounts":    accounts,
			"ExpandForm":  expandForm,
		},
	})
}

// AccountDetailHandler handles GET /admin/accounts/{id} - show account details (admin-only).
func (h *Handlers) AccountDetailHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := UsernameFromContext(r.Context())
	roles, _ := RolesFromContext(r.Context())
	currentAccountID, _ := AccountIDFromContext(r.Context())

	// Check admin authorization
	if !isAdmin(roles) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Extract account ID from path
	accountID, errMsg := extractPathID(r.URL.Path, "/admin/accounts/")
	if errMsg != "" {
		http.Error(w, errMsg, http.StatusBadRequest)
		return
	}

	// Check projection store availability
	if h.projectionStore == nil {
		http.Error(w, "Service unavailable", http.StatusServiceUnavailable)
		return
	}

	// Get account detail
	var account projectors.AccountListEntry
	err := h.projectionStore.Get(r.Context(), domain.AdminRealmID, "account_list", accountID, &account)
	if err != nil {
		data := TemplateData{
			Title:   "Account Not Found",
			Error:   "Account not found",
			Account: h.buildAccountInfo(r, username, roles),
		}
		w.WriteHeader(http.StatusNotFound)
		h.templates.Render(w, "accounts/detail.html", data)
		return
	}

	// Get all realms for role assignment dropdown
	var realms []projectors.RealmListEntry
	rawRealms, err := h.projectionStore.List(r.Context(), domain.AdminRealmID, "realm_list")
	if err != nil {
		log.Printf("AccountDetailHandler: failed to list realms: %v", err)
	} else {
		realms = make([]projectors.RealmListEntry, 0, len(rawRealms))
		for _, raw := range rawRealms {
			var realm projectors.RealmListEntry
			if err := json.Unmarshal(raw, &realm); err != nil {
				continue
			}
			realms = append(realms, realm)
		}
	}

	h.templates.Render(w, "accounts/detail.html", TemplateData{
		Title:   account.Username,
		Account: h.buildAccountInfo(r, username, roles),
		Data: map[string]interface{}{
			"Account":         account,
			"Realms":          realms,
			"IsSelf":          account.AccountID == currentAccountID,
			"ValidRoles":      []string{"admin", "member", "viewer"},
		},
	})
}

// CreateAccountHandler handles POST /admin/accounts/create (admin-only).
func (h *Handlers) CreateAccountHandler(w http.ResponseWriter, r *http.Request) {
	roles, _ := RolesFromContext(r.Context())

	// Check admin authorization
	if !isAdmin(roles) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	username := strings.TrimSpace(r.FormValue("username"))
	if username == "" {
		renderToastPartial(w, "error", "Username is required")
		return
	}

	// Create account via domain command
	result, err := domain.HandleCreateAccount(r.Context(), domain.CreateAccount{
		Username: username,
	}, h.eventStore, h.projectionStore)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			renderToastPartial(w, "error", "Username already exists")
			return
		}
		renderToastPartial(w, "error", "Failed to create account")
		return
	}

	// Show success message with the generated PAT
	renderAccountCreatedPartial(w, result.AccountID, result.RawToken)
}

// renderAccountCreatedPartial renders a success message with the new PAT.
func renderAccountCreatedPartial(w http.ResponseWriter, accountID, rawToken string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	// Escape dynamic values to prevent XSS
	escapedAccountID := html.EscapeString(accountID)
	escapedRawToken := html.EscapeString(rawToken)

	// Render success partial with the token (shown once)
	htmlContent := `<div class="alert alert-success">
		<strong>Account created!</strong><br>
		Account ID: ` + escapedAccountID + `<br>
		<strong>Initial PAT (save this - it won't be shown again):</strong><br>
		<code style="user-select: all;">` + escapedRawToken + `</code>
	</div>
	<a href="/admin/accounts" class="btn btn-secondary">Back to Accounts</a>`

	if _, err := w.Write([]byte(htmlContent)); err != nil {
		log.Printf("renderAccountCreatedPartial: failed to write response: %v", err)
	}
}

// SuspendAccountHandler handles POST /admin/accounts/{id}/suspend (admin-only).
func (h *Handlers) SuspendAccountHandler(w http.ResponseWriter, r *http.Request) {
	roles, _ := RolesFromContext(r.Context())
	currentAccountID, _ := AccountIDFromContext(r.Context())

	// Check admin authorization
	if !isAdmin(roles) {
		renderToastPartial(w, "error", "Forbidden")
		return
	}

	accountID := r.PathValue("id")
	if accountID == "" {
		renderToastPartial(w, "error", "Account ID is required")
		return
	}

	// Prevent self-suspension
	if accountID == currentAccountID {
		renderToastPartial(w, "error", "Cannot suspend your own account")
		return
	}

	// Get reason from form
	reason := r.FormValue("reason")

	// Suspend account via domain command
	err := domain.HandleSuspendAccount(r.Context(), domain.SuspendAccount{
		AccountID: accountID,
		Reason:    reason,
	}, h.eventStore)

	if err != nil {
		if strings.Contains(err.Error(), "suspended") {
			renderToastPartial(w, "error", "Account already suspended")
			return
		}
		if strings.Contains(err.Error(), "not found") {
			renderToastPartial(w, "error", "Account not found")
			return
		}
		renderToastPartial(w, "error", "Failed to suspend account")
		return
	}

	// Redirect to accounts list
	http.Redirect(w, r, "/admin/accounts", http.StatusSeeOther)
}

// UpdateRolesHandler handles POST /admin/accounts/{id}/roles (admin-only).
func (h *Handlers) UpdateRolesHandler(w http.ResponseWriter, r *http.Request) {
	roles, _ := RolesFromContext(r.Context())
	currentAccountID, _ := AccountIDFromContext(r.Context())

	// Check admin authorization
	if !isAdmin(roles) {
		renderToastPartial(w, "error", "Forbidden")
		return
	}

	accountID := r.PathValue("id")
	if accountID == "" {
		renderToastPartial(w, "error", "Account ID is required")
		return
	}

	// Prevent self-modification
	if accountID == currentAccountID {
		renderToastPartial(w, "error", "Cannot modify your own account")
		return
	}

	// Get form values
	realmID := r.FormValue("realm_id")
	action := r.FormValue("action") // "assign" or "revoke"
	role := r.FormValue("role")

	var err error

	switch action {
	case "assign":
		if realmID == "" || role == "" {
			renderToastPartial(w, "error", "Realm and role are required")
			return
		}
		if !domain.IsValidRole(role) {
			renderToastPartial(w, "error", "Invalid role")
			return
		}
		err = domain.HandleAssignRole(r.Context(), domain.AssignRole{
			AccountID: accountID,
			RealmID:   realmID,
			Role:      role,
		}, h.eventStore)
	case "revoke":
		if realmID == "" {
			renderToastPartial(w, "error", "Realm is required")
			return
		}
		err = domain.HandleRevokeRole(r.Context(), domain.RevokeRole{
			AccountID: accountID,
			RealmID:   realmID,
		}, h.eventStore)
	default:
		renderToastPartial(w, "error", "Invalid action")
		return
	}

	if err != nil {
		if strings.Contains(err.Error(), "not granted") {
			renderToastPartial(w, "error", "Realm not granted to this account")
			return
		}
		if strings.Contains(err.Error(), "not found") {
			renderToastPartial(w, "error", "Account not found")
			return
		}
		renderToastPartial(w, "error", "Failed to update role")
		return
	}

	// Redirect back to account detail
	http.Redirect(w, r, "/admin/accounts/"+accountID, http.StatusSeeOther)
}

// PATsListHandler handles GET /admin/accounts/{id}/pats - list PATs for account (admin-only).
func (h *Handlers) PATsListHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := UsernameFromContext(r.Context())
	roles, _ := RolesFromContext(r.Context())

	// Check admin authorization
	if !isAdmin(roles) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Extract account ID from path
	accountID := r.PathValue("id")
	if accountID == "" {
		http.Error(w, "Account ID is required", http.StatusBadRequest)
		return
	}

	// Check projection store availability
	if h.projectionStore == nil {
		http.Error(w, "Service unavailable", http.StatusServiceUnavailable)
		return
	}

	// Get account detail to show username
	var account projectors.AccountListEntry
	err := h.projectionStore.Get(r.Context(), domain.AdminRealmID, "account_list", accountID, &account)
	if err != nil {
		data := TemplateData{
			Title:   "Account Not Found",
			Error:   "Account not found",
			Account: h.buildAccountInfo(r, username, roles),
		}
		w.WriteHeader(http.StatusNotFound)
		h.templates.Render(w, "accounts/pats.html", data)
		return
	}

	// Get PATs for this account by reading account state
	pats := []PATInfo{}
	if h.eventStore != nil {
		streamID := "account-" + accountID
		events, err := h.eventStore.ReadStream(r.Context(), domain.AdminRealmID, streamID, 0)
		if err != nil {
			log.Printf("PATsListHandler: failed to read events for account %s: %v", accountID, err)
		} else {
			pats = rebuildPATsFromEvents(events)
		}
	}

	h.templates.Render(w, "accounts/pats.html", TemplateData{
		Title:   "PATs for " + account.Username,
		Account: h.buildAccountInfo(r, username, roles),
		Data: map[string]interface{}{
			"Account":   account,
			"PATs":      pats,
			"AccountID": accountID,
		},
	})
}

// PATInfo represents a PAT for display purposes.
type PATInfo struct {
	PATID     string    `json:"pat_id"`
	Label     string    `json:"label"`
	CreatedAt time.Time `json:"created_at"`
	Revoked   bool      `json:"revoked"`
}

// rebuildPATsFromEvents extracts PAT information from account events.
func rebuildPATsFromEvents(events []core.Event) []PATInfo {
	pats := make(map[string]PATInfo)

	for _, evt := range events {
		switch evt.EventType {
		case domain.EventPATCreated:
			var data domain.PATCreated
			if err := json.Unmarshal(evt.Data, &data); err != nil {
				continue
			}
			pats[data.PATID] = PATInfo{
				PATID:     data.PATID,
				Label:     data.Label,
				CreatedAt: data.CreatedAt,
			}
		case domain.EventPATRevoked:
			var data domain.PATRevoked
			if err := json.Unmarshal(evt.Data, &data); err != nil {
				continue
			}
			if pat, ok := pats[data.PATID]; ok {
				pat.Revoked = true
				pats[data.PATID] = pat
			}
		}
	}

	// Convert map to slice
	result := make([]PATInfo, 0, len(pats))
	for _, pat := range pats {
		result = append(result, pat)
	}
	return result
}

// PATActionHandler handles POST /admin/accounts/{id}/pats - create or revoke PAT (admin-only).
func (h *Handlers) PATActionHandler(w http.ResponseWriter, r *http.Request) {
	roles, _ := RolesFromContext(r.Context())

	// Check admin authorization
	if !isAdmin(roles) {
		renderToastPartial(w, "error", "Forbidden")
		return
	}

	accountID := r.PathValue("id")
	if accountID == "" {
		renderToastPartial(w, "error", "Account ID is required")
		return
	}

	action := r.FormValue("action")

	switch action {
	case "create":
		label := strings.TrimSpace(r.FormValue("label"))
		if label == "" {
			label = "unnamed"
		}

		result, err := domain.HandleCreatePAT(r.Context(), domain.CreatePAT{
			AccountID: accountID,
			Label:     label,
		}, h.eventStore)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				renderToastPartial(w, "error", "Account not found")
				return
			}
			if strings.Contains(err.Error(), "suspended") {
				renderToastPartial(w, "error", "Account is suspended")
				return
			}
			renderToastPartial(w, "error", "Failed to create PAT")
			return
		}

		// Show success message with the generated PAT token (shown once)
		renderPATCreatedPartial(w, result.PATID, result.RawToken)

	case "revoke":
		patID := r.FormValue("pat_id")
		if patID == "" {
			renderToastPartial(w, "error", "PAT ID is required")
			return
		}

		err := domain.HandleRevokePAT(r.Context(), domain.RevokePAT{
			AccountID: accountID,
			PATID:     patID,
		}, h.eventStore)
		if err != nil {
			if strings.Contains(err.Error(), "not found") {
				renderToastPartial(w, "error", "PAT not found")
				return
			}
			if strings.Contains(err.Error(), "already revoked") {
				renderToastPartial(w, "error", "PAT already revoked")
				return
			}
			renderToastPartial(w, "error", "Failed to revoke PAT")
			return
		}

		// Redirect back to PATs list
		http.Redirect(w, r, "/admin/accounts/"+accountID+"/pats", http.StatusSeeOther)

	default:
		renderToastPartial(w, "error", "Invalid action")
	}
}

// CreateRuneHandler handles POST /admin/runes/create.
func (h *Handlers) CreateRuneHandler(w http.ResponseWriter, r *http.Request) {
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRequest(r, roles)

	// Check member+ authorization
	if !canTakeAction(roles, realmID) {
		renderToastPartial(w, "error", "Unauthorized: member access required")
		return
	}

	// Get form values
	title := strings.TrimSpace(r.FormValue("title"))
	description := strings.TrimSpace(r.FormValue("description"))
	priorityStr := r.FormValue("priority")
	parentID := strings.TrimSpace(r.FormValue("parent_id"))
	branch := strings.TrimSpace(r.FormValue("branch"))

	// Validate required fields
	if title == "" {
		renderToastPartial(w, "error", "Title is required")
		return
	}

	// Parse priority (default to 0 if empty or invalid)
	priority := 0
	if priorityStr != "" {
		if p, err := strconv.Atoi(priorityStr); err == nil && p >= 0 && p <= 4 {
			priority = p
		}
	}

	// Build CreateRune command
	cmd := domain.CreateRune{
		Title:       title,
		Description: description,
		Priority:    priority,
	}

	// Set parent ID if provided
	if parentID != "" {
		cmd.ParentID = parentID
	}

	// Set branch if provided (top-level runes require branch)
	if branch != "" {
		cmd.Branch = &branch
	}

	// Create rune via domain command
	result, err := domain.HandleCreateRune(r.Context(), realmID, cmd, h.eventStore, h.projectionStore)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			renderToastPartial(w, "error", "Parent rune not found")
			return
		}
		if strings.Contains(err.Error(), "sealed") || strings.Contains(err.Error(), "shattered") {
			renderToastPartial(w, "error", "Cannot create child of sealed or shattered rune")
			return
		}
		if strings.Contains(err.Error(), "branch") {
			renderToastPartial(w, "error", "Top-level runes require a branch")
			return
		}
		log.Printf("CreateRuneHandler: failed to create rune: %v", err)
		renderToastPartial(w, "error", "Failed to create rune")
		return
	}

	// Check if request wants HTMX partial or full redirect
	if r.Header.Get("HX-Request") == "true" {
		renderRuneCreatedPartial(w, result.ID, result.Title)
		return
	}

	// Redirect to rune detail page
	http.Redirect(w, r, "/admin/runes/"+result.ID, http.StatusSeeOther)
}

// UpdateRuneHandler handles POST /admin/runes/{id}/update.
func (h *Handlers) UpdateRuneHandler(w http.ResponseWriter, r *http.Request) {
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRequest(r, roles)

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

	// Get form values (only update fields that are provided)
	cmd := domain.UpdateRune{ID: runeID}

	if title := strings.TrimSpace(r.FormValue("title")); title != "" {
		cmd.Title = &title
	}

	if description := r.FormValue("description"); description != "" || r.FormValue("clear_description") == "true" {
		// Allow clearing description by sending empty value with clear_description flag
		if r.FormValue("clear_description") == "true" {
			empty := ""
			cmd.Description = &empty
		} else {
			cmd.Description = &description
		}
	}

	if priorityStr := r.FormValue("priority"); priorityStr != "" {
		if p, err := strconv.Atoi(priorityStr); err == nil && p >= 0 && p <= 4 {
			cmd.Priority = &p
		}
	}

	if branch := strings.TrimSpace(r.FormValue("branch")); branch != "" {
		cmd.Branch = &branch
	}

	// Update rune via domain command
	err := domain.HandleUpdateRune(r.Context(), realmID, cmd, h.eventStore)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			renderToastPartial(w, "error", "Rune not found")
			return
		}
		if strings.Contains(err.Error(), "sealed") || strings.Contains(err.Error(), "shattered") {
			renderToastPartial(w, "error", "Cannot update sealed or shattered rune")
			return
		}
		log.Printf("UpdateRuneHandler: failed to update rune %s: %v", runeID, err)
		renderToastPartial(w, "error", "Failed to update rune")
		return
	}

	// Get updated rune for partial response with retry for eventual consistency
	if h.projectionStore == nil {
		renderToastPartial(w, "success", "Rune updated - refresh to see changes")
		return
	}
	var rune projectors.RuneDetail
	const maxRetries = 3
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		if err := h.projectionStore.Get(r.Context(), realmID, "rune_detail", runeID, &rune); err != nil {
			lastErr = err
			delay := time.Duration(i+1) * 50 * time.Millisecond
			select {
			case <-time.After(delay):
			case <-r.Context().Done():
				renderToastPartial(w, "error", "Request cancelled")
				return
			}
			continue
		}
		lastErr = nil
		break
	}
	if lastErr != nil {
		renderToastPartial(w, "success", "Rune updated - refresh to see changes")
		return
	}

	// Return partial HTML for htmx swap
	renderRuneUpdatedPartial(w, rune, canTakeAction(roles, realmID))
}

// RuneForgeHandler handles POST /admin/runes/{id}/forge.
func (h *Handlers) RuneForgeHandler(w http.ResponseWriter, r *http.Request) {
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRequest(r, roles)

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

	// Forge rune via domain command
	err := domain.HandleForgeRune(r.Context(), realmID, domain.ForgeRune{ID: runeID}, h.eventStore, h.projectionStore)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			renderToastPartial(w, "error", "Rune not found")
			return
		}
		if strings.Contains(err.Error(), "shattered") {
			renderToastPartial(w, "error", "Cannot forge shattered rune")
			return
		}
		log.Printf("RuneForgeHandler: failed to forge rune %s: %v", runeID, err)
		renderToastPartial(w, "error", "Failed to forge rune")
		return
	}

	// Get updated rune for partial response with retry for eventual consistency
	if h.projectionStore == nil {
		renderToastPartial(w, "success", "Rune forged - refresh to see changes")
		return
	}
	var rune projectors.RuneDetail
	const maxRetries = 3
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		if err := h.projectionStore.Get(r.Context(), realmID, "rune_detail", runeID, &rune); err != nil {
			lastErr = err
			delay := time.Duration(i+1) * 50 * time.Millisecond
			select {
			case <-time.After(delay):
			case <-r.Context().Done():
				renderToastPartial(w, "error", "Request cancelled")
				return
			}
			continue
		}
		lastErr = nil
		break
	}
	if lastErr != nil {
		renderToastPartial(w, "success", "Rune forged - refresh to see changes")
		return
	}

	// Return partial HTML for htmx swap
	renderRuneUpdatedPartial(w, rune, canTakeAction(roles, realmID))
}

// AddDependencyHandler handles POST /admin/runes/{id}/dependencies.
func (h *Handlers) AddDependencyHandler(w http.ResponseWriter, r *http.Request) {
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRequest(r, roles)

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

	targetID := strings.TrimSpace(r.FormValue("target_id"))
	relationship := strings.TrimSpace(r.FormValue("relationship"))

	if targetID == "" {
		renderToastPartial(w, "error", "Target rune ID is required")
		return
	}
	if relationship == "" {
		renderToastPartial(w, "error", "Relationship type is required")
		return
	}

	// Add dependency via domain command
	err := domain.HandleAddDependency(r.Context(), realmID, domain.AddDependency{
		RuneID:       runeID,
		TargetID:     targetID,
		Relationship: relationship,
	}, h.eventStore, h.projectionStore)

	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			renderToastPartial(w, "error", "Rune not found")
			return
		}
		if strings.Contains(err.Error(), "unknown relationship") {
			renderToastPartial(w, "error", "Invalid relationship type")
			return
		}
		if strings.Contains(err.Error(), "self") {
			renderToastPartial(w, "error", "Cannot create self-referential dependency")
			return
		}
		log.Printf("AddDependencyHandler: failed to add dependency: %v", err)
		renderToastPartial(w, "error", "Failed to add dependency")
		return
	}

	// Get updated rune for partial response
	if h.projectionStore == nil {
		renderToastPartial(w, "success", "Dependency added - refresh to see changes")
		return
	}
	var rune projectors.RuneDetail
	const maxRetries = 3
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		if err := h.projectionStore.Get(r.Context(), realmID, "rune_detail", runeID, &rune); err != nil {
			lastErr = err
			delay := time.Duration(i+1) * 50 * time.Millisecond
			select {
			case <-time.After(delay):
			case <-r.Context().Done():
				renderToastPartial(w, "error", "Request cancelled")
				return
			}
			continue
		}
		lastErr = nil
		break
	}
	if lastErr != nil {
		renderToastPartial(w, "success", "Dependency added - refresh to see changes")
		return
	}

	// Return partial HTML for htmx swap
	renderRuneUpdatedPartial(w, rune, canTakeAction(roles, realmID))
}

// RemoveDependencyHandler handles DELETE /admin/runes/{id}/dependencies.
func (h *Handlers) RemoveDependencyHandler(w http.ResponseWriter, r *http.Request) {
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRequest(r, roles)

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

	targetID := strings.TrimSpace(r.FormValue("target_id"))
	relationship := strings.TrimSpace(r.FormValue("relationship"))

	if targetID == "" {
		renderToastPartial(w, "error", "Target rune ID is required")
		return
	}
	if relationship == "" {
		renderToastPartial(w, "error", "Relationship type is required")
		return
	}

	// Remove dependency via domain command
	err := domain.HandleRemoveDependency(r.Context(), realmID, domain.RemoveDependency{
		RuneID:       runeID,
		TargetID:     targetID,
		Relationship: relationship,
	}, h.eventStore, h.projectionStore)

	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			renderToastPartial(w, "error", "Rune or dependency not found")
			return
		}
		log.Printf("RemoveDependencyHandler: failed to remove dependency: %v", err)
		renderToastPartial(w, "error", "Failed to remove dependency")
		return
	}

	// Get updated rune for partial response
	if h.projectionStore == nil {
		renderToastPartial(w, "success", "Dependency removed - refresh to see changes")
		return
	}
	var rune projectors.RuneDetail
	const maxRetries = 3
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		if err := h.projectionStore.Get(r.Context(), realmID, "rune_detail", runeID, &rune); err != nil {
			lastErr = err
			delay := time.Duration(i+1) * 50 * time.Millisecond
			select {
			case <-time.After(delay):
			case <-r.Context().Done():
				renderToastPartial(w, "error", "Request cancelled")
				return
			}
			continue
		}
		lastErr = nil
		break
	}
	if lastErr != nil {
		renderToastPartial(w, "success", "Dependency removed - refresh to see changes")
		return
	}

	// Return partial HTML for htmx swap
	renderRuneUpdatedPartial(w, rune, canTakeAction(roles, realmID))
}

// RuneUnclaimHandler handles POST /admin/runes/{id}/unclaim.
func (h *Handlers) RuneUnclaimHandler(w http.ResponseWriter, r *http.Request) {
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRequest(r, roles)

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

	// Unclaim rune via domain command
	err := domain.HandleUnclaimRune(r.Context(), realmID, domain.UnclaimRune{ID: runeID}, h.eventStore)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			renderToastPartial(w, "error", "Rune not found")
			return
		}
		if strings.Contains(err.Error(), "not claimed") {
			renderToastPartial(w, "error", "Rune is not claimed")
			return
		}
		if strings.Contains(err.Error(), "sealed") || strings.Contains(err.Error(), "fulfilled") {
			renderToastPartial(w, "error", "Cannot unclaim sealed or fulfilled rune")
			return
		}
		log.Printf("RuneUnclaimHandler: failed to unclaim rune %s: %v", runeID, err)
		renderToastPartial(w, "error", "Failed to unclaim rune")
		return
	}

	// Get updated rune for partial response with retry for eventual consistency
	if h.projectionStore == nil {
		renderToastPartial(w, "success", "Rune unclaimed - refresh to see changes")
		return
	}
	var rune projectors.RuneDetail
	const maxRetries = 3
	var lastErr error
	for i := 0; i < maxRetries; i++ {
		if err := h.projectionStore.Get(r.Context(), realmID, "rune_detail", runeID, &rune); err != nil {
			lastErr = err
			delay := time.Duration(i+1) * 50 * time.Millisecond
			select {
			case <-time.After(delay):
			case <-r.Context().Done():
				renderToastPartial(w, "error", "Request cancelled")
				return
			}
			continue
		}
		lastErr = nil
		break
	}
	if lastErr != nil {
		renderToastPartial(w, "success", "Rune unclaimed - refresh to see changes")
		return
	}

	// Return partial HTML for htmx swap
	renderRuneUpdatedPartial(w, rune, canTakeAction(roles, realmID))
}

// RuneShatterHandler handles POST /admin/runes/{id}/shatter.
func (h *Handlers) RuneShatterHandler(w http.ResponseWriter, r *http.Request) {
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRequest(r, roles)

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

	// Check confirmation (for safety)
	confirm := r.FormValue("confirm")
	if confirm != "true" {
		renderToastPartial(w, "error", "Shatter requires confirmation")
		return
	}

	// Shatter rune via domain command
	err := domain.HandleShatterRune(r.Context(), realmID, domain.ShatterRune{ID: runeID}, h.eventStore)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			renderToastPartial(w, "error", "Rune not found")
			return
		}
		if strings.Contains(err.Error(), "must be sealed or fulfilled") {
			renderToastPartial(w, "error", "Can only shatter fulfilled or sealed runes")
			return
		}
		log.Printf("RuneShatterHandler: failed to shatter rune %s: %v", runeID, err)
		renderToastPartial(w, "error", "Failed to shatter rune")
		return
	}

	// Redirect to runes list after shatter (rune is now tombstone)
	http.Redirect(w, r, "/admin/runes", http.StatusSeeOther)
}

// SweepRunesHandler handles POST /admin/runes/sweep.
func (h *Handlers) SweepRunesHandler(w http.ResponseWriter, r *http.Request) {
	roles, _ := RolesFromContext(r.Context())
	realmID := getRealmIDFromRequest(r, roles)

	// Check admin authorization (sweep is admin-only)
	if !isAdmin(roles) {
		renderToastPartial(w, "error", "Unauthorized: admin access required")
		return
	}

	// Check confirmation
	confirm := r.FormValue("confirm")
	if confirm != "true" {
		renderToastPartial(w, "error", "Sweep requires confirmation")
		return
	}

	// Sweep runes via domain command
	shattered, err := domain.HandleSweepRunes(r.Context(), realmID, h.eventStore, h.projectionStore)
	if err != nil {
		log.Printf("SweepRunesHandler: failed to sweep runes: %v", err)
		renderToastPartial(w, "error", "Failed to sweep runes")
		return
	}

	// Log the shattered rune IDs server-side for audit purposes
	if len(shattered) > 0 {
		log.Printf("SweepRunesHandler: shattered %d rune(s): %s", len(shattered), strings.Join(shattered, ", "))
	}

	// Return success message with count only (no internal IDs in client response)
	renderSweepResultPartial(w, len(shattered))
}

// renderSweepResultPartial renders the sweep results.
func renderSweepResultPartial(w http.ResponseWriter, count int) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	var buf strings.Builder

	buf.WriteString(`<div class="toast toast-success" hx-swap-oob="beforeend:#toasts">`)
	if count == 0 {
		buf.WriteString("No runes to sweep")
	} else {
		buf.WriteString(fmt.Sprintf("Swept %d rune(s) successfully", count))
	}
	buf.WriteString(`</div>`)

	// Trigger a page refresh to show updated list
	buf.WriteString(`<div hx-get="/admin/runes" hx-trigger="load" hx-target="body" hx-swap="outerHTML"></div>`)

	if _, err := w.Write([]byte(buf.String())); err != nil {
		log.Printf("renderSweepResultPartial: failed to write response: %v", err)
	}
}

// renderRuneUpdatedPartial renders the updated rune details for htmx swap.
func renderRuneUpdatedPartial(w http.ResponseWriter, rune projectors.RuneDetail, canTakeAction bool) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	// Escape dynamic values to prevent XSS
	escapedID := html.EscapeString(rune.ID)
	escapedStatus := html.EscapeString(rune.Status)
	escapedDescription := html.EscapeString(rune.Description)
	escapedBranch := html.EscapeString(rune.Branch)
	escapedClaimant := html.EscapeString(rune.Claimant)
	escapedParentID := html.EscapeString(rune.ParentID)

	// Build the updated detail card
	var buf strings.Builder
	buf.WriteString(`<div class="rune-detail" id="rune-`)
	buf.WriteString(escapedID)
	buf.WriteString(`">`)

	// Success toast
	buf.WriteString(`<div class="toast toast-success" hx-swap-oob="beforeend:#toasts">Rune updated successfully</div>`)

	// Details card
	buf.WriteString(`<div class="card">
		<div class="card-header">
			<h2>Details</h2>
			<span class="badge badge-`)
	buf.WriteString(escapedStatus)
	buf.WriteString(`">`)
	buf.WriteString(escapedStatus)
	buf.WriteString(`</span>
		</div>
		<div class="card-body">
			<dl class="dl-horizontal">
				<dt>Status</dt>
				<dd>`)
	buf.WriteString(escapedStatus)
	buf.WriteString(`</dd>
				<dt>Priority</dt>
				<dd>`)
	buf.WriteString(strconv.Itoa(rune.Priority))
	buf.WriteString(`</dd>`)
	if rune.Claimant != "" {
		buf.WriteString(`
				<dt>Claimant</dt>
				<dd>`)
		buf.WriteString(escapedClaimant)
		buf.WriteString(`</dd>`)
	}
	if rune.Branch != "" {
		buf.WriteString(`
				<dt>Branch</dt>
				<dd>`)
		buf.WriteString(escapedBranch)
		buf.WriteString(`</dd>`)
	}
	if rune.ParentID != "" {
		buf.WriteString(`
				<dt>Parent</dt>
				<dd><a href="/admin/runes/`)
		buf.WriteString(escapedParentID)
		buf.WriteString(`">`)
		buf.WriteString(escapedParentID)
		buf.WriteString(`</a></dd>`)
	}
	buf.WriteString(`
				<dt>Created</dt>
				<dd>`)
	buf.WriteString(rune.CreatedAt.Format(time.RFC3339))
	buf.WriteString(`</dd>
				<dt>Updated</dt>
				<dd>`)
	buf.WriteString(rune.UpdatedAt.Format(time.RFC3339))
	buf.WriteString(`</dd>
			</dl>`)

	if rune.Description != "" {
		buf.WriteString(`
			<h3>Description</h3>
			<p>`)
		buf.WriteString(escapedDescription)
		buf.WriteString(`</p>`)
	}

	buf.WriteString(`
		</div>
	</div>`)

	// Actions card (if can take action)
	if canTakeAction {
		buf.WriteString(`
	<div class="card">
		<div class="card-header">
			<h2>Actions</h2>
		</div>
		<div class="card-body">
			<div class="rune-actions">`)
		if rune.Status == "draft" {
			buf.WriteString(`
				<button class="btn btn-warning" hx-post="/admin/runes/`)
			buf.WriteString(escapedID)
			buf.WriteString(`/forge" hx-target="closest .rune-detail" hx-swap="outerHTML">Forge</button>`)
		}
		if rune.Status == "open" {
			buf.WriteString(`
				<button class="btn btn-primary" hx-post="/admin/runes/`)
			buf.WriteString(escapedID)
			buf.WriteString(`/claim" hx-target="closest .rune-detail" hx-swap="outerHTML">Claim</button>`)
		}
		if rune.Status == "claimed" {
			buf.WriteString(`
				<button class="btn btn-success" hx-post="/admin/runes/`)
			buf.WriteString(escapedID)
			buf.WriteString(`/fulfill" hx-target="closest .rune-detail" hx-swap="outerHTML">Fulfill</button>`)
			buf.WriteString(`
				<button class="btn btn-warning" hx-post="/admin/runes/`)
			buf.WriteString(escapedID)
			buf.WriteString(`/unclaim" hx-target="closest .rune-detail" hx-swap="outerHTML">Unclaim</button>`)
		}
		if rune.Status != "sealed" && rune.Status != "shattered" {
			buf.WriteString(`
				<button class="btn btn-secondary" hx-post="/admin/runes/`)
			buf.WriteString(escapedID)
			buf.WriteString(`/seal" hx-target="closest .rune-detail" hx-swap="outerHTML">Seal</button>`)
		}
		if rune.Status == "fulfilled" || rune.Status == "sealed" {
			buf.WriteString(`
				<button class="btn btn-danger" hx-post="/admin/runes/`)
			buf.WriteString(escapedID)
			buf.WriteString(`/shatter" hx-vals='{"confirm": "true"}' hx-confirm="Are you sure you want to shatter this rune? This is irreversible!" hx-target="body" hx-swap="none">Shatter</button>`)
		}
		if rune.Status != "shattered" {
			buf.WriteString(`
				<form hx-post="/admin/runes/`)
			buf.WriteString(escapedID)
			buf.WriteString(`/note" hx-target="closest .rune-detail" hx-swap="outerHTML" class="form-inline">
					<input type="text" name="note" placeholder="Add a note..." class="form-control" required>
					<button type="submit" class="btn btn-primary">Add Note</button>
				</form>`)
		}
		buf.WriteString(`
			</div>
		</div>
	</div>`)
	}

	buf.WriteString(`</div>`)

	if _, err := w.Write([]byte(buf.String())); err != nil {
		log.Printf("renderRuneUpdatedPartial: failed to write response for rune %s: %v", rune.ID, err)
	}
}

// renderRuneCreatedPartial renders a success message for htmx requests.
func renderRuneCreatedPartial(w http.ResponseWriter, runeID, title string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	// Escape dynamic values to prevent XSS
	escapedID := html.EscapeString(runeID)
	escapedTitle := html.EscapeString(title)

	htmlContent := `<div class="alert alert-success">
		<strong>Rune Created!</strong><br>
		ID: <a href="/admin/runes/` + escapedID + `">` + escapedID + `</a><br>
		Title: ` + escapedTitle + `
	</div>
	<a href="/admin/runes/` + escapedID + `" class="btn btn-primary">View Rune</a>
	<a href="/admin/runes" class="btn btn-secondary">Back to List</a>`

	if _, err := w.Write([]byte(htmlContent)); err != nil {
		log.Printf("renderRuneCreatedPartial: failed to write response for rune %s: %v", runeID, err)
	}
}

// renderPATCreatedPartial renders a success message with the new PAT token.
func renderPATCreatedPartial(w http.ResponseWriter, patID, rawToken string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	// Escape dynamic values to prevent XSS
	escapedPatID := html.EscapeString(patID)
	escapedRawToken := html.EscapeString(rawToken)

	// Render success partial with the token (shown once)
	htmlContent := `<div class="alert alert-success">
		<strong>PAT Created!</strong><br>
		PAT ID: ` + escapedPatID + `<br>
		<strong>Token (save this - it won't be shown again):</strong><br>
		<code style="user-select: all; word-break: break-all;">` + escapedRawToken + `</code>
	</div>
	<a href="" class="btn btn-secondary" onclick="location.reload(); return false;">Back to PATs</a>`

	if _, err := w.Write([]byte(htmlContent)); err != nil {
		log.Printf("renderPATCreatedPartial: failed to write response for PAT %s: %v", patID, err)
	}
}

// renderRealmCreatedPartial renders a success message and triggers page refresh for htmx.
func renderRealmCreatedPartial(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	var buf strings.Builder
	buf.WriteString(`<div class="toast toast-success" hx-swap-oob="beforeend:#toasts">Realm created successfully</div>`)
	// Trigger page refresh to show updated list
	buf.WriteString(`<div hx-get="/admin/realms" hx-trigger="load" hx-target="body" hx-swap="outerHTML"></div>`)

	if _, err := w.Write([]byte(buf.String())); err != nil {
		log.Printf("renderRealmCreatedPartial: failed to write response: %v", err)
	}
}
