package domain

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestCreateAccountCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newAcctCmdTestContext(t)

		// Given
		tc.create_account_command()

		// When
		tc.marshal_and_unmarshal_create_account()

		// Then
		tc.create_account_fields_match()
		tc.acct_cmd_json_has_key("username")
	})
}

func TestSuspendAccountCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newAcctCmdTestContext(t)

		// Given
		tc.suspend_account_command()

		// When
		tc.marshal_and_unmarshal_suspend_account()

		// Then
		tc.suspend_account_fields_match()
		tc.acct_cmd_json_has_key("account_id")
		tc.acct_cmd_json_has_key("reason")
	})
}

func TestGrantRealmCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newAcctCmdTestContext(t)

		// Given
		tc.grant_realm_command()

		// When
		tc.marshal_and_unmarshal_grant_realm()

		// Then
		tc.grant_realm_fields_match()
		tc.acct_cmd_json_has_key("account_id")
		tc.acct_cmd_json_has_key("realm_id")
	})
}

func TestRevokeRealmCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newAcctCmdTestContext(t)

		// Given
		tc.revoke_realm_command()

		// When
		tc.marshal_and_unmarshal_revoke_realm()

		// Then
		tc.revoke_realm_fields_match()
		tc.acct_cmd_json_has_key("account_id")
		tc.acct_cmd_json_has_key("realm_id")
	})
}

func TestCreatePATCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newAcctCmdTestContext(t)

		// Given
		tc.create_pat_command()

		// When
		tc.marshal_and_unmarshal_create_pat()

		// Then
		tc.create_pat_fields_match()
		tc.acct_cmd_json_has_key("account_id")
		tc.acct_cmd_json_has_key("label")
	})
}

func TestRevokePATCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newAcctCmdTestContext(t)

		// Given
		tc.revoke_pat_command()

		// When
		tc.marshal_and_unmarshal_revoke_pat()

		// Then
		tc.revoke_pat_fields_match()
		tc.acct_cmd_json_has_key("account_id")
		tc.acct_cmd_json_has_key("pat_id")
	})
}

func TestCreateAccountResult(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newAcctCmdTestContext(t)

		// Given
		tc.create_account_result()

		// When
		tc.marshal_and_unmarshal_create_account_result()

		// Then
		tc.create_account_result_fields_match()
		tc.acct_cmd_json_has_key("account_id")
		tc.acct_cmd_json_has_key("raw_token")
	})
}

func TestCreatePATResult(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newAcctCmdTestContext(t)

		// Given
		tc.create_pat_result()

		// When
		tc.marshal_and_unmarshal_create_pat_result()

		// Then
		tc.create_pat_result_fields_match()
		tc.acct_cmd_json_has_key("pat_id")
		tc.acct_cmd_json_has_key("raw_token")
	})
}

// --- Test Context ---

type acctCmdTestContext struct {
	t *testing.T

	createAccount      CreateAccount
	suspendAccount     SuspendAccount
	grantRealm         GrantRealm
	revokeRealm        RevokeRealm
	createPAT          CreatePAT
	revokePAT          RevokePAT
	createAccountRes   CreateAccountResult
	createPATRes       CreatePATResult

	jsonBytes []byte
	jsonMap   map[string]any

	roundTrippedCreateAccount    CreateAccount
	roundTrippedSuspendAccount   SuspendAccount
	roundTrippedGrantRealm       GrantRealm
	roundTrippedRevokeRealm      RevokeRealm
	roundTrippedCreatePAT        CreatePAT
	roundTrippedRevokePAT        RevokePAT
	roundTrippedCreateAccountRes CreateAccountResult
	roundTrippedCreatePATRes     CreatePATResult
}

func newAcctCmdTestContext(t *testing.T) *acctCmdTestContext {
	t.Helper()
	return &acctCmdTestContext{t: t}
}

// --- Given ---

func (tc *acctCmdTestContext) create_account_command() {
	tc.t.Helper()
	tc.createAccount = CreateAccount{
		Username: "newuser",
	}
}

