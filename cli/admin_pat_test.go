package cli

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestAdminCreatePAT(t *testing.T) {
	t.Run("creates PAT and prints PAT ID and token", func(t *testing.T) {
		tc := newAdminPATTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_resolve_username("acct-1234")
		tc.api_returns_create_pat("pat-5678", "pat-token-xyz")

		// When
		tc.run_create_pat("alice")

		// Then
		tc.command_has_no_error()
		tc.output_contains("PAT ID:")
		tc.output_contains("Token:")
		tc.output_contains("Save this token")
	})

	t.Run("creates PAT with label", func(t *testing.T) {
		tc := newAdminPATTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_resolve_username("acct-1234")
		tc.api_returns_create_pat("pat-5678", "pat-token-xyz")

		// When
		tc.run_create_pat_with_label("alice", "ci-token")

		// Then
		tc.command_has_no_error()
		tc.output_contains("PAT ID:")
		tc.output_contains("Token:")
	})

	t.Run("creates PAT with json output", func(t *testing.T) {
		tc := newAdminPATTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_resolve_username("acct-1234")
		tc.api_returns_create_pat("pat-5678", "pat-token-xyz")

		// When
		tc.run_create_pat_json("alice")

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json()
		tc.json_output_has_key("pat_id")
		tc.json_output_has_key("token")
	})

	t.Run("returns error for unknown username", func(t *testing.T) {
		tc := newAdminPATTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_error("username not found")

		// When
		tc.run_create_pat("unknown")

		// Then
		tc.error_occurred()
	})
}

func TestAdminListPATs(t *testing.T) {
	t.Run("lists PATs in human-readable table", func(t *testing.T) {
		tc := newAdminPATTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_resolve_username("acct-1234")
		tc.api_returns_pats_list()

		// When
		tc.run_list_pats("alice")

		// Then
		tc.command_has_no_error()
		tc.output_contains("PAT ID")
		tc.output_contains("Label")
		tc.output_contains("Created")
		tc.output_contains("pat-5678")
		tc.output_contains("my-token")
	})

	t.Run("lists PATs in json output", func(t *testing.T) {
		tc := newAdminPATTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_resolve_username("acct-1234")
		tc.api_returns_pats_list()

		// When
		tc.run_list_pats_json("alice")

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json_array()
	})

	t.Run("returns error for unknown username", func(t *testing.T) {
		tc := newAdminPATTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_error("username not found")

		// When
		tc.run_list_pats("unknown")

		// Then
		tc.error_occurred()
	})
}

func TestAdminRevokePAT(t *testing.T) {
	t.Run("revokes PAT and prints confirmation", func(t *testing.T) {
		tc := newAdminPATTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_resolve_username("acct-1234")
		tc.api_returns_success()

		// When
		tc.run_revoke_pat("alice", "pat-5678")

		// Then
		tc.command_has_no_error()
		tc.output_contains("revoked")
	})

	t.Run("revokes PAT with json output", func(t *testing.T) {
		tc := newAdminPATTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_resolve_username("acct-1234")
		tc.api_returns_success()

		// When
		tc.run_revoke_pat_json("alice", "pat-5678")

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json()
		tc.json_output_has_value("status", "revoked")
	})

	t.Run("returns error for unknown username", func(t *testing.T) {
		tc := newAdminPATTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_error("username not found")

		// When
		tc.run_revoke_pat("unknown", "pat-5678")

		// Then
		tc.error_occurred()
	})
}

// --- Test Context ---

type adminPATTestContext struct {
	t *testing.T

	mock       *mockClient
	cmd        *cobra.Command
	output     string
	err        error
	jsonOutput map[string]interface{}
}

func newAdminPATTestContext(t *testing.T) *adminPATTestContext {
	t.Helper()
	return &adminPATTestContext{t: t}
}

// --- Given ---

func (tc *adminPATTestContext) admin_cmd_with_mock_client() {
	tc.t.Helper()
	tc.mock = &mockClient{}
	tc.cmd = newAdminCmdWithMockClient(tc.mock)
}

func (tc *adminPATTestContext) api_returns_resolve_username(accountID string) {
	tc.t.Helper()
	tc.mock.getResponses = append(tc.mock.getResponses, mustMarshal(map[string]string{
		"account_id": accountID,
	}))
}

func (tc *adminPATTestContext) api_returns_create_pat(patID, token string) {
	tc.t.Helper()
	tc.mock.postResponse = mustMarshal(map[string]string{
		"pat_id": patID,
		"token":  token,
	})
}

func (tc *adminPATTestContext) api_returns_pats_list() {
	tc.t.Helper()
	tc.mock.getResponses = append(tc.mock.getResponses, mustMarshal([]map[string]interface{}{
		{
			"id":         "pat-5678",
			"label":      "my-token",
			"created_at": "2024-01-01T00:00:00Z",
		},
	}))
}

func (tc *adminPATTestContext) api_returns_success() {
	tc.t.Helper()
	tc.mock.postResponse = mustMarshal(map[string]string{"status": "ok"})
}

func (tc *adminPATTestContext) api_returns_error(msg string) {
	tc.t.Helper()
	tc.mock.getError = fmt.Errorf("%s", msg)
	tc.mock.postError = fmt.Errorf("%s", msg)
}

// --- When ---

func (tc *adminPATTestContext) run_create_pat(username string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "create-pat", username)
}

func (tc *adminPATTestContext) run_create_pat_with_label(username, label string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "create-pat", username, "--label", label)
}

func (tc *adminPATTestContext) run_create_pat_json(username string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "create-pat", username, "--json")
}

func (tc *adminPATTestContext) run_list_pats(username string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "list-pats", username)
}

func (tc *adminPATTestContext) run_list_pats_json(username string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "list-pats", username, "--json")
}

func (tc *adminPATTestContext) run_revoke_pat(username, patID string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "revoke-pat", username, patID)
}

func (tc *adminPATTestContext) run_revoke_pat_json(username, patID string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "revoke-pat", username, patID, "--json")
}

// --- Then ---

func (tc *adminPATTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *adminPATTestContext) error_occurred() {
	tc.t.Helper()
	assert.Error(tc.t, tc.err)
}

func (tc *adminPATTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.output, substr)
}

func (tc *adminPATTestContext) output_is_valid_json() {
	tc.t.Helper()
	tc.jsonOutput = make(map[string]interface{})
	err := json.Unmarshal([]byte(tc.output), &tc.jsonOutput)
	assert.NoError(tc.t, err, "output is not valid JSON: %s", tc.output)
}

func (tc *adminPATTestContext) output_is_valid_json_array() {
	tc.t.Helper()
	var arr []interface{}
	err := json.Unmarshal([]byte(tc.output), &arr)
	assert.NoError(tc.t, err, "output is not valid JSON array: %s", tc.output)
}

func (tc *adminPATTestContext) json_output_has_key(key string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.jsonOutput, "json output not parsed")
	_, ok := tc.jsonOutput[key]
	assert.True(tc.t, ok, "expected key %q in JSON output", key)
}

func (tc *adminPATTestContext) json_output_has_value(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.jsonOutput, "json output not parsed")
	val, ok := tc.jsonOutput[key]
	require.True(tc.t, ok, "expected key %q in JSON output", key)
	assert.Equal(tc.t, expected, val)
}
