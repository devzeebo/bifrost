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

func TestSweepCommand(t *testing.T) {
	t.Run("sends POST to /sweep-runes when --confirm is passed", func(t *testing.T) {
		tc := newSweepTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_shattered("bf-aaa", "bf-bbb")
		tc.client_configured()

		// When
		tc.execute_sweep_with_confirm()

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/sweep-runes")
	})

	t.Run("prompts for confirmation and proceeds when user types y", func(t *testing.T) {
		tc := newSweepTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_shattered("bf-aaa")
		tc.client_configured()
		tc.user_types("y\n")

		// When
		tc.execute_sweep()

		// Then
		tc.command_has_no_error()
		tc.output_contains("Continue? [y/N]")
		tc.request_method_was("POST")
		tc.request_path_was("/sweep-runes")
	})

	t.Run("prompts for confirmation and aborts when user types n", func(t *testing.T) {
		tc := newSweepTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_shattered()
		tc.client_configured()
		tc.user_types("n\n")

		// When
		tc.execute_sweep()

		// Then
		tc.command_has_no_error()
		tc.output_contains("Aborted")
		tc.no_request_was_sent()
	})

	t.Run("outputs human-readable list of shattered runes when --human flag is set", func(t *testing.T) {
		tc := newSweepTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_shattered("bf-aaa", "bf-bbb")
		tc.client_configured()

		// When
		tc.execute_sweep_with_confirm_and_human()

		// Then
		tc.command_has_no_error()
		tc.output_contains("Shattered 2 runes:")
		tc.output_contains("bf-aaa")
		tc.output_contains("bf-bbb")
	})

	t.Run("outputs No runes to sweep in human mode when response has empty array", func(t *testing.T) {
		tc := newSweepTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_shattered()
		tc.client_configured()

		// When
		tc.execute_sweep_with_confirm_and_human()

		// Then
		tc.command_has_no_error()
		tc.output_contains("No runes to sweep")
	})

	t.Run("returns raw JSON when --human is not set", func(t *testing.T) {
		tc := newSweepTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_shattered("bf-aaa")
		tc.client_configured()

		// When
		tc.execute_sweep_with_confirm()

		// Then
		tc.command_has_no_error()
		tc.output_contains(`"shattered"`)
		tc.output_contains(`"bf-aaa"`)
	})

	t.Run("returns error when server responds with error", func(t *testing.T) {
		tc := newSweepTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusInternalServerError, "sweep failed")
		tc.client_configured()

		// When
		tc.execute_sweep_with_confirm()

		// Then
		tc.command_has_error()
		tc.output_contains("sweep failed")
	})
}

// --- Test Context ---

type sweepTestContext struct {
	t *testing.T

	server         *httptest.Server
	client         *Client
	receivedMethod string
	receivedPath   string
	requestSent    bool
	buf            *bytes.Buffer
	in             *bytes.Buffer
	err            error
}

func newSweepTestContext(t *testing.T) *sweepTestContext {
	t.Helper()
	return &sweepTestContext{
		t:   t,
		buf: &bytes.Buffer{},
		in:  &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *sweepTestContext) server_that_captures_request_and_returns_shattered(ids ...string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		tc.requestSent = true
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		resp := map[string][]string{"shattered": ids}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *sweepTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.requestSent = true
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *sweepTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

func (tc *sweepTestContext) user_types(input string) {
	tc.t.Helper()
	tc.in.WriteString(input)
}

// --- When ---

func (tc *sweepTestContext) execute_sweep() {
	tc.t.Helper()
	cmd := NewSweepCmd(func() *Client { return tc.client }, tc.buf, tc.in)
	cmd.Command.SetArgs([]string{})
	tc.err = cmd.Command.Execute()
}

func (tc *sweepTestContext) execute_sweep_with_confirm() {
	tc.t.Helper()
	cmd := NewSweepCmd(func() *Client { return tc.client }, tc.buf, tc.in)
	cmd.Command.SetArgs([]string{"--confirm"})
	tc.err = cmd.Command.Execute()
}

func (tc *sweepTestContext) execute_sweep_with_confirm_and_human() {
	tc.t.Helper()
	cmd := NewSweepCmd(func() *Client { return tc.client }, tc.buf, tc.in)
	cmd.Command.SetArgs([]string{"--confirm", "--human"})
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *sweepTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *sweepTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *sweepTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *sweepTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *sweepTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}

func (tc *sweepTestContext) no_request_was_sent() {
	tc.t.Helper()
	assert.False(tc.t, tc.requestSent, "expected no request to be sent to server")
}
