package cli

import (
	"encoding/json"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestAdminCreateAccount(t *testing.T) {
	t.Run("creates account and prints account ID and token", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()

		// When
		tc.run_create_account("alice")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Account ID:")
		tc.output_contains("Token:")
		tc.output_contains("Save this token")
	})

	t.Run("creates account with json output", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()

		// When
		tc.run_create_account_json("alice")

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json()
		tc.json_output_has_key("account_id")
		tc.json_output_has_key("token")
	})
}

func TestAdminListAccounts(t *testing.T) {
	t.Run("lists accounts in human-readable table", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()
		tc.projection_store_has_accounts()

		// When
		tc.run_list_accounts()

		// Then
		tc.command_has_no_error()
		tc.output_contains("ID")
		tc.output_contains("Username")
		tc.output_contains("Status")
		tc.output_contains("acct-1234")
		tc.output_contains("alice")
	})

	t.Run("lists accounts in json output", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()
		tc.projection_store_has_accounts()

		// When
		tc.run_list_accounts_json()

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json_array()
	})
}

func TestAdminSuspendAccount(t *testing.T) {
	t.Run("suspends account and prints confirmation", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()
		tc.account_exists("alice", "acct-1234")

		// When
		tc.run_suspend_account("alice")

		// Then
		tc.command_has_no_error()
		tc.output_contains("suspended")
	})

	t.Run("suspends account with json output", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()
		tc.account_exists("alice", "acct-1234")

		// When
		tc.run_suspend_account_json("alice")

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json()
		tc.json_output_has_value("status", "suspended")
	})

	t.Run("returns error for unknown username", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()

		// When
		tc.run_suspend_account("unknown")

		// Then
		tc.error_occurred()
	})
}

func TestAdminGrant(t *testing.T) {
	t.Run("grants realm access as member and prints confirmation", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()
		tc.account_exists("alice", "acct-1234")

		// When
		tc.run_grant("alice", "bf-realm1")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Granted")
		tc.output_contains("alice")
		tc.output_contains("bf-realm1")
	})

	t.Run("grants realm access with json output", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()
		tc.account_exists("alice", "acct-1234")

		// When
		tc.run_grant_json("alice", "bf-realm1")

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json()
		tc.json_output_has_value("status", "granted")
	})

	t.Run("returns error for unknown username", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()

		// When
		tc.run_grant("unknown", "bf-realm1")

		// Then
		tc.error_occurred()
	})
}

func TestAdminRevoke(t *testing.T) {
	t.Run("revokes realm access and prints confirmation", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()
		tc.account_with_role("alice", "acct-1234", "bf-realm1", "member")

		// When
		tc.run_revoke("alice", "bf-realm1")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Revoked")
		tc.output_contains("alice")
		tc.output_contains("bf-realm1")
	})

	t.Run("revokes realm access with json output", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()
		tc.account_with_role("alice", "acct-1234", "bf-realm1", "member")

		// When
		tc.run_revoke_json("alice", "bf-realm1")

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json()
		tc.json_output_has_value("status", "revoked")
	})

	t.Run("returns error for unknown username", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()

		// When
		tc.run_revoke("unknown", "bf-realm1")

		// Then
		tc.error_occurred()
	})
}

func TestAdminAssignRole(t *testing.T) {
	t.Run("assigns role and prints confirmation", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()
		tc.account_exists("alice", "acct-1234")

		// When
		tc.run_assign_role("alice", "bf-realm1", "admin")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Assigned")
		tc.output_contains("admin")
		tc.output_contains("alice")
		tc.output_contains("bf-realm1")
	})

	t.Run("assigns role with json output", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()
		tc.account_exists("alice", "acct-1234")

		// When
		tc.run_assign_role_json("alice", "bf-realm1", "admin")

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json()
		tc.json_output_has_value("status", "assigned")
		tc.json_output_has_value("role", "admin")
	})

	t.Run("returns error for invalid role", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()
		tc.account_exists("alice", "acct-1234")

		// When
		tc.run_assign_role("alice", "bf-realm1", "superuser")

		// Then
		tc.error_occurred()
		tc.error_message_contains("invalid role")
	})

	t.Run("returns error for unknown username", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()

		// When
		tc.run_assign_role("unknown", "bf-realm1", "admin")

		// Then
		tc.error_occurred()
	})
}

func TestAdminRevokeRole(t *testing.T) {
	t.Run("revokes role and prints confirmation", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()
		tc.account_with_role("alice", "acct-1234", "bf-realm1", "admin")

		// When
		tc.run_revoke_role("alice", "bf-realm1")

		// Then
		tc.command_has_no_error()
		tc.output_contains("Revoked")
		tc.output_contains("alice")
		tc.output_contains("bf-realm1")
	})

	t.Run("revokes role with json output", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()
		tc.account_with_role("alice", "acct-1234", "bf-realm1", "admin")

		// When
		tc.run_revoke_role_json("alice", "bf-realm1")

		// Then
		tc.command_has_no_error()
		tc.output_is_valid_json()
		tc.json_output_has_value("status", "revoked")
	})

	t.Run("returns error for unknown username", func(t *testing.T) {
		tc := newAdminAccountTestContext(t)

		// Given
		tc.admin_cmd_with_mock_stores()

		// When
		tc.run_revoke_role("unknown", "bf-realm1")

		// Then
		tc.error_occurred()
	})
}

// --- Test Context ---

type adminAccountTestContext struct {
	t *testing.T

	cmd             *cobra.Command
	eventStore      *mockEventStore
	projectionStore *mockProjectionStore
	output          string
	err             error
	jsonOutput      map[string]interface{}
}

