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

func TestRealmDirectoryProjector(t *testing.T) {
	t.Run("Name returns realm_directory", func(t *testing.T) {
		tc := newRealmDirectoryTestContext(t)

		// Given
		tc.a_realm_directory_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("realm_directory")
	})

	t.Run("TableName returns projection_realm_directory", func(t *testing.T) {
		tc := newRealmDirectoryTestContext(t)

		// Given
		tc.a_realm_directory_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("projection_realm_directory")
	})

	t.Run("handles RealmCreated by putting entry with status active", func(t *testing.T) {
		tc := newRealmDirectoryTestContext(t)

		// Given
		tc.a_realm_directory_projector()
		tc.a_projection_store()
		tc.a_realm_created_event("realm-1", "My Realm")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.realm_entry_exists("realm-1")
		tc.realm_entry_has_name("realm-1", "My Realm")
		tc.realm_entry_has_status("realm-1", "active")
		tc.realm_entry_has_created_at("realm-1")
	})

	t.Run("handles RealmSuspended by updating status to suspended", func(t *testing.T) {
		tc := newRealmDirectoryTestContext(t)

		// Given
		tc.a_realm_directory_projector()
		tc.a_projection_store()
		tc.existing_realm_entry("realm-1", "My Realm", "active")
		tc.a_realm_suspended_event("realm-1", "policy violation")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.realm_entry_has_status("realm-1", "suspended")
		tc.realm_entry_has_name("realm-1", "My Realm")
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newRealmDirectoryTestContext(t)

		// Given
		tc.a_realm_directory_projector()
		tc.a_projection_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})
}

// --- Test Context ---

type realmDirectoryTestContext struct {
	t *testing.T

	projector  *RealmDirectoryProjector
	store      *mockProjectionStore
	event      core.Event
	ctx        context.Context
	realmID    string
	nameResult string
	tableNameResult string
	err        error
}

func newRealmDirectoryTestContext(t *testing.T) *realmDirectoryTestContext {
	t.Helper()
	return &realmDirectoryTestContext{
		t:       t,
		ctx:     context.Background(),
		realmID: "realm-1",
	}
}

// --- Given ---

func (tc *realmDirectoryTestContext) a_realm_directory_projector() {
	tc.t.Helper()
	tc.projector = NewRealmDirectoryProjector()
}

func (tc *realmDirectoryTestContext) a_projection_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *realmDirectoryTestContext) a_realm_created_event(realmID, name string) {
	tc.t.Helper()
	tc.realmID = realmID
	tc.event = makeEvent(domain.EventRealmCreated, domain.RealmCreated{
		RealmID:   realmID,
		Name:      name,
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	})
}

func (tc *realmDirectoryTestContext) a_realm_suspended_event(realmID, reason string) {
	tc.t.Helper()
	tc.realmID = realmID
	tc.event = makeEvent(domain.EventRealmSuspended, domain.RealmSuspended{
		RealmID: realmID,
		Reason:  reason,
	})
}

func (tc *realmDirectoryTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *realmDirectoryTestContext) existing_realm_entry(realmID, name, status string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := RealmDirectoryEntry{
		RealmID:   realmID,
		Name:      name,
		Status:    status,
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	}
	tc.store.put("realm-1", "projection_realm_directory", realmID, entry)
}

// --- When ---

func (tc *realmDirectoryTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *realmDirectoryTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameResult = tc.projector.TableName()
}

func (tc *realmDirectoryTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *realmDirectoryTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *realmDirectoryTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameResult)
}

func (tc *realmDirectoryTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *realmDirectoryTestContext) realm_entry_exists(realmID string) {
	tc.t.Helper()
	var entry RealmDirectoryEntry
	err := tc.store.Get(tc.ctx, "realm-1", "projection_realm_directory", realmID, &entry)
	require.NoError(tc.t, err, "expected realm directory entry for %s", realmID)
}

func (tc *realmDirectoryTestContext) realm_entry_has_name(realmID, expected string) {
	tc.t.Helper()
	var entry RealmDirectoryEntry
	err := tc.store.Get(tc.ctx, "realm-1", "projection_realm_directory", realmID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Name)
}

func (tc *realmDirectoryTestContext) realm_entry_has_status(realmID, expected string) {
	tc.t.Helper()
	var entry RealmDirectoryEntry
	err := tc.store.Get(tc.ctx, "realm-1", "projection_realm_directory", realmID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Status)
}

func (tc *realmDirectoryTestContext) realm_entry_has_created_at(realmID string) {
	tc.t.Helper()
	var entry RealmDirectoryEntry
	err := tc.store.Get(tc.ctx, "realm-1", "projection_realm_directory", realmID, &entry)
	require.NoError(tc.t, err)
	assert.False(tc.t, entry.CreatedAt.IsZero(), "expected CreatedAt to be set")
}
