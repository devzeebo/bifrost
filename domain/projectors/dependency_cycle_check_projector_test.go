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

func TestDependencyCycleCheckProjector(t *testing.T) {
	t.Run("Name returns dependency_cycle_check", func(t *testing.T) {
		tc := newDepCycleCheckTestContext(t)

		// Given
		tc.a_dependency_cycle_check_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("dependency_cycle_check")
	})

	t.Run("TableName returns dependency_cycle_check", func(t *testing.T) {
		tc := newDepCycleCheckTestContext(t)

		// Given
		tc.a_dependency_cycle_check_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("dependency_cycle_check")
	})

	// --- DependencyAdded ---

	t.Run("DependencyAdded inserts row with correct key", func(t *testing.T) {
		tc := newDepCycleCheckTestContext(t)

		// Given
		tc.a_dependency_cycle_check_projector()
		tc.a_store()
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.row_exists("bf-a1b2", "bf-c3d4")
	})

	t.Run("DependencyAdded stores correct document", func(t *testing.T) {
		tc := newDepCycleCheckTestContext(t)

		// Given
		tc.a_dependency_cycle_check_projector()
		tc.a_store()
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.row_has_document("bf-a1b2", "bf-c3d4")
	})

	t.Run("DependencyAdded is idempotent for duplicate", func(t *testing.T) {
		tc := newDepCycleCheckTestContext(t)

		// Given
		tc.a_dependency_cycle_check_projector()
		tc.a_store()
		tc.an_existing_row("bf-a1b2", "bf-c3d4")
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.row_exists("bf-a1b2", "bf-c3d4")
	})

	t.Run("DependencyAdded skips inverse events", func(t *testing.T) {
		tc := newDepCycleCheckTestContext(t)

		// Given
		tc.a_dependency_cycle_check_projector()
		tc.a_store()
		tc.an_inverse_dependency_added_event("bf-a1b2", "bf-c3d4", "blocked_by")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.no_row_exists("bf-a1b2", "bf-c3d4")
	})

	t.Run("DependencyAdded handles multiple different edges", func(t *testing.T) {
		tc := newDepCycleCheckTestContext(t)

		// Given
		tc.a_dependency_cycle_check_projector()
		tc.a_store()
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")
		tc.handle_is_called()
		tc.a_dependency_added_event("bf-e5f6", "bf-g7h8", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.row_exists("bf-a1b2", "bf-c3d4")
		tc.row_exists("bf-e5f6", "bf-g7h8")
	})

	// --- DependencyRemoved ---

	t.Run("DependencyRemoved deletes row", func(t *testing.T) {
		tc := newDepCycleCheckTestContext(t)

		// Given
		tc.a_dependency_cycle_check_projector()
		tc.a_store()
		tc.an_existing_row("bf-a1b2", "bf-c3d4")
		tc.a_dependency_removed_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.no_row_exists("bf-a1b2", "bf-c3d4")
	})

	t.Run("DependencyRemoved handles missing row gracefully", func(t *testing.T) {
		tc := newDepCycleCheckTestContext(t)

		// Given
		tc.a_dependency_cycle_check_projector()
		tc.a_store()
		tc.a_dependency_removed_event("bf-nonexistent", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("DependencyRemoved skips inverse events", func(t *testing.T) {
		tc := newDepCycleCheckTestContext(t)

		// Given
		tc.a_dependency_cycle_check_projector()
		tc.a_store()
		tc.an_existing_row("bf-a1b2", "bf-c3d4")
		tc.an_inverse_dependency_removed_event("bf-a1b2", "bf-c3d4", "blocked_by")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.row_exists("bf-a1b2", "bf-c3d4")
	})

	// --- Unknown events ---

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newDepCycleCheckTestContext(t)

		// Given
		tc.a_dependency_cycle_check_projector()
		tc.a_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})
}

// --- Test Context ---

type depCycleCheckTestContext struct {
	t            *testing.T
	projector    *DependencyCycleCheckProjector
	store        *mockProjectionStore
	event        core.Event
	ctx          context.Context
	realmID      string
	nameResult   string
	tableNameRes string
	err          error
}

func newDepCycleCheckTestContext(t *testing.T) *depCycleCheckTestContext {
	t.Helper()
	return &depCycleCheckTestContext{
		t:       t,
		ctx:     context.Background(),
		realmID: "realm-1",
	}
}

// --- Given ---

func (tc *depCycleCheckTestContext) a_dependency_cycle_check_projector() {
	tc.t.Helper()
	tc.projector = NewDependencyCycleCheckProjector()
}

func (tc *depCycleCheckTestContext) a_store() {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
}

func (tc *depCycleCheckTestContext) a_dependency_added_event(sourceID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyAdded, domain.DependencyAdded{
		RuneID: sourceID, TargetID: targetID, Relationship: relationship,
	})
}

func (tc *depCycleCheckTestContext) a_dependency_removed_event(sourceID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyRemoved, domain.DependencyRemoved{
		RuneID: sourceID, TargetID: targetID, Relationship: relationship,
	})
}

func (tc *depCycleCheckTestContext) an_inverse_dependency_added_event(sourceID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyAdded, domain.DependencyAdded{
		RuneID: sourceID, TargetID: targetID, Relationship: relationship, IsInverse: true,
	})
}

func (tc *depCycleCheckTestContext) an_inverse_dependency_removed_event(sourceID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyRemoved, domain.DependencyRemoved{
		RuneID: sourceID, TargetID: targetID, Relationship: relationship, IsInverse: true,
	})
}

func (tc *depCycleCheckTestContext) an_existing_row(sourceID, targetID string) {
	tc.t.Helper()
	key := sourceID + ":" + targetID
	doc := DependencyCycleCheckDoc{
		SourceID: sourceID,
		TargetID: targetID,
	}
	tc.store.put(tc.realmID, tc.projector.TableName(), key, doc)
}

func (tc *depCycleCheckTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = makeEvent("UnknownEvent", struct{}{})
}

// --- When ---

func (tc *depCycleCheckTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *depCycleCheckTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameRes = tc.projector.TableName()
}

func (tc *depCycleCheckTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *depCycleCheckTestContext) no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

func (tc *depCycleCheckTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *depCycleCheckTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameRes)
}

func (tc *depCycleCheckTestContext) row_exists(sourceID, targetID string) {
	tc.t.Helper()
	key := sourceID + ":" + targetID
	var doc DependencyCycleCheckDoc
	err := tc.store.Get(tc.ctx, tc.realmID, tc.projector.TableName(), key, &doc)
	require.NoError(tc.t, err, "row should exist")
	assert.Equal(tc.t, sourceID, doc.SourceID)
	assert.Equal(tc.t, targetID, doc.TargetID)
}

func (tc *depCycleCheckTestContext) row_has_document(sourceID, targetID string) {
	tc.t.Helper()
	key := sourceID + ":" + targetID
	var doc DependencyCycleCheckDoc
	err := tc.store.Get(tc.ctx, tc.realmID, tc.projector.TableName(), key, &doc)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, sourceID, doc.SourceID)
	assert.Equal(tc.t, targetID, doc.TargetID)
}

func (tc *depCycleCheckTestContext) no_row_exists(sourceID, targetID string) {
	tc.t.Helper()
	key := sourceID + ":" + targetID
	var doc DependencyCycleCheckDoc
	err := tc.store.Get(tc.ctx, tc.realmID, tc.projector.TableName(), key, &doc)
	assert.Error(tc.t, err, "row should not exist")
}
