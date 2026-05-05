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

func TestRetroCommand(t *testing.T) {
	t.Run("adds retro item: sends POST to /add-retro with rune_id and text", func(t *testing.T) {
		tc := newRetroTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_retro_add("bf-abc", "Team communication was excellent")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/api/add-retro")
		tc.request_body_has_field("rune_id", "bf-abc")
		tc.request_body_has_field("text", "Team communication was excellent")
	})

	t.Run("adds retro item: outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newRetroTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_retro_add_with_human("bf-abc", "Team communication was excellent")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Retro item added to rune bf-abc")
	})

	t.Run("adds retro item: returns error when server responds with error", func(t *testing.T) {
		tc := newRetroTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusNotFound, "rune not found")
		tc.client_configured()

		// When
		tc.execute_retro_add("bf-abc", "This will fail")

		// Then
		tc.command_has_error()
	})

	t.Run("fetches retro for single rune: sends GET to /retro with id param", func(t *testing.T) {
		tc := newRetroTestContext(t)

		// Given
		tc.server_that_returns_single_rune_retro("bf-abc", "Fix the bridge", "open", "Needs repair", []string{"Took longer than expected"})
		tc.client_configured()

		// When
		tc.execute_retro_fetch("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/api/retro")
		tc.request_query_param_was("id", "bf-abc")
	})

	t.Run("fetches retro: human output shows rune details and retro items", func(t *testing.T) {
		tc := newRetroTestContext(t)

		// Given
		tc.server_that_returns_single_rune_retro("bf-abc", "Fix the bridge", "fulfilled", "Needs repair", []string{"Took longer than expected"})
		tc.client_configured()

		// When
		tc.execute_retro_fetch_with_human("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Fix the bridge")
		tc.output_contains("fulfilled")
		tc.output_contains("Needs repair")
		tc.output_contains("Took longer than expected")
	})

	t.Run("fetches retro: human output shows (none) when no retro items", func(t *testing.T) {
		tc := newRetroTestContext(t)

		// Given
		tc.server_that_returns_single_rune_retro("bf-abc", "Task", "open", "", []string{})
		tc.client_configured()

		// When
		tc.execute_retro_fetch_with_human("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("(none)")
	})

	t.Run("fetches saga retro: human output shows all child runes", func(t *testing.T) {
		tc := newRetroTestContext(t)

		// Given
		tc.server_that_returns_saga_retro([]sagaRetroEntry{
			{id: "bf-a1b2.1", title: "Child 1", status: "fulfilled", items: []string{"Note 1"}},
			{id: "bf-a1b2.2", title: "Child 2", status: "sealed", items: []string{}},
		})
		tc.client_configured()

		// When
		tc.execute_retro_fetch_with_human("bf-a1b2")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Child 1")
		tc.output_contains("Child 2")
		tc.output_contains("Note 1")
	})

	t.Run("fetches retro: returns error when server responds with error", func(t *testing.T) {
		tc := newRetroTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusNotFound, "rune not found")
		tc.client_configured()

		// When
		tc.execute_retro_fetch("bf-abc")

		// Then
		tc.command_has_error()
	})
}

// --- Test Context ---

type retroTestContext struct {
	t *testing.T

	server              *httptest.Server
	client              *Client
	receivedMethod      string
	receivedPath        string
	receivedQueryParams map[string]string
	receivedBody        map[string]any
	buf                 *bytes.Buffer
	err                 error
}

type sagaRetroEntry struct {
	id     string
	title  string
	status string
	items  []string
}

func newRetroTestContext(t *testing.T) *retroTestContext {
	t.Helper()
	return &retroTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *retroTestContext) server_that_captures_request_and_returns_no_content() {
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

func (tc *retroTestContext) server_that_returns_single_rune_retro(id, title, status, description string, items []string) {
	tc.t.Helper()
	retroItems := make([]map[string]any, 0, len(items))
	for _, item := range items {
		retroItems = append(retroItems, map[string]any{
			"text":       item,
			"created_at": "2026-01-15T10:00:00Z",
		})
	}
	response := map[string]any{
		"id":          id,
		"title":       title,
		"status":      status,
		"description": description,
		"retro_items": retroItems,
	}
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		tc.receivedQueryParams = map[string]string{"id": r.URL.Query().Get("id")}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *retroTestContext) server_that_returns_saga_retro(entries []sagaRetroEntry) {
	tc.t.Helper()
	response := make([]map[string]any, 0, len(entries))
	for _, e := range entries {
		retroItems := make([]map[string]any, 0, len(e.items))
		for _, item := range e.items {
			retroItems = append(retroItems, map[string]any{
				"text":       item,
				"created_at": "2026-01-15T10:00:00Z",
			})
		}
		response = append(response, map[string]any{
			"id":          e.id,
			"title":       e.title,
			"status":      e.status,
			"retro_items": retroItems,
		})
	}
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(response)
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *retroTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *retroTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(tc.server.URL, "test-key", "test-realm")
}

// --- When ---

func (tc *retroTestContext) execute_retro_add(id, text string) {
	tc.t.Helper()
	cmd := NewRetroCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, text})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *retroTestContext) execute_retro_add_with_human(id, text string) {
	tc.t.Helper()
	cmd := NewRetroCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, text, "--human"})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *retroTestContext) execute_retro_fetch(id string) {
	tc.t.Helper()
	cmd := NewRetroCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *retroTestContext) execute_retro_fetch_with_human(id string) {
	tc.t.Helper()
	cmd := NewRetroCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--human"})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *retroTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *retroTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *retroTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *retroTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *retroTestContext) request_query_param_was(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedQueryParams)
	assert.Equal(tc.t, expected, tc.receivedQueryParams[key])
}

func (tc *retroTestContext) request_body_has_field(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *retroTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}
