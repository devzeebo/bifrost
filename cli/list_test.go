package cli

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestListCommand(t *testing.T) {
	t.Run("sends GET to /runes", func(t *testing.T) {
		tc := newListTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_runes()
		tc.client_configured()

		// When
		tc.execute_list()

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/api/runes")
	})

	t.Run("passes status filter as query parameter", func(t *testing.T) {
		tc := newListTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_runes()
		tc.client_configured()

		// When
		tc.execute_list_with_status("open")

		// Then
		tc.command_has_no_error()
		tc.request_query_param_was("status", "open")
	})

	t.Run("passes priority filter as query parameter", func(t *testing.T) {
		tc := newListTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_runes()
		tc.client_configured()

		// When
		tc.execute_list_with_priority("1")

		// Then
		tc.command_has_no_error()
		tc.request_query_param_was("priority", "1")
	})

	t.Run("passes assignee filter as query parameter", func(t *testing.T) {
		tc := newListTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_runes()
		tc.client_configured()

		// When
		tc.execute_list_with_assignee("alice")

		// Then
		tc.command_has_no_error()
		tc.request_query_param_was("assignee", "alice")
	})

	t.Run("passes branch filter as query parameter", func(t *testing.T) {
		tc := newListTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_runes()
		tc.client_configured()

		// When
		tc.execute_list_with_branch("feature-x")

		// Then
		tc.command_has_no_error()
		tc.request_query_param_was("branch", "feature-x")
	})

	t.Run("omits branch query parameter when flag not set", func(t *testing.T) {
		tc := newListTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_runes()
		tc.client_configured()

		// When
		tc.execute_list()

		// Then
		tc.command_has_no_error()
		tc.request_query_param_absent("branch")
	})

	t.Run("outputs JSON response by default", func(t *testing.T) {
		tc := newListTestContext(t)

		// Given
		tc.server_that_returns_json(`[{"id":"bf-1","title":"Rune 1","status":"open","priority":0}]`)
		tc.client_configured()

		// When
		tc.execute_list()

		// Then
		tc.command_has_no_error()
		tc.output_contains(`"id":"bf-1"`)
	})

	t.Run("outputs human-readable table when --human flag is set", func(t *testing.T) {
		tc := newListTestContext(t)

		// Given
		tc.server_that_returns_json(`[{"id":"bf-1","title":"Rune 1","status":"open","priority":0,"claimant":"alice","branch":"main"}]`)
		tc.client_configured()

		// When
		tc.execute_list_with_human()

		// Then
		tc.command_has_no_error()
		tc.output_contains("ID")
		tc.output_contains("Title")
		tc.output_contains("Status")
		tc.output_contains("Priority")
		tc.output_contains("Assignee")
		tc.output_contains("Branch")
		tc.output_contains("bf-1")
		tc.output_contains("Rune 1")
		tc.output_contains("main")
	})

	t.Run("returns error when server responds with error", func(t *testing.T) {
		tc := newListTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusInternalServerError, "failed to list runes")
		tc.client_configured()

		// When
		tc.execute_list()

		// Then
		tc.command_has_error()
		tc.output_contains("failed to list runes")
	})
}

// --- Test Context ---

type listTestContext struct {
	t *testing.T

	server         *httptest.Server
	client         *Client
	receivedMethod string
	receivedPath   string
	receivedQuery  map[string]string
	buf            *bytes.Buffer
	err            error
}

func newListTestContext(t *testing.T) *listTestContext {
	t.Helper()
	return &listTestContext{
		t:             t,
		buf:           &bytes.Buffer{},
		receivedQuery: make(map[string]string),
	}
}

// --- Given ---

func (tc *listTestContext) server_that_captures_request_and_returns_runes() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		for k, v := range r.URL.Query() {
			tc.receivedQuery[k] = v[0]
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[]`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *listTestContext) server_that_returns_json(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *listTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *listTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(tc.server.URL, "test-key", "test-realm")
}

// --- When ---

func (tc *listTestContext) execute_list() {
	tc.t.Helper()
	cmd := NewListCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *listTestContext) execute_list_with_status(status string) {
	tc.t.Helper()
	cmd := NewListCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--status", status})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *listTestContext) execute_list_with_priority(priority string) {
	tc.t.Helper()
	cmd := NewListCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--priority", priority})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *listTestContext) execute_list_with_assignee(assignee string) {
	tc.t.Helper()
	cmd := NewListCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--assignee", assignee})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *listTestContext) execute_list_with_branch(branch string) {
	tc.t.Helper()
	cmd := NewListCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--branch", branch})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *listTestContext) execute_list_with_human() {
	tc.t.Helper()
	cmd := NewListCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--human"})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *listTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *listTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *listTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *listTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *listTestContext) request_query_param_was(key, expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedQuery[key])
}

func (tc *listTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}

func (tc *listTestContext) request_query_param_absent(key string) {
	tc.t.Helper()
	_, exists := tc.receivedQuery[key]
	assert.False(tc.t, exists, "expected query param %q to be absent", key)
}
