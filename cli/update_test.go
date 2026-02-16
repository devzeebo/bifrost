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

func TestUpdateCommand(t *testing.T) {
	t.Run("sends POST to /update-rune with id", func(t *testing.T) {
		tc := newUpdateTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_update("bf-abc", "--title", "New Title")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/update-rune")
		tc.request_body_has_field("id", "bf-abc")
		tc.request_body_has_field("title", "New Title")
	})

	t.Run("includes priority when --priority flag is set", func(t *testing.T) {
		tc := newUpdateTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_update("bf-abc", "--priority", "2")

		// Then
		tc.command_has_no_error()
		tc.request_body_has_float_field("priority", 2)
	})

	t.Run("includes description when -d flag is set", func(t *testing.T) {
		tc := newUpdateTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_update("bf-abc", "-d", "Updated description")

		// Then
		tc.command_has_no_error()
		tc.request_body_has_field("description", "Updated description")
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newUpdateTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_update("bf-abc", "--title", "New Title", "--human")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Rune bf-abc updated")
	})

	t.Run("includes branch when --branch flag is set", func(t *testing.T) {
		tc := newUpdateTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_update("bf-abc", "--branch", "feature/my-branch")

		// Then
		tc.command_has_no_error()
		tc.request_body_has_field("branch", "feature/my-branch")
	})

	t.Run("omits branch when --branch flag is not set", func(t *testing.T) {
		tc := newUpdateTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_update("bf-abc", "--title", "New Title")

		// Then
		tc.command_has_no_error()
		tc.request_body_does_not_have_field("branch")
	})

	t.Run("returns error when server responds with error", func(t *testing.T) {
		tc := newUpdateTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusNotFound, "rune not found")
		tc.client_configured()

		// When
		tc.execute_update("bf-abc", "--title", "New Title")

		// Then
		tc.command_has_error()
		tc.output_contains("rune not found")
	})
}

// --- Test Context ---

type updateTestContext struct {
	t *testing.T

	server         *httptest.Server
	client         *Client
	receivedMethod string
	receivedPath   string
	receivedBody   map[string]any
	buf            *bytes.Buffer
	err            error
}

func newUpdateTestContext(t *testing.T) *updateTestContext {
	t.Helper()
	return &updateTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *updateTestContext) server_that_captures_request_and_returns_no_content() {
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

func (tc *updateTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *updateTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

// --- When ---

func (tc *updateTestContext) execute_update(args ...string) {
	tc.t.Helper()
	cmd := NewUpdateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs(args)
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *updateTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *updateTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *updateTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *updateTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *updateTestContext) request_body_has_field(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *updateTestContext) request_body_has_float_field(key string, expected float64) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *updateTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}

func (tc *updateTestContext) request_body_does_not_have_field(key string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	_, exists := tc.receivedBody[key]
	assert.False(tc.t, exists, "expected field %q to be absent from request body", key)
}
