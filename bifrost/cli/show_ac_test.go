package cli

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestShowCommand_AcceptanceCriteria(t *testing.T) {
	// NOTE: US5-AC02 (JSON output includes acceptance_criteria) is tested at the
	// integration level in server/ac_integration_test.go. The CLI show command is a
	// JSON passthrough, so testing JSON field presence here would be a false positive.

	t.Run("US5-AC01: human output shows Acceptance Criteria section with ID, scenario, description", func(t *testing.T) {
		tc := newShowACTestContext(t)

		// Given
		tc.server_that_returns_json(`{
			"id":"bf-abc",
			"title":"My Rune",
			"status":"open",
			"priority":1,
			"acceptance_criteria":[
				{"id":"AC-01","scenario":"happy path","description":"User logs in successfully"},
				{"id":"AC-02","scenario":"sad path","description":"Login fails with error"}
			]
		}`)
		tc.client_configured()

		// When
		tc.execute_show_with_human("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Acceptance Criteria:")
		tc.output_contains("AC-01")
		tc.output_contains("happy path")
		tc.output_contains("User logs in successfully")
		tc.output_contains("AC-02")
		tc.output_contains("sad path")
		tc.output_contains("Login fails with error")
	})

	t.Run("US5-AC01: human output omits Acceptance Criteria section when empty", func(t *testing.T) {
		tc := newShowACTestContext(t)

		// Given
		tc.server_that_returns_json(`{
			"id":"bf-abc",
			"title":"My Rune",
			"status":"open",
			"priority":1,
			"acceptance_criteria":[]
		}`)
		tc.client_configured()

		// When
		tc.execute_show_with_human("bf-abc")

		// Then
		tc.command_has_no_error()
		tc.output_not_contains("Acceptance Criteria:")
	})

	t.Run("US5-AC03: human output displays AC items in order by ID", func(t *testing.T) {
		tc := newShowACTestContext(t)

		// Given — server returns ACs already in sorted order (AC-01, AC-02, AC-03)
		tc.server_that_returns_json(`{
			"id":"bf-abc",
			"title":"My Rune",
			"status":"open",
			"priority":1,
			"acceptance_criteria":[
				{"id":"AC-01","scenario":"first","description":"first desc"},
				{"id":"AC-02","scenario":"second","description":"second desc"},
				{"id":"AC-03","scenario":"third","description":"third desc"}
			]
		}`)
		tc.client_configured()

		// When
		tc.execute_show_with_human("bf-abc")

		// Then — AC-01 appears before AC-02 which appears before AC-03 in output
		tc.command_has_no_error()
		tc.output_contains("AC-01")
		tc.output_contains("AC-02")
		tc.output_contains("AC-03")
		tc.ac_output_order_is_sequential()
	})

}

// ---------------------------------------------------------------------------
// Test Context
// ---------------------------------------------------------------------------

type showACTestContext struct {
	t *testing.T

	server *httptest.Server
	client *Client
	buf    *bytes.Buffer
	err    error
}

func newShowACTestContext(t *testing.T) *showACTestContext {
	t.Helper()
	return &showACTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// ---------------------------------------------------------------------------
// Given
// ---------------------------------------------------------------------------

func (tc *showACTestContext) server_that_returns_json(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *showACTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(tc.server.URL, "test-key", "test-realm")
}

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

func (tc *showACTestContext) execute_show_with_human(id string) {
	tc.t.Helper()
	cmd := NewShowCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--human"})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

func (tc *showACTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *showACTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}

func (tc *showACTestContext) output_not_contains(substr string) {
	tc.t.Helper()
	assert.NotContains(tc.t, tc.buf.String(), substr)
}

func (tc *showACTestContext) ac_output_order_is_sequential() {
	tc.t.Helper()
	output := tc.buf.String()
	// Verify AC-01 appears before AC-02 which appears before AC-03
	idx01 := indexOfInString(output, "AC-01")
	idx02 := indexOfInString(output, "AC-02")
	idx03 := indexOfInString(output, "AC-03")
	require.NotEqual(tc.t, -1, idx01, "AC-01 not found in output")
	require.NotEqual(tc.t, -1, idx02, "AC-02 not found in output")
	require.NotEqual(tc.t, -1, idx03, "AC-03 not found in output")
	assert.Less(tc.t, idx01, idx02, "expected AC-01 to appear before AC-02")
	assert.Less(tc.t, idx02, idx03, "expected AC-02 to appear before AC-03")
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func indexOfInString(s, substr string) int {
	for i := range s {
		if i+len(substr) <= len(s) && s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}

