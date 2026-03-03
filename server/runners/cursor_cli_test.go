package runners

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestCursorCLIRunner(t *testing.T) {
	t.Run("name returns cursor-cli", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.cursor_cli_runner_is_created()

		// When
		tc.name_is_retrieved()

		// Then
		tc.name_is_cursor_cli()
	})

	t.Run("image name returns default when not configured", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.cursor_cli_runner_is_created()

		// When
		tc.image_name_is_retrieved()

		// Then
		tc.image_name_is_default()
	})

	t.Run("image name returns configured value", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.cursor_cli_runner_with_custom_image_is_created()

		// When
		tc.image_name_is_retrieved()

		// Then
		tc.image_name_is_custom()
	})

	t.Run("prepare workspace creates windsurf directory", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.cursor_cli_runner_is_created()
		tc.temp_workspace_is_created()
		tc.agent_details_are_set()

		// When
		tc.workspace_is_prepared()

		// Then
		tc.windsurf_directory_is_created()
	})

	t.Run("build container spec creates correct spec", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.cursor_cli_runner_is_created()
		tc.workspace_path_is_set()
		tc.env_vars_are_set()

		// When
		tc.container_spec_is_built()

		// Then
		tc.spec_has_correct_image()
		tc.spec_has_workspace_mount()
		tc.spec_has_env_vars()
	})

	t.Run("parse output extracts result on success", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.cursor_cli_runner_is_created()
		tc.success_output_is_set()

		// When
		tc.output_is_parsed()

		// Then
		tc.result_is_extracted()
		tc.no_error_is_returned()
	})

	t.Run("parse output returns error on failure", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.cursor_cli_runner_is_created()
		tc.error_output_is_set()

		// When
		tc.output_is_parsed()

		// Then
		tc.error_is_returned()
	})
}

// --- Test Context ---

type testContext struct {
	t           *testing.T
	runner      *CursorCLIRunner
	workspace   string
	agent       core.AgentDetail
	settings    core.RunnerSettings
	envVars     map[string]string
	spec        core.ContainerSpec
	output      string
	result      string
	err         error
}

func newTestContext(t *testing.T) *testContext {
	t.Helper()
	return &testContext{t: t}
}

// --- Given ---

func (tc *testContext) cursor_cli_runner_is_created() {
	tc.t.Helper()
	tc.runner = NewCursorCLIRunner("")
}

func (tc *testContext) cursor_cli_runner_with_custom_image_is_created() {
	tc.t.Helper()
	tc.runner = NewCursorCLIRunner("custom-image:v1")
}

func (tc *testContext) temp_workspace_is_created() {
	tc.t.Helper()
	dir, err := os.MkdirTemp("", "cursor-cli-test")
	require.NoError(tc.t, err)
	tc.workspace = dir
	tc.t.Cleanup(func() {
		os.RemoveAll(dir)
	})
}

func (tc *testContext) agent_details_are_set() {
	tc.t.Helper()
	tc.agent = core.AgentDetail{
		ID:   "agent-123",
		Name: "Test Agent",
		Type: "cursor",
	}
	tc.settings = core.RunnerSettings{
		Config: map[string]string{
			"workflow": "# Test Workflow\n\nThis is a test workflow.",
			"skill":    "# Test Skill\n\nThis is a test skill.",
		},
	}
}

func (tc *testContext) workspace_path_is_set() {
	tc.t.Helper()
	tc.workspace = "/workspace/path"
}

func (tc *testContext) env_vars_are_set() {
	tc.t.Helper()
	tc.envVars = map[string]string{
		"API_KEY": "test-key",
		"DEBUG":   "true",
	}
}

func (tc *testContext) success_output_is_set() {
	tc.t.Helper()
	tc.output = `RESULT: Task completed successfully
Status: OK
Output: All tests passed`
}

func (tc *testContext) error_output_is_set() {
	tc.t.Helper()
	tc.output = `ERROR: Failed to execute task
Status: FAILED
Reason: Invalid configuration`
}

// --- When ---

func (tc *testContext) name_is_retrieved() {
	tc.t.Helper()
	tc.result = tc.runner.Name()
}

func (tc *testContext) image_name_is_retrieved() {
	tc.t.Helper()
	tc.result = tc.runner.ImageName()
}

func (tc *testContext) workspace_is_prepared() {
	tc.t.Helper()
	tc.err = tc.runner.PrepareWorkspace(tc.workspace, tc.agent, tc.settings)
}

func (tc *testContext) container_spec_is_built() {
	tc.t.Helper()
	tc.spec = tc.runner.BuildContainerSpec(tc.workspace, tc.envVars)
}

func (tc *testContext) output_is_parsed() {
	tc.t.Helper()
	tc.result, tc.err = tc.runner.ParseOutput(tc.output)
}

// --- Then ---

func (tc *testContext) name_is_cursor_cli() {
	tc.t.Helper()
	assert.Equal(tc.t, "cursor-cli", tc.result)
}

func (tc *testContext) image_name_is_default() {
	tc.t.Helper()
	assert.Equal(tc.t, "bifrost-cursor-cli:latest", tc.result)
}

func (tc *testContext) image_name_is_custom() {
	tc.t.Helper()
	assert.Equal(tc.t, "custom-image:v1", tc.result)
}

func (tc *testContext) windsurf_directory_is_created() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	
	windsurfDir := filepath.Join(tc.workspace, ".windsurf")
	assert.DirExists(tc.t, windsurfDir)
	
	// Check workflow file
	workflowPath := filepath.Join(windsurfDir, "workflow.md")
	assert.FileExists(tc.t, workflowPath)
	content, err := os.ReadFile(workflowPath)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, tc.settings.Config["workflow"], string(content))
	
	// Check skill file
	skillPath := filepath.Join(windsurfDir, "skill.md")
	assert.FileExists(tc.t, skillPath)
	skillContent, err := os.ReadFile(skillPath)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, tc.settings.Config["skill"], string(skillContent))
}

func (tc *testContext) spec_has_correct_image() {
	tc.t.Helper()
	assert.Equal(tc.t, "bifrost-cursor-cli:latest", tc.spec.Image)
}

func (tc *testContext) spec_has_workspace_mount() {
	tc.t.Helper()
	require.Len(tc.t, tc.spec.Mounts, 1)
	assert.Equal(tc.t, tc.workspace, tc.spec.Mounts[0].Source)
	assert.Equal(tc.t, "/workspace", tc.spec.Mounts[0].Target)
}

func (tc *testContext) spec_has_env_vars() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.envVars, tc.spec.EnvVars)
	assert.Equal(tc.t, "/workspace", tc.spec.WorkingDir)
}

func (tc *testContext) result_is_extracted() {
	tc.t.Helper()
	assert.Contains(tc.t, tc.result, "Task completed successfully")
}

func (tc *testContext) no_error_is_returned() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *testContext) error_is_returned() {
	tc.t.Helper()
	assert.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), "Failed to execute task")
}
