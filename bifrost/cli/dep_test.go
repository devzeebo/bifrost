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
	t.Run("posts to add-dependency with rune1, verb, and rune2 as positional args", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request()
		tc.root_cmd_with_server()

		// When
		tc.run_dep_add("rune-1", "blocks", "rune-2")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/api/add-dependency")
		tc.request_body_has("rune_id", "rune-1")
		tc.request_body_has("target_id", "rune-2")
		tc.request_body_has("relationship", "blocks")
	})

	t.Run("supports all relationship verbs", func(t *testing.T) {
		verbs := []string{"blocks", "relates_to", "duplicates", "supersedes", "replies_to"}
		for _, verb := range verbs {
			t.Run(verb, func(t *testing.T) {
				tc := newDepTestContext(t)

				// Given
				tc.server_that_captures_request()
				tc.root_cmd_with_server()

				// When
				tc.run_dep_add("rune-1", verb, "rune-2")

				// Then
				tc.command_has_no_error()
				tc.request_body_has("relationship", verb)
			})
		}
	})

	t.Run("returns error for invalid relationship verb", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request()
		tc.root_cmd_with_server()

		// When
		tc.run_dep_add("rune-1", "invalid_verb", "rune-2")

		// Then
		tc.command_has_error()
		tc.error_contains("invalid relationship")
	})

	t.Run("normalizes inverse relationship by swapping source and target", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request()
		tc.root_cmd_with_server()

		// When
		tc.run_dep_add("rune-2", "blocked_by", "rune-1")

		// Then
		tc.command_has_no_error()
		tc.request_body_has("rune_id", "rune-1")
		tc.request_body_has("target_id", "rune-2")
		tc.request_body_has("relationship", "blocks")
	})

	t.Run("accepts all inverse relationship types", func(t *testing.T) {
		cases := []struct {
			inverse string
			forward string
		}{
			{"blocked_by", "blocks"},
			{"duplicated_by", "duplicates"},
			{"superseded_by", "supersedes"},
			{"replied_to_by", "replies_to"},
		}
		for _, tt := range cases {
			t.Run(tt.inverse, func(t *testing.T) {
				tc := newDepTestContext(t)

				// Given
				tc.server_that_captures_request()
				tc.root_cmd_with_server()

				// When
				tc.run_dep_add("rune-2", tt.inverse, "rune-1")

				// Then
				tc.command_has_no_error()
				tc.request_body_has("relationship", tt.forward)
				tc.request_body_has("rune_id", "rune-1")
				tc.request_body_has("target_id", "rune-2")
			})
		}
	})
}

func TestDepRemoveCommand(t *testing.T) {
	t.Run("posts to remove-dependency with rune1, verb, and rune2 as positional args", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request()
		tc.root_cmd_with_server()

		// When
		tc.run_dep_remove("rune-1", "blocks", "rune-2")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/api/remove-dependency")
		tc.request_body_has("rune_id", "rune-1")
		tc.request_body_has("target_id", "rune-2")
		tc.request_body_has("relationship", "blocks")
	})

	t.Run("supports all relationship verbs", func(t *testing.T) {
		verbs := []string{"blocks", "relates_to", "duplicates", "supersedes", "replies_to"}
		for _, verb := range verbs {
			t.Run(verb, func(t *testing.T) {
				tc := newDepTestContext(t)

				// Given
				tc.server_that_captures_request()
				tc.root_cmd_with_server()

				// When
				tc.run_dep_remove("rune-1", verb, "rune-2")

				// Then
				tc.command_has_no_error()
				tc.request_body_has("relationship", verb)
			})
		}
	})

	t.Run("returns error for invalid relationship verb", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request()
		tc.root_cmd_with_server()

		// When
		tc.run_dep_remove("rune-1", "invalid_verb", "rune-2")

		// Then
		tc.command_has_error()
		tc.error_contains("invalid relationship")
	})

	t.Run("normalizes inverse relationship by swapping source and target", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request()
		tc.root_cmd_with_server()

		// When
		tc.run_dep_remove("rune-2", "blocked_by", "rune-1")

		// Then
		tc.command_has_no_error()
		tc.request_body_has("rune_id", "rune-1")
		tc.request_body_has("target_id", "rune-2")
		tc.request_body_has("relationship", "blocks")
	})
}

func TestDepListCommand(t *testing.T) {
	t.Run("fetches rune detail and displays dependencies", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns(`{"id":"rune-1","dependencies":[{"relationship":"blocks","target_id":"rune-2"}]}`)
		tc.root_cmd_with_server()

		// When
		tc.run_dep_list("rune-1")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_contains("/rune")
		tc.request_query_has("id", "rune-1")
	})

	t.Run("outputs json dependencies array in json mode", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns(`{"id":"rune-1","dependencies":[{"relationship":"blocks","target_id":"rune-2"}]}`)
		tc.root_cmd_with_server()

		// When
		tc.run_dep_list("rune-1")

		// Then
		tc.command_has_no_error()
		tc.output_contains("blocks")
		tc.output_contains("rune-2")
	})

	t.Run("outputs human-readable table when --human flag is set", func(t *testing.T) {
		tc := newDepTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns(`{"id":"rune-1","dependencies":[{"relationship":"blocks","target_id":"rune-2"},{"relationship":"relates_to","target_id":"rune-3"}]}`)
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
	tc.root.Client = NewClient(tc.server.URL, "test-key", "test-realm")

	cmd := &cobra.Command{Use: "bf"}
	cmd.PersistentFlags().Bool("human", false, "formatted table/text output")
	cmd.PersistentFlags().Bool("json", false, "force JSON output")
	tc.root.Command = cmd

	depCmd := NewDepCmd(tc.root)
	tc.root.Command.AddCommand(depCmd)
}

// --- When ---

func (tc *depTestContext) run_dep_add(rune1, verb, rune2 string) {
	tc.t.Helper()
	tc.root.Command.SetArgs([]string{"dep", "add", rune1, verb, rune2})
	buf := new(bytes.Buffer)
	tc.root.Command.SetOut(buf)
	tc.root.Command.SetErr(buf)
	tc.cmdErr = tc.root.Command.Execute()
	tc.output = buf.String()
}

func (tc *depTestContext) run_dep_remove(rune1, verb, rune2 string) {
	tc.t.Helper()
	tc.root.Command.SetArgs([]string{"dep", "remove", rune1, verb, rune2})
	buf := new(bytes.Buffer)
	tc.root.Command.SetOut(buf)
	tc.root.Command.SetErr(buf)
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

func (tc *depTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.cmdErr)
}

func (tc *depTestContext) error_contains(substr string) {
	tc.t.Helper()
	require.Error(tc.t, tc.cmdErr)
	assert.Contains(tc.t, tc.cmdErr.Error(), substr)
}
