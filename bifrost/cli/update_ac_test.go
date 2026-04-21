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

func TestUpdateCommand_ACAdd(t *testing.T) {
	t.Run("US2-AC01: sends POST to /add-ac with rune_id, scenario, description when --ac-add is set", func(t *testing.T) {
		tc := newUpdateACTestContext(t)

		// Given
		tc.server_that_captures_all_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_update_with_ac_add("bf-abc", `{"scenario":"sad path","description":"Login fails"}`)

		// Then
		tc.command_has_no_error()
		tc.request_to_path_has_field("/api/add-ac", "rune_id", "bf-abc")
		tc.request_to_path_has_field("/api/add-ac", "scenario", "sad path")
		tc.request_to_path_has_field("/api/add-ac", "description", "Login fails")
	})

	t.Run("US2-AC03: multiple --ac-add flags each send a separate POST to /add-ac", func(t *testing.T) {
		tc := newUpdateACTestContext(t)

		// Given
		tc.server_that_captures_all_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_update_with_multiple_ac_adds("bf-abc",
			`{"scenario":"path one","description":"desc one"}`,
			`{"scenario":"path two","description":"desc two"}`,
		)

		// Then
		tc.command_has_no_error()
		tc.request_count_to_path_is("/api/add-ac", 2)
	})

	t.Run("returns error when server fails on --ac-add", func(t *testing.T) {
		tc := newUpdateACTestContext(t)

		// Given
		tc.server_that_returns_error_on_path("/api/add-ac", http.StatusNotFound, "rune not found")
		tc.client_configured()

		// When
		tc.execute_update_with_ac_add("bf-missing", `{"scenario":"path","description":"desc"}`)

		// Then
		tc.command_has_error()
		tc.output_contains("rune not found")
	})
}

func TestUpdateCommand_ACUpdate(t *testing.T) {
	t.Run("US3-AC01: sends POST to /update-ac with rune_id, id, scenario, description when --ac-update is set", func(t *testing.T) {
		tc := newUpdateACTestContext(t)

		// Given
		tc.server_that_captures_all_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_update_with_ac_update("bf-abc", `{"id":"AC-01","scenario":"new name","description":"new desc"}`)

		// Then
		tc.command_has_no_error()
		tc.request_to_path_has_field("/api/update-ac", "rune_id", "bf-abc")
		tc.request_to_path_has_field("/api/update-ac", "id", "AC-01")
		tc.request_to_path_has_field("/api/update-ac", "scenario", "new name")
		tc.request_to_path_has_field("/api/update-ac", "description", "new desc")
	})

	t.Run("US3-AC02: returns error when server responds with error for non-existent AC ID", func(t *testing.T) {
		tc := newUpdateACTestContext(t)

		// Given
		tc.server_that_returns_error_on_path("/api/update-ac", http.StatusNotFound, "AC-99 not found")
		tc.client_configured()

		// When
		tc.execute_update_with_ac_update("bf-abc", `{"id":"AC-99","scenario":"s","description":"d"}`)

		// Then
		tc.command_has_error()
		tc.output_contains("AC-99 not found")
	})

	t.Run("US3-AC03: multiple --ac-update flags each send a separate POST to /update-ac", func(t *testing.T) {
		tc := newUpdateACTestContext(t)

		// Given
		tc.server_that_captures_all_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_update_with_multiple_ac_updates("bf-abc",
			`{"id":"AC-01","scenario":"new one","description":"new desc one"}`,
			`{"id":"AC-02","scenario":"new two","description":"new desc two"}`,
		)

		// Then
		tc.command_has_no_error()
		tc.request_count_to_path_is("/api/update-ac", 2)
	})
}

