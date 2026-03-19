package projectors

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestSystemStatusProjector(t *testing.T) {
	t.Run("Name returns system_status", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("system_status")
	})

	t.Run("TableName returns system_status", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("system_status")
	})

	t.Run("handles AccountCreated by initializing empty admin_account_ids and realm_ids", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.an_account_created_event("acct-1", "alice")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.system_status_entry_exists()
		tc.system_status_has_admin_account_ids([]string{})
		tc.system_status_has_realm_ids([]string{})
	})

	t.Run("handles RoleAssigned with admin role in _admin realm by adding to admin_account_ids", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.existing_system_status_entry([]string{}, []string{})
		tc.a_role_assigned_event_in_admin_realm("acct-1", "admin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.system_status_has_admin_account_ids([]string{"acct-1"})
	})

	t.Run("handles RoleAssigned with owner role in _admin realm by adding to admin_account_ids", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.existing_system_status_entry([]string{}, []string{})
		tc.a_role_assigned_event_in_admin_realm("acct-1", "owner")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.system_status_has_admin_account_ids([]string{"acct-1"})
	})

	t.Run("handles RoleAssigned with non-admin role in _admin realm does not add to admin_account_ids", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.existing_system_status_entry([]string{}, []string{})
		tc.a_role_assigned_event_in_admin_realm("acct-1", "member")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.system_status_has_admin_account_ids([]string{})
	})

	t.Run("handles RoleAssigned with admin role in non-_admin realm does not add to admin_account_ids", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.existing_system_status_entry([]string{}, []string{})
		tc.a_role_assigned_event("acct-1", "realm-1", "admin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.system_status_has_admin_account_ids([]string{})
	})

	t.Run("handles RoleRevoked for admin in _admin realm by removing from admin_account_ids", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.existing_system_status_entry([]string{"acct-1", "acct-2"}, []string{})
		tc.a_role_revoked_event_in_admin_realm("acct-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.system_status_has_admin_account_ids([]string{"acct-2"})
	})

	t.Run("handles RoleRevoked for non-admin realm does not affect admin_account_ids", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.existing_system_status_entry([]string{"acct-1"}, []string{})
		tc.a_role_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.system_status_has_admin_account_ids([]string{"acct-1"})
	})

	t.Run("handles RealmCreated by adding realm to realm_ids", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.existing_system_status_entry([]string{}, []string{})
		tc.a_realm_created_event("realm-1", "my-realm")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.system_status_has_realm_ids([]string{"realm-1"})
	})

	t.Run("handles multiple RealmCreated events by accumulating realm_ids", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.existing_system_status_entry([]string{}, []string{"realm-1"})
		tc.a_realm_created_event("realm-2", "other-realm")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.system_status_has_realm_ids([]string{"realm-1", "realm-2"})
	})

	t.Run("handles multiple RoleAssigned events by accumulating admin_account_ids", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.existing_system_status_entry([]string{"acct-1"}, []string{})
		tc.a_role_assigned_event_in_admin_realm("acct-2", "admin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.system_status_has_admin_account_ids([]string{"acct-1", "acct-2"})
	})

	t.Run("RoleAssigned is idempotent - duplicate admin not added", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.existing_system_status_entry([]string{"acct-1"}, []string{})
		tc.a_role_assigned_event_in_admin_realm("acct-1", "admin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.system_status_has_admin_account_ids([]string{"acct-1"})
	})

	t.Run("RealmCreated is idempotent - duplicate realm not added", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.existing_system_status_entry([]string{}, []string{"realm-1"})
		tc.a_realm_created_event("realm-1", "my-realm")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.system_status_has_realm_ids([]string{"realm-1"})
	})

	t.Run("RoleRevoked is idempotent - missing account is no-op", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.existing_system_status_entry([]string{"acct-1"}, []string{})
		tc.a_role_revoked_event_in_admin_realm("acct-2") // acct-2 not in list

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.system_status_has_admin_account_ids([]string{"acct-1"})
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("AccountCreated is idempotent - existing status not overwritten", func(t *testing.T) {
		tc := newSystemStatusTestContext(t)

		// Given
		tc.a_system_status_projector()
		tc.a_store()
		tc.existing_system_status_entry([]string{"acct-1"}, []string{"realm-1"})
		tc.an_account_created_event("acct-2", "bob")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.system_status_has_admin_account_ids([]string{"acct-1"})
		tc.system_status_has_realm_ids([]string{"realm-1"})
	})
}

