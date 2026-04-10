package cli

import (
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
		result, err := d.Dispatch(DispatchInput{ID: "bf-abc123", Title: "Test"})

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
		result, err := d.Dispatch(DispatchInput{ID: "bf-abc"})

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
		result, err := d.Dispatch(DispatchInput{ID: "bf-abc"})

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "dispatcher exited with error")
	})

	t.Run("returns error when dispatcher outputs invalid JSON", func(t *testing.T) {
		script := writeScript(t, `#!/bin/sh
echo "not valid json"
`)
		d := &ScriptDispatcher{ScriptPath: script}
		result, err := d.Dispatch(DispatchInput{ID: "bf-abc"})

		require.Error(t, err)
		assert.Nil(t, result)
		assert.Contains(t, err.Error(), "not valid JSON")
	})

	t.Run("passes all rune fields to dispatcher", func(t *testing.T) {
		var capturedInput DispatchInput
		script := writeScript(t, `#!/bin/sh
cat > /tmp/bf_dispatch_test_input.json
echo '{"command":"echo","args":[],"stdin":"","env":{}}'
`)
		d := &ScriptDispatcher{ScriptPath: script}
		input := DispatchInput{
			ID:          "bf-xyz",
			Title:       "My Task",
			Description: "Do something",
			Status:      "open",
			Priority:    2,
			Tags:        []string{"backend", "urgent"},
		}
		_, err := d.Dispatch(input)
		require.NoError(t, err)

		// Read the captured input file the script wrote.
		data, err := os.ReadFile("/tmp/bf_dispatch_test_input.json")
		require.NoError(t, err)
		require.NoError(t, json.Unmarshal(data, &capturedInput))

		assert.Equal(t, "bf-xyz", capturedInput.ID)
		assert.Equal(t, "My Task", capturedInput.Title)
		assert.Equal(t, "Do something", capturedInput.Description)
		assert.Equal(t, 2, capturedInput.Priority)
		assert.Equal(t, []string{"backend", "urgent"}, capturedInput.Tags)
	})
}

func TestDispatchInputFromRune(t *testing.T) {
	t.Run("converts rune detail map to DispatchInput", func(t *testing.T) {
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

		assert.Equal(t, "bf-abc", input.ID)
		assert.Equal(t, "Do work", input.Title)
		assert.Equal(t, "Some desc", input.Description)
		assert.Equal(t, "open", input.Status)
		assert.Equal(t, 1, input.Priority)
		assert.Equal(t, []string{"alpha", "beta"}, input.Tags)
		assert.Len(t, input.Notes, 1)
		assert.Len(t, input.Dependencies, 1)
	})

	t.Run("handles missing optional fields gracefully", func(t *testing.T) {
		detail := map[string]any{
			"id":    "bf-minimal",
			"title": "Minimal",
		}

		input := dispatchInputFromRune(detail)

		assert.Equal(t, "bf-minimal", input.ID)
		assert.Equal(t, "", input.Description)
		assert.Equal(t, 0, input.Priority)
		assert.Nil(t, input.Tags)
		assert.Nil(t, input.Notes)
		assert.Nil(t, input.Dependencies)
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