func newAdminAccountTestContext(t *testing.T) *adminAccountTestContext {
	t.Helper()
	return &adminAccountTestContext{t: t}
}

// --- Given ---

func (tc *adminAccountTestContext) admin_cmd_with_mock_stores() {
	tc.t.Helper()
	tc.eventStore = newMockEventStore()
	tc.projectionStore = &mockProjectionStore{
		data:     make(map[string]any),
		listData: make(map[string][]json.RawMessage),
	}
	tc.cmd = newAdminCmdForTest(tc.eventStore, tc.projectionStore)
}

func (tc *adminAccountTestContext) projection_store_has_accounts() {
	tc.t.Helper()
	entry := projectors.AccountListEntry{
		AccountID: "acct-1234",
		Username:  "alice",
		Status:    "active",
		Realms:    []string{},
		PATCount:  1,
	}
	data, _ := json.Marshal(entry)
	tc.projectionStore.listData["_admin|account_list"] = []json.RawMessage{data}
}

func (tc *adminAccountTestContext) account_exists(username, accountID string) {
	tc.t.Helper()
	tc.projectionStore.data["_admin|account_lookup|username:"+username] = accountID

	accountCreated := map[string]interface{}{
		"account_id": accountID,
		"username":   username,
		"created_at": "2024-01-01T00:00:00Z",
	}
	data, _ := json.Marshal(accountCreated)
	tc.eventStore.streams["_admin|account-"+accountID] = []core.Event{
		{
			RealmID:        "_admin",
			StreamID:       "account-" + accountID,
			Version:        0,
			EventType:      "AccountCreated",
			Data:           data,
			GlobalPosition: 1,
		},
	}
}

func (tc *adminAccountTestContext) account_with_realm_access(username, accountID, realmID string) {
	tc.t.Helper()
	tc.account_with_role(username, accountID, realmID, "member")
}

func (tc *adminAccountTestContext) account_with_role(username, accountID, realmID, role string) {
	tc.t.Helper()
	tc.account_exists(username, accountID)

	roleAssigned := map[string]interface{}{
		"account_id": accountID,
		"realm_id":   realmID,
		"role":       role,
	}
	data, _ := json.Marshal(roleAssigned)
	tc.eventStore.streams["_admin|account-"+accountID] = append(
		tc.eventStore.streams["_admin|account-"+accountID],
		core.Event{
			RealmID:        "_admin",
			StreamID:       "account-" + accountID,
			Version:        1,
			EventType:      "RoleAssigned",
			Data:           data,
			GlobalPosition: 2,
		},
	)
}

// --- When ---

func (tc *adminAccountTestContext) run_create_account(username string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "create-account", username)
}

func (tc *adminAccountTestContext) run_create_account_json(username string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "create-account", username, "--json")
}

func (tc *adminAccountTestContext) run_list_accounts() {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "list-accounts")
}

func (tc *adminAccountTestContext) run_list_accounts_json() {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "list-accounts", "--json")
}

func (tc *adminAccountTestContext) run_suspend_account(username string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "suspend-account", username)
}

func (tc *adminAccountTestContext) run_suspend_account_json(username string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "suspend-account", username, "--json")
}

func (tc *adminAccountTestContext) run_grant(username, realmID string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "grant", username, realmID)
}

func (tc *adminAccountTestContext) run_grant_json(username, realmID string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "grant", username, realmID, "--json")
}

func (tc *adminAccountTestContext) run_revoke(username, realmID string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "revoke", username, realmID)
}

func (tc *adminAccountTestContext) run_revoke_json(username, realmID string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "revoke", username, realmID, "--json")
}

func (tc *adminAccountTestContext) run_assign_role(username, realmID, role string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "assign-role", username, realmID, role)
}

func (tc *adminAccountTestContext) run_assign_role_json(username, realmID, role string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "assign-role", username, realmID, role, "--json")
}

func (tc *adminAccountTestContext) run_revoke_role(username, realmID string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "revoke-role", username, realmID)
}

func (tc *adminAccountTestContext) run_revoke_role_json(username, realmID string) {
	tc.t.Helper()
	tc.output, tc.err = executeAdminCmd(tc.cmd, "revoke-role", username, realmID, "--json")
}

// --- Then ---

func (tc *adminAccountTestContext) command_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *adminAccountTestContext) error_occurred() {
	tc.t.Helper()
	assert.Error(tc.t, tc.err)
}

func (tc *adminAccountTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.output, substr)
}

func (tc *adminAccountTestContext) output_is_valid_json() {
	tc.t.Helper()
	tc.jsonOutput = make(map[string]interface{})
	err := json.Unmarshal([]byte(tc.output), &tc.jsonOutput)
	assert.NoError(tc.t, err, "output is not valid JSON: %s", tc.output)
}

func (tc *adminAccountTestContext) output_is_valid_json_array() {
	tc.t.Helper()
	var arr []interface{}
	err := json.Unmarshal([]byte(tc.output), &arr)
	assert.NoError(tc.t, err, "output is not valid JSON array: %s", tc.output)
}

func (tc *adminAccountTestContext) json_output_has_key(key string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.jsonOutput, "json output not parsed")
	_, ok := tc.jsonOutput[key]
	assert.True(tc.t, ok, "expected key %q in JSON output", key)
}

func (tc *adminAccountTestContext) json_output_has_value(key, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.jsonOutput, "json output not parsed")
	val, ok := tc.jsonOutput[key]
	require.True(tc.t, ok, "expected key %q in JSON output", key)
	assert.Equal(tc.t, expected, val)
}

func (tc *adminAccountTestContext) error_message_contains(substr string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), substr)
}