// --- Test Context ---

type systemStatusTestContext struct {
	t           *testing.T
	projector   *SystemStatusProjector
	store       *mockProjectionStore
	event       core.Event
	ctx         context.Context
	nameResult  string
	tableNameRes string
	err         error
}

func newSystemStatusTestContext(t *testing.T) *systemStatusTestContext {
	t.Helper()
	return &systemStatusTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *systemStatusTestContext) a_system_status_projector() {
	tc.t.Helper()
	tc.projector = NewSystemStatusProjector()
}

func (tc *systemStatusTestContext) a_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *systemStatusTestContext) an_account_created_event(accountID, username string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAccountCreated, domain.AccountCreated{
		AccountID: accountID,
		Username:  username,
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	})
}

func (tc *systemStatusTestContext) a_role_assigned_event(accountID, realmID, role string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRoleAssigned, domain.RoleAssigned{
		AccountID: accountID,
		RealmID:   realmID,
		Role:      role,
	})
}

func (tc *systemStatusTestContext) a_role_assigned_event_in_admin_realm(accountID, role string) {
	tc.t.Helper()
	tc.event = core.Event{
		EventType: domain.EventRoleAssigned,
		Data:      mustMarshal(domain.RoleAssigned{AccountID: accountID, RealmID: "_admin", Role: role}),
		RealmID:   "_admin",
		Timestamp: time.Now(),
	}
}

func (tc *systemStatusTestContext) a_role_revoked_event(accountID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRoleRevoked, domain.RoleRevoked{
		AccountID: accountID,
		RealmID:   realmID,
	})
}

func (tc *systemStatusTestContext) a_role_revoked_event_in_admin_realm(accountID string) {
	tc.t.Helper()
	tc.event = core.Event{
		EventType: domain.EventRoleRevoked,
		Data:      mustMarshal(domain.RoleRevoked{AccountID: accountID, RealmID: "_admin"}),
		RealmID:   "_admin",
		Timestamp: time.Now(),
	}
}

func (tc *systemStatusTestContext) a_realm_created_event(realmID, name string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRealmCreated, domain.RealmCreated{
		RealmID:   realmID,
		Name:      name,
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	})
}

func (tc *systemStatusTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *systemStatusTestContext) existing_system_status_entry(adminAccountIDs, realmIDs []string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := SystemStatusEntry{
		AdminAccountIDs: adminAccountIDs,
		RealmIDs:        realmIDs,
	}
	tc.store.put("_admin", "system_status", "status", entry)
}

// --- When ---

func (tc *systemStatusTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *systemStatusTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameRes = tc.projector.TableName()
}

func (tc *systemStatusTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *systemStatusTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *systemStatusTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameRes)
}

func (tc *systemStatusTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *systemStatusTestContext) system_status_entry_exists() {
	tc.t.Helper()
	var entry SystemStatusEntry
	err := tc.store.Get(tc.ctx, "_admin", "system_status", "status", &entry)
	require.NoError(tc.t, err, "expected system status entry to exist")
}

func (tc *systemStatusTestContext) system_status_has_admin_account_ids(expected []string) {
	tc.t.Helper()
	var entry SystemStatusEntry
	err := tc.store.Get(tc.ctx, "_admin", "system_status", "status", &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.AdminAccountIDs)
}

func (tc *systemStatusTestContext) system_status_has_realm_ids(expected []string) {
	tc.t.Helper()
	var entry SystemStatusEntry
	err := tc.store.Get(tc.ctx, "_admin", "system_status", "status", &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.RealmIDs)
}

// --- Helper ---

func mustMarshal(v any) []byte {
	data, _ := json.Marshal(v)
	return data
}
