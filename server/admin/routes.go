package admin

import (
	"fmt"
	"net/http"

	"github.com/devzeebo/bifrost/core"
)

// RouteConfig holds the configuration for registering admin routes.
type RouteConfig struct {
	AuthConfig      *AuthConfig
	ProjectionStore core.ProjectionStore
	EventStore      core.EventStore
}

// RegisterRoutes registers all admin UI routes with the given mux.
// It sets up the middleware chain internally:
// 1. AuthMiddleware - validates JWT, loads account into context
// 2. RoleMiddleware - checks required role for route (admin-only routes)
//
// Route groups:
// - Public: /admin/login, /admin/static/*
// - Authenticated (any): /admin/, /admin/logout, /admin/runes (list/detail)
// - Member+: /admin/runes/{id}/claim|fulfill|seal|note
// - Admin-only: /admin/realms/*, /admin/accounts/*
func RegisterRoutes(mux *http.ServeMux, cfg *RouteConfig) error {
	// Create handlers
	templates, err := NewTemplates()
	if err != nil {
		return fmt.Errorf("failed to load templates: %w", err)
	}

	handlers := NewHandlers(templates, cfg.AuthConfig, cfg.ProjectionStore, cfg.EventStore)

	// Create middleware
	authMiddleware := AuthMiddleware(cfg.AuthConfig, cfg.ProjectionStore)
	requireAdmin := RequireAdminMiddleware()

	// Public routes (no auth required)
	mux.HandleFunc("GET /admin/login", handlers.LoginHandler)
	mux.HandleFunc("POST /admin/login", handlers.LoginHandler)
	mux.Handle("GET /admin/static/", http.StripPrefix("/admin/static/", StaticHandler()))

	// Authenticated routes - any authenticated user
	mux.Handle("POST /admin/logout", authMiddleware(http.HandlerFunc(handlers.LogoutHandler)))
	mux.Handle("POST /admin/switch-realm", authMiddleware(http.HandlerFunc(handlers.SwitchRealmHandler)))
	mux.Handle("GET /admin/", authMiddleware(http.HandlerFunc(handlers.DashboardHandler)))
	mux.Handle("GET /admin", authMiddleware(http.RedirectHandler("/admin/", http.StatusMovedPermanently)))

	// Runes - list and detail are viewable by any authenticated user
	mux.Handle("GET /admin/runes", authMiddleware(http.HandlerFunc(handlers.RunesListHandler)))
	mux.Handle("GET /admin/runes/", authMiddleware(http.HandlerFunc(handlers.RuneDetailHandler)))

	// Runes - actions require member+ role
	// Role checks are performed at handler level (not middleware) because the realm ID
	// is derived from the user's roles at runtime, and different users may have different
	// realm access. Handler-level checks allow dynamic realm resolution per request.
	mux.Handle("POST /admin/runes/create", authMiddleware(http.HandlerFunc(handlers.CreateRuneHandler)))
	mux.Handle("POST /admin/runes/sweep", authMiddleware(requireAdmin(http.HandlerFunc(handlers.SweepRunesHandler))))
	mux.Handle("POST /admin/runes/{id}/update", authMiddleware(http.HandlerFunc(handlers.UpdateRuneHandler)))
	mux.Handle("POST /admin/runes/{id}/forge", authMiddleware(http.HandlerFunc(handlers.RuneForgeHandler)))
	mux.Handle("POST /admin/runes/{id}/dependencies", authMiddleware(http.HandlerFunc(handlers.AddDependencyHandler)))
	mux.Handle("DELETE /admin/runes/{id}/dependencies", authMiddleware(http.HandlerFunc(handlers.RemoveDependencyHandler)))
	mux.Handle("POST /admin/runes/{id}/claim", authMiddleware(http.HandlerFunc(handlers.RuneClaimHandler)))
	mux.Handle("POST /admin/runes/{id}/unclaim", authMiddleware(http.HandlerFunc(handlers.RuneUnclaimHandler)))
	mux.Handle("POST /admin/runes/{id}/fulfill", authMiddleware(http.HandlerFunc(handlers.RuneFulfillHandler)))
	mux.Handle("POST /admin/runes/{id}/shatter", authMiddleware(http.HandlerFunc(handlers.RuneShatterHandler)))
	mux.Handle("POST /admin/runes/{id}/seal", authMiddleware(http.HandlerFunc(handlers.RuneSealHandler)))
	mux.Handle("POST /admin/runes/{id}/note", authMiddleware(http.HandlerFunc(handlers.RuneNoteHandler)))

	// Realms - admin only
	mux.Handle("GET /admin/realms", authMiddleware(requireAdmin(http.HandlerFunc(handlers.RealmsListHandler))))
	mux.Handle("GET /admin/realms/", authMiddleware(requireAdmin(http.HandlerFunc(handlers.RealmDetailHandler))))
	mux.Handle("POST /admin/realms/create", authMiddleware(requireAdmin(http.HandlerFunc(handlers.CreateRealmHandler))))
	mux.Handle("POST /admin/realms/{id}/suspend", authMiddleware(requireAdmin(http.HandlerFunc(handlers.SuspendRealmHandler))))

	// Accounts - admin only
	mux.Handle("GET /admin/accounts", authMiddleware(requireAdmin(http.HandlerFunc(handlers.AccountsListHandler))))
	mux.Handle("GET /admin/accounts/", authMiddleware(requireAdmin(http.HandlerFunc(handlers.AccountDetailHandler))))
	mux.Handle("POST /admin/accounts/create", authMiddleware(requireAdmin(http.HandlerFunc(handlers.CreateAccountHandler))))
	mux.Handle("POST /admin/accounts/{id}/suspend", authMiddleware(requireAdmin(http.HandlerFunc(handlers.SuspendAccountHandler))))
	mux.Handle("POST /admin/accounts/{id}/roles", authMiddleware(requireAdmin(http.HandlerFunc(handlers.UpdateRolesHandler))))
	mux.Handle("GET /admin/accounts/{id}/pats", authMiddleware(requireAdmin(http.HandlerFunc(handlers.PATsListHandler))))
	mux.Handle("POST /admin/accounts/{id}/pats", authMiddleware(requireAdmin(http.HandlerFunc(handlers.PATActionHandler))))

	return nil
}

// RequireAdminMiddleware returns middleware that checks if the user has admin role.
// It should be used after AuthMiddleware has populated the context.
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

// RequireMemberMiddleware returns middleware that checks if the user has member+ role.
// It should be used after AuthMiddleware has populated the context.
// The realmID parameter specifies which realm to check.
func RequireMemberMiddleware(realmID string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			roles, ok := RolesFromContext(r.Context())
			if !ok {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}

			role, hasRole := roles[realmID]
			if !hasRole || role == "viewer" {
				http.Error(w, "Forbidden", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
