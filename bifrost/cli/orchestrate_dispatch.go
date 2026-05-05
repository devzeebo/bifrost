package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
)

// DispatchInput is the rune data sent to the dispatcher script via stdin.
type DispatchInput struct {
	Rune map[string]any `json:"rune"`
	Cwd  string         `json:"cwd"`
}

// DispatchResult is the execution plan returned by the dispatcher script via stdout.
// If Command is empty, the rune should be skipped (unclaimed).
type DispatchResult struct {
	Command string            `json:"command"`
	Args    []string          `json:"args"`
	Stdin   string            `json:"stdin"`
	Env     map[string]string `json:"env"`
}

// Dispatcher resolves a rune to an execution plan.
type Dispatcher interface {
	Dispatch(ctx context.Context, rune DispatchInput) (*DispatchResult, error)
}

// ScriptDispatcher invokes an external script to resolve a rune.
// The script receives the rune JSON on stdin and writes a DispatchResult JSON to stdout.
type ScriptDispatcher struct {
	ScriptPath string
}

// Dispatch invokes the external script with rune data on stdin and parses the result.
// Returns nil result (no error) when the script signals skip via empty Command.
func (d *ScriptDispatcher) Dispatch(ctx context.Context, rune DispatchInput) (*DispatchResult, error) {
	inputJSON, err := json.Marshal(rune)
	if err != nil {
		return nil, fmt.Errorf("marshaling dispatch input: %w", err)
	}

	cmd := exec.CommandContext(ctx, d.ScriptPath) //nolint:gosec
	cmd.Stdin = bytes.NewReader(inputJSON)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		// Check for context cancellation
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		raw := stdout.String()
		if raw == "" {
			raw = stderr.String()
		}
		return nil, fmt.Errorf("dispatcher exited with error: %w\n%s", err, raw)
	}

	var result DispatchResult
	if err := json.Unmarshal(stdout.Bytes(), &result); err != nil {
		return nil, fmt.Errorf("dispatcher output is not valid JSON: %w\nraw output: %s", err, stdout.String())
	}

	return &result, nil
}

// dispatchInputFromRune converts a rune detail map (from the API) into a DispatchInput.
func dispatchInputFromRune(detail map[string]any) DispatchInput {
	cwd, err := os.Getwd()
	if err != nil {
		cwd = ""
	}

	return DispatchInput{
		Rune: detail,
		Cwd:  cwd,
	}
}