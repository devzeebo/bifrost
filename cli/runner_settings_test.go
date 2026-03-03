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

func TestRunnerSettingsCreate(t *testing.T) {
	t.Run("sends POST to /api/runner-settings with runner_type and name", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_created()
		tc.client_configured()

		// When
		tc.execute_create("cursor-cli", "TestSettings")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/api/runner-settings")
		tc.request_body_has_field("runner_type", "cursor-cli")
		tc.request_body_has_field("name", "TestSettings")
	})

	t.Run("outputs JSON response by default", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_returns_json(`{"runner_settings_id":"rs-abc","runner_type":"cursor-cli","name":"TestSettings"}`)
		tc.client_configured()

		// When
		tc.execute_create("cursor-cli", "TestSettings")

		// Then
		tc.command_has_no_error()
		tc.output_contains(`"runner_settings_id":"rs-abc"`)
	})

	t.Run("outputs human-readable format when --human flag is set", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_returns_json(`{"runner_settings_id":"rs-abc","runner_type":"cursor-cli","name":"TestSettings"}`)
		tc.client_configured()

		// When
		tc.execute_create_human("cursor-cli", "TestSettings")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Created runner settings rs-abc: TestSettings")
	})
}

func TestRunnerSettingsList(t *testing.T) {
	t.Run("sends GET to /api/runner-settings", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_list()
		tc.client_configured()

		// When
		tc.execute_list()

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/api/runner-settings")
	})

	t.Run("outputs JSON array by default", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_returns_json_list(`[{"runner_settings_id":"rs-1","name":"Settings1"},{"runner_settings_id":"rs-2","name":"Settings2"}]`)
		tc.client_configured()

		// When
		tc.execute_list()

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json_array()
	})

	t.Run("outputs human-readable table when --human flag is set", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_returns_json_list(`[{"runner_settings_id":"rs-1","runner_type":"cursor-cli","name":"Settings1"},{"runner_settings_id":"rs-2","runner_type":"windsurf-cli","name":"Settings2"}]`)
		tc.client_configured()

		// When
		tc.execute_list_human()

		// Then
		tc.command_has_no_error()
		tc.output_contains("ID")
		tc.output_contains("Type")
		tc.output_contains("Name")
		tc.output_contains("rs-1")
		tc.output_contains("Settings1")
	})
}

func TestRunnerSettingsShow(t *testing.T) {
	t.Run("sends GET to /api/runner-settings/{id}", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_settings()
		tc.client_configured()

		// When
		tc.execute_show("rs-1234")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/api/runner-settings/rs-1234")
	})

	t.Run("outputs JSON by default", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_returns_settings_json(`{"runner_settings_id":"rs-1234","runner_type":"cursor-cli","name":"TestSettings","fields":{"api_key":"test-key"}}`)
		tc.client_configured()

		// When
		tc.execute_show("rs-1234")

		// Then
		tc.command_has_no_error()
		tc.output_contains(`"runner_settings_id":"rs-1234"`)
	})

	t.Run("outputs human-readable format when --human flag is set", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_returns_settings_json(`{"runner_settings_id":"rs-1234","runner_type":"cursor-cli","name":"TestSettings","fields":{"api_key":"test-key"}}`)
		tc.client_configured()

		// When
		tc.execute_show_human("rs-1234")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Runner Settings ID:")
		tc.output_contains("rs-1234")
		tc.output_contains("Name:")
		tc.output_contains("TestSettings")
	})

	t.Run("returns error when settings not found", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusNotFound, "runner settings not found")
		tc.client_configured()

		// When
		tc.execute_show("rs-nonexistent")

		// Then
		tc.command_has_error()
		tc.output_contains("runner settings not found")
	})
}

func TestRunnerSettingsSetField(t *testing.T) {
	t.Run("sends PUT to /api/runner-settings/{id}/fields with key and value", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()

		// When
		tc.execute_set_field("rs-1234", "api_key", "secret-value")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("PUT")
		tc.request_path_was("/api/runner-settings/rs-1234/fields")
		tc.request_body_has_field("key", "api_key")
		tc.request_body_has_field("value", "secret-value")
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()

		// When
		tc.execute_set_field_human("rs-1234", "api_key", "secret-value")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Set field api_key on rs-1234")
	})
}

