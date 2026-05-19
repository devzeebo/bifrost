package cli

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestReopenCommand(t *testing.T) {
	t.Run("sends POST to /reopen-rune with id", func(t *testing.T) {
		tc := newReopenTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_reopen("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/api/reopen-rune")
		tc.request_body_has_field("id", "bf-abc")
	})

	t.Run("sends as_claimed=true when --claim flag is set", func(t *testing.T) {
		tc := newReopenTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_reopen_with_claim("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.request_body_has_bool_field("as_claimed", true)
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newReopenTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_reopen_with_human("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Rune bf-abc reopened")
	})

	t.Run("returns error when server responds with error", func(t *testing.T) {
		tc := newReopenTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusBadRequest, "can only reopen failed runes")
		tc.client_configured()

		// When
		tc.execute_reopen("bf-abc")

		// Then
		tc.command_has_error()
		tc.output_contains("can only reopen failed runes")
	})
}

// --- Test Context ---

type reopenTestContext struct {
	t *testing.T

	server         *httptest.Server
	client         *Client
	receivedMethod string
	receivedPath   string
	receivedBody   map[string]any
	buf            *bytes.Buffer
	err            error
}

func newReopenTestContext(t *testing.T) *reopenTestContext {
	t.Helper()
	return &reopenTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *reopenTestContext) server_that_captures_request_and_returns_no_content() {
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

func (tc *reopenTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *reopenTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(tc.server.URL, "test-key", "test-realm")
}

// --- When ---

func (tc *reopenTestContext) execute_reopen(id string) {
	tc.t.Helper()
	cmd := NewReopenCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *reopenTestContext) execute_reopen_with_claim(id string) {
	tc.t.Helper()
	cmd := NewReopenCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--claim"})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *reopenTestContext) execute_reopen_with_human(id string) {
	tc.t.Helper()
	cmd := NewReopenCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--human"})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *reopenTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *reopenTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *reopenTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *reopenTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *reopenTestContext) request_body_has_field(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *reopenTestContext) request_body_has_bool_field(key string, expected bool) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *reopenTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}
