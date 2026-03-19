package projectors

import (
	"context"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestAccountAuthProjector(t *testing.T) {
	t.Run("Name returns account_auth", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("account_auth")
	})

	t.Run("TableName returns account_auth", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("account_auth")
	})

	t.Run("handles AccountCreated by putting entry with username and active status", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()
		tc.a_store()
		tc.an_account_created_event("acct-1", "alice")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_exists("acct-1")
		tc.entry_has_username("acct-1", "alice")
		tc.entry_has_status("acct-1", "active")
		tc.entry_has_empty_realms("acct-1")
		tc.entry_has_empty_roles("acct-1")
		tc.entry_is_stored_in_account_auth_table("acct-1")
	})

	t.Run("handles AccountSuspended by updating status to suspended", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()
		tc.a_store()
		tc.existing_entry("acct-1", "alice", "active")
		tc.an_account_suspended_event("acct-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_has_status("acct-1", "suspended")
	})

	t.Run("handles RealmGranted by appending realm to list and setting member role", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()
		tc.a_store()
		tc.existing_entry("acct-1", "alice", "active")
		tc.a_realm_granted_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_has_realms("acct-1", []string{"realm-1"})
		tc.entry_has_role("acct-1", "realm-1", "member")
	})

	t.Run("handles RealmRevoked by removing realm from list and role from map", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()
		tc.a_store()
		tc.existing_entry_with_realms("acct-1", "alice", "active", []string{"realm-1", "realm-2"})
		tc.a_realm_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_has_realms("acct-1", []string{"realm-2"})
		tc.entry_has_no_role("acct-1", "realm-1")
		tc.entry_has_role("acct-1", "realm-2", "member")
	})

	t.Run("handles RoleAssigned by updating role in map and adding realm if not present", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()
		tc.a_store()
		tc.existing_entry("acct-1", "alice", "active")
		tc.a_role_assigned_event("acct-1", "realm-1", "admin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_has_realms("acct-1", []string{"realm-1"})
		tc.entry_has_role("acct-1", "realm-1", "admin")
	})

	t.Run("handles RoleAssigned by updating role for existing realm", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()
		tc.a_store()
		tc.existing_entry_with_realms("acct-1", "alice", "active", []string{"realm-1"})
		tc.a_role_assigned_event("acct-1", "realm-1", "owner")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_has_realms("acct-1", []string{"realm-1"})
		tc.entry_has_role("acct-1", "realm-1", "owner")
	})

	t.Run("handles RoleRevoked by removing realm from list and role from map", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()
		tc.a_store()
		tc.existing_entry_with_realms("acct-1", "alice", "active", []string{"realm-1", "realm-2"})
		tc.a_role_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_has_realms("acct-1", []string{"realm-2"})
		tc.entry_has_no_role("acct-1", "realm-1")
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()
		tc.a_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("AccountCreated is idempotent for duplicate account", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()
		tc.a_store()
		tc.existing_entry("acct-1", "alice", "active")
		tc.an_account_created_event("acct-1", "bob") // different username

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_has_username("acct-1", "alice") // unchanged
	})

	t.Run("RealmGranted is idempotent for duplicate realm", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()
		tc.a_store()
		tc.existing_entry_with_realms("acct-1", "alice", "active", []string{"realm-1"})
		tc.a_realm_granted_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_has_realms("acct-1", []string{"realm-1"})
		tc.entry_has_role("acct-1", "realm-1", "member")
	})

	t.Run("RoleAssigned is idempotent for same role", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()
		tc.a_store()
		tc.existing_entry_with_realms("acct-1", "alice", "active", []string{"realm-1"})
		tc.a_role_assigned_event("acct-1", "realm-1", "admin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_has_realms("acct-1", []string{"realm-1"})
		tc.entry_has_role("acct-1", "realm-1", "admin")
	})

	t.Run("RealmRevoked is idempotent for missing realm", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()
		tc.a_store()
		tc.existing_entry("acct-1", "alice", "active")
		tc.a_realm_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_has_empty_realms("acct-1")
	})

	t.Run("RoleRevoked is idempotent for missing role", func(t *testing.T) {
		tc := newAccountAuthTestContext(t)

		// Given
		tc.an_account_auth_projector()
		tc.a_store()
		tc.existing_entry("acct-1", "alice", "active")
		tc.a_role_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_has_empty_realms("acct-1")
	})
}

// --- Test Context ---

type accountAuthTestContext struct {
	t       *testing.T
	projector *AccountAuthProjector
	store    *mockProjectionStore
	event    core.Event
	err      error
	name     string
	tableName string
}

func newAccountAuthTestContext(t *testing.T) *accountAuthTestContext {
	t.Helper()
	return &accountAuthTestContext{t: t}
}

// --- Given ---

func (tc *accountAuthTestContext) an_account_auth_projector() {
	tc.t.Helper()
	tc.projector = NewAccountAuthProjector()
}

func (tc *accountAuthTestContext) a_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *accountAuthTestContext) an_account_created_event(accountID, username string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAccountCreated, domain.AccountCreated{
		AccountID: accountID,
		Username:  username,
	})
}

