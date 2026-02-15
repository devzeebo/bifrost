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

func TestCreateCommand(t *testing.T) {
	t.Run("sends POST to /create-rune with title and priority", func(t *testing.T) {
		tc := newCreateTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_created()
		tc.client_configured()

		// When
		tc.execute_create("My Rune", "0")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/create-rune")
		tc.request_body_has_field("title", "My Rune")
		tc.request_body_has_float_field("priority", 0)
	})

	t.Run("includes description when -d flag is set", func(t *testing.T) {
		tc := newCreateTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_created()
		tc.client_configured()

		// When
		tc.execute_create_with_description("My Rune", "1", "A detailed description")

		// Then
		tc.command_has_no_error()
		tc.request_body_has_field("description", "A detailed description")
	})

	t.Run("includes parent_id when --parent flag is set", func(t *testing.T) {
		tc := newCreateTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_created()
		tc.client_configured()

		// When
		tc.execute_create_with_parent("My Rune", "2", "bf-parent-123")

		// Then
		tc.command_has_no_error()
		tc.request_body_has_field("parent_id", "bf-parent-123")
	})

	t.Run("outputs JSON response by default", func(t *testing.T) {
		tc := newCreateTestContext(t)

		// Given
		tc.server_that_returns_json(`{"id":"bf-abc","title":"My Rune"}`)
		tc.client_configured()

		// When
		tc.execute_create("My Rune", "0")

		// Then
		tc.command_has_no_error()
		tc.output_contains(`"id":"bf-abc"`)
	})

	t.Run("outputs human-readable format when --human flag is set", func(t *testing.T) {
		tc := newCreateTestContext(t)

		// Given
		tc.server_that_returns_json(`{"id":"bf-abc","title":"My Rune"}`)
		tc.client_configured()

		// When
		tc.execute_create_with_human("My Rune", "0")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Created rune bf-abc: My Rune")
	})

	t.Run("returns error when server responds with error", func(t *testing.T) {
		tc := newCreateTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusBadRequest, "title is required")
		tc.client_configured()

		// When
		tc.execute_create("", "0")

		// Then
		tc.command_has_error()
		tc.output_contains("title is required")
	})
}

// --- Test Context ---

type createTestContext struct {
	t *testing.T

	server          *httptest.Server
	client          *Client
	receivedMethod  string
	receivedPath    string
	receivedBody    map[string]any
	buf             *bytes.Buffer
	err             error
}

func newCreateTestContext(t *testing.T) *createTestContext {
	t.Helper()
	return &createTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *createTestContext) server_that_captures_request_and_returns_created() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &tc.receivedBody)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"id":"bf-test","title":"test"}`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *createTestContext) server_that_returns_json(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *createTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *createTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

// --- When ---

func (tc *createTestContext) execute_create(title, priority string) {
	tc.t.Helper()
	cmd := NewCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{title, "-p", priority})
	tc.err = cmd.Command.Execute()
}

func (tc *createTestContext) execute_create_with_description(title, priority, desc string) {
	tc.t.Helper()
	cmd := NewCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{title, "-p", priority, "-d", desc})
	tc.err = cmd.Command.Execute()
}

func (tc *createTestContext) execute_create_with_parent(title, priority, parent string) {
	tc.t.Helper()
	cmd := NewCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{title, "-p", priority, "--parent", parent})
	tc.err = cmd.Command.Execute()
}

func (tc *createTestContext) execute_create_with_human(title, priority string) {
	tc.t.Helper()
	cmd := NewCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{title, "-p", priority, "--human"})
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *createTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *createTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *createTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *createTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *createTestContext) request_body_has_field(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *createTestContext) request_body_has_float_field(key string, expected float64) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *createTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}
