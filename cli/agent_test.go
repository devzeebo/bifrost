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

func TestAgentCreate(t *testing.T) {
	t.Run("sends POST to /api/agents with name", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_created()
		tc.client_configured()

		// When
		tc.execute_create("TestAgent")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/api/agents")
		tc.request_body_has_field("name", "TestAgent")
	})

	t.Run("includes main_workflow_id when --main-workflow flag is set", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_created()
		tc.client_configured()

		// When
		tc.execute_create_with_workflow("TestAgent", "wf-1234")

		// Then
		tc.command_has_no_error()
		tc.request_body_has_field("main_workflow_id", "wf-1234")
	})

	t.Run("outputs JSON response by default", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_returns_json(`{"agent_id":"agent-abc","name":"TestAgent"}`)
		tc.client_configured()

		// When
		tc.execute_create("TestAgent")

		// Then
		tc.command_has_no_error()
		tc.output_contains(`"agent_id":"agent-abc"`)
	})

	t.Run("outputs human-readable format when --human flag is set", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_returns_json(`{"agent_id":"agent-abc","name":"TestAgent"}`)
		tc.client_configured()

		// When
		tc.execute_create_human("TestAgent")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Created agent agent-abc: TestAgent")
	})

	t.Run("returns error when server responds with error", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusBadRequest, "name is required")
		tc.client_configured()

		// When
		tc.execute_create("")

		// Then
		tc.command_has_error()
		tc.output_contains("name is required")
	})
}

func TestAgentList(t *testing.T) {
	t.Run("sends GET to /api/agents", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_list()
		tc.client_configured()

		// When
		tc.execute_list()

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/api/agents")
	})

	t.Run("outputs JSON array by default", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_returns_json_list(`[{"agent_id":"agent-1","name":"Agent1"},{"agent_id":"agent-2","name":"Agent2"}]`)
		tc.client_configured()

		// When
		tc.execute_list()

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json_array()
	})

	t.Run("outputs human-readable table when --human flag is set", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_returns_json_list(`[{"agent_id":"agent-1","name":"Agent1"},{"agent_id":"agent-2","name":"Agent2"}]`)
		tc.client_configured()

		// When
		tc.execute_list_human()

		// Then
		tc.command_has_no_error()
		tc.output_contains("ID")
		tc.output_contains("Name")
		tc.output_contains("agent-1")
		tc.output_contains("Agent1")
	})
}

func TestAgentShow(t *testing.T) {
	t.Run("sends GET to /api/agents/{id}", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_agent()
		tc.client_configured()

		// When
		tc.execute_show("agent-1234")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/api/agents/agent-1234")
	})

	t.Run("outputs JSON by default", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_returns_agent_json(`{"agent_id":"agent-1234","name":"TestAgent"}`)
		tc.client_configured()

		// When
		tc.execute_show("agent-1234")

		// Then
		tc.command_has_no_error()
		tc.output_contains(`"agent_id":"agent-1234"`)
	})

	t.Run("outputs human-readable format when --human flag is set", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_returns_agent_json(`{"agent_id":"agent-1234","name":"TestAgent","main_workflow_id":"wf-1"}`)
		tc.client_configured()

		// When
		tc.execute_show_human("agent-1234")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Agent ID:")
		tc.output_contains("agent-1234")
		tc.output_contains("Name:")
		tc.output_contains("TestAgent")
	})

	t.Run("returns error when agent not found", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusNotFound, "agent not found")
		tc.client_configured()

		// When
		tc.execute_show("agent-nonexistent")

		// Then
		tc.command_has_error()
		tc.output_contains("agent not found")
	})
}

func TestAgentGrant(t *testing.T) {
	t.Run("sends POST to /api/agents/{id}/grant with realm_id", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()

		// When
		tc.execute_grant("bf-realm1", "agent-1234")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/api/agents/agent-1234/grant")
		tc.request_body_has_field("realm_id", "bf-realm1")
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()

		// When
		tc.execute_grant_human("bf-realm1", "agent-1234")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Granted")
		tc.output_contains("agent-1234")
		tc.output_contains("bf-realm1")
	})
}