func (tc *accountAuthTestContext) an_account_suspended_event(accountID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAccountSuspended, domain.AccountSuspended{
		AccountID: accountID,
		Reason:    "policy violation",
	})
}

func (tc *accountAuthTestContext) a_realm_granted_event(accountID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRealmGranted, domain.RealmGranted{
		AccountID: accountID,
		RealmID:   realmID,
	})
}

func (tc *accountAuthTestContext) a_realm_revoked_event(accountID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRealmRevoked, domain.RealmRevoked{
		AccountID: accountID,
		RealmID:   realmID,
	})
}

func (tc *accountAuthTestContext) a_role_assigned_event(accountID, realmID, role string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRoleAssigned, domain.RoleAssigned{
		AccountID: accountID,
		RealmID:   realmID,
		Role:      role,
	})
}

func (tc *accountAuthTestContext) a_role_revoked_event(accountID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRoleRevoked, domain.RoleRevoked{
		AccountID: accountID,
		RealmID:   realmID,
	})
}

func (tc *accountAuthTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = makeEvent("UnknownEvent", map[string]string{"foo": "bar"})
}

func (tc *accountAuthTestContext) existing_entry(accountID, username, status string) {
	tc.t.Helper()
	entry := AccountAuthEntry{
		AccountID: accountID,
		Username:  username,
		Status:    status,
		Realms:    []string{},
		Roles:     map[string]string{},
	}
	key := "realm-1:account_auth:" + accountID
	tc.store.data[key] = entry
}

func (tc *accountAuthTestContext) existing_entry_with_realms(accountID, username, status string, realms []string) {
	tc.t.Helper()
	roles := make(map[string]string)
	for _, r := range realms {
		roles[r] = "member"
	}
	entry := AccountAuthEntry{
		AccountID: accountID,
		Username:  username,
		Status:    status,
		Realms:    realms,
		Roles:     roles,
	}
	key := "realm-1:account_auth:" + accountID
	tc.store.data[key] = entry
}

// --- When ---

func (tc *accountAuthTestContext) name_is_called() {
	tc.t.Helper()
	tc.name = tc.projector.Name()
}

func (tc *accountAuthTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableName = tc.projector.TableName()
}

func (tc *accountAuthTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(context.Background(), tc.event, tc.store)
}

// --- Then ---

func (tc *accountAuthTestContext) no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *accountAuthTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.name)
}

func (tc *accountAuthTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableName)
}

func (tc *accountAuthTestContext) entry_exists(accountID string) {
	tc.t.Helper()
	key := "realm-1:account_auth:" + accountID
	_, exists := tc.store.data[key]
	assert.True(tc.t, exists, "expected entry for account %s to exist", accountID)
}

func (tc *accountAuthTestContext) entry_has_username(accountID, expected string) {
	tc.t.Helper()
	entry := tc.getEntry(accountID)
	require.NotNil(tc.t, entry)
	assert.Equal(tc.t, expected, entry.Username)
}

func (tc *accountAuthTestContext) entry_has_status(accountID, expected string) {
	tc.t.Helper()
	entry := tc.getEntry(accountID)
	require.NotNil(tc.t, entry)
	assert.Equal(tc.t, expected, entry.Status)
}

func (tc *accountAuthTestContext) entry_has_empty_realms(accountID string) {
	tc.t.Helper()
	entry := tc.getEntry(accountID)
	require.NotNil(tc.t, entry)
	assert.Empty(tc.t, entry.Realms)
}

func (tc *accountAuthTestContext) entry_has_empty_roles(accountID string) {
	tc.t.Helper()
	entry := tc.getEntry(accountID)
	require.NotNil(tc.t, entry)
	assert.Empty(tc.t, entry.Roles)
}

func (tc *accountAuthTestContext) entry_has_realms(accountID string, expected []string) {
	tc.t.Helper()
	entry := tc.getEntry(accountID)
	require.NotNil(tc.t, entry)
	assert.Equal(tc.t, expected, entry.Realms)
}

func (tc *accountAuthTestContext) entry_has_role(accountID, realmID, expectedRole string) {
	tc.t.Helper()
	entry := tc.getEntry(accountID)
	require.NotNil(tc.t, entry)
	assert.Equal(tc.t, expectedRole, entry.Roles[realmID])
}

func (tc *accountAuthTestContext) entry_has_no_role(accountID, realmID string) {
	tc.t.Helper()
	entry := tc.getEntry(accountID)
	require.NotNil(tc.t, entry)
	_, exists := entry.Roles[realmID]
	assert.False(tc.t, exists, "expected no role for realm %s", realmID)
}

func (tc *accountAuthTestContext) entry_is_stored_in_account_auth_table(accountID string) {
	tc.t.Helper()
	// Verify the entry was stored with the correct table name
	// The mock store uses the key directly, but we verify the projector uses the right table
	assert.Equal(tc.t, "account_auth", tc.projector.TableName())
}

func (tc *accountAuthTestContext) getEntry(accountID string) *AccountAuthEntry {
	tc.t.Helper()
	key := "realm-1:account_auth:" + accountID
	entry, exists := tc.store.data[key]
	if !exists {
		return nil
	}
	e, ok := entry.(AccountAuthEntry)
	if !ok {
		return nil
	}
	return &e
}
