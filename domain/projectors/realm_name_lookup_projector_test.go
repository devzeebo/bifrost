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

func TestRealmNameLookupProjector(t *testing.T) {
	t.Run("Name returns realm_name_lookup", func(t *testing.T) {
		tc := newRealmNameLookupTestContext(t)

		// Given
		tc.a_realm_name_lookup_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("realm_name_lookup")
	})

	t.Run("TableName returns realm_name_lookup", func(t *testing.T) {
		tc := newRealmNameLookupTestContext(t)

		// Given
		tc.a_realm_name_lookup_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("realm_name_lookup")
	})

	t.Run("handles RealmCreated by putting name to realm_id mapping", func(t *testing.T) {
		tc := newRealmNameLookupTestContext(t)

		// Given
		tc.a_realm_name_lookup_projector()
		tc.a_store()
		tc.a_realm_created_event("realm-123", "my-realm")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.lookup_entry_exists("my-realm")
		tc.lookup_entry_has_realm_id("my-realm", "realm-123")
		tc.lookup_entry_has_name("my-realm", "my-realm")
	})

	t.Run("RealmCreated is idempotent - duplicate name not overwritten", func(t *testing.T) {
		tc := newRealmNameLookupTestContext(t)

		// Given
		tc.a_realm_name_lookup_projector()
		tc.a_store()
		tc.existing_lookup_entry("my-realm", "realm-original")
		tc.a_realm_created_event("realm-new", "my-realm")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.lookup_entry_has_realm_id("my-realm", "realm-original")
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newRealmNameLookupTestContext(t)

		// Given
		tc.a_realm_name_lookup_projector()
		tc.a_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})
}

// --- Test Context ---

type realmNameLookupTestContext struct {
	t           *testing.T
	projector   *RealmNameLookupProjector
	store       *mockProjectionStore
	event       core.Event
	ctx         context.Context
	nameResult  string
	tableNameRes string
	err         error
}

func newRealmNameLookupTestContext(t *testing.T) *realmNameLookupTestContext {
	t.Helper()
	return &realmNameLookupTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *realmNameLookupTestContext) a_realm_name_lookup_projector() {
	tc.t.Helper()
	tc.projector = NewRealmNameLookupProjector()
}

func (tc *realmNameLookupTestContext) a_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *realmNameLookupTestContext) a_realm_created_event(realmID, name string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRealmCreated, domain.RealmCreated{
		RealmID:   realmID,
		Name:      name,
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	})
}

func (tc *realmNameLookupTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *realmNameLookupTestContext) existing_lookup_entry(name, realmID string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := RealmNameLookupEntry{
		Name:    name,
		RealmID: realmID,
	}
	tc.store.put("_admin", "realm_name_lookup", name, entry)
}

// --- When ---

func (tc *realmNameLookupTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *realmNameLookupTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameRes = tc.projector.TableName()
}

func (tc *realmNameLookupTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *realmNameLookupTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *realmNameLookupTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameRes)
}

func (tc *realmNameLookupTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *realmNameLookupTestContext) lookup_entry_exists(name string) {
	tc.t.Helper()
	var entry RealmNameLookupEntry
	err := tc.store.Get(tc.ctx, "_admin", "realm_name_lookup", name, &entry)
	require.NoError(tc.t, err, "expected lookup entry for name %s", name)
}

func (tc *realmNameLookupTestContext) lookup_entry_has_realm_id(name, expected string) {
	tc.t.Helper()
	var entry RealmNameLookupEntry
	err := tc.store.Get(tc.ctx, "_admin", "realm_name_lookup", name, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.RealmID)
}

func (tc *realmNameLookupTestContext) lookup_entry_has_name(name, expected string) {
	tc.t.Helper()
	var entry RealmNameLookupEntry
	err := tc.store.Get(tc.ctx, "_admin", "realm_name_lookup", name, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Name)
}
