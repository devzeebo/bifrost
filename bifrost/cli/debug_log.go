//go:build debug

package cli

import (
	"fmt"
	"os"
)

func debugLog(format string, args ...any) {
	fmt.Fprintf(os.Stderr, "[DEBUG] "+format+"\n", args...)
}
