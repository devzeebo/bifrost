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

func TestDependencyExistenceProjector(t *testing.T) {
	t.Run("Name returns dependency_existence", func(t *testing.T) {
		tc := newDepExistenceTestContext(t)

		// Given
		tc.a_dependency_existence_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("dependency_existence")
	})

	t.Run("TableName returns projection_dependency_existence", func(t *testing.T) {
		tc := newDepExistenceTestContext(t)

		// Given
		tc.a_dependency_existence_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("projection_dependency_existence")
	})

	// --- DependencyAdded ---

	t.Run("DependencyAdded inserts row with correct key", func(t *testing.T) {
		tc := newDepExistenceTestContext(t)

		// Given
		tc.a_dependency_existence_projector()
		tc.a_projection_store()
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.row_exists("bf-a1b2", "bf-c3d4", "blocks")
	})

	t.Run("DependencyAdded stores correct document", func(t *testing.T) {
		tc := newDepExistenceTestContext(t)

		// Given
		tc.a_dependency_existence_projector()
		tc.a_projection_store()
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.row_has_document("bf-a1b2", "bf-c3d4", "blocks")
	})

	t.Run("DependencyAdded is idempotent for duplicate", func(t *testing.T) {
		tc := newDepExistenceTestContext(t)

		// Given
		tc.a_dependency_existence_projector()
		tc.a_projection_store()
		tc.an_existing_row("bf-a1b2", "bf-c3d4", "blocks")
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.row_exists("bf-a1b2", "bf-c3d4", "blocks")
	})

	t.Run("DependencyAdded skips inverse events", func(t *testing.T) {
		tc := newDepExistenceTestContext(t)

		// Given
		tc.a_dependency_existence_projector()
		tc.a_projection_store()
		tc.an_inverse_dependency_added_event("bf-a1b2", "bf-c3d4", "blocked_by")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.no_row_exists("bf-a1b2", "bf-c3d4", "blocked_by")
	})

	t.Run("DependencyAdded handles multiple different dependencies", func(t *testing.T) {
		tc := newDepExistenceTestContext(t)

		// Given
		tc.a_dependency_existence_projector()
		tc.a_projection_store()
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")
		tc.handle_is_called()
		tc.a_dependency_added_event("bf-a1b2", "bf-e5f6", "relates_to")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.row_exists("bf-a1b2", "bf-c3d4", "blocks")
		tc.row_exists("bf-a1b2", "bf-e5f6", "relates_to")
	})

	// --- DependencyRemoved ---

	t.Run("DependencyRemoved deletes row", func(t *testing.T) {
		tc := newDepExistenceTestContext(t)

		// Given
		tc.a_dependency_existence_projector()
		tc.a_projection_store()
		tc.an_existing_row("bf-a1b2", "bf-c3d4", "blocks")
		tc.a_dependency_removed_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.no_row_exists("bf-a1b2", "bf-c3d4", "blocks")
	})

	t.Run("DependencyRemoved handles missing row gracefully", func(t *testing.T) {
		tc := newDepExistenceTestContext(t)

		// Given
		tc.a_dependency_existence_projector()
		tc.a_projection_store()
		tc.a_dependency_removed_event("bf-nonexistent", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("DependencyRemoved skips inverse events", func(t *testing.T) {
		tc := newDepExistenceTestContext(t)

		// Given
		tc.a_dependency_existence_projector()
		tc.a_projection_store()
		tc.an_existing_row("bf-a1b2", "bf-c3d4", "blocks")
		tc.an_inverse_dependency_removed_event("bf-a1b2", "bf-c3d4", "blocked_by")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.row_exists("bf-a1b2", "bf-c3d4", "blocks")
	})

	// --- Unknown events ---

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newDepExistenceTestContext(t)

		// Given
		tc.a_dependency_existence_projector()
		tc.a_projection_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})
}

// --- Test Context ---

type depExistenceTestContext struct {
	t *testing.T

	projector    *DependencyExistenceProjector
	store        *mockProjectionStore
	event        core.Event
	ctx          context.Context
	realmID      string
	nameResult   string
	tableNameRes string
	err          error
}

func newDepExistenceTestContext(t *testing.T) *depExistenceTestContext {
	t.Helper()
	return &depExistenceTestContext{
		t:       t,
		ctx:     context.Background(),
		realmID: "realm-1",
	}
}

// --- Given ---

func (tc *depExistenceTestContext) a_dependency_existence_projector() {
	tc.t.Helper()
	tc.projector = NewDependencyExistenceProjector()
}

func (tc *depExistenceTestContext) a_projection_store() {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
}

func (tc *depExistenceTestContext) a_dependency_added_event(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyAdded, domain.DependencyAdded{
		RuneID: runeID, TargetID: targetID, Relationship: relationship,
	})
}

func (tc *depExistenceTestContext) a_dependency_removed_event(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyRemoved, domain.DependencyRemoved{
		RuneID: runeID, TargetID: targetID, Relationship: relationship,
	})
}

func (tc *depExistenceTestContext) an_inverse_dependency_added_event(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyAdded, domain.DependencyAdded{
		RuneID: runeID, TargetID: targetID, Relationship: relationship, IsInverse: true,
	})
}

func (tc *depExistenceTestContext) an_inverse_dependency_removed_event(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyRemoved, domain.DependencyRemoved{
		RuneID: runeID, TargetID: targetID, Relationship: relationship, IsInverse: true,
	})
}

func (tc *depExistenceTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *depExistenceTestContext) an_existing_row(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.a_projection_store()
	key := runeID + ":" + targetID + ":" + relationship
	doc := DependencyExistenceDoc{
		RuneID:       runeID,
		TargetID:     targetID,
		Relationship: relationship,
	}
	tc.store.put(tc.realmID, "projection_dependency_existence", key, doc)
}

// --- When ---

func (tc *depExistenceTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *depExistenceTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameRes = tc.projector.TableName()
}

func (tc *depExistenceTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *depExistenceTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *depExistenceTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameRes)
}

func (tc *depExistenceTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *depExistenceTestContext) row_exists(runeID, targetID, relationship string) {
	tc.t.Helper()
	key := runeID + ":" + targetID + ":" + relationship
	var doc DependencyExistenceDoc
	err := tc.store.Get(tc.ctx, tc.realmID, "projection_dependency_existence", key, &doc)
	require.NoError(tc.t, err, "expected row to exist with key %s", key)
}

func (tc *depExistenceTestContext) no_row_exists(runeID, targetID, relationship string) {
	tc.t.Helper()
	key := runeID + ":" + targetID + ":" + relationship
	var doc DependencyExistenceDoc
	err := tc.store.Get(tc.ctx, tc.realmID, "projection_dependency_existence", key, &doc)
	assert.Error(tc.t, err, "expected no row with key %s", key)
}

func (tc *depExistenceTestContext) row_has_document(runeID, targetID, relationship string) {
	tc.t.Helper()
	key := runeID + ":" + targetID + ":" + relationship
	var doc DependencyExistenceDoc
	err := tc.store.Get(tc.ctx, tc.realmID, "projection_dependency_existence", key, &doc)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, runeID, doc.RuneID)
	assert.Equal(tc.t, targetID, doc.TargetID)
	assert.Equal(tc.t, relationship, doc.Relationship)
}
