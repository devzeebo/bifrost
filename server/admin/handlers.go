// Package admin provides the server-rendered admin UI for Bifrost.
package admin

import (
	"net/http"
	"strings"

	"github.com/devzeebo/bifrost/core"
)

// Handlers contains all admin UI HTTP handlers.
type Handlers struct {
	templates       *Templates
	authConfig      *AuthConfig
	projectionStore core.ProjectionStore
}

// NewHandlers creates a new Handlers instance.
func NewHandlers(templates *Templates, authConfig *AuthConfig, projectionStore core.ProjectionStore) *Handlers {
	return &Handlers{
		templates:       templates,
		authConfig:      authConfig,
		projectionStore: projectionStore,
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
}

// DashboardHandler handles GET requests for the dashboard.
func (h *Handlers) DashboardHandler(w http.ResponseWriter, r *http.Request) {
	username, _ := UsernameFromContext(r.Context())
	roles, _ := RolesFromContext(r.Context())

	data := TemplateData{
		Title: "Dashboard",
		Account: &AccountInfo{
			Username: username,
			Roles:    roles,
		},
	}

	h.templates.Render(w, "dashboard.html", data)
}
