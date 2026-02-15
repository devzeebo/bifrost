package cli

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestInitCommand(t *testing.T) {
	t.Run("creates .bifrost.yaml with url and realm", func(t *testing.T) {
		tc := newInitTestContext(t)

		// When
		tc.execute_init("--realm", "my-realm")

		// Then
		tc.no_error_occurred()
		tc.bifrost_yaml_exists()
		tc.bifrost_yaml_contains("url: http://localhost:8080")
		tc.bifrost_yaml_contains("realm: my-realm")
		tc.bifrost_yaml_does_not_contain("api_key")
	})

	t.Run("creates AGENTS.md from template with realm name interpolated", func(t *testing.T) {
		tc := newInitTestContext(t)

		// When
		tc.execute_init("--realm", "my-realm")

		// Then
		tc.no_error_occurred()
		tc.agents_md_exists()
		tc.agents_md_contains("realm **my-realm**")
	})

	t.Run("uses custom url when --url flag is provided", func(t *testing.T) {
		tc := newInitTestContext(t)

		// When
		tc.execute_init("--realm", "r1", "--url", "https://bifrost.example.com")

		// Then
		tc.no_error_occurred()
		tc.bifrost_yaml_contains("url: https://bifrost.example.com")
	})

	t.Run("interpolates URL into AGENTS.md template", func(t *testing.T) {
		tc := newInitTestContext(t)

		// When
		tc.execute_init("--realm", "r1", "--url", "https://bifrost.example.com")

		// Then
		tc.no_error_occurred()
		tc.agents_md_contains("url: https://bifrost.example.com")
	})

	t.Run("errors if .bifrost.yaml already exists without --force", func(t *testing.T) {
		tc := newInitTestContext(t)

		// Given
		tc.bifrost_yaml_already_exists()

		// When
		tc.execute_init("--realm", "r1")

		// Then
		tc.error_occurred()
		tc.error_contains("already exists")
	})

	t.Run("overwrites existing files when --force is passed", func(t *testing.T) {
		tc := newInitTestContext(t)

		// Given
		tc.bifrost_yaml_already_exists()
		tc.agents_md_already_exists()

		// When
		tc.execute_init("--realm", "new-realm", "--force")

		// Then
		tc.no_error_occurred()
		tc.bifrost_yaml_contains("realm: new-realm")
		tc.agents_md_contains("realm **new-realm**")
	})

	t.Run("prints confirmation message with login instruction on success", func(t *testing.T) {
		tc := newInitTestContext(t)

		// When
		tc.execute_init("--realm", "r1")

		// Then
		tc.no_error_occurred()
		tc.output_contains("Initialized bifrost in")
		tc.output_contains("Run bf login --token")
	})

	t.Run("errors when --realm is not provided", func(t *testing.T) {
		tc := newInitTestContext(t)

		// When
		tc.execute_init()

		// Then
		tc.error_occurred()
	})

	t.Run("appends .bifrost.yaml to .gitignore if .gitignore exists", func(t *testing.T) {
		tc := newInitTestContext(t)

		// Given
		tc.gitignore_exists_with("node_modules\n")

		// When
		tc.execute_init("--realm", "r1")

		// Then
		tc.no_error_occurred()
		tc.gitignore_contains(".bifrost.yaml")
	})

	t.Run("does not duplicate .bifrost.yaml in .gitignore if already present", func(t *testing.T) {
		tc := newInitTestContext(t)

		// Given
		tc.gitignore_exists_with("node_modules\n.bifrost.yaml\n")

		// When
		tc.execute_init("--realm", "r1")

		// Then
		tc.no_error_occurred()
		tc.gitignore_has_single_occurrence_of(".bifrost.yaml")
	})

	t.Run("does not create or modify .gitignore if it does not exist", func(t *testing.T) {
		tc := newInitTestContext(t)

		// When
		tc.execute_init("--realm", "r1")

		// Then
		tc.no_error_occurred()
		tc.gitignore_does_not_exist()
	})
}

// --- Test Context ---

type initTestContext struct {
	t      *testing.T
	tmpDir string
	output string
	err    error
}

