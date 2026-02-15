package cli

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestDepAddCommand(t *testing.T) {
	t.Run("posts to add-dependency with runeId, targetId, and default relationship", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request()
		tc.root_cmd_with_server()

		// When
		tc.run_dep_add("rune-1", "rune-2")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/add-dependency")
		tc.request_body_has("runeId", "rune-1")
		tc.request_body_has("targetId", "rune-2")
		tc.request_body_has("relationship", "blocks")
	})

	t.Run("uses custom relationship type when --type is specified", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request()
		tc.root_cmd_with_server()

		// When
		tc.run_dep_add_with_type("rune-1", "rune-2", "relates_to")

		// Then
		tc.command_has_no_error()
		tc.request_body_has("relationship", "relates_to")
	})
}

func TestDepRemoveCommand(t *testing.T) {
	t.Run("posts to remove-dependency with runeId, targetId, and default relationship", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request()
		tc.root_cmd_with_server()

		// When
		tc.run_dep_remove("rune-1", "rune-2")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/remove-dependency")
		tc.request_body_has("runeId", "rune-1")
		tc.request_body_has("targetId", "rune-2")
		tc.request_body_has("relationship", "blocks")
	})

	t.Run("uses custom relationship type when --type is specified", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request()
		tc.root_cmd_with_server()

		// When
		tc.run_dep_remove_with_type("rune-1", "rune-2", "duplicates")

		// Then
		tc.command_has_no_error()
		tc.request_body_has("relationship", "duplicates")
	})
}

func TestDepListCommand(t *testing.T) {
	t.Run("gets dependencies with runeId and default relationship", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns(`[{"targetId":"rune-2","relationship":"blocks"}]`)
		tc.root_cmd_with_server()

		// When
		tc.run_dep_list("rune-1")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_contains("/dependencies")
		tc.request_query_has("runeId", "rune-1")
		tc.request_query_has("relationship", "blocks")
	})

	t.Run("uses custom relationship type when --type is specified", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns(`[{"targetId":"rune-2","relationship":"relates_to"}]`)
		tc.root_cmd_with_server()

		// When
		tc.run_dep_list_with_type("rune-1", "relates_to")

		// Then
		tc.command_has_no_error()
		tc.request_query_has("relationship", "relates_to")
	})

	t.Run("outputs human-readable table when --human flag is set", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns(`[{"targetId":"rune-2","relationship":"blocks"},{"targetId":"rune-3","relationship":"relates_to"}]`)
		tc.root_cmd_with_server()

		// When
		tc.run_dep_list_human("rune-1")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Target")
		tc.output_contains("Relationship")
		tc.output_contains("rune-2")
		tc.output_contains("blocks")
	})
}

// --- Test Context ---

type depTestContext struct {
	t *testing.T

	server  *httptest.Server
	root    *RootCmd
	cmdErr  error
	output  string

	receivedMethod string
	receivedPath   string
	receivedQuery  map[string]string
	receivedBody   map[string]interface{}
}

func newDepTestContext(t *testing.T) *depTestContext {
	t.Helper()
	return &depTestContext{
		t:             t,
		receivedQuery: make(map[string]string),
	}
}

// --- Given ---

func (tc *depTestContext) server_that_captures_request() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		for k, v := range r.URL.Query() {
			tc.receivedQuery[k] = v[0]
		}
		if r.Body != nil {
			body, _ := io.ReadAll(r.Body)
			if len(body) > 0 {
				_ = json.Unmarshal(body, &tc.receivedBody)
			}
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *depTestContext) server_that_captures_request_and_returns(response string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		for k, v := range r.URL.Query() {
			tc.receivedQuery[k] = v[0]
		}
		if r.Body != nil {
			body, _ := io.ReadAll(r.Body)
			if len(body) > 0 {
				_ = json.Unmarshal(body, &tc.receivedBody)
			}
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(response))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *depTestContext) root_cmd_with_server() {
	tc.t.Helper()
	tc.root = &RootCmd{}
	tc.root.Cfg = &Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	}
	tc.root.Client = NewClient(tc.root.Cfg)

	cmd := &cobra.Command{Use: "bf"}
	cmd.PersistentFlags().Bool("human", false, "formatted table/text output")
	cmd.PersistentFlags().Bool("json", false, "force JSON output")
	tc.root.Command = cmd

	depCmd := NewDepCmd(tc.root)
	tc.root.Command.AddCommand(depCmd)
}

