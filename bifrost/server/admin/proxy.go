package admin

import (
	"bytes"
	"errors"
	"io/fs"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// UIPrefix is the URL path prefix for the new Vike/React admin UI.
const UIPrefix = "/ui"

// NewVikeProxyHandler creates a reverse proxy to the Vite/Vike server.
func NewVikeProxyHandler(viteURL, _ string) (http.Handler, error) {
	target, err := url.Parse(viteURL)
	if err != nil {
		return nil, err
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	return proxy, nil
}

// NewVikeStaticHandler serves built Vike assets with SPA routing.
// The prefix is stripped from request paths before serving files.
func NewVikeStaticHandler(staticPath, prefix string) (http.Handler, error) {
	absPath, err := filepath.Abs(staticPath)
	if err != nil {
		return nil, err
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Strip the prefix to get the relative path
		relPath := strings.TrimPrefix(r.URL.Path, prefix)
		if relPath == "" || relPath == "/" {
			relPath = "/index.html"
		}

		// Remove leading slash for filepath.Join
		relPath = strings.TrimPrefix(relPath, "/")

		// Build the full filesystem path
		fullPath := filepath.Join(absPath, relPath)

		// Check if file exists
		if _, err := os.Stat(fullPath); os.IsNotExist(err) {
			// File not found - serve index.html for SPA routing
			fullPath = filepath.Join(absPath, "index.html")
		}

		// Serve the file directly
		http.ServeFile(w, r, fullPath)
	}), nil
}

// NewVikeStaticHandlerFS serves embedded Vike assets with SPA routing.
// It wraps a file server with fallback to index.html for client-side routing.
func NewVikeStaticHandlerFS(fileServer http.Handler, fsys fs.FS, _ string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "" || path == "/" {
			path = "/index.html"
		} else {
			// Remove leading slash
			path = strings.TrimPrefix(path, "/")
		}

		// Check if file exists in embedded FS and is a file (not directory)
		info, err := fs.Stat(fsys, path)
		if errors.Is(err, fs.ErrNotExist) || (err == nil && info.IsDir()) {
			// File not found or is a directory - check for .html version
			htmlPath := path + ".html"
			htmlInfo, htmlErr := fs.Stat(fsys, htmlPath)
			if htmlErr == nil && !htmlInfo.IsDir() {
				// .html file exists, serve it via file server with modified path
				r.URL.Path = "/" + htmlPath
				fileServer.ServeHTTP(w, r)
				return
			}

			// No .html file - serve index.html for SPA routing
			content, err := fs.ReadFile(fsys, "index.html")
			if err != nil {
				http.NotFound(w, r)
				return
			}

			http.ServeContent(w, r, "index.html", time.Time{}, bytes.NewReader(content))
			return
		}

		fileServer.ServeHTTP(w, r)
	})
}
