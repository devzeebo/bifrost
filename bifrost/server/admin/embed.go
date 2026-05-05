//go:build !noui

package admin

import "embed"

// UIFiles contains the embedded Vike production build.
// The ui/ directory is populated by `make ui-dist` before building the server.
//
//go:embed ui
var UIFiles embed.FS
