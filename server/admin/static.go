package admin

import (
	"embed"
	"io/fs"
	"net/http"
)

//go:embed static/*
var staticFS embed.FS

// StaticHandler returns an HTTP handler that serves embedded static files.
func StaticHandler() http.Handler {
	// Get the static subdirectory from the embedded FS
	staticDir, err := fs.Sub(staticFS, "static")
	if err != nil {
		panic(err)
	}
	return http.FileServer(http.FS(staticDir))
}
