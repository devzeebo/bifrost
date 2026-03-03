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

func TestSkillCreate(t *testing.T) {
	t.Run("sends POST to /api/skills with name and content", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_created()
		tc.client_configured()
		tc.temp_file_with_content("skill content here")

		// When
		tc.execute_create("TestSkill", tc.tempFile.Name())

		// Then
		tc.command_has_no_error()
		tc.request_method_was("POST")
		tc.request_path_was("/api/skills")
		tc.request_body_has_field("name", "TestSkill")
		tc.request_body_has_field("content", "skill content here")
	})

	t.Run("outputs JSON response by default", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_returns_json(`{"skill_id":"skill-abc","name":"TestSkill"}`)
		tc.client_configured()
		tc.temp_file_with_content("content")

		// When
		tc.execute_create("TestSkill", tc.tempFile.Name())

		// Then
		tc.command_has_no_error()
		tc.output_contains(`"skill_id":"skill-abc"`)
	})

	t.Run("outputs human-readable format when --human flag is set", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_returns_json(`{"skill_id":"skill-abc","name":"TestSkill"}`)
		tc.client_configured()
		tc.temp_file_with_content("content")

		// When
		tc.execute_create_human("TestSkill", tc.tempFile.Name())

		// Then
		tc.command_has_no_error()
		tc.output_contains("Created skill skill-abc: TestSkill")
	})

	t.Run("returns error when file does not exist", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_created()
		tc.client_configured()

		// When
		tc.execute_create("TestSkill", "/nonexistent/file.md")

		// Then
		tc.command_has_error()
	})
}

func TestSkillList(t *testing.T) {
	t.Run("sends GET to /api/skills", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_list()
		tc.client_configured()

		// When
		tc.execute_list()

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/api/skills")
	})

	t.Run("outputs JSON array by default", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_returns_json_list(`[{"skill_id":"skill-1","name":"Skill1"},{"skill_id":"skill-2","name":"Skill2"}]`)
		tc.client_configured()

		// When
		tc.execute_list()

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json_array()
	})

	t.Run("outputs human-readable table when --human flag is set", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_returns_json_list(`[{"skill_id":"skill-1","name":"Skill1"},{"skill_id":"skill-2","name":"Skill2"}]`)
		tc.client_configured()

		// When
		tc.execute_list_human()

		// Then
		tc.command_has_no_error()
		tc.output_contains("ID")
		tc.output_contains("Name")
		tc.output_contains("skill-1")
		tc.output_contains("Skill1")
	})
}

func TestSkillShow(t *testing.T) {
	t.Run("sends GET to /api/skills/{id}", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_skill()
		tc.client_configured()

		// When
		tc.execute_show("skill-1234")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("GET")
		tc.request_path_was("/api/skills/skill-1234")
	})

	t.Run("outputs JSON by default", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_returns_skill_json(`{"skill_id":"skill-1234","name":"TestSkill","content":"skill content"}`)
		tc.client_configured()

		// When
		tc.execute_show("skill-1234")

		// Then
		tc.command_has_no_error()
		tc.output_contains(`"skill_id":"skill-1234"`)
	})

	t.Run("outputs human-readable format when --human flag is set", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_returns_skill_json(`{"skill_id":"skill-1234","name":"TestSkill","content":"skill content"}`)
		tc.client_configured()

		// When
		tc.execute_show_human("skill-1234")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Skill ID:")
		tc.output_contains("skill-1234")
		tc.output_contains("Name:")
		tc.output_contains("TestSkill")
	})

	t.Run("returns error when skill not found", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusNotFound, "skill not found")
		tc.client_configured()

		// When
		tc.execute_show("skill-nonexistent")

		// Then
		tc.command_has_error()
		tc.output_contains("skill not found")
	})
}

func TestSkillUpdate(t *testing.T) {
	t.Run("sends PUT to /api/skills/{id} with content", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()
		tc.temp_file_with_content("updated content")

		// When
		tc.execute_update("skill-1234", tc.tempFile.Name())

		// Then
		tc.command_has_no_error()
		tc.request_method_was("PUT")
		tc.request_path_was("/api/skills/skill-1234")
		tc.request_body_has_field("content", "updated content")
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()
		tc.temp_file_with_content("updated content")

		// When
		tc.execute_update_human("skill-1234", tc.tempFile.Name())

		// Then
		tc.command_has_no_error()
		tc.output_contains("Updated skill skill-1234")
	})
}