// --- When ---

func (tc *depTestContext) run_dep_add(runeID, targetID string) {
	tc.t.Helper()
	tc.root.Command.SetArgs([]string{"dep", "add", runeID, targetID})
	buf := new(bytes.Buffer)
	tc.root.Command.SetOut(buf)
	tc.cmdErr = tc.root.Command.Execute()
	tc.output = buf.String()
}

func (tc *depTestContext) run_dep_add_with_type(runeID, targetID, relType string) {
	tc.t.Helper()
	tc.root.Command.SetArgs([]string{"dep", "add", runeID, targetID, "--type", relType})
	buf := new(bytes.Buffer)
	tc.root.Command.SetOut(buf)
	tc.cmdErr = tc.root.Command.Execute()
	tc.output = buf.String()
}

func (tc *depTestContext) run_dep_remove(runeID, targetID string) {
	tc.t.Helper()
	tc.root.Command.SetArgs([]string{"dep", "remove", runeID, targetID})
	buf := new(bytes.Buffer)
	tc.root.Command.SetOut(buf)
	tc.cmdErr = tc.root.Command.Execute()
	tc.output = buf.String()
}

func (tc *depTestContext) run_dep_remove_with_type(runeID, targetID, relType string) {
	tc.t.Helper()
	tc.root.Command.SetArgs([]string{"dep", "remove", runeID, targetID, "--type", relType})
	buf := new(bytes.Buffer)
	tc.root.Command.SetOut(buf)
	tc.cmdErr = tc.root.Command.Execute()
	tc.output = buf.String()
}

func (tc *depTestContext) run_dep_list(runeID string) {
	tc.t.Helper()
	tc.root.Command.SetArgs([]string{"dep", "list", runeID})
	buf := new(bytes.Buffer)
	tc.root.Command.SetOut(buf)
	tc.cmdErr = tc.root.Command.Execute()
	tc.output = buf.String()
}

func (tc *depTestContext) run_dep_list_with_type(runeID, relType string) {
	tc.t.Helper()
	tc.root.Command.SetArgs([]string{"dep", "list", runeID, "--type", relType})
	buf := new(bytes.Buffer)
	tc.root.Command.SetOut(buf)
	tc.cmdErr = tc.root.Command.Execute()
	tc.output = buf.String()
}

func (tc *depTestContext) run_dep_list_human(runeID string) {
	tc.t.Helper()
	tc.root.Command.SetArgs([]string{"dep", "list", runeID, "--human"})
	buf := new(bytes.Buffer)
	tc.root.Command.SetOut(buf)
	tc.cmdErr = tc.root.Command.Execute()
	tc.output = buf.String()
}

// --- Then ---

func (tc *depTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.cmdErr)
}

func (tc *depTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *depTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *depTestContext) request_path_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.receivedPath, substr)
}

func (tc *depTestContext) request_body_has(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody, "expected request body to be present")
	val, ok := tc.receivedBody[key]
	require.True(tc.t, ok, "expected key %q in request body", key)
	assert.Equal(tc.t, expected, val)
}

func (tc *depTestContext) request_query_has(key, expected string) {
	tc.t.Helper()
	val, ok := tc.receivedQuery[key]
	require.True(tc.t, ok, "expected query param %q", key)
	assert.Equal(tc.t, expected, val)
}

func (tc *depTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.output, substr)
}