func (tc *acctCmdTestContext) suspend_account_command() {
	tc.t.Helper()
	tc.suspendAccount = SuspendAccount{
		AccountID: "acct-a1b2",
		Reason:    "policy violation",
	}
}

func (tc *acctCmdTestContext) grant_realm_command() {
	tc.t.Helper()
	tc.grantRealm = GrantRealm{
		AccountID: "acct-a1b2",
		RealmID:   "bf-r1",
	}
}

func (tc *acctCmdTestContext) revoke_realm_command() {
	tc.t.Helper()
	tc.revokeRealm = RevokeRealm{
		AccountID: "acct-a1b2",
		RealmID:   "bf-r1",
	}
}

func (tc *acctCmdTestContext) create_pat_command() {
	tc.t.Helper()
	tc.createPAT = CreatePAT{
		AccountID: "acct-a1b2",
		Label:     "CI token",
	}
}

func (tc *acctCmdTestContext) revoke_pat_command() {
	tc.t.Helper()
	tc.revokePAT = RevokePAT{
		AccountID: "acct-a1b2",
		PATID:     "pat-x1y2",
	}
}

func (tc *acctCmdTestContext) create_account_result() {
	tc.t.Helper()
	tc.createAccountRes = CreateAccountResult{
		AccountID: "acct-a1b2",
		RawToken:  "bf_abc123secret",
	}
}

func (tc *acctCmdTestContext) create_pat_result() {
	tc.t.Helper()
	tc.createPATRes = CreatePATResult{
		PATID:    "pat-x1y2",
		RawToken: "bf_pat_secret456",
	}
}

// --- When ---

func (tc *acctCmdTestContext) marshal_and_unmarshal_create_account() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.createAccount)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedCreateAccount))
}

func (tc *acctCmdTestContext) marshal_and_unmarshal_suspend_account() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.suspendAccount)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedSuspendAccount))
}

func (tc *acctCmdTestContext) marshal_and_unmarshal_grant_realm() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.grantRealm)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedGrantRealm))
}

func (tc *acctCmdTestContext) marshal_and_unmarshal_revoke_realm() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.revokeRealm)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedRevokeRealm))
}

func (tc *acctCmdTestContext) marshal_and_unmarshal_create_pat() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.createPAT)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedCreatePAT))
}

func (tc *acctCmdTestContext) marshal_and_unmarshal_revoke_pat() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.revokePAT)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedRevokePAT))
}

func (tc *acctCmdTestContext) marshal_and_unmarshal_create_account_result() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.createAccountRes)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedCreateAccountRes))
}

func (tc *acctCmdTestContext) marshal_and_unmarshal_create_pat_result() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.createPATRes)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedCreatePATRes))
}

// --- Then ---

func (tc *acctCmdTestContext) create_account_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.createAccount, tc.roundTrippedCreateAccount)
}

func (tc *acctCmdTestContext) suspend_account_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.suspendAccount, tc.roundTrippedSuspendAccount)
}

func (tc *acctCmdTestContext) grant_realm_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.grantRealm, tc.roundTrippedGrantRealm)
}

func (tc *acctCmdTestContext) revoke_realm_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.revokeRealm, tc.roundTrippedRevokeRealm)
}

func (tc *acctCmdTestContext) create_pat_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.createPAT, tc.roundTrippedCreatePAT)
}

func (tc *acctCmdTestContext) revoke_pat_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.revokePAT, tc.roundTrippedRevokePAT)
}

func (tc *acctCmdTestContext) create_account_result_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.createAccountRes, tc.roundTrippedCreateAccountRes)
}

func (tc *acctCmdTestContext) create_pat_result_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.createPATRes, tc.roundTrippedCreatePATRes)
}

func (tc *acctCmdTestContext) acct_cmd_json_has_key(key string) {
	tc.t.Helper()
	_, exists := tc.jsonMap[key]
	assert.True(tc.t, exists, "expected JSON to contain key %q", key)
}
