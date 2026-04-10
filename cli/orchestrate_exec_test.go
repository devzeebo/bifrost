package cli

import (
	"bytes"
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRunDispatched(t *testing.T) {
	t.Run("streams stdout to provided writer", func(t *testing.T) {
		var stdout, stderr bytes.Buffer
		result := &DispatchResult{
			Command: "echo",
			Args:    []string{"hello world"},
		}

		code, err := RunDispatched(context.Background(), result, &stdout, &stderr)

		require.NoError(t, err)
		assert.Equal(t, 0, code)
		assert.Contains(t, stdout.String(), "hello world")
	})

	t.Run("returns non-zero exit code without error", func(t *testing.T) {
		var stdout, stderr bytes.Buffer
		result := &DispatchResult{
			Command: "sh",
			Args:    []string{"-c", "exit 42"},
		}

		code, err := RunDispatched(context.Background(), result, &stdout, &stderr)

		require.NoError(t, err)
		assert.Equal(t, 42, code)
	})

	t.Run("pipes stdin content to subprocess", func(t *testing.T) {
		var stdout, stderr bytes.Buffer
		result := &DispatchResult{
			Command: "cat",
			Stdin:   "hello from stdin",
		}

		code, err := RunDispatched(context.Background(), result, &stdout, &stderr)

		require.NoError(t, err)
		assert.Equal(t, 0, code)
		assert.Contains(t, stdout.String(), "hello from stdin")
	})

	t.Run("returns error when command is not found", func(t *testing.T) {
		var stdout, stderr bytes.Buffer
		result := &DispatchResult{
			Command: "/nonexistent/command/that/does/not/exist",
		}

		code, err := RunDispatched(context.Background(), result, &stdout, &stderr)

		require.Error(t, err)
		assert.Equal(t, -1, code)
	})

	t.Run("injects env vars into subprocess", func(t *testing.T) {
		var stdout, stderr bytes.Buffer
		result := &DispatchResult{
			Command: "sh",
			Args:    []string{"-c", "echo $MY_TEST_VAR"},
			Env:     map[string]string{"MY_TEST_VAR": "injected_value"},
		}

		code, err := RunDispatched(context.Background(), result, &stdout, &stderr)

		require.NoError(t, err)
		assert.Equal(t, 0, code)
		assert.Contains(t, stdout.String(), "injected_value")
	})
}
