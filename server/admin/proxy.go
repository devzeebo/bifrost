package admin

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// BetaAdminPrefix is the URL path prefix for the Vike beta admin UI.
const BetaAdminPrefix = "/beta/admin"

// NewVikeStaticHandler serves built Vike assets with SPA routing.
// The prefix is stripped from request paths before serving files.
func NewVikeStaticHandler(staticPath, prefix string) (http.Handler, error) {
	absPath, err := filepath.Abs(staticPath)
	if err != nil {
		return nil, err
	}

	fs := http.FileServer(http.Dir(absPath))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, prefix)
		if path == "" || path == "/" {
			path = "/index.html"
		}

		fullPath := filepath.Join(absPath, path)
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			r.URL.Path = "/index.html"
		} else {
			r.URL.Path = path
		}

		fs.ServeHTTP(w, r)
	}), nil
}
