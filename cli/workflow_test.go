package cli

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestWorkflowCreate(t *testing.T) {
	t.Run("sends POST to /api/workflows with name and content", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_created()
		tc.client_configured()
		tc.temp_file_with_content("workflow content here")

		// When
		tc.execute_create("TestWorkflow", tc.tempFile.Name())

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/api/workflows")
		tc.request_body_has_field("name", "TestWorkflow")
		tc.request_body_has_field("content", "workflow content here")
	})

	t.Run("outputs JSON response by default", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_returns_json(`{"workflow_id":"wf-abc","name":"TestWorkflow"}`)
		tc.client_configured()
		tc.temp_file_with_content("content")

		// When
		tc.execute_create("TestWorkflow", tc.tempFile.Name())

		// Then
		tc.command_has_no_error()
		tc.output_contains(`"workflow_id":"wf-abc"`)
	})

	t.Run("outputs human-readable format when --human flag is set", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_returns_json(`{"workflow_id":"wf-abc","name":"TestWorkflow"}`)
		tc.client_configured()
		tc.temp_file_with_content("content")

		// When
		tc.execute_create_human("TestWorkflow", tc.tempFile.Name())

		// Then
		tc.command_has_no_error()
		tc.output_contains("Created workflow wf-abc: TestWorkflow")
	})

	t.Run("returns error when file does not exist", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_created()
		tc.client_configured()

		// When
		tc.execute_create("TestWorkflow", "/nonexistent/file.md")

		// Then
		tc.command_has_error()
	})
}

func TestWorkflowList(t *testing.T) {
	t.Run("sends GET to /api/workflows", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_list()
		tc.client_configured()

		// When
		tc.execute_list()

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/api/workflows")
	})

	t.Run("outputs JSON array by default", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_returns_json_list(`[{"workflow_id":"wf-1","name":"Workflow1"},{"workflow_id":"wf-2","name":"Workflow2"}]`)
		tc.client_configured()

		// When
		tc.execute_list()

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json_array()
	})

	t.Run("outputs human-readable table when --human flag is set", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_returns_json_list(`[{"workflow_id":"wf-1","name":"Workflow1"},{"workflow_id":"wf-2","name":"Workflow2"}]`)
		tc.client_configured()

		// When
		tc.execute_list_human()

		// Then
		tc.command_has_no_error()
		tc.output_contains("ID")
		tc.output_contains("Name")
		tc.output_contains("wf-1")
		tc.output_contains("Workflow1")
	})
}

func TestWorkflowShow(t *testing.T) {
	t.Run("sends GET to /api/workflows/{id}", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_workflow()
		tc.client_configured()

		// When
		tc.execute_show("wf-1234")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/api/workflows/wf-1234")
	})

	t.Run("outputs JSON by default", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_returns_workflow_json(`{"workflow_id":"wf-1234","name":"TestWorkflow","content":"workflow content"}`)
		tc.client_configured()

		// When
		tc.execute_show("wf-1234")

		// Then
		tc.command_has_no_error()
		tc.output_contains(`"workflow_id":"wf-1234"`)
	})

	t.Run("outputs human-readable format when --human flag is set", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_returns_workflow_json(`{"workflow_id":"wf-1234","name":"TestWorkflow","content":"workflow content"}`)
		tc.client_configured()

		// When
		tc.execute_show_human("wf-1234")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Workflow ID:")
		tc.output_contains("wf-1234")
		tc.output_contains("Name:")
		tc.output_contains("TestWorkflow")
	})

	t.Run("returns error when workflow not found", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusNotFound, "workflow not found")
		tc.client_configured()

		// When
		tc.execute_show("wf-nonexistent")

		// Then
		tc.command_has_error()
		tc.output_contains("workflow not found")
	})
}

func TestWorkflowUpdate(t *testing.T) {
	t.Run("sends PUT to /api/workflows/{id} with content", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()
		tc.temp_file_with_content("updated content")

		// When
		tc.execute_update("wf-1234", tc.tempFile.Name())

		// Then
		tc.command_has_no_error()
		tc.request_method_was("PUT")
		tc.request_path_was("/api/workflows/wf-1234")
		tc.request_body_has_field("content", "updated content")
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()
		tc.temp_file_with_content("updated content")

		// When
		tc.execute_update_human("wf-1234", tc.tempFile.Name())

		// Then
		tc.command_has_no_error()
		tc.output_contains("Updated workflow wf-1234")
	})
}

