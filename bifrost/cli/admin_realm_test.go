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

func TestAdminCreateRealm(t *testing.T) {
	t.Run("creates realm and prints realm ID", func(t *testing.T) {
		tc := newAdminRealmTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_create_realm("bf-1234")

		// When
		tc.run_create_realm("my-realm")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Realm ID:")
	})

	t.Run("creates realm with json output", func(t *testing.T) {
		tc := newAdminRealmTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_create_realm("bf-1234")

		// When
		tc.run_create_realm_json("my-realm")

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json()
		tc.json_output_has_key("realm_id")
	})
}

func TestAdminListRealms(t *testing.T) {
	t.Run("lists realms in human-readable table", func(t *testing.T) {
		tc := newAdminRealmTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_realms_list()

		// When
		tc.run_list_realms()

		// Then
		tc.command_has_no_error()
		tc.output_contains("ID")
		tc.output_contains("Name")
		tc.output_contains("Status")
		tc.output_contains("bf-1234")
		tc.output_contains("test-realm")
	})

	t.Run("lists realms in json output", func(t *testing.T) {
		tc := newAdminRealmTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_realms_list()

		// When
		tc.run_list_realms_json()

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json()
	})
}

func TestAdminSuspendRealm(t *testing.T) {
	t.Run("suspends realm and prints confirmation", func(t *testing.T) {
		tc := newAdminRealmTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_success()

		// When
		tc.run_suspend_realm("bf-1234")

		// Then
		tc.command_has_no_error()
		tc.output_contains("suspended")
	})

	t.Run("suspends realm with json output", func(t *testing.T) {
		tc := newAdminRealmTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_success()

		// When
		tc.run_suspend_realm_json("bf-1234")

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json()
		tc.json_output_has_value("status", "suspended")
	})

	t.Run("returns error for non-existent realm", func(t *testing.T) {
		tc := newAdminRealmTestContext(t)

		// Given
		tc.admin_cmd_with_mock_client()
		tc.api_returns_error("realm not found")

		// When
		tc.run_suspend_realm("bf-nonexistent")

		// Then
		tc.error_occurred()
	})
}

// --- Test Context ---

type adminRealmTestContext struct {
	t *testing.T

	mock       *mockClient
	cmd        *cobra.Command
	output     string
	err        error
	jsonOutput map[string]interface{}
}

func newAdminRealmTestContext(t *testing.T) *adminRealmTestContext {
	t.Helper()
	return &adminRealmTestContext{t: t}
}

// --- Given ---

func (tc *adminRealmTestContext) admin_cmd_with_mock_client() {
	tc.t.Helper()
	tc.mock = &mockClient{}
	tc.cmd = newAdminCmdWithMockClient(tc.mock)
}

func (tc *adminRealmTestContext) api_returns_create_realm(realmID string) {
	tc.t.Helper()
	tc.mock.postResponse = mustMarshal(map[string]string{
		"realm_id": realmID,
	})
}

func (tc *adminRealmTestContext) api_returns_realms_list() {
	tc.t.Helper()
	tc.mock.getResponses = append(tc.mock.getResponses, mustMarshal([]map[string]interface{}{
		{
			"realm_id": "bf-1234",
			"name":     "test-realm",
			"status":   "active",
		},
	}))
}

func (tc *adminRealmTestContext) api_returns_success() {
	tc.t.Helper()
	tc.mock.postResponse = mustMarshal(map[string]string{"status": "ok"})
}

func (tc *adminRealmTestContext) api_returns_error(msg string) {
	tc.t.Helper()
	tc.mock.getError = fmt.Errorf("%s", msg)
	tc.mock.postError = fmt.Errorf("%s", msg)
}

// --- When ---

func (tc *adminRealmTestContext) run_create_realm(name string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "create-realm", name)
}

func (tc *adminRealmTestContext) run_create_realm_json(name string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "create-realm", name, "--json")
}

func (tc *adminRealmTestContext) run_list_realms() {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "list-realms")
}

func (tc *adminRealmTestContext) run_list_realms_json() {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "list-realms", "--json")
}

func (tc *adminRealmTestContext) run_suspend_realm(realmID string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "suspend-realm", realmID)
}

func (tc *adminRealmTestContext) run_suspend_realm_json(realmID string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "suspend-realm", realmID, "--json")
}

// --- Then ---

func (tc *adminRealmTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *adminRealmTestContext) error_occurred() {
	tc.t.Helper()
	assert.Error(tc.t, tc.err)
}

func (tc *adminRealmTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.output, substr)
}

func (tc *adminRealmTestContext) output_is_valid_json() {
	tc.t.Helper()
	tc.jsonOutput = make(map[string]interface{})
	err := json.Unmarshal([]byte(tc.output), &tc.jsonOutput)
	if err != nil {
		var arr []interface{}
		err2 := json.Unmarshal([]byte(tc.output), &arr)
		assert.NoError(tc.t, err2, "output is not valid JSON: %s", tc.output)
		return
	}
}

func (tc *adminRealmTestContext) json_output_has_key(key string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.jsonOutput, "json output not parsed")
	_, ok := tc.jsonOutput[key]
	assert.True(tc.t, ok, "expected key %q in JSON output", key)
}

func (tc *adminRealmTestContext) json_output_has_value(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.jsonOutput, "json output not parsed")
	val, ok := tc.jsonOutput[key]
	require.True(tc.t, ok, "expected key %q in JSON output", key)
	assert.Equal(tc.t, expected, val)
}