func TestUpdateCommand_ACRemove(t *testing.T) {
	t.Run("US4-AC01: sends POST to /remove-ac with rune_id and id when --ac-remove is set", func(t *testing.T) {
		tc := newUpdateACTestContext(t)

		// Given
		tc.server_that_captures_all_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_update_with_ac_remove("bf-abc", "AC-01")

		// Then
		tc.command_has_no_error()
		tc.request_to_path_has_field("/api/remove-ac", "rune_id", "bf-abc")
		tc.request_to_path_has_field("/api/remove-ac", "id", "AC-01")
	})

	t.Run("US4-AC02: returns error when server responds with error for non-existent AC ID", func(t *testing.T) {
		tc := newUpdateACTestContext(t)

		// Given
		tc.server_that_returns_error_on_path("/api/remove-ac", http.StatusNotFound, "AC-99 not found")
		tc.client_configured()

		// When
		tc.execute_update_with_ac_remove("bf-abc", "AC-99")

		// Then
		tc.command_has_error()
		tc.output_contains("AC-99 not found")
	})

	t.Run("US4-AC05: multiple --ac-remove flags each send a separate POST to /remove-ac", func(t *testing.T) {
		tc := newUpdateACTestContext(t)

		// Given
		tc.server_that_captures_all_and_returns_no_content()
		tc.client_configured()

		// When
		tc.execute_update_with_multiple_ac_removes("bf-abc", "AC-01", "AC-02")

		// Then
		tc.command_has_no_error()
		tc.request_count_to_path_is("/api/remove-ac", 2)
	})
}

// ---------------------------------------------------------------------------
// Test Context
// ---------------------------------------------------------------------------

type updateACTestContext struct {
	t *testing.T

	server   *httptest.Server
	client   *Client
	requests []capturedHTTPRequest // reuse from create_ac_test.go
	buf      *bytes.Buffer
	err      error
}

func newUpdateACTestContext(t *testing.T) *updateACTestContext {
	t.Helper()
	return &updateACTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// ---------------------------------------------------------------------------
// Given
// ---------------------------------------------------------------------------

func (tc *updateACTestContext) server_that_captures_all_and_returns_no_content() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured := capturedHTTPRequest{
			method: r.Method,
			path:   r.URL.Path,
		}
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &captured.body)
		tc.requests = append(tc.requests, captured)
		w.WriteHeader(http.StatusNoContent)
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *updateACTestContext) server_that_returns_error_on_path(targetPath string, status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured := capturedHTTPRequest{
			method: r.Method,
			path:   r.URL.Path,
		}
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &captured.body)
		tc.requests = append(tc.requests, captured)

		if r.URL.Path == targetPath {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(status)
			_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *updateACTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(tc.server.URL, "test-key", "test-realm")
}

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

func (tc *updateACTestContext) execute_update_with_ac_add(runeID, acJSON string) {
	tc.t.Helper()
	cmd := NewUpdateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{runeID, "--ac-add", acJSON})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *updateACTestContext) execute_update_with_multiple_ac_adds(runeID string, acJSONItems ...string) {
	tc.t.Helper()
	args := []string{runeID}
	for _, ac := range acJSONItems {
		args = append(args, "--ac-add", ac)
	}
	cmd := NewUpdateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs(args)
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *updateACTestContext) execute_update_with_ac_update(runeID, acJSON string) {
	tc.t.Helper()
	cmd := NewUpdateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{runeID, "--ac-update", acJSON})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *updateACTestContext) execute_update_with_multiple_ac_updates(runeID string, acJSONItems ...string) {
	tc.t.Helper()
	args := []string{runeID}
	for _, ac := range acJSONItems {
		args = append(args, "--ac-update", ac)
	}
	cmd := NewUpdateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs(args)
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *updateACTestContext) execute_update_with_ac_remove(runeID, acID string) {
	tc.t.Helper()
	cmd := NewUpdateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{runeID, "--ac-remove", acID})
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *updateACTestContext) execute_update_with_multiple_ac_removes(runeID string, acIDs ...string) {
	tc.t.Helper()
	args := []string{runeID}
	for _, id := range acIDs {
		args = append(args, "--ac-remove", id)
	}
	cmd := NewUpdateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs(args)
	cmd.Command.SetErr(tc.buf)
	tc.err = cmd.Command.Execute()
}

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

func (tc *updateACTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *updateACTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *updateACTestContext) request_to_path_has_field(path, key, expected string) {
	tc.t.Helper()
	for _, req := range tc.requests {
		if req.path == path {
			require.NotNil(tc.t, req.body, "expected request to %q to have a JSON body", path)
			assert.Equal(tc.t, expected, req.body[key], "request to %q body field %q", path, key)
			return
		}
	}
	tc.t.Fatalf("no request found to path %q in %v", path, tc.requests)
}

func (tc *updateACTestContext) request_count_to_path_is(path string, expected int) {
	tc.t.Helper()
	count := 0
	for _, req := range tc.requests {
		if req.path == path {
			count++
		}
	}
	assert.Equal(tc.t, expected, count, "expected %d requests to %q, got %d", expected, path, count)
}

func (tc *updateACTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}