func TestWorkflowDelete(t *testing.T) {
	t.Run("sends DELETE to /api/workflows/{id}", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()

		// When
		tc.execute_delete("wf-1234")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("DELETE")
		tc.request_path_was("/api/workflows/wf-1234")
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()

		// When
		tc.execute_delete_human("wf-1234")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Deleted workflow wf-1234")
	})

	t.Run("returns error when workflow not found", func(t *testing.T) {
		tc := newWorkflowTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusNotFound, "workflow not found")
		tc.client_configured()

		// When
		tc.execute_delete("wf-nonexistent")

		// Then
		tc.command_has_error()
		tc.output_contains("workflow not found")
	})
}

// --- Test Context ---

type workflowTestContext struct {
	t *testing.T

	server          *httptest.Server
	client          *Client
	receivedMethod  string
	receivedPath    string
	receivedBody    map[string]any
	buf             *bytes.Buffer
	tempFile        *os.File
	err             error
}

func newWorkflowTestContext(t *testing.T) *workflowTestContext {
	t.Helper()
	return &workflowTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *workflowTestContext) server_that_captures_request_and_returns_created() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &tc.receivedBody)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"workflow_id":"wf-test","name":"test"}`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *workflowTestContext) server_that_captures_request_and_returns_list() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[]`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *workflowTestContext) server_that_captures_request_and_returns_workflow() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"workflow_id":"wf-test","name":"test"}`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *workflowTestContext) server_that_captures_request_and_returns_ok() {
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

func (tc *workflowTestContext) server_that_returns_json(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *workflowTestContext) server_that_returns_json_list(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *workflowTestContext) server_that_returns_workflow_json(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *workflowTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *workflowTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

func (tc *workflowTestContext) temp_file_with_content(content string) {
	tc.t.Helper()
	f, err := os.CreateTemp("", "workflow-*.md")
	require.NoError(tc.t, err)
	_, err = f.WriteString(content)
	require.NoError(tc.t, err)
	err = f.Close()
	require.NoError(tc.t, err)
	tc.tempFile = f
	tc.t.Cleanup(func() { _ = os.Remove(f.Name()) })
}

// --- When ---

func (tc *workflowTestContext) execute_create(name, filePath string) {
	tc.t.Helper()
	cmd := NewWorkflowCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--name", name, "--content", filePath})
	tc.err = cmd.Command.Execute()
}

func (tc *workflowTestContext) execute_create_human(name, filePath string) {
	tc.t.Helper()
	cmd := NewWorkflowCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--name", name, "--content", filePath, "--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *workflowTestContext) execute_list() {
	tc.t.Helper()
	cmd := NewWorkflowListCmd(func() *Client { return tc.client }, tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *workflowTestContext) execute_list_human() {
	tc.t.Helper()
	cmd := NewWorkflowListCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *workflowTestContext) execute_show(id string) {
	tc.t.Helper()
	cmd := NewWorkflowShowCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id})
	tc.err = cmd.Command.Execute()
}

func (tc *workflowTestContext) execute_show_human(id string) {
	tc.t.Helper()
	cmd := NewWorkflowShowCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *workflowTestContext) execute_update(id, filePath string) {
	tc.t.Helper()
	cmd := NewWorkflowUpdateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--content", filePath})
	tc.err = cmd.Command.Execute()
}

func (tc *workflowTestContext) execute_update_human(id, filePath string) {
	tc.t.Helper()
	cmd := NewWorkflowUpdateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--content", filePath, "--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *workflowTestContext) execute_delete(id string) {
	tc.t.Helper()
	cmd := NewWorkflowDeleteCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id})
	tc.err = cmd.Command.Execute()
}

func (tc *workflowTestContext) execute_delete_human(id string) {
	tc.t.Helper()
	cmd := NewWorkflowDeleteCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--human"})
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *workflowTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *workflowTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *workflowTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *workflowTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *workflowTestContext) request_body_has_field(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *workflowTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}

func (tc *workflowTestContext) output_is_valid_json_array() {
	tc.t.Helper()
	var arr []interface{}
	err := json.Unmarshal(tc.buf.Bytes(), &arr)
	assert.NoError(tc.t, err, "output is not valid JSON array: %s", tc.buf.String())
}
