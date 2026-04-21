package domain

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestAccountEventTypeConstants(t *testing.T) {
	t.Run("all account event type constants have correct values", func(t *testing.T) {
		tc := newAcctEvtTestContext(t)

		// Then
		tc.account_event_type_constants_are_correct()
	})
}

func TestAccountCreatedEvent(t *testing.T) {
	t.Run("serializes and deserializes with all fields", func(t *testing.T) {
		tc := newAcctEvtTestContext(t)

		// Given
		tc.account_created_event()

		// When
		tc.marshal_and_unmarshal_account_created()

		// Then
		tc.account_created_fields_match()
		tc.account_created_json_has_expected_keys()
	})
}

func TestAccountSuspendedEvent(t *testing.T) {
	t.Run("serializes and deserializes with all fields", func(t *testing.T) {
		tc := newAcctEvtTestContext(t)

		// Given
		tc.account_suspended_event()

		// When
		tc.marshal_and_unmarshal_account_suspended()

		// Then
		tc.account_suspended_fields_match()
	})
}

func TestRealmGrantedEvent(t *testing.T) {
	t.Run("serializes and deserializes with all fields", func(t *testing.T) {
		tc := newAcctEvtTestContext(t)

		// Given
		tc.realm_granted_event()

		// When
		tc.marshal_and_unmarshal_realm_granted()

		// Then
		tc.realm_granted_fields_match()
	})
}

func TestRealmRevokedEvent(t *testing.T) {
	t.Run("serializes and deserializes with all fields", func(t *testing.T) {
		tc := newAcctEvtTestContext(t)

		// Given
		tc.realm_revoked_event()

		// When
		tc.marshal_and_unmarshal_realm_revoked()

		// Then
		tc.realm_revoked_fields_match()
	})
}

func TestPATCreatedEvent(t *testing.T) {
	t.Run("serializes and deserializes with all fields", func(t *testing.T) {
		tc := newAcctEvtTestContext(t)

		// Given
		tc.pat_created_event()

		// When
		tc.marshal_and_unmarshal_pat_created()

		// Then
		tc.pat_created_fields_match()
		tc.pat_created_json_has_expected_keys()
	})
}

func TestPATRevokedEvent(t *testing.T) {
	t.Run("serializes and deserializes with all fields", func(t *testing.T) {
		tc := newAcctEvtTestContext(t)

		// Given
		tc.pat_revoked_event()

		// When
		tc.marshal_and_unmarshal_pat_revoked()

		// Then
		tc.pat_revoked_fields_match()
	})
}

func TestRoleAssignedEvent(t *testing.T) {
	t.Run("serializes and deserializes with all fields", func(t *testing.T) {
		tc := newAcctEvtTestContext(t)

		// Given
		tc.role_assigned_event()

		// When
		tc.marshal_and_unmarshal_role_assigned()

		// Then
		tc.role_assigned_fields_match()
		tc.role_assigned_json_has_expected_keys()
	})
}

func TestRoleRevokedEvent(t *testing.T) {
	t.Run("serializes and deserializes with all fields", func(t *testing.T) {
		tc := newAcctEvtTestContext(t)

		// Given
		tc.role_revoked_event()

		// When
		tc.marshal_and_unmarshal_role_revoked()

		// Then
		tc.role_revoked_fields_match()
	})
}

// --- Test Context ---

type acctEvtTestContext struct {
	t *testing.T

	accountCreated   AccountCreated
	accountSuspended AccountSuspended
	realmGranted     RealmGranted
	realmRevoked     RealmRevoked
	patCreated       PATCreated
	patRevoked       PATRevoked
	roleAssigned     RoleAssigned
	roleRevoked      RoleRevoked

	jsonBytes []byte
	jsonMap   map[string]any

	roundTrippedAccountCreated   AccountCreated
	roundTrippedAccountSuspended AccountSuspended
	roundTrippedRealmGranted     RealmGranted
	roundTrippedRealmRevoked     RealmRevoked
	roundTrippedPATCreated       PATCreated
	roundTrippedPATRevoked       PATRevoked
	roundTrippedRoleAssigned     RoleAssigned
	roundTrippedRoleRevoked      RoleRevoked
}

func newAcctEvtTestContext(t *testing.T) *acctEvtTestContext {
	t.Helper()
	return &acctEvtTestContext{t: t}
}

// --- Given ---

func (tc *acctEvtTestContext) account_created_event() {
	tc.t.Helper()
	tc.accountCreated = AccountCreated{
		AccountID: "acct-a1b2",
		Username:  "testuser",
		CreatedAt: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
	}
}

func (tc *acctEvtTestContext) account_suspended_event() {
	tc.t.Helper()
	tc.accountSuspended = AccountSuspended{
		AccountID: "acct-a1b2",
		Reason:    "policy violation",
	}
}

func (tc *acctEvtTestContext) realm_granted_event() {
	tc.t.Helper()
	tc.realmGranted = RealmGranted{
		AccountID: "acct-a1b2",
		RealmID:   "bf-r1",
	}
}

func (tc *acctEvtTestContext) realm_revoked_event() {
	tc.t.Helper()
	tc.realmRevoked = RealmRevoked{
		AccountID: "acct-a1b2",
		RealmID:   "bf-r1",
	}
}

func (tc *acctEvtTestContext) pat_created_event() {
	tc.t.Helper()
	tc.patCreated = PATCreated{
		AccountID: "acct-a1b2",
		PATID:     "pat-x1y2",
		KeyHash:   "hash123",
		Label:     "CI token",
		CreatedAt: time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC),
	}
}

