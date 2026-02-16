package projectors

import (
	"context"
	"testing"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestAccountListProjector(t *testing.T) {
	t.Run("Name returns account_list", func(t *testing.T) {
		tc := newAccountListTestContext(t)

		// Given
		tc.an_account_list_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("account_list")
	})

	t.Run("handles AccountCreated by putting entry with status active", func(t *testing.T) {
		tc := newAccountListTestContext(t)

		// Given
		tc.an_account_list_projector()
		tc.a_projection_store()
		tc.an_account_created_event("acct-1", "alice")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_exists("acct-1")
		tc.account_entry_has_username("acct-1", "alice")
		tc.account_entry_has_status("acct-1", "active")
		tc.account_entry_has_realms("acct-1", []string{})
		tc.account_entry_has_pat_count("acct-1", 0)
		tc.account_entry_has_created_at("acct-1")
	})

	t.Run("handles AccountSuspended by updating status to suspended", func(t *testing.T) {
		tc := newAccountListTestContext(t)

		// Given
		tc.an_account_list_projector()
		tc.a_projection_store()
		tc.existing_account_entry("acct-1", "alice", "active")
		tc.an_account_suspended_event("acct-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_status("acct-1", "suspended")
		tc.account_entry_has_username("acct-1", "alice")
	})

	t.Run("handles RealmGranted by appending realm to list", func(t *testing.T) {
		tc := newAccountListTestContext(t)

		// Given
		tc.an_account_list_projector()
		tc.a_projection_store()
		tc.existing_account_entry("acct-1", "alice", "active")
		tc.a_realm_granted_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_realms("acct-1", []string{"realm-1"})
	})

	t.Run("handles RealmRevoked by removing realm from list", func(t *testing.T) {
		tc := newAccountListTestContext(t)

		// Given
		tc.an_account_list_projector()
		tc.a_projection_store()
		tc.existing_account_entry_with_realms("acct-1", "alice", "active", []string{"realm-1", "realm-2"})
		tc.a_realm_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_realms("acct-1", []string{"realm-2"})
	})

	t.Run("handles PATCreated by incrementing PATCount", func(t *testing.T) {
		tc := newAccountListTestContext(t)

		// Given
		tc.an_account_list_projector()
		tc.a_projection_store()
		tc.existing_account_entry("acct-1", "alice", "active")
		tc.a_pat_created_event("acct-1", "pat-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_pat_count("acct-1", 1)
	})

	t.Run("handles PATRevoked by decrementing PATCount", func(t *testing.T) {
		tc := newAccountListTestContext(t)

		// Given
		tc.an_account_list_projector()
		tc.a_projection_store()
		tc.existing_account_entry_with_pat_count("acct-1", "alice", "active", 3)
		tc.a_pat_revoked_event("acct-1", "pat-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_pat_count("acct-1", 2)
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newAccountListTestContext(t)

		// Given
		tc.an_account_list_projector()
		tc.a_projection_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("handles AccountCreated by initializing roles to empty map", func(t *testing.T) {
		tc := newAccountListTestContext(t)

		// Given
		tc.an_account_list_projector()
		tc.a_projection_store()
		tc.an_account_created_event("acct-1", "alice")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_roles("acct-1", map[string]string{})
	})

	t.Run("handles RoleAssigned by adding realm and setting role", func(t *testing.T) {
		tc := newAccountListTestContext(t)

		// Given
		tc.an_account_list_projector()
		tc.a_projection_store()
		tc.existing_account_entry("acct-1", "alice", "active")
		tc.a_role_assigned_event("acct-1", "realm-1", "admin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_realms("acct-1", []string{"realm-1"})
		tc.account_entry_has_roles("acct-1", map[string]string{"realm-1": "admin"})
	})

	t.Run("handles RoleAssigned with existing realm updates role value", func(t *testing.T) {
		tc := newAccountListTestContext(t)

		// Given
		tc.an_account_list_projector()
		tc.a_projection_store()
		tc.existing_account_entry_with_roles("acct-1", "alice", "active", []string{"realm-1"}, map[string]string{"realm-1": "member"})
		tc.a_role_assigned_event("acct-1", "realm-1", "admin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_realms("acct-1", []string{"realm-1"})
		tc.account_entry_has_roles("acct-1", map[string]string{"realm-1": "admin"})
	})

	t.Run("handles RoleRevoked by removing realm and role", func(t *testing.T) {
		tc := newAccountListTestContext(t)

		// Given
		tc.an_account_list_projector()
		tc.a_projection_store()
		tc.existing_account_entry_with_roles("acct-1", "alice", "active", []string{"realm-1", "realm-2"}, map[string]string{"realm-1": "admin", "realm-2": "member"})
		tc.a_role_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_realms("acct-1", []string{"realm-2"})
		tc.account_entry_has_roles("acct-1", map[string]string{"realm-2": "member"})
	})

	t.Run("handles RealmGranted by also setting roles map with member", func(t *testing.T) {
		tc := newAccountListTestContext(t)

		// Given
		tc.an_account_list_projector()
		tc.a_projection_store()
		tc.existing_account_entry("acct-1", "alice", "active")
		tc.a_realm_granted_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_roles("acct-1", map[string]string{"realm-1": "member"})
	})

	t.Run("handles RealmRevoked by also removing from roles map", func(t *testing.T) {
		tc := newAccountListTestContext(t)

		// Given
		tc.an_account_list_projector()
		tc.a_projection_store()
		tc.existing_account_entry_with_roles("acct-1", "alice", "active", []string{"realm-1"}, map[string]string{"realm-1": "member"})
		tc.a_realm_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_roles("acct-1", map[string]string{})
	})
}

// --- Test Context ---

type accountListTestContext struct {
	t *testing.T

	projector  *AccountListProjector
	store      *mockProjectionStore
	event      core.Event
	ctx        context.Context
	nameResult string
	err        error
}

func newAccountListTestContext(t *testing.T) *accountListTestContext {
	t.Helper()
	return &accountListTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *accountListTestContext) an_account_list_projector() {
	tc.t.Helper()
	tc.projector = NewAccountListProjector()
}

func (tc *accountListTestContext) a_projection_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *accountListTestContext) an_account_created_event(accountID, username string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAccountCreated, domain.AccountCreated{
		AccountID: accountID,
		Username:  username,
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	})
}

func (tc *accountListTestContext) an_account_suspended_event(accountID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAccountSuspended, domain.AccountSuspended{
		AccountID: accountID,
		Reason:    "policy violation",
	})
}

func (tc *accountListTestContext) a_realm_granted_event(accountID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRealmGranted, domain.RealmGranted{
		AccountID: accountID,
		RealmID:   realmID,
	})
}

func (tc *accountListTestContext) a_realm_revoked_event(accountID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRealmRevoked, domain.RealmRevoked{
		AccountID: accountID,
		RealmID:   realmID,
	})
}

func (tc *accountListTestContext) a_role_assigned_event(accountID, realmID, role string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRoleAssigned, domain.RoleAssigned{
		AccountID: accountID,
		RealmID:   realmID,
		Role:      role,
	})
}

func (tc *accountListTestContext) a_role_revoked_event(accountID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRoleRevoked, domain.RoleRevoked{
		AccountID: accountID,
		RealmID:   realmID,
	})
}

func (tc *accountListTestContext) a_pat_created_event(accountID, patID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventPATCreated, domain.PATCreated{
		AccountID: accountID,
		PATID:     patID,
		KeyHash:   "hash-1",
		Label:     "my-pat",
		CreatedAt: time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC),
	})
}

