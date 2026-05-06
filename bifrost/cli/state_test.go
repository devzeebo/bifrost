package cli

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestStateCommand(t *testing.T) {
	t.Run("get subcommand sends GET to /rune with id query parameter", func(t *testing.T) {
		tc := newStateTestContext(t)

		// Given
		tc.server_that_returns_rune_with_state()
		tc.client_configured()

		// When
		tc.execute_get("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/api/rune")
		tc.request_query_has("id", "bf-abc")
	})

	t.Run("get subcommand outputs state in human-readable format", func(t *testing.T) {
		tc := newStateTestContext(t)

		// Given
		tc.server_that_returns_rune_with_state()
		tc.client_configured()

		// When
		tc.execute_get_with_human("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("State:")
		tc.output_contains("\"coverage\": 85")
	})

	t.Run("get subcommand shows '(none)' when state is empty", func(t *testing.T) {
		tc := newStateTestContext(t)

		// Given
		tc.server_that_returns_rune_without_state()
		tc.client_configured()

		// When
		tc.execute_get_with_human("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("State: (none)")
	})

	t.Run("set subcommand sends POST to /update-rune-state with patch JSON", func(t *testing.T) {
		tc := newStateTestContext(t)

		// Given
		tc.server_that_accepts_state_update()
		tc.client_configured()

		// When
		tc.execute_set_with_patch("bf-abc", `{"coverage": 85}`)

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/api/update-rune-state")
		tc.request_body_has_field("rune_id", "bf-abc")
		tc.request_body_has_field("patch", `{"coverage": 85}`)
	})

	t.Run("set subcommand supports --patch flag for JSON", func(t *testing.T) {
		tc := newStateTestContext(t)

		// Given
		tc.server_that_accepts_state_update()
		tc.client_configured()

		// When
		tc.execute_set("bf-abc", "--patch", `{"coverage": 85}`)

		// Then
		tc.command_has_no_error()
		tc.request_body_has_field("patch", `{"coverage": 85}`)
	})

	t.Run("set subcommand reads from stdin with --stdin flag", func(t *testing.T) {
		tc := newStateTestContext(t)

		// Given
		tc.server_that_accepts_state_update()
		tc.client_configured()
		stdin := strings.NewReader(`{"coverage": 92}`)

		// When
		cmd := NewStateCmd(func() *Client { return tc.client }, tc.buf)
		cmd.Command.SetArgs([]string{"set", "bf-abc", "--stdin"})
		cmd.Command.SetIn(stdin)
		cmd.Command.SetErr(tc.buf)
		tc.err = cmd.Command.Execute()

		// Then
		tc.command_has_no_error()
		tc.request_body_has_field("patch", `{"coverage": 92}`)
	})

	t.Run("set subcommand outputs human-readable confirmation with --human", func(t *testing.T) {
		tc := newStateTestContext(t)

		// Given
		tc.server_that_accepts_state_update()
		tc.client_configured()

		// When
		tc.execute_set("bf-abc", "--patch", `{"coverage": 85}`, "--human")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Rune bf-abc state updated")
	})

	t.Run("clear subcommand sends POST to /clear-rune-state", func(t *testing.T) {
		tc := newStateTestContext(t)

		// Given
		tc.server_that_accepts_state_clear()
		tc.client_configured()

		// When
		tc.execute_clear("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/api/clear-rune-state")
		tc.request_body_has_field("rune_id", "bf-abc")
	})

	t.Run("clear subcommand outputs human-readable confirmation with --human", func(t *testing.T) {
		tc := newStateTestContext(t)

		// Given
		tc.server_that_accepts_state_clear()
		tc.client_configured()

		// When
		tc.execute_clear("bf-abc", "--human")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Rune bf-abc state cleared")
	})

	t.Run("returns error when server responds with error", func(t *testing.T) {
		tc := newStateTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusBadRequest, "invalid patch JSON")
		tc.client_configured()

		// When
		tc.execute_set_with_patch("bf-abc", `{invalid}`)

		// Then
		tc.command_has_error()
		tc.output_contains("invalid patch JSON")
	})

	t.Run("shows help when no subcommand provided", func(t *testing.T) {
		tc := newStateTestContext(t)

		// Given
		tc.server_that_returns_rune_with_state()
		tc.client_configured()

		// When
		cmd := NewStateCmd(func() *Client { return tc.client }, tc.buf)
		cmd.Command.SetArgs([]string{"bf-abc"})
		cmd.Command.SetOut(tc.buf)
		cmd.Command.SetErr(tc.buf)
		tc.err = cmd.Command.Execute()

		// Then
		tc.command_has_no_error()
		tc.output_contains("Manage rune state")
	})
}

// --- Test Context ---

type stateTestContext struct {
	t *testing.T

	server         *httptest.Server
	client         *Client
	receivedMethod string
	receivedPath   string
	receivedBody   map[string]any
	receivedQuery  map[string]string
	buf            *bytes.Buffer
	err            error
}

func newStateTestContext(t *testing.T) *stateTestContext {
	t.Helper()
	return &stateTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *stateTestContext) server_that_returns_rune_with_state() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		tc.receivedQuery = map[string]string{}
		for k, v := range r.URL.Query() {
			tc.receivedQuery[k] = v[0]
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":       "bf-abc",
			"title":    "Test rune",
			"status":   "open",
			"priority": 1,
			"state": map[string]any{
				"coverage": 85,
				"tested":   false,
			},
		})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *stateTestContext) server_that_returns_rune_without_state() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":       "bf-abc",
			"title":    "Test rune",
			"status":   "open",
			"priority": 1,
			"state":    map[string]any{},
		})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *stateTestContext) server_that_accepts_state_update() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &tc.receivedBody)
		w.WriteHeader(http.StatusNoContent)
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *stateTestContext) server_that_accepts_state_clear() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &tc.receivedBody)
		w.WriteHeader(http.StatusNoContent)
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *stateTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *stateTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(tc.server.URL, "test-key", "test-realm")
}

// --- When ---

func (tc *stateTestContext) execute_get(runeID string) {
	tc.t.Helper()
	cmd := NewStateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"get", runeID})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *stateTestContext) execute_get_with_human(runeID string) {
	tc.t.Helper()
	cmd := NewStateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"get", runeID, "--human"})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *stateTestContext) execute_set_with_patch(runeID, patch string) {
	tc.t.Helper()
	cmd := NewStateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"set", runeID, "--patch", patch})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *stateTestContext) execute_set(runeID string, args ...string) {
	tc.t.Helper()
	cmd := NewStateCmd(func() *Client { return tc.client }, tc.buf)
	fullArgs := append([]string{"set", runeID}, args...)
	cmd.Command.SetArgs(fullArgs)
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *stateTestContext) execute_clear(runeID string, args ...string) {
	tc.t.Helper()
	cmd := NewStateCmd(func() *Client { return tc.client }, tc.buf)
	fullArgs := append([]string{"clear", runeID}, args...)
	cmd.Command.SetArgs(fullArgs)
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *stateTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *stateTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *stateTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *stateTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *stateTestContext) request_query_has(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedQuery)
	assert.Equal(tc.t, expected, tc.receivedQuery[key])
}

func (tc *stateTestContext) request_body_has_field(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	val, ok := tc.receivedBody[key]
	require.True(tc.t, ok, "expected field %q to exist", key)
	// Compare as JSON for proper formatting
	expectedBytes, _ := json.Marshal(expected)
	actualBytes, _ := json.Marshal(val)
	assert.JSONEq(tc.t, string(expectedBytes), string(actualBytes))
}

func (tc *stateTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}
