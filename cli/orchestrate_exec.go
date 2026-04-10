package cli

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
)

// RunDispatched executes a DispatchResult as a subprocess, streaming stdout/stderr
// to the provided writers. Returns the exit code and any execution error.
func RunDispatched(ctx context.Context, result *DispatchResult, stdout, stderr io.Writer) (int, error) {
	cmd := exec.CommandContext(ctx, result.Command, result.Args...) //nolint:gosec

	if result.Stdin != "" {
		cmd.Stdin = strings.NewReader(result.Stdin)
	}

	if cmd.Env == nil {
		cmd.Env = os.Environ()
	}
	for k, v := range result.Env {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", k, v))
	}

	cmd.Stdout = stdout
	cmd.Stderr = stderr

	if err := cmd.Run(); err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return exitErr.ExitCode(), nil
		}
		return -1, err
	}

	return 0, nil
}