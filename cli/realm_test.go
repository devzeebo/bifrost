package cli

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestRealmCreateCommand(t *testing.T) {
	t.Run("posts to create-realm with name", func(t *testing.T) {
		tc := newRealmTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns(`{"realmId":"bf-abc123","apiKey":"secret-key-xyz"}`)
		tc.root_cmd_with_server()

		// When
		tc.run_realm_create("my-realm")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/create-realm")
		tc.request_body_has("name", "my-realm")
	})

	t.Run("outputs human-readable realm ID", func(t *testing.T) {
		tc := newRealmTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns(`{"realm_id":"bf-abc123"}`)
		tc.root_cmd_with_server()

		// When
		tc.run_realm_create_human("my-realm")

		// Then
		tc.command_has_no_error()
		tc.output_contains("bf-abc123")
	})
}

func TestRealmListCommand(t *testing.T) {
	t.Run("gets realms list", func(t *testing.T) {
		tc := newRealmTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns(`[{"id":"bf-1","name":"realm-a","status":"active"},{"id":"bf-2","name":"realm-b","status":"inactive"}]`)
		tc.root_cmd_with_server()

		// When
		tc.run_realm_list()

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/realms")
	})

	t.Run("outputs human-readable table", func(t *testing.T) {
		tc := newRealmTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns(`[{"id":"bf-1","name":"realm-a","status":"active"},{"id":"bf-2","name":"realm-b","status":"inactive"}]`)
		tc.root_cmd_with_server()

		// When
		tc.run_realm_list_human()

		// Then
		tc.command_has_no_error()
		tc.output_contains("ID")
		tc.output_contains("Name")
		tc.output_contains("Status")
		tc.output_contains("bf-1")
		tc.output_contains("realm-a")
		tc.output_contains("active")
	})
}

// --- Test Context ---

type realmTestContext struct {
	t *testing.T

	server  *httptest.Server
	root    *RootCmd
	cmdErr  error
	output  string

	receivedMethod string
	receivedPath   string
	receivedBody   map[string]interface{}
}

func newRealmTestContext(t *testing.T) *realmTestContext {
	t.Helper()
	return &realmTestContext{t: t}
}

// --- Given ---

func (tc *realmTestContext) server_that_captures_request_and_returns(response string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		if r.Body != nil {
			body, _ := io.ReadAll(r.Body)
			if len(body) > 0 {
				_ = json.Unmarshal(body, &tc.receivedBody)
			}
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(response))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *realmTestContext) root_cmd_with_server() {
	tc.t.Helper()
	tc.root = &RootCmd{}
	tc.root.Cfg = &Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	}
	tc.root.Client = NewClient(tc.root.Cfg)

	cmd := &cobra.Command{Use: "bf"}
	cmd.PersistentFlags().Bool("human", false, "formatted table/text output")
	cmd.PersistentFlags().Bool("json", false, "force JSON output")
	tc.root.Command = cmd

	realmCmd := NewRealmCmd(tc.root)
	tc.root.Command.AddCommand(realmCmd)
}

// --- When ---

func (tc *realmTestContext) run_realm_create(name string) {
	tc.t.Helper()
	tc.root.Command.SetArgs([]string{"realm", "create", name})
	buf := new(bytes.Buffer)
	tc.root.Command.SetOut(buf)
	tc.cmdErr = tc.root.Command.Execute()
	tc.output = buf.String()
}

func (tc *realmTestContext) run_realm_create_human(name string) {
	tc.t.Helper()
	tc.root.Command.SetArgs([]string{"realm", "create", name, "--human"})
	buf := new(bytes.Buffer)
	tc.root.Command.SetOut(buf)
	tc.cmdErr = tc.root.Command.Execute()
	tc.output = buf.String()
}

func (tc *realmTestContext) run_realm_list() {
	tc.t.Helper()
	tc.root.Command.SetArgs([]string{"realm", "list"})
	buf := new(bytes.Buffer)
	tc.root.Command.SetOut(buf)
	tc.cmdErr = tc.root.Command.Execute()
	tc.output = buf.String()
}

func (tc *realmTestContext) run_realm_list_human() {
	tc.t.Helper()
	tc.root.Command.SetArgs([]string{"realm", "list", "--human"})
	buf := new(bytes.Buffer)
	tc.root.Command.SetOut(buf)
	tc.cmdErr = tc.root.Command.Execute()
	tc.output = buf.String()
}

// --- Then ---

func (tc *realmTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.cmdErr)
}

func (tc *realmTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *realmTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *realmTestContext) request_body_has(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody, "expected request body to be present")
	val, ok := tc.receivedBody[key]
	require.True(tc.t, ok, "expected key %q in request body", key)
	assert.Equal(tc.t, expected, val)
}

func (tc *realmTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.output, substr)
}
