//go:build !debug

package cli

func debugLog(format string, args ...any) {
	// no-op in release builds
}
