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

func TestSealCommand(t *testing.T) {
	t.Run("sends POST to /seal-rune with id", func(t *testing.T) {
		tc := newSealTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_seal("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/seal-rune")
		tc.request_body_has_field("id", "bf-abc")
	})

	t.Run("includes reason when --reason flag is set", func(t *testing.T) {
		tc := newSealTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_seal_with_reason("bf-abc", "completed successfully")

		// Then
		tc.command_has_no_error()
		tc.request_body_has_field("reason", "completed successfully")
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newSealTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_seal_with_human("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Rune bf-abc sealed")
	})

	t.Run("returns error when server responds with error", func(t *testing.T) {
		tc := newSealTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusBadRequest, "rune not fulfilled")
		tc.client_configured()

		// When
		tc.execute_seal("bf-abc")

		// Then
		tc.command_has_error()
		tc.output_contains("rune not fulfilled")
	})
}

// --- Test Context ---

type sealTestContext struct {
	t *testing.T

	server         *httptest.Server
	client         *Client
	receivedMethod string
	receivedPath   string
	receivedBody   map[string]any
	buf            *bytes.Buffer
	err            error
}

func newSealTestContext(t *testing.T) *sealTestContext {
	t.Helper()
	return &sealTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *sealTestContext) server_that_captures_request_and_returns_no_content() {
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

func (tc *sealTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *sealTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

// --- When ---

func (tc *sealTestContext) execute_seal(id string) {
	tc.t.Helper()
	cmd := NewSealCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id})
	tc.err = cmd.Command.Execute()
}

func (tc *sealTestContext) execute_seal_with_reason(id, reason string) {
	tc.t.Helper()
	cmd := NewSealCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--reason", reason})
	tc.err = cmd.Command.Execute()
}

func (tc *sealTestContext) execute_seal_with_human(id string) {
	tc.t.Helper()
	cmd := NewSealCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--human"})
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *sealTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *sealTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *sealTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *sealTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *sealTestContext) request_body_has_field(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *sealTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}
