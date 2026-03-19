//go:build noui

package admin

import "embed"

// UIFiles is an empty FS when building with -tags noui (for tests/lint).
var UIFiles embed.FS
