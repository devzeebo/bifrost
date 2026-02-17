// Package admin provides the server-rendered admin UI for Bifrost.
package admin

import (
	"encoding/json"
	"errors"
	"html"
	"log"
	"net/http"
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
	sort.Slice(runes, func(i, j int) bool {
		return runes[i].UpdatedAt.After(runes[j].UpdatedAt)
	})
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

	// Extract rune ID from path
	runeID, errMsg := extractPathID(r.URL.Path, "/admin/runes/")
	if errMsg != "" {
		http.Error(w, errMsg, http.StatusBadRequest)
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
		renderToastPartial(w, "success", "Action completed - refresh to see changes")
		return
	}

	// Return partial HTML for htmx swap
	renderRuneActionsPartial(w, rune, canTakeAction(roles, realmID))
}

// getRealmIDFromRoles extracts the realm ID from the roles map.
// Returns the lexicographically first non-_admin realm found, or "_admin" if only admin role.
func getRealmIDFromRoles(roles map[string]string) string {
	first := ""
	for realmID := range roles {
		if realmID == "_admin" {
			continue
		}
		if first == "" || realmID < first {
			first = realmID
		}
	}
	if first != "" {
		return first
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

	var class string
	switch toastType {
	case "error":
		class = "toast-error"
	case "success":
		class = "toast-success"
	default:
		class = "toast-info"
	}

	// Escape dynamic values to prevent XSS
	escapedClass := html.EscapeString(class)
	escapedMessage := html.EscapeString(message)

	// Create a toast element that htmx will swap into the toasts container
	// Using oob-swap to update the toasts area
	if _, err := w.Write([]byte(`<div class="toast ` + escapedClass + `" hx-swap-oob="beforeend:#toasts">` + escapedMessage + `</div>`)); err != nil {
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
		Title: "Realms",
		Account: &AccountInfo{
			Username: username,
			Roles:    roles,
		},
		Data: map[string]interface{}{
			"Realms": realms,
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
			Account: &AccountInfo{Username: username, Roles: roles},
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
		Account: &AccountInfo{Username: username, Roles: roles},
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

// isAdmin returns true if the user has admin role in the _admin realm.
func isAdmin(roles map[string]string) bool {
	if roles == nil {
		return false
	}
	role, ok := roles["_admin"]
	return ok && role == "admin"
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
		Title: "Accounts",
		Account: &AccountInfo{
			Username: username,
			Roles:    roles,
		},
		Data: map[string]interface{}{
			"Accounts": accounts,
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
			Account: &AccountInfo{Username: username, Roles: roles},
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
		Account: &AccountInfo{Username: username, Roles: roles},
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
	html := `<div class="alert alert-success">
		<strong>Account created!</strong><br>
		Account ID: ` + escapedAccountID + `<br>
		<strong>Initial PAT (save this - it won't be shown again):</strong><br>
		<code style="user-select: all;">` + escapedRawToken + `</code>
	</div>
	<a href="/admin/accounts" class="btn btn-secondary">Back to Accounts</a>`

	if _, err := w.Write([]byte(html)); err != nil {
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
			Account: &AccountInfo{Username: username, Roles: roles},
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
		Account: &AccountInfo{Username: username, Roles: roles},
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

// renderPATCreatedPartial renders a success message with the new PAT token.
func renderPATCreatedPartial(w http.ResponseWriter, patID, rawToken string) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)

	// Escape dynamic values to prevent XSS
	escapedPatID := html.EscapeString(patID)
	escapedRawToken := html.EscapeString(rawToken)

	// Render success partial with the token (shown once)
	html := `<div class="alert alert-success">
		<strong>PAT Created!</strong><br>
		PAT ID: ` + escapedPatID + `<br>
		<strong>Token (save this - it won't be shown again):</strong><br>
		<code style="user-select: all; word-break: break-all;">` + escapedRawToken + `</code>
	</div>
	<a href="" class="btn btn-secondary" onclick="location.reload(); return false;">Back to PATs</a>`

	if _, err := w.Write([]byte(html)); err != nil {
		log.Printf("renderPATCreatedPartial: failed to write response for PAT %s: %v", patID, err)
	}
}
