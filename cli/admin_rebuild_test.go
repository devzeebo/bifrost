package cli

import (
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestRebuildProjections(t *testing.T) {
	t.Run("calls rebuild-projections API endpoint", func(t *testing.T) {
		tc := newRebuildTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_success()

		// When
		tc.rebuild_projections_is_executed()

		// Then
		tc.command_has_no_error()
		tc.output_contains("rebuilt")
	})
}

// --- Test Context ---

type rebuildTestContext struct {
	t *testing.T

	mock   *mockClient
	cmd    *cobra.Command
	output string
	err    error
}

func newRebuildTestContext(t *testing.T) *rebuildTestContext {
	t.Helper()
	return &rebuildTestContext{t: t}
}

// --- Given ---

func (tc *rebuildTestContext) admin_cmd_with_mock_client() {
	tc.t.Helper()
	tc.mock = &mockClient{}
	tc.cmd = newAdminCmdWithMockClient(tc.mock)
}

func (tc *rebuildTestContext) api_returns_success() {
	tc.t.Helper()
	tc.mock.postResponse = mustMarshal(map[string]string{"status": "ok"})
}

// --- When ---

func (tc *rebuildTestContext) rebuild_projections_is_executed() {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "rebuild-projections")
}

// --- Then ---

func (tc *rebuildTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *rebuildTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.output, substr)
}