func newInitTestContext(t *testing.T) *initTestContext {
	t.Helper()
	tmpDir := t.TempDir()
	return &initTestContext{
		t:      t,
		tmpDir: tmpDir,
	}
}

// --- Given ---

func (tc *initTestContext) bifrost_yaml_already_exists() {
	tc.t.Helper()
	err := os.WriteFile(filepath.Join(tc.tmpDir, ".bifrost.yaml"), []byte("url: old\n"), 0644)
	require.NoError(tc.t, err)
}

func (tc *initTestContext) agents_md_already_exists() {
	tc.t.Helper()
	err := os.WriteFile(filepath.Join(tc.tmpDir, "AGENTS.md"), []byte("old content\n"), 0644)
	require.NoError(tc.t, err)
}

func (tc *initTestContext) gitignore_exists_with(content string) {
	tc.t.Helper()
	err := os.WriteFile(filepath.Join(tc.tmpDir, ".gitignore"), []byte(content), 0644)
	require.NoError(tc.t, err)
}

// --- When ---

func (tc *initTestContext) execute_init(args ...string) {
	tc.t.Helper()
	cmd := NewInitCmd()
	cmd.SetArgs(append(args, "--dir", tc.tmpDir))
	tc.output = ""
	buf := &bytes.Buffer{}
	cmd.SetOut(buf)
	tc.err = cmd.Execute()
	tc.output = buf.String()
}

// --- Then ---

func (tc *initTestContext) no_error_occurred() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *initTestContext) error_occurred() {
	tc.t.Helper()
	assert.Error(tc.t, tc.err)
}

func (tc *initTestContext) error_contains(substr string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), substr)
}

func (tc *initTestContext) bifrost_yaml_exists() {
	tc.t.Helper()
	_, err := os.Stat(filepath.Join(tc.tmpDir, ".bifrost.yaml"))
	assert.NoError(tc.t, err, ".bifrost.yaml should exist")
}

func (tc *initTestContext) bifrost_yaml_contains(substr string) {
	tc.t.Helper()
	data, err := os.ReadFile(filepath.Join(tc.tmpDir, ".bifrost.yaml"))
	require.NoError(tc.t, err)
	assert.Contains(tc.t, string(data), substr)
}

func (tc *initTestContext) bifrost_yaml_does_not_contain(substr string) {
	tc.t.Helper()
	data, err := os.ReadFile(filepath.Join(tc.tmpDir, ".bifrost.yaml"))
	require.NoError(tc.t, err)
	assert.NotContains(tc.t, string(data), substr)
}

func (tc *initTestContext) agents_md_exists() {
	tc.t.Helper()
	_, err := os.Stat(filepath.Join(tc.tmpDir, "AGENTS.md"))
	assert.NoError(tc.t, err, "AGENTS.md should exist")
}

func (tc *initTestContext) agents_md_contains(substr string) {
	tc.t.Helper()
	data, err := os.ReadFile(filepath.Join(tc.tmpDir, "AGENTS.md"))
	require.NoError(tc.t, err)
	assert.Contains(tc.t, string(data), substr)
}

func (tc *initTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.output, substr)
}

func (tc *initTestContext) gitignore_contains(substr string) {
	tc.t.Helper()
	data, err := os.ReadFile(filepath.Join(tc.tmpDir, ".gitignore"))
	require.NoError(tc.t, err)
	assert.Contains(tc.t, string(data), substr)
}

func (tc *initTestContext) gitignore_has_single_occurrence_of(entry string) {
	tc.t.Helper()
	data, err := os.ReadFile(filepath.Join(tc.tmpDir, ".gitignore"))
	require.NoError(tc.t, err)
	content := string(data)
	count := 0
	for _, line := range strings.Split(content, "\n") {
		if strings.TrimSpace(line) == entry {
			count++
		}
	}
	assert.Equal(tc.t, 1, count, "expected exactly one occurrence of %q in .gitignore", entry)
}

func (tc *initTestContext) gitignore_does_not_exist() {
	tc.t.Helper()
	_, err := os.Stat(filepath.Join(tc.tmpDir, ".gitignore"))
	assert.True(tc.t, os.IsNotExist(err), ".gitignore should not exist")
}
