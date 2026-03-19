package projectors

import (
	"context"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Compile-time interface satisfaction check
var _ core.Projector = (*RuneChildCountProjector)(nil)

// --- Tests ---

func TestRuneChildCountProjector(t *testing.T) {
	t.Run("Name returns rune_child_count", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given
		tc.a_rune_child_count_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("rune_child_count")
	})

	t.Run("TableName returns rune_child_count", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given
		tc.a_rune_child_count_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("rune_child_count")
	})

	t.Run("RuneCreated with ParentID creates entry with count 1", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given
		tc.a_rune_child_count_projector()
		tc.a_store()
		tc.a_rune_created_event_with_parent("bf-a1b2.1", "bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_exists_for_parent("bf-a1b2")
		tc.count_is("bf-a1b2", 1)
	})

	t.Run("RuneCreated without ParentID is ignored", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given
		tc.a_rune_child_count_projector()
		tc.a_store()
		tc.a_rune_created_event_without_parent("bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.no_entry_stored()
	})

	t.Run("ignores non-RuneCreated events", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given
		tc.a_rune_child_count_projector()
		tc.a_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.no_entry_stored()
	})

	t.Run("second child increments count to 2", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given
		tc.a_rune_child_count_projector()
		tc.a_store()
		tc.existing_entry_with_count("bf-a1b2", 1)
		tc.a_rune_created_event_with_parent("bf-a1b2.2", "bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.count_is("bf-a1b2", 2)
	})

	t.Run("idempotency - same child ID replayed does not increment count", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given: parent already has count 1 from child bf-a1b2.1
		tc.a_rune_child_count_projector()
		tc.a_store()
		tc.existing_entry_with_count("bf-a1b2", 1)
		// Replay the same event (sequence number 1, count is already 1)
		tc.a_rune_created_event_with_parent("bf-a1b2.1", "bf-a1b2")

		// When
		tc.handle_is_called()

		// Then: count stays at 1 (1 < 1 is false, so no increment)
		tc.no_error()
		tc.count_is("bf-a1b2", 1)
	})

	t.Run("idempotency - child with sequence 3 when count is 1 increments to 3", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given: parent has count 1, but child.3 event arrives (maybe out of order replay)
		tc.a_rune_child_count_projector()
		tc.a_store()
		tc.existing_entry_with_count("bf-a1b2", 1)
		tc.a_rune_created_event_with_parent("bf-a1b2.3", "bf-a1b2")

		// When
		tc.handle_is_called()

		// Then: count becomes 3 (1 < 3, so increment to 3)
		tc.no_error()
		tc.count_is("bf-a1b2", 3)
	})

	t.Run("idempotency - child with sequence 2 when count is 3 does not increment", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given: parent already has count 3, child.2 arrives late
		tc.a_rune_child_count_projector()
		tc.a_store()
		tc.existing_entry_with_count("bf-a1b2", 3)
		tc.a_rune_created_event_with_parent("bf-a1b2.2", "bf-a1b2")

		// When
		tc.handle_is_called()

		// Then: count stays at 3 (3 < 2 is false)
		tc.no_error()
		tc.count_is("bf-a1b2", 3)
	})

	t.Run("entry contains parent_rune_id and count", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given
		tc.a_rune_child_count_projector()
		tc.a_store()
		tc.a_rune_created_event_with_parent("bf-a1b2.1", "bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_has_parent_rune_id("bf-a1b2", "bf-a1b2")
	})

	t.Run("no auxiliary keys are stored", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given
		tc.a_rune_child_count_projector()
		tc.a_store()
		tc.a_rune_created_event_with_parent("bf-a1b2.1", "bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.no_auxiliary_keys()
	})
}

// --- Test Context ---

type runeChildCountTestContext struct {
	t *testing.T

	projector      *RuneChildCountProjector
	store          *mockProjectionStore
	event          core.Event
	ctx            context.Context
	realmID        string
	nameResult     string
	tableNameRes   string
	err            error
}

func newRuneChildCountTestContext(t *testing.T) *runeChildCountTestContext {
	t.Helper()
	return &runeChildCountTestContext{
		t:       t,
		ctx:     context.Background(),
		realmID: "realm-1",
	}
}

// --- Given ---

func (tc *runeChildCountTestContext) a_rune_child_count_projector() {
	tc.t.Helper()
	tc.projector = NewRuneChildCountProjector()
}

func (tc *runeChildCountTestContext) a_store() {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
}

func (tc *runeChildCountTestContext) a_rune_created_event_with_parent(id, parentID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneCreated, domain.RuneCreated{
		ID: id, Title: "Child task", Priority: 2, ParentID: parentID,
	})
}

func (tc *runeChildCountTestContext) a_rune_created_event_without_parent(id string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneCreated, domain.RuneCreated{
		ID: id, Title: "Top-level task", Priority: 1,
	})
}

func (tc *runeChildCountTestContext) existing_entry_with_count(parentID string, count int) {
	tc.t.Helper()
	tc.a_store()
	entry := RuneChildCountEntry{
		ParentRuneID: parentID,
		Count:        count,
	}
	tc.store.put(tc.realmID, "rune_child_count", parentID, entry)
}

func (tc *runeChildCountTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

// --- When ---

func (tc *runeChildCountTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *runeChildCountTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameRes = tc.projector.TableName()
}

func (tc *runeChildCountTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *runeChildCountTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *runeChildCountTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameRes)
}

func (tc *runeChildCountTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *runeChildCountTestContext) entry_exists_for_parent(parentID string) {
	tc.t.Helper()
	var entry RuneChildCountEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "rune_child_count", parentID, &entry)
	require.NoError(tc.t, err, "expected entry for parent %s", parentID)
}

func (tc *runeChildCountTestContext) count_is(parentID string, expected int) {
	tc.t.Helper()
	var entry RuneChildCountEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "rune_child_count", parentID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Count)
}

func (tc *runeChildCountTestContext) entry_has_parent_rune_id(parentID, expected string) {
	tc.t.Helper()
	var entry RuneChildCountEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "rune_child_count", parentID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.ParentRuneID)
}

func (tc *runeChildCountTestContext) no_entry_stored() {
	tc.t.Helper()
	for key := range tc.store.data {
		assert.NotContains(tc.t, key, "rune_child_count", "expected no rune_child_count entries in store")
	}
}

func (tc *runeChildCountTestContext) no_auxiliary_keys() {
	tc.t.Helper()
	for key := range tc.store.data {
		assert.NotContains(tc.t, key, "child_counted:", "expected no child_counted: auxiliary keys in store")
	}
}
