package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestServerBinary(t *testing.T) {
	t.Run("builds an executable binary", func(t *testing.T) {
		tc := newTestContext(t)

		// When
		tc.server_cmd_is_built()

		// Then
		tc.build_succeeds()
		tc.output_is_executable()
	})
}

// --- Test Context ---

type testContext struct {
	t         *testing.T
	outputDir string
	binary    string
	buildErr  error
}

func newTestContext(t *testing.T) *testContext {
	t.Helper()
	dir := t.TempDir()
	return &testContext{
		t:         t,
		outputDir: dir,
		binary:    filepath.Join(dir, "bifrost-server"),
	}
}

// --- When ---

func (tc *testContext) server_cmd_is_built() {
	tc.t.Helper()
	cmd := exec.Command("go", "build", "-o", tc.binary, ".")
	cmd.Dir = findModuleRoot(tc.t)
	cmd.Env = append(os.Environ(), "CGO_ENABLED=0")
	out, err := cmd.CombinedOutput()
	if err != nil {
		tc.t.Logf("build output: %s", string(out))
	}
	tc.buildErr = err
}

// --- Then ---

func (tc *testContext) build_succeeds() {
	tc.t.Helper()
	require.NoError(tc.t, tc.buildErr, "go build should succeed")
}

func (tc *testContext) output_is_executable() {
	tc.t.Helper()
	info, err := os.Stat(tc.binary)
	require.NoError(tc.t, err, "binary should exist")
	assert.NotZero(tc.t, info.Size(), "binary should not be empty")
	assert.NotZero(tc.t, info.Mode()&0111, "binary should have execute permission")
}

// --- Helpers ---

func findModuleRoot(t *testing.T) string {
	t.Helper()
	// The test runs from server/cmd/, so the module root for this package
	// is the directory containing the go.mod (which is server/cmd/ itself
	// if it has its own go.mod, or we use the current directory).
	dir, err := os.Getwd()
	require.NoError(t, err)
	return dir
}
