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

func TestShatterCommand(t *testing.T) {
	t.Run("sends POST to /shatter-rune with id when --confirm is passed", func(t *testing.T) {
		tc := newShatterTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_shatter_with_confirm("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/shatter-rune")
		tc.request_body_has_field("id", "bf-abc")
	})

	t.Run("prompts for confirmation and proceeds when user types y", func(t *testing.T) {
		tc := newShatterTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()
		tc.user_types("y\n")

		// When
		tc.execute_shatter("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Shatter rune bf-abc?")
		tc.request_path_was("/shatter-rune")
		tc.request_body_has_field("id", "bf-abc")
	})

	t.Run("prompts for confirmation and proceeds when user types yes", func(t *testing.T) {
		tc := newShatterTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()
		tc.user_types("yes\n")

		// When
		tc.execute_shatter("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.request_path_was("/shatter-rune")
	})

	t.Run("prompts for confirmation and aborts when user types n", func(t *testing.T) {
		tc := newShatterTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()
		tc.user_types("n\n")

		// When
		tc.execute_shatter("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Aborted")
		tc.no_request_was_made()
	})

	t.Run("prompts for confirmation and aborts when user types empty string", func(t *testing.T) {
		tc := newShatterTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()
		tc.user_types("\n")

		// When
		tc.execute_shatter("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Aborted")
		tc.no_request_was_made()
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newShatterTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_shatter_with_confirm_and_human("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Rune bf-abc shattered")
	})

	t.Run("returns error when server responds with error", func(t *testing.T) {
		tc := newShatterTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusBadRequest, "rune not found")
		tc.client_configured()

		// When
		tc.execute_shatter_with_confirm("bf-abc")

		// Then
		tc.command_has_error()
		tc.output_contains("rune not found")
	})
}

// --- Test Context ---

type shatterTestContext struct {
	t *testing.T

	server         *httptest.Server
	client         *Client
	receivedMethod string
	receivedPath   string
	receivedBody   map[string]any
	requestMade    bool
	buf            *bytes.Buffer
	in             *bytes.Buffer
	err            error
}

func newShatterTestContext(t *testing.T) *shatterTestContext {
	t.Helper()
	return &shatterTestContext{
		t:   t,
		buf: &bytes.Buffer{},
		in:  &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *shatterTestContext) server_that_captures_request_and_returns_no_content() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.requestMade = true
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &tc.receivedBody)
		w.WriteHeader(http.StatusNoContent)
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *shatterTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.requestMade = true
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *shatterTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

func (tc *shatterTestContext) user_types(input string) {
	tc.t.Helper()
	tc.in = bytes.NewBufferString(input)
}

// --- When ---

func (tc *shatterTestContext) execute_shatter(id string) {
	tc.t.Helper()
	cmd := NewShatterCmd(func() *Client { return tc.client }, tc.buf, tc.in)
	cmd.Command.SetArgs([]string{id})
	tc.err = cmd.Command.Execute()
}

func (tc *shatterTestContext) execute_shatter_with_confirm(id string) {
	tc.t.Helper()
	cmd := NewShatterCmd(func() *Client { return tc.client }, tc.buf, tc.in)
	cmd.Command.SetArgs([]string{id, "--confirm"})
	tc.err = cmd.Command.Execute()
}

func (tc *shatterTestContext) execute_shatter_with_confirm_and_human(id string) {
	tc.t.Helper()
	cmd := NewShatterCmd(func() *Client { return tc.client }, tc.buf, tc.in)
	cmd.Command.SetArgs([]string{id, "--confirm", "--human"})
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *shatterTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *shatterTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *shatterTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *shatterTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *shatterTestContext) request_body_has_field(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *shatterTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}

func (tc *shatterTestContext) no_request_was_made() {
	tc.t.Helper()
	assert.False(tc.t, tc.requestMade)
}