func (tc *acctEvtTestContext) pat_revoked_event() {
	tc.t.Helper()
	tc.patRevoked = PATRevoked{
		AccountID: "acct-a1b2",
		PATID:     "pat-x1y2",
	}
}

// --- When ---

func (tc *acctEvtTestContext) marshal_and_unmarshal_account_created() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.accountCreated)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedAccountCreated))
}

func (tc *acctEvtTestContext) marshal_and_unmarshal_account_suspended() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.accountSuspended)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedAccountSuspended))
}

func (tc *acctEvtTestContext) marshal_and_unmarshal_realm_granted() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.realmGranted)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedRealmGranted))
}

func (tc *acctEvtTestContext) marshal_and_unmarshal_realm_revoked() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.realmRevoked)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedRealmRevoked))
}

func (tc *acctEvtTestContext) marshal_and_unmarshal_pat_created() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.patCreated)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedPATCreated))
}

func (tc *acctEvtTestContext) marshal_and_unmarshal_pat_revoked() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.patRevoked)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedPATRevoked))
}

// --- Then ---

func (tc *acctEvtTestContext) account_event_type_constants_are_correct() {
	tc.t.Helper()
	assert.Equal(tc.t, "AccountCreated", EventAccountCreated)
	assert.Equal(tc.t, "AccountSuspended", EventAccountSuspended)
	assert.Equal(tc.t, "RealmGranted", EventRealmGranted)
	assert.Equal(tc.t, "RealmRevoked", EventRealmRevoked)
	assert.Equal(tc.t, "PATCreated", EventPATCreated)
	assert.Equal(tc.t, "PATRevoked", EventPATRevoked)
	assert.Equal(tc.t, "RoleAssigned", EventRoleAssigned)
	assert.Equal(tc.t, "RoleRevoked", EventRoleRevoked)
}

func (tc *acctEvtTestContext) account_created_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.accountCreated.AccountID, tc.roundTrippedAccountCreated.AccountID)
	assert.Equal(tc.t, tc.accountCreated.Username, tc.roundTrippedAccountCreated.Username)
	assert.True(tc.t, tc.accountCreated.CreatedAt.Equal(tc.roundTrippedAccountCreated.CreatedAt))
}

func (tc *acctEvtTestContext) account_created_json_has_expected_keys() {
	tc.t.Helper()
	assert.Contains(tc.t, tc.jsonMap, "account_id")
	assert.Contains(tc.t, tc.jsonMap, "username")
	assert.Contains(tc.t, tc.jsonMap, "created_at")
}

func (tc *acctEvtTestContext) account_suspended_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.accountSuspended, tc.roundTrippedAccountSuspended)
}

func (tc *acctEvtTestContext) realm_granted_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.realmGranted, tc.roundTrippedRealmGranted)
}

func (tc *acctEvtTestContext) realm_revoked_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.realmRevoked, tc.roundTrippedRealmRevoked)
}

func (tc *acctEvtTestContext) pat_created_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.patCreated.AccountID, tc.roundTrippedPATCreated.AccountID)
	assert.Equal(tc.t, tc.patCreated.PATID, tc.roundTrippedPATCreated.PATID)
	assert.Equal(tc.t, tc.patCreated.KeyHash, tc.roundTrippedPATCreated.KeyHash)
	assert.Equal(tc.t, tc.patCreated.Label, tc.roundTrippedPATCreated.Label)
	assert.True(tc.t, tc.patCreated.CreatedAt.Equal(tc.roundTrippedPATCreated.CreatedAt))
}

func (tc *acctEvtTestContext) pat_created_json_has_expected_keys() {
	tc.t.Helper()
	assert.Contains(tc.t, tc.jsonMap, "account_id")
	assert.Contains(tc.t, tc.jsonMap, "pat_id")
	assert.Contains(tc.t, tc.jsonMap, "key_hash")
	assert.Contains(tc.t, tc.jsonMap, "label")
	assert.Contains(tc.t, tc.jsonMap, "created_at")
}

func (tc *acctEvtTestContext) pat_revoked_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.patRevoked, tc.roundTrippedPATRevoked)
}

// --- RoleAssigned Given/When/Then ---

func (tc *acctEvtTestContext) role_assigned_event() {
	tc.t.Helper()
	tc.roleAssigned = RoleAssigned{
		AccountID: "acct-a1b2",
		RealmID:   "bf-r1",
		Role:      "admin",
	}
}

func (tc *acctEvtTestContext) marshal_and_unmarshal_role_assigned() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.roleAssigned)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedRoleAssigned))
}

func (tc *acctEvtTestContext) role_assigned_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.roleAssigned, tc.roundTrippedRoleAssigned)
}

func (tc *acctEvtTestContext) role_assigned_json_has_expected_keys() {
	tc.t.Helper()
	assert.Contains(tc.t, tc.jsonMap, "account_id")
	assert.Contains(tc.t, tc.jsonMap, "realm_id")
	assert.Contains(tc.t, tc.jsonMap, "role")
}

// --- RoleRevoked Given/When/Then ---

func (tc *acctEvtTestContext) role_revoked_event() {
	tc.t.Helper()
	tc.roleRevoked = RoleRevoked{
		AccountID: "acct-a1b2",
		RealmID:   "bf-r1",
	}
}

func (tc *acctEvtTestContext) marshal_and_unmarshal_role_revoked() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.roleRevoked)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedRoleRevoked))
}

func (tc *acctEvtTestContext) role_revoked_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.roleRevoked, tc.roundTrippedRoleRevoked)
}
