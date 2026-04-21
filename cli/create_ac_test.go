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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestCreateCommand_WithACAdd(t *testing.T) {
	t.Run("US1-AC01: sends POST to /add-ac after create when --ac-add flag is set", func(t *testing.T) {
		tc := newCreateACTestContext(t)

		// Given
		tc.server_that_captures_all_requests_and_returns_created_then_no_content()
		tc.client_configured()

		// When
		tc.execute_create_with_ac("My Rune", `{"scenario":"happy path","description":"User logs in successfully"}`)

		// Then
		tc.command_has_no_error()
		tc.request_count_is_at_least(2)
		tc.request_n_path_was(0, "/api/create-rune")
		tc.request_n_path_was(1, "/api/add-ac")
		tc.request_n_body_has_field(1, "scenario", "happy path")
		tc.request_n_body_has_field(1, "description", "User logs in successfully")
	})

	t.Run("US1-AC01: add-ac request carries the rune_id returned by create", func(t *testing.T) {
		tc := newCreateACTestContext(t)

		// Given
		tc.server_that_captures_all_requests_and_returns_created_then_no_content()
		tc.client_configured()

		// When
		tc.execute_create_with_ac("My Rune", `{"scenario":"happy path","description":"User logs in"}`)

		// Then
		tc.command_has_no_error()
		tc.request_n_body_has_field(1, "rune_id", "bf-test")
	})

	t.Run("US1-AC02: multiple --ac-add flags each send a separate POST to /add-ac", func(t *testing.T) {
		tc := newCreateACTestContext(t)

		// Given
		tc.server_that_captures_all_requests_and_returns_created_then_no_content()
		tc.client_configured()

		// When
		tc.execute_create_with_multiple_acs("My Rune",
			`{"scenario":"happy path","description":"User logs in"}`,
			`{"scenario":"sad path","description":"Login fails"}`,
		)

		// Then
		tc.command_has_no_error()
		tc.request_count_is_at_least(3)
		tc.request_n_path_was(1, "/api/add-ac")
		tc.request_n_path_was(2, "/api/add-ac")
	})

	t.Run("returns error when server fails on create", func(t *testing.T) {
		tc := newCreateACTestContext(t)

		// Given
		tc.server_that_returns_error_on_create(http.StatusBadRequest, "title is required")
		tc.client_configured()

		// When
		tc.execute_create_with_ac("", `{"scenario":"happy path","description":"desc"}`)

		// Then
		tc.command_has_error()
		tc.output_contains("title is required")
	})

	t.Run("returns error when server fails on add-ac", func(t *testing.T) {
		tc := newCreateACTestContext(t)

		// Given
		tc.server_that_returns_ok_on_create_error_on_ac(http.StatusBadRequest, "invalid ac")
		tc.client_configured()

		// When
		tc.execute_create_with_ac("My Rune", `{"scenario":"happy path","description":"desc"}`)

		// Then
		tc.command_has_error()
	})
}

// ---------------------------------------------------------------------------
// Test Context
// ---------------------------------------------------------------------------

type capturedHTTPRequest struct {
	method string
	path   string
	body   map[string]any
}

type createACTestContext struct {
	t *testing.T

	server   *httptest.Server
	client   *Client
	requests []capturedHTTPRequest
	buf      *bytes.Buffer
	err      error
}

func newCreateACTestContext(t *testing.T) *createACTestContext {
	t.Helper()
	return &createACTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// ---------------------------------------------------------------------------
// Given
// ---------------------------------------------------------------------------

func (tc *createACTestContext) server_that_captures_all_requests_and_returns_created_then_no_content() {
	tc.t.Helper()
	callCount := 0
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured := capturedHTTPRequest{
			method: r.Method,
			path:   r.URL.Path,
		}
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &captured.body)
		tc.requests = append(tc.requests, captured)

		w.Header().Set("Content-Type", "application/json")
		if callCount == 0 {
			// First request: create-rune → return 201 with rune ID
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"id":"bf-test","title":"My Rune"}`))
		} else {
			// Subsequent requests: add-ac → return 204
			w.WriteHeader(http.StatusNoContent)
		}
		callCount++
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *createACTestContext) server_that_returns_error_on_create(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *createACTestContext) server_that_returns_ok_on_create_error_on_ac(status int, message string) {
	tc.t.Helper()
	callCount := 0
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if callCount == 0 {
			w.WriteHeader(http.StatusCreated)
			_, _ = w.Write([]byte(`{"id":"bf-test","title":"My Rune"}`))
		} else {
			w.WriteHeader(status)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
		}
		callCount++
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *createACTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(tc.server.URL, "test-key", "test-realm")
}

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

func (tc *createACTestContext) execute_create_with_ac(title, acJSON string) {
	tc.t.Helper()
	cmd := NewCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{title, "--no-branch", "--ac-add", acJSON})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *createACTestContext) execute_create_with_multiple_acs(title string, acJSONItems ...string) {
	tc.t.Helper()
	args := []string{title, "--no-branch"}
	for _, ac := range acJSONItems {
		args = append(args, "--ac-add", ac)
	}
	cmd := NewCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs(args)
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

func (tc *createACTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *createACTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *createACTestContext) request_count_is_at_least(n int) {
	tc.t.Helper()
	assert.GreaterOrEqual(tc.t, len(tc.requests), n,
		"expected at least %d requests, got %d", n, len(tc.requests))
}

func (tc *createACTestContext) request_n_path_was(n int, expected string) {
	tc.t.Helper()
	require.Greater(tc.t, len(tc.requests), n, "expected at least %d requests", n+1)
	assert.Equal(tc.t, expected, tc.requests[n].path)
}

func (tc *createACTestContext) request_n_body_has_field(n int, key, expected string) {
	tc.t.Helper()
	require.Greater(tc.t, len(tc.requests), n, "expected at least %d requests", n+1)
	req := tc.requests[n]
	require.NotNil(tc.t, req.body, "expected request %d to have a JSON body", n)
	assert.Equal(tc.t, expected, req.body[key], "request %d body field %q", n, key)
}

func (tc *createACTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}
