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

func TestShowCommand(t *testing.T) {
	t.Run("sends GET to /rune with id query parameter", func(t *testing.T) {
		tc := newShowTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_rune()
		tc.client_configured()

		// When
		tc.execute_show("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/rune")
		tc.request_query_param_was("id", "bf-abc")
	})

	t.Run("outputs JSON response by default", func(t *testing.T) {
		tc := newShowTestContext(t)

		// Given
		tc.server_that_returns_json(`{"id":"bf-abc","title":"My Rune","status":"open","priority":0}`)
		tc.client_configured()

		// When
		tc.execute_show("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains(`"id":"bf-abc"`)
		tc.output_contains(`"title":"My Rune"`)
	})

	t.Run("outputs human-readable format when --human flag is set", func(t *testing.T) {
		tc := newShowTestContext(t)

		// Given
		tc.server_that_returns_json(`{"id":"bf-abc","title":"My Rune","status":"open","priority":1,"description":"A desc","claimant":"alice","dependencies":["bf-dep1"],"notes":["note1"]}`)
		tc.client_configured()

		// When
		tc.execute_show_with_human("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("bf-abc")
		tc.output_contains("My Rune")
		tc.output_contains("open")
		tc.output_contains("A desc")
	})

	t.Run("displays branch in human output when present", func(t *testing.T) {
		tc := newShowTestContext(t)

		// Given
		tc.server_that_returns_json(`{"id":"bf-abc","title":"My Rune","status":"open","priority":1,"branch":"feature-x"}`)
		tc.client_configured()

		// When
		tc.execute_show_with_human("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Branch:")
		tc.output_contains("feature-x")
	})

	t.Run("omits branch in human output when empty", func(t *testing.T) {
		tc := newShowTestContext(t)

		// Given
		tc.server_that_returns_json(`{"id":"bf-abc","title":"My Rune","status":"open","priority":1}`)
		tc.client_configured()

		// When
		tc.execute_show_with_human("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_not_contains("Branch:")
	})

	t.Run("returns error when server responds with not found", func(t *testing.T) {
		tc := newShowTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusNotFound, "rune not found")
		tc.client_configured()

		// When
		tc.execute_show("bf-nonexistent")

		// Then
		tc.command_has_error()
		tc.output_contains("rune not found")
	})
}

// --- Test Context ---

type showTestContext struct {
	t *testing.T

	server         *httptest.Server
	client         *Client
	receivedMethod string
	receivedPath   string
	receivedQuery  map[string]string
	buf            *bytes.Buffer
	err            error
}

func newShowTestContext(t *testing.T) *showTestContext {
	t.Helper()
	return &showTestContext{
		t:             t,
		buf:           &bytes.Buffer{},
		receivedQuery: make(map[string]string),
	}
}

// --- Given ---

func (tc *showTestContext) server_that_captures_request_and_returns_rune() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		for k, v := range r.URL.Query() {
			tc.receivedQuery[k] = v[0]
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"bf-abc","title":"My Rune","status":"open","priority":0}`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *showTestContext) server_that_returns_json(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *showTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *showTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

// --- When ---

func (tc *showTestContext) execute_show(id string) {
	tc.t.Helper()
	cmd := NewShowCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id})
	tc.err = cmd.Command.Execute()
}

func (tc *showTestContext) execute_show_with_human(id string) {
	tc.t.Helper()
	cmd := NewShowCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--human"})
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *showTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *showTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *showTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *showTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *showTestContext) request_query_param_was(key, expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedQuery[key])
}

func (tc *showTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}

func (tc *showTestContext) output_not_contains(substr string) {
	tc.t.Helper()
	assert.NotContains(tc.t, tc.buf.String(), substr)
}