func TestAgentRevoke(t *testing.T) {
	t.Run("sends POST to /api/agents/{id}/revoke with realm_id", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()

		// When
		tc.execute_revoke("bf-realm1", "agent-1234")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/api/agents/agent-1234/revoke")
		tc.request_body_has_field("realm_id", "bf-realm1")
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newAgentTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()

		// When
		tc.execute_revoke_human("bf-realm1", "agent-1234")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Revoked")
		tc.output_contains("agent-1234")
		tc.output_contains("bf-realm1")
	})
}

// --- Test Context ---

type agentTestContext struct {
	t *testing.T

	server          *httptest.Server
	client          *Client
	receivedMethod  string
	receivedPath    string
	receivedBody    map[string]any
	buf             *bytes.Buffer
	err             error
}

func newAgentTestContext(t *testing.T) *agentTestContext {
	t.Helper()
	return &agentTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *agentTestContext) server_that_captures_request_and_returns_created() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &tc.receivedBody)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"agent_id":"agent-test","name":"test"}`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *agentTestContext) server_that_captures_request_and_returns_list() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[]`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *agentTestContext) server_that_captures_request_and_returns_agent() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"agent_id":"agent-test","name":"test"}`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *agentTestContext) server_that_captures_request_and_returns_ok() {
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

func (tc *agentTestContext) server_that_returns_json(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *agentTestContext) server_that_returns_json_list(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *agentTestContext) server_that_returns_agent_json(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *agentTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *agentTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

// --- When ---

func (tc *agentTestContext) execute_create(name string) {
	tc.t.Helper()
	cmd := NewAgentCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--name", name})
	tc.err = cmd.Command.Execute()
}

func (tc *agentTestContext) execute_create_with_workflow(name, workflowID string) {
	tc.t.Helper()
	cmd := NewAgentCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--name", name, "--main-workflow", workflowID})
	tc.err = cmd.Command.Execute()
}

func (tc *agentTestContext) execute_create_human(name string) {
	tc.t.Helper()
	cmd := NewAgentCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--name", name, "--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *agentTestContext) execute_list() {
	tc.t.Helper()
	cmd := NewAgentListCmd(func() *Client { return tc.client }, tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *agentTestContext) execute_list_human() {
	tc.t.Helper()
	cmd := NewAgentListCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *agentTestContext) execute_show(id string) {
	tc.t.Helper()
	cmd := NewAgentShowCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id})
	tc.err = cmd.Command.Execute()
}

func (tc *agentTestContext) execute_show_human(id string) {
	tc.t.Helper()
	cmd := NewAgentShowCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *agentTestContext) execute_grant(realmID, agentID string) {
	tc.t.Helper()
	cmd := NewAgentGrantCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{realmID, agentID})
	tc.err = cmd.Command.Execute()
}

func (tc *agentTestContext) execute_grant_human(realmID, agentID string) {
	tc.t.Helper()
	cmd := NewAgentGrantCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{realmID, agentID, "--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *agentTestContext) execute_revoke(realmID, agentID string) {
	tc.t.Helper()
	cmd := NewAgentRevokeCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{realmID, agentID})
	tc.err = cmd.Command.Execute()
}

func (tc *agentTestContext) execute_revoke_human(realmID, agentID string) {
	tc.t.Helper()
	cmd := NewAgentRevokeCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{realmID, agentID, "--human"})
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *agentTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *agentTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *agentTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *agentTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *agentTestContext) request_body_has_field(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *agentTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}

func (tc *agentTestContext) output_is_valid_json_array() {
	tc.t.Helper()
	var arr []interface{}
	err := json.Unmarshal(tc.buf.Bytes(), &arr)
	assert.NoError(tc.t, err, "output is not valid JSON array: %s", tc.buf.String())
}
