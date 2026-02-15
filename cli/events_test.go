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

func TestEventsCommand(t *testing.T) {
	t.Run("sends GET to /events with runeId query parameter", func(t *testing.T) {
		tc := newEventsTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_events()
		tc.client_configured()

		// When
		tc.execute_events("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/events")
		tc.request_query_param_was("runeId", "bf-abc")
	})

	t.Run("outputs JSON response by default", func(t *testing.T) {
		tc := newEventsTestContext(t)

		// Given
		tc.server_that_returns_json(`[{"type":"RuneCreated","data":{"id":"bf-abc"}}]`)
		tc.client_configured()

		// When
		tc.execute_events("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains(`"type":"RuneCreated"`)
	})

	t.Run("returns error when server responds with error", func(t *testing.T) {
		tc := newEventsTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusNotFound, "rune not found")
		tc.client_configured()

		// When
		tc.execute_events("bf-nonexistent")

		// Then
		tc.command_has_error()
		tc.output_contains("rune not found")
	})
}

// --- Test Context ---

type eventsTestContext struct {
	t *testing.T

	server         *httptest.Server
	client         *Client
	receivedMethod string
	receivedPath   string
	receivedQuery  map[string]string
	buf            *bytes.Buffer
	err            error
}

func newEventsTestContext(t *testing.T) *eventsTestContext {
	t.Helper()
	return &eventsTestContext{
		t:             t,
		buf:           &bytes.Buffer{},
		receivedQuery: make(map[string]string),
	}
}

// --- Given ---

func (tc *eventsTestContext) server_that_captures_request_and_returns_events() {
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

func (tc *eventsTestContext) server_that_returns_json(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *eventsTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *eventsTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

// --- When ---

func (tc *eventsTestContext) execute_events(id string) {
	tc.t.Helper()
	cmd := NewEventsCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id})
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *eventsTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *eventsTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *eventsTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *eventsTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *eventsTestContext) request_query_param_was(key, expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedQuery[key])
}

func (tc *eventsTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}
