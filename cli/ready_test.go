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

func TestReadyCommand(t *testing.T) {
	t.Run("sends GET to /runes with status=open and blocked=false", func(t *testing.T) {
		tc := newReadyTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_runes()
		tc.client_configured()

		// When
		tc.execute_ready()

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/runes")
		tc.request_query_param_was("status", "open")
		tc.request_query_param_was("blocked", "false")
		tc.request_query_param_was("is_saga", "false")
	})

	t.Run("does not send is_saga param when --sagas flag is set", func(t *testing.T) {
		tc := newReadyTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_runes()
		tc.client_configured()

		// When
		tc.execute_ready_with_sagas()

		// Then
		tc.command_has_no_error()
		tc.request_query_param_absent("is_saga")
		tc.request_query_param_was("status", "open")
		tc.request_query_param_was("blocked", "false")
	})

	t.Run("outputs JSON response by default", func(t *testing.T) {
		tc := newReadyTestContext(t)

		// Given
		tc.server_that_returns_json(`[{"id":"bf-1","title":"Ready Rune","status":"open","priority":0}]`)
		tc.client_configured()

		// When
		tc.execute_ready()

		// Then
		tc.command_has_no_error()
		tc.output_contains(`"id":"bf-1"`)
	})

	t.Run("outputs human-readable table when --human flag is set", func(t *testing.T) {
		tc := newReadyTestContext(t)

		// Given
		tc.server_that_returns_json(`[{"id":"bf-1","title":"Ready Rune","status":"open","priority":0}]`)
		tc.client_configured()

		// When
		tc.execute_ready_with_human()

		// Then
		tc.command_has_no_error()
		tc.output_contains("ID")
		tc.output_contains("Title")
		tc.output_contains("bf-1")
		tc.output_contains("Ready Rune")
	})

	t.Run("JSON output only includes id, title, status, and priority", func(t *testing.T) {
		tc := newReadyTestContext(t)

		// Given
		tc.server_that_returns_json(`[{"id":"bf-1","title":"Ready Rune","status":"open","priority":0,"claimant":"someone","parent_id":"saga-1","created_at":"2026-01-01T00:00:00Z","updated_at":"2026-01-01T00:00:00Z"}]`)
		tc.client_configured()

		// When
		tc.execute_ready()

		// Then
		tc.command_has_no_error()
		tc.output_json_items_only_have_fields("id", "title", "status", "priority")
	})

	t.Run("JSON output is sorted by priority ascending", func(t *testing.T) {
		tc := newReadyTestContext(t)

		// Given
		tc.server_that_returns_json(`[{"id":"bf-3","title":"Low","status":"open","priority":2},{"id":"bf-1","title":"High","status":"open","priority":0},{"id":"bf-2","title":"Med","status":"open","priority":1}]`)
		tc.client_configured()

		// When
		tc.execute_ready()

		// Then
		tc.command_has_no_error()
		tc.output_json_priorities_are_ascending()
	})

	t.Run("returns error when server responds with error", func(t *testing.T) {
		tc := newReadyTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusInternalServerError, "failed to list runes")
		tc.client_configured()

		// When
		tc.execute_ready()

		// Then
		tc.command_has_error()
		tc.output_contains("failed to list runes")
	})
}

// --- Test Context ---

type readyTestContext struct {
	t *testing.T

	server         *httptest.Server
	client         *Client
	receivedMethod string
	receivedPath   string
	receivedQuery  map[string]string
	buf            *bytes.Buffer
	err            error
}

func newReadyTestContext(t *testing.T) *readyTestContext {
	t.Helper()
	return &readyTestContext{
		t:             t,
		buf:           &bytes.Buffer{},
		receivedQuery: make(map[string]string),
	}
}

// --- Given ---

func (tc *readyTestContext) server_that_captures_request_and_returns_runes() {
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

func (tc *readyTestContext) server_that_returns_json(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *readyTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *readyTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

// --- When ---

func (tc *readyTestContext) execute_ready() {
	tc.t.Helper()
	cmd := NewReadyCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{})
	tc.err = cmd.Command.Execute()
}

func (tc *readyTestContext) execute_ready_with_sagas() {
	tc.t.Helper()
	cmd := NewReadyCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--sagas"})
	tc.err = cmd.Command.Execute()
}

func (tc *readyTestContext) execute_ready_with_human() {
	tc.t.Helper()
	cmd := NewReadyCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--human"})
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *readyTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *readyTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *readyTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *readyTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *readyTestContext) request_query_param_was(key, expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedQuery[key])
}

func (tc *readyTestContext) request_query_param_absent(key string) {
	tc.t.Helper()
	_, exists := tc.receivedQuery[key]
	assert.False(tc.t, exists, "expected query param %q to be absent, but it was present", key)
}

func (tc *readyTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}

func (tc *readyTestContext) output_json_priorities_are_ascending() {
	tc.t.Helper()
	var items []map[string]any
	require.NoError(tc.t, json.Unmarshal(tc.buf.Bytes(), &items))
	require.GreaterOrEqual(tc.t, len(items), 2, "need at least 2 items to verify sort order")
	for i := 1; i < len(items); i++ {
		prev, _ := items[i-1]["priority"].(float64)
		curr, _ := items[i]["priority"].(float64)
		assert.LessOrEqual(tc.t, prev, curr, "item[%d] priority %v should be <= item[%d] priority %v", i-1, prev, i, curr)
	}
}

func (tc *readyTestContext) output_json_items_only_have_fields(fields ...string) {
	tc.t.Helper()
	var items []map[string]any
	require.NoError(tc.t, json.Unmarshal(tc.buf.Bytes(), &items))
	require.NotEmpty(tc.t, items)
	allowed := make(map[string]bool, len(fields))
	for _, f := range fields {
		allowed[f] = true
	}
	for i, item := range items {
		for key := range item {
			assert.True(tc.t, allowed[key], "item[%d] has unexpected field %q", i, key)
		}
		for _, f := range fields {
			assert.Contains(tc.t, item, f, "item[%d] missing expected field %q", i, f)
		}
	}
}
