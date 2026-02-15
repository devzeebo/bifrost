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

func TestClaimCommand(t *testing.T) {
	t.Run("sends POST to /claim-rune with id and default claimant", func(t *testing.T) {
		tc := newClaimTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_claim("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/claim-rune")
		tc.request_body_has_field("id", "bf-abc")
		tc.request_body_has_non_empty_field("claimant")
	})

	t.Run("uses --as flag for claimant name", func(t *testing.T) {
		tc := newClaimTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_claim_as("bf-abc", "alice")

		// Then
		tc.command_has_no_error()
		tc.request_body_has_field("claimant", "alice")
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newClaimTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_claim_with_human("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Rune bf-abc claimed")
	})

	t.Run("returns error when server responds with error", func(t *testing.T) {
		tc := newClaimTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusBadRequest, "rune already claimed")
		tc.client_configured()

		// When
		tc.execute_claim("bf-abc")

		// Then
		tc.command_has_error()
		tc.output_contains("rune already claimed")
	})
}

// --- Test Context ---

type claimTestContext struct {
	t *testing.T

	server         *httptest.Server
	client         *Client
	receivedMethod string
	receivedPath   string
	receivedBody   map[string]any
	buf            *bytes.Buffer
	err            error
}

func newClaimTestContext(t *testing.T) *claimTestContext {
	t.Helper()
	return &claimTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *claimTestContext) server_that_captures_request_and_returns_no_content() {
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

func (tc *claimTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *claimTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

// --- When ---

func (tc *claimTestContext) execute_claim(id string) {
	tc.t.Helper()
	cmd := NewClaimCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id})
	tc.err = cmd.Command.Execute()
}

func (tc *claimTestContext) execute_claim_as(id, claimant string) {
	tc.t.Helper()
	cmd := NewClaimCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--as", claimant})
	tc.err = cmd.Command.Execute()
}

func (tc *claimTestContext) execute_claim_with_human(id string) {
	tc.t.Helper()
	cmd := NewClaimCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--human"})
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *claimTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *claimTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *claimTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *claimTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *claimTestContext) request_body_has_field(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *claimTestContext) request_body_has_non_empty_field(key string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	val, ok := tc.receivedBody[key].(string)
	assert.True(tc.t, ok, "expected field %q to be a string", key)
	assert.NotEmpty(tc.t, val, "expected field %q to be non-empty", key)
}

func (tc *claimTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}
