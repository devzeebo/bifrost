package cli

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestScriptDispatcher(t *testing.T) {
	t.Run("sends rune JSON to dispatcher stdin and parses result", func(t *testing.T) {
		script := writeScript(t, `#!/bin/sh
input=$(cat)
id=$(echo "$input" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "{\"command\":\"echo\",\"args\":[\"$id\"],\"stdin\":\"\",\"env\":{}}"
`)
		d := &ScriptDispatcher{ScriptPath: script}
		result, err := d.Dispatch(context.Background(), DispatchInput{Rune: map[string]any{"id": "bf-abc123", "title": "Test"}})

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, "echo", result.Command)
		assert.Equal(t, []string{"bf-abc123"}, result.Args)
	})

	t.Run("returns nil result when command is empty (skip signal)", func(t *testing.T) {
		script := writeScript(t, `#!/bin/sh
echo '{"command":""}'
`)
		d := &ScriptDispatcher{ScriptPath: script}
		result, err := d.Dispatch(context.Background(), DispatchInput{Rune: map[string]any{"id": "bf-abc"}})

		require.NoError(t, err)
		require.NotNil(t, result)
		assert.Equal(t, "", result.Command)
	})

	t.Run("returns error when dispatcher exits non-zero", func(t *testing.T) {
		script := writeScript(t, `#!/bin/sh
echo "something went wrong" >&2
exit 1
`)
		d := &ScriptDispatcher{ScriptPath: script}
		result, err := d.Dispatch(context.Background(), DispatchInput{Rune: map[string]any{"id": "bf-abc"}})

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "dispatcher exited with error")
	})

	t.Run("returns error when dispatcher outputs invalid JSON", func(t *testing.T) {
		script := writeScript(t, `#!/bin/sh
echo "not valid json"
`)
		d := &ScriptDispatcher{ScriptPath: script}
		result, err := d.Dispatch(context.Background(), DispatchInput{Rune: map[string]any{"id": "bf-abc"}})

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "not valid JSON")
	})

	t.Run("passes rune and cwd to dispatcher", func(t *testing.T) {
		var capturedInput DispatchInput
		script := writeScript(t, `#!/bin/sh
cat > /tmp/bf_dispatch_test_input.json
echo '{"command":"echo","args":[],"stdin":"","env":{}}'
`)
		d := &ScriptDispatcher{ScriptPath: script}
		input := DispatchInput{
			Rune: map[string]any{
				"id":          "bf-xyz",
				"title":       "My Task",
				"description": "Do something",
				"status":      "open",
				"priority":    2,
				"tags":        []string{"backend", "urgent"},
			},
			Cwd: "/tmp",
		}
		_, err := d.Dispatch(context.Background(), input)
		require.NoError(t, err)

		// Read the captured input file the script wrote.
		data, err := os.ReadFile("/tmp/bf_dispatch_test_input.json")
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(data, &capturedInput))

		assert.Equal(t, "bf-xyz", capturedInput.Rune["id"])
		assert.Equal(t, "My Task", capturedInput.Rune["title"])
		assert.Equal(t, "Do something", capturedInput.Rune["description"])
		assert.Equal(t, "/tmp", capturedInput.Cwd)
	})
}

func TestDispatchInputFromRune(t *testing.T) {
	t.Run("converts rune detail map to DispatchInput with full rune and cwd", func(t *testing.T) {
		detail := map[string]any{
			"id":          "bf-abc",
			"title":       "Do work",
			"description": "Some desc",
			"status":      "open",
			"priority":    float64(1),
			"tags":        []any{"alpha", "beta"},
			"notes":       []any{map[string]any{"text": "a note"}},
			"dependencies": []any{map[string]any{
				"target_id":    "bf-dep",
				"relationship": "blocks",
			}},
		}

		input := dispatchInputFromRune(detail)

		assert.Equal(t, detail, input.Rune)
		assert.NotEmpty(t, input.Cwd)
	})

	t.Run("passes entire detail map as rune", func(t *testing.T) {
		detail := map[string]any{
			"id":    "bf-minimal",
			"title": "Minimal",
		}

		input := dispatchInputFromRune(detail)

		assert.Equal(t, detail, input.Rune)
		assert.NotEmpty(t, input.Cwd)
	})
}

// writeScript creates a temporary executable shell script and returns its path.
func writeScript(t *testing.T, content string) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "dispatcher.sh")
	require.NoError(t, os.WriteFile(path, []byte(content), 0o755))
	return path
}