func TestRunnerSettingsDelete(t *testing.T) {
	t.Run("sends DELETE to /api/runner-settings/{id}", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()

		// When
		tc.execute_delete("rs-1234")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("DELETE")
		tc.request_path_was("/api/runner-settings/rs-1234")
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()

		// When
		tc.execute_delete_human("rs-1234")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Deleted runner settings rs-1234")
	})

	t.Run("returns error when settings not found", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusNotFound, "runner settings not found")
		tc.client_configured()

		// When
		tc.execute_delete("rs-nonexistent")

		// Then
		tc.command_has_error()
		tc.output_contains("runner settings not found")
	})
}

// --- Test Context ---

type runnerSettingsTestContext struct {
	t *testing.T

	server          *httptest.Server
	client          *Client
	receivedMethod  string
	receivedPath    string
	receivedBody    map[string]any
	buf             *bytes.Buffer
	err             error
}

func newRunnerSettingsTestContext(t *testing.T) *runnerSettingsTestContext {
	t.Helper()
	return &runnerSettingsTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *runnerSettingsTestContext) server_that_captures_request_and_returns_created() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &tc.receivedBody)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"runner_settings_id":"rs-test","runner_type":"cursor-cli","name":"test"}`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *runnerSettingsTestContext) server_that_captures_request_and_returns_list() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[]`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *runnerSettingsTestContext) server_that_captures_request_and_returns_settings() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"runner_settings_id":"rs-test","runner_type":"cursor-cli","name":"test"}`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *runnerSettingsTestContext) server_that_captures_request_and_returns_ok() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &tc.receivedBody)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{}`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *runnerSettingsTestContext) server_that_returns_json(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *runnerSettingsTestContext) server_that_returns_json_list(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *runnerSettingsTestContext) server_that_returns_settings_json(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *runnerSettingsTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *runnerSettingsTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

// --- When ---

func (tc *runnerSettingsTestContext) execute_create(runnerType, name string) {
	tc.t.Helper()
	cmd := NewRunnerSettingsCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--runner-type", runnerType, "--name", name})
	tc.err = cmd.Command.Execute()
}

func (tc *runnerSettingsTestContext) execute_create_human(runnerType, name string) {
	tc.t.Helper()
	cmd := NewRunnerSettingsCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--runner-type", runnerType, "--name", name, "--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *runnerSettingsTestContext) execute_list() {
	tc.t.Helper()
	cmd := NewRunnerSettingsListCmd(func() *Client { return tc.client }, tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *runnerSettingsTestContext) execute_list_human() {
	tc.t.Helper()
	cmd := NewRunnerSettingsListCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *runnerSettingsTestContext) execute_show(id string) {
	tc.t.Helper()
	cmd := NewRunnerSettingsShowCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id})
	tc.err = cmd.Command.Execute()
}

func (tc *runnerSettingsTestContext) execute_show_human(id string) {
	tc.t.Helper()
	cmd := NewRunnerSettingsShowCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *runnerSettingsTestContext) execute_set_field(id, key, value string) {
	tc.t.Helper()
	cmd := NewRunnerSettingsSetFieldCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, key, value})
	tc.err = cmd.Command.Execute()
}

func (tc *runnerSettingsTestContext) execute_set_field_human(id, key, value string) {
	tc.t.Helper()
	cmd := NewRunnerSettingsSetFieldCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, key, value, "--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *runnerSettingsTestContext) execute_delete(id string) {
	tc.t.Helper()
	cmd := NewRunnerSettingsDeleteCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id})
	tc.err = cmd.Command.Execute()
}

func (tc *runnerSettingsTestContext) execute_delete_human(id string) {
	tc.t.Helper()
	cmd := NewRunnerSettingsDeleteCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--human"})
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *runnerSettingsTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *runnerSettingsTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *runnerSettingsTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *runnerSettingsTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *runnerSettingsTestContext) request_body_has_field(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *runnerSettingsTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}

func (tc *runnerSettingsTestContext) output_is_valid_json_array() {
	tc.t.Helper()
	var arr []interface{}
	err := json.Unmarshal(tc.buf.Bytes(), &arr)
	assert.NoError(tc.t, err, "output is not valid JSON array: %s", tc.buf.String())
}