func (tc *accountListTestContext) a_pat_revoked_event(accountID, patID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventPATRevoked, domain.PATRevoked{
		AccountID: accountID,
		PATID:     patID,
	})
}

func (tc *accountListTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *accountListTestContext) existing_account_entry(accountID, username, status string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := AccountListEntry{
		AccountID: accountID,
		Username:  username,
		Status:    status,
		Realms:    []string{},
		PATCount:  0,
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	}
	tc.store.put("_admin", "account_list", accountID, entry)
}

func (tc *accountListTestContext) existing_account_entry_with_realms(accountID, username, status string, realms []string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := AccountListEntry{
		AccountID: accountID,
		Username:  username,
		Status:    status,
		Realms:    realms,
		PATCount:  0,
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	}
	tc.store.put("_admin", "account_list", accountID, entry)
}

func (tc *accountListTestContext) existing_account_entry_with_pat_count(accountID, username, status string, patCount int) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := AccountListEntry{
		AccountID: accountID,
		Username:  username,
		Status:    status,
		Realms:    []string{},
		PATCount:  patCount,
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	}
	tc.store.put("_admin", "account_list", accountID, entry)
}

func (tc *accountListTestContext) existing_account_entry_with_roles(accountID, username, status string, realms []string, roles map[string]string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := AccountListEntry{
		AccountID: accountID,
		Username:  username,
		Status:    status,
		Realms:    realms,
		Roles:     roles,
		PATCount:  0,
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	}
	tc.store.put("_admin", "account_list", accountID, entry)
}

// --- When ---

func (tc *accountListTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *accountListTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *accountListTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *accountListTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *accountListTestContext) account_entry_exists(accountID string) {
	tc.t.Helper()
	var entry AccountListEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_list", accountID, &entry)
	require.NoError(tc.t, err, "expected account list entry for %s", accountID)
}

func (tc *accountListTestContext) account_entry_has_username(accountID, expected string) {
	tc.t.Helper()
	var entry AccountListEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_list", accountID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Username)
}

func (tc *accountListTestContext) account_entry_has_status(accountID, expected string) {
	tc.t.Helper()
	var entry AccountListEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_list", accountID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Status)
}

func (tc *accountListTestContext) account_entry_has_realms(accountID string, expected []string) {
	tc.t.Helper()
	var entry AccountListEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_list", accountID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Realms)
}

func (tc *accountListTestContext) account_entry_has_pat_count(accountID string, expected int) {
	tc.t.Helper()
	var entry AccountListEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_list", accountID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.PATCount)
}

func (tc *accountListTestContext) account_entry_has_created_at(accountID string) {
	tc.t.Helper()
	var entry AccountListEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_list", accountID, &entry)
	require.NoError(tc.t, err)
	assert.False(tc.t, entry.CreatedAt.IsZero(), "expected CreatedAt to be set")
}

func (tc *accountListTestContext) account_entry_has_roles(accountID string, expected map[string]string) {
	tc.t.Helper()
	var entry AccountListEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_list", accountID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Roles)
}
