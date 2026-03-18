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

func TestAccountDirectoryProjector(t *testing.T) {
	t.Run("Name returns account_directory", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("account_directory")
	})

	t.Run("TableName returns account_directory", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("account_directory")
	})

	t.Run("handles AccountCreated by putting entry with status active and empty pats", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()
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
		tc.account_entry_has_roles("acct-1", map[string]string{})
		tc.account_entry_has_pat_count("acct-1", 0)
		tc.account_entry_has_pats("acct-1", []PATEntry{})
		tc.account_entry_has_created_at("acct-1")
	})

	t.Run("handles AccountSuspended by updating status to suspended", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()
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

	t.Run("handles RealmGranted by appending realm to list and setting member role", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()
		tc.a_projection_store()
		tc.existing_account_entry("acct-1", "alice", "active")
		tc.a_realm_granted_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_realms("acct-1", []string{"realm-1"})
		tc.account_entry_has_roles("acct-1", map[string]string{"realm-1": "member"})
	})

	t.Run("handles RealmRevoked by removing realm from list and role from map", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()
		tc.a_projection_store()
		tc.existing_account_entry_with_realms("acct-1", "alice", "active", []string{"realm-1", "realm-2"}, map[string]string{"realm-1": "member", "realm-2": "admin"})
		tc.a_realm_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_realms("acct-1", []string{"realm-2"})
		tc.account_entry_has_roles("acct-1", map[string]string{"realm-2": "admin"})
	})

	t.Run("handles RoleAssigned by adding realm and setting role", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()
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
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()
		tc.a_projection_store()
		tc.existing_account_entry_with_realms("acct-1", "alice", "active", []string{"realm-1"}, map[string]string{"realm-1": "member"})
		tc.a_role_assigned_event("acct-1", "realm-1", "admin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_realms("acct-1", []string{"realm-1"})
		tc.account_entry_has_roles("acct-1", map[string]string{"realm-1": "admin"})
	})

	t.Run("handles RoleRevoked by removing realm and role", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()
		tc.a_projection_store()
		tc.existing_account_entry_with_realms("acct-1", "alice", "active", []string{"realm-1", "realm-2"}, map[string]string{"realm-1": "admin", "realm-2": "member"})
		tc.a_role_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_realms("acct-1", []string{"realm-2"})
		tc.account_entry_has_roles("acct-1", map[string]string{"realm-2": "member"})
	})

	t.Run("handles PATCreated by appending to pats array", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()
		tc.a_projection_store()
		tc.existing_account_entry("acct-1", "alice", "active")
		tc.a_pat_created_event("acct-1", "pat-1", "hash-1", "my-pat")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_pat_count("acct-1", 1)
		tc.account_entry_has_pats("acct-1", []PATEntry{
			{PATID: "pat-1", KeyHash: "hash-1", Label: "my-pat", CreatedAt: time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC)},
		})
	})

	t.Run("handles PATCreated idempotently - duplicate PATID not added", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()
		tc.a_projection_store()
		tc.existing_account_entry_with_pats("acct-1", "alice", "active", []PATEntry{
			{PATID: "pat-1", KeyHash: "hash-1", Label: "my-pat", CreatedAt: time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC)},
		})
		tc.a_pat_created_event("acct-1", "pat-1", "hash-1", "my-pat")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_pat_count("acct-1", 1) // Still 1, not 2
		tc.account_entry_has_pats("acct-1", []PATEntry{
			{PATID: "pat-1", KeyHash: "hash-1", Label: "my-pat", CreatedAt: time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC)},
		})
	})

	t.Run("handles PATRevoked by removing from pats array", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()
		tc.a_projection_store()
		tc.existing_account_entry_with_pats("acct-1", "alice", "active", []PATEntry{
			{PATID: "pat-1", KeyHash: "hash-1", Label: "my-pat", CreatedAt: time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC)},
			{PATID: "pat-2", KeyHash: "hash-2", Label: "ci-token", CreatedAt: time.Date(2026, 2, 2, 12, 0, 0, 0, time.UTC)},
		})
		tc.a_pat_revoked_event("acct-1", "pat-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_pat_count("acct-1", 1)
		tc.account_entry_has_pats("acct-1", []PATEntry{
			{PATID: "pat-2", KeyHash: "hash-2", Label: "ci-token", CreatedAt: time.Date(2026, 2, 2, 12, 0, 0, 0, time.UTC)},
		})
	})

	t.Run("handles PATRevoked idempotently - missing pat is no-op", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()
		tc.a_projection_store()
		tc.existing_account_entry_with_pats("acct-1", "alice", "active", []PATEntry{
			{PATID: "pat-2", KeyHash: "hash-2", Label: "ci-token", CreatedAt: time.Date(2026, 2, 2, 12, 0, 0, 0, time.UTC)},
		})
		tc.a_pat_revoked_event("acct-1", "pat-1") // pat-1 doesn't exist

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_pat_count("acct-1", 1)
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()
		tc.a_projection_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("AccountCreated is idempotent - existing account not overwritten", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()
		tc.a_projection_store()
		tc.existing_account_entry_with_pats("acct-1", "alice", "active", []PATEntry{
			{PATID: "pat-1", KeyHash: "hash-1", Label: "my-pat", CreatedAt: time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC)},
		})
		tc.an_account_created_event("acct-1", "alice")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_pat_count("acct-1", 1) // PATs preserved
	})

	t.Run("RealmGranted is idempotent - duplicate realm not added", func(t *testing.T) {
		tc := newAccountDirectoryTestContext(t)

		// Given
		tc.an_account_directory_projector()
		tc.a_projection_store()
		tc.existing_account_entry_with_realms("acct-1", "alice", "active", []string{"realm-1"}, map[string]string{"realm-1": "member"})
		tc.a_realm_granted_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_entry_has_realms("acct-1", []string{"realm-1"}) // Still just one
	})
}

