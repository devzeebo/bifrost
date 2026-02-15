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

func TestNoteCommand(t *testing.T) {
	t.Run("sends POST to /add-note with rune_id and text", func(t *testing.T) {
		tc := newNoteTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_note("bf-abc", "This is a note")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/add-note")
		tc.request_body_has_field("rune_id", "bf-abc")
		tc.request_body_has_field("text", "This is a note")
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newNoteTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_note_with_human("bf-abc", "This is a note")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Note added to rune bf-abc")
	})

	t.Run("returns error when server responds with error", func(t *testing.T) {
		tc := newNoteTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusNotFound, "rune not found")
		tc.client_configured()

		// When
		tc.execute_note("bf-abc", "This is a note")

		// Then
		tc.command_has_error()
		tc.output_contains("rune not found")
	})
}

// --- Test Context ---

type noteTestContext struct {
	t *testing.T

	server         *httptest.Server
	client         *Client
	receivedMethod string
	receivedPath   string
	receivedBody   map[string]any
	buf            *bytes.Buffer
	err            error
}

func newNoteTestContext(t *testing.T) *noteTestContext {
	t.Helper()
	return &noteTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *noteTestContext) server_that_captures_request_and_returns_no_content() {
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

func (tc *noteTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *noteTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

// --- When ---

func (tc *noteTestContext) execute_note(id, text string) {
	tc.t.Helper()
	cmd := NewNoteCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, text})
	tc.err = cmd.Command.Execute()
}

func (tc *noteTestContext) execute_note_with_human(id, text string) {
	tc.t.Helper()
	cmd := NewNoteCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, text, "--human"})
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *noteTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *noteTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *noteTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *noteTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *noteTestContext) request_body_has_field(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *noteTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}