func TestSkillDelete(t *testing.T) {
	t.Run("sends DELETE to /api/skills/{id}", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()

		// When
		tc.execute_delete("skill-1234")

		// Then
		tc.command_has_no_error()
		tc.request_method_was("DELETE")
		tc.request_path_was("/api/skills/skill-1234")
	})

	t.Run("outputs human-readable confirmation when --human flag is set", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_captures_request_and_returns_ok()
		tc.client_configured()

		// When
		tc.execute_delete_human("skill-1234")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Deleted skill skill-1234")
	})

	t.Run("returns error when skill not found", func(t *testing.T) {
		tc := newSkillTestContext(t)

		// Given
		tc.server_that_returns_error(http.StatusNotFound, "skill not found")
		tc.client_configured()

		// When
		tc.execute_delete("skill-nonexistent")

		// Then
		tc.command_has_error()
		tc.output_contains("skill not found")
	})
}

// --- Test Context ---

type skillTestContext struct {
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

func newSkillTestContext(t *testing.T) *skillTestContext {
	t.Helper()
	return &skillTestContext{
		t:   t,
		buf: &bytes.Buffer{},
	}
}

// --- Given ---

func (tc *skillTestContext) server_that_captures_request_and_returns_created() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &tc.receivedBody)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"skill_id":"skill-test","name":"test"}`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *skillTestContext) server_that_captures_request_and_returns_list() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`[]`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *skillTestContext) server_that_captures_request_and_returns_skill() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedMethod = r.Method
		tc.receivedPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"skill_id":"skill-test","name":"test"}`))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *skillTestContext) server_that_captures_request_and_returns_ok() {
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

func (tc *skillTestContext) server_that_returns_json(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *skillTestContext) server_that_returns_json_list(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *skillTestContext) server_that_returns_skill_json(jsonStr string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(jsonStr))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *skillTestContext) server_that_returns_error(status int, message string) {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *skillTestContext) client_configured() {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: "test-key",
	})
}

func (tc *skillTestContext) temp_file_with_content(content string) {
	tc.t.Helper()
	f, err := os.CreateTemp("", "skill-*.md")
	require.NoError(tc.t, err)
	_, err = f.WriteString(content)
	require.NoError(tc.t, err)
	err = f.Close()
	require.NoError(tc.t, err)
	tc.tempFile = f
	tc.t.Cleanup(func() { _ = os.Remove(f.Name()) })
}

// --- When ---

func (tc *skillTestContext) execute_create(name, filePath string) {
	tc.t.Helper()
	cmd := NewSkillCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--name", name, "--content", filePath})
	tc.err = cmd.Command.Execute()
}

func (tc *skillTestContext) execute_create_human(name, filePath string) {
	tc.t.Helper()
	cmd := NewSkillCreateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--name", name, "--content", filePath, "--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *skillTestContext) execute_list() {
	tc.t.Helper()
	cmd := NewSkillListCmd(func() *Client { return tc.client }, tc.buf)
	tc.err = cmd.Command.Execute()
}

func (tc *skillTestContext) execute_list_human() {
	tc.t.Helper()
	cmd := NewSkillListCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{"--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *skillTestContext) execute_show(id string) {
	tc.t.Helper()
	cmd := NewSkillShowCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id})
	tc.err = cmd.Command.Execute()
}

func (tc *skillTestContext) execute_show_human(id string) {
	tc.t.Helper()
	cmd := NewSkillShowCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *skillTestContext) execute_update(id, filePath string) {
	tc.t.Helper()
	cmd := NewSkillUpdateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--content", filePath})
	tc.err = cmd.Command.Execute()
}

func (tc *skillTestContext) execute_update_human(id, filePath string) {
	tc.t.Helper()
	cmd := NewSkillUpdateCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--content", filePath, "--human"})
	tc.err = cmd.Command.Execute()
}

func (tc *skillTestContext) execute_delete(id string) {
	tc.t.Helper()
	cmd := NewSkillDeleteCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id})
	tc.err = cmd.Command.Execute()
}

func (tc *skillTestContext) execute_delete_human(id string) {
	tc.t.Helper()
	cmd := NewSkillDeleteCmd(func() *Client { return tc.client }, tc.buf)
	cmd.Command.SetArgs([]string{id, "--human"})
	tc.err = cmd.Command.Execute()
}

// --- Then ---

func (tc *skillTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *skillTestContext) command_has_error() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
}

func (tc *skillTestContext) request_method_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedMethod)
}

func (tc *skillTestContext) request_path_was(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedPath)
}

func (tc *skillTestContext) request_body_has_field(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.receivedBody)
	assert.Equal(tc.t, expected, tc.receivedBody[key])
}

func (tc *skillTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.buf.String(), substr)
}

func (tc *skillTestContext) output_is_valid_json_array() {
	tc.t.Helper()
	var arr []interface{}
	err := json.Unmarshal(tc.buf.Bytes(), &arr)
	assert.NoError(tc.t, err, "output is not valid JSON array: %s", tc.buf.String())
}
