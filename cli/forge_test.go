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

func TestForgeCommand(t *testing.T) {
	t.Run("sends POST to /forge-rune with id", func(t *testing.T) {
		tc := newForgeTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_forge("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/forge-rune")
		tc.request_body_has_field("id", "bf-abc")
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newForgeTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_forge_with_human("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Forged rune bf-abc")
	})

	t.Run("returns error when server responds with error", func(t *testing.T) {
		tc := newForgeTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusBadRequest, "rune is not a draft")
		tc.client_configured()

		// When
		tc.execute_forge("bf-abc")

		// Then
		tc.command_has_error()
		tc.output_contains("rune is not a draft")
	})
}

// --- Test Context ---

type forgeTestContext struct {
	t *testing.T

	server         *httptest.Server
	client         *Client
	receivedMethod string
	receivedPath   string
	receivedBody   map[string]any
	buf            *bytes.Buffer
	err            error
}

func newForgeTestContext(t *testing.T) *forgeTestContext {
	t.Helper()
	return &forgeTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *forgeTestContext) server_that_captures_request_and_returns_no_content() {
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

func (tc *forgeTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *forgeTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

// --- When ---

func (tc *forgeTestContext) execute_forge(id string) {
	tc.t.Helper()
	cmd := NewForgeCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id})
	tc.err = cmd.Command.Execute()
}

func (tc *forgeTestContext) execute_forge_with_human(id string) {
	tc.t.Helper()
	cmd := NewForgeCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--human"})
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *forgeTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *forgeTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *forgeTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *forgeTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *forgeTestContext) request_body_has_field(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *forgeTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}