// --- Test Context ---

type accountDirectoryTestContext struct {
	t *testing.T

	projector     *AccountDirectoryProjector
	store         *mockProjectionStore
	event         core.Event
	ctx           context.Context
	nameResult    string
	tableNameRes  string
	err           error
}

func newAccountDirectoryTestContext(t *testing.T) *accountDirectoryTestContext {
	t.Helper()
	return &accountDirectoryTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *accountDirectoryTestContext) an_account_directory_projector() {
	tc.t.Helper()
	tc.projector = NewAccountDirectoryProjector()
}

func (tc *accountDirectoryTestContext) a_projection_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *accountDirectoryTestContext) an_account_created_event(accountID, username string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAccountCreated, domain.AccountCreated{
		AccountID: accountID,
		Username:  username,
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	})
}

func (tc *accountDirectoryTestContext) an_account_suspended_event(accountID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAccountSuspended, domain.AccountSuspended{
		AccountID: accountID,
		Reason:    "policy violation",
	})
}

func (tc *accountDirectoryTestContext) a_realm_granted_event(accountID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRealmGranted, domain.RealmGranted{
		AccountID: accountID,
		RealmID:   realmID,
	})
}

func (tc *accountDirectoryTestContext) a_realm_revoked_event(accountID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRealmRevoked, domain.RealmRevoked{
		AccountID: accountID,
		RealmID:   realmID,
	})
}

func (tc *accountDirectoryTestContext) a_role_assigned_event(accountID, realmID, role string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRoleAssigned, domain.RoleAssigned{
		AccountID: accountID,
		RealmID:   realmID,
		Role:      role,
	})
}

func (tc *accountDirectoryTestContext) a_role_revoked_event(accountID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRoleRevoked, domain.RoleRevoked{
		AccountID: accountID,
		RealmID:   realmID,
	})
}

func (tc *accountDirectoryTestContext) a_pat_created_event(accountID, patID, keyHash, label string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventPATCreated, domain.PATCreated{
		AccountID: accountID,
		PATID:     patID,
		KeyHash:   keyHash,
		Label:     label,
		CreatedAt: time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC),
	})
}

func (tc *accountDirectoryTestContext) a_pat_revoked_event(accountID, patID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventPATRevoked, domain.PATRevoked{
		AccountID: accountID,
		PATID:     patID,
	})
}

func (tc *accountDirectoryTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *accountDirectoryTestContext) existing_account_entry(accountID, username, status string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := AccountDirectoryEntry{
		AccountID: accountID,
		Username:  username,
		Status:    status,
		Realms:    []string{},
		Roles:     map[string]string{},
		PATs:      []PATEntry{},
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	}
	tc.store.put("_admin", "account_directory", accountID, entry)
}

func (tc *accountDirectoryTestContext) existing_account_entry_with_realms(accountID, username, status string, realms []string, roles map[string]string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := AccountDirectoryEntry{
		AccountID: accountID,
		Username:  username,
		Status:    status,
		Realms:    realms,
		Roles:     roles,
		PATs:      []PATEntry{},
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	}
	tc.store.put("_admin", "account_directory", accountID, entry)
}

func (tc *accountDirectoryTestContext) existing_account_entry_with_pats(accountID, username, status string, pats []PATEntry) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := AccountDirectoryEntry{
		AccountID: accountID,
		Username:  username,
		Status:    status,
		Realms:    []string{},
		Roles:     map[string]string{},
		PATs:      pats,
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	}
	tc.store.put("_admin", "account_directory", accountID, entry)
}

// --- When ---

func (tc *accountDirectoryTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *accountDirectoryTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameRes = tc.projector.TableName()
}

func (tc *accountDirectoryTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *accountDirectoryTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *accountDirectoryTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameRes)
}

func (tc *accountDirectoryTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *accountDirectoryTestContext) account_entry_exists(accountID string) {
	tc.t.Helper()
	var entry AccountDirectoryEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_directory", accountID, &entry)
	require.NoError(tc.t, err, "expected account directory entry for %s", accountID)
}

func (tc *accountDirectoryTestContext) account_entry_has_username(accountID, expected string) {
	tc.t.Helper()
	var entry AccountDirectoryEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_directory", accountID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Username)
}

func (tc *accountDirectoryTestContext) account_entry_has_status(accountID, expected string) {
	tc.t.Helper()
	var entry AccountDirectoryEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_directory", accountID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Status)
}

func (tc *accountDirectoryTestContext) account_entry_has_realms(accountID string, expected []string) {
	tc.t.Helper()
	var entry AccountDirectoryEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_directory", accountID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Realms)
}

func (tc *accountDirectoryTestContext) account_entry_has_roles(accountID string, expected map[string]string) {
	tc.t.Helper()
	var entry AccountDirectoryEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_directory", accountID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Roles)
}

func (tc *accountDirectoryTestContext) account_entry_has_pat_count(accountID string, expected int) {
	tc.t.Helper()
	var entry AccountDirectoryEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_directory", accountID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.PATCount())
}

func (tc *accountDirectoryTestContext) account_entry_has_pats(accountID string, expected []PATEntry) {
	tc.t.Helper()
	var entry AccountDirectoryEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_directory", accountID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.PATs)
}

func (tc *accountDirectoryTestContext) account_entry_has_created_at(accountID string) {
	tc.t.Helper()
	var entry AccountDirectoryEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_directory", accountID, &entry)
	require.NoError(tc.t, err)
	assert.False(tc.t, entry.CreatedAt.IsZero(), "expected CreatedAt to be set")
}
