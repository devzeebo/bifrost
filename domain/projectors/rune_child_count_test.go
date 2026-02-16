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
	t.Run("Name returns RuneChildCount", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given
		tc.a_rune_child_count_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("RuneChildCount")
	})

	t.Run("increments count when child rune is created", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given
		tc.a_rune_child_count_projector()
		tc.a_projection_store()
		tc.a_rune_created_event_with_parent("bf-a1b2.1", "bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.child_count_for_parent_is("bf-a1b2", 1)
	})

	t.Run("increments count for second child", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given
		tc.a_rune_child_count_projector()
		tc.a_projection_store()
		tc.existing_child_count("bf-a1b2", 1)
		tc.a_rune_created_event_with_parent("bf-a1b2.2", "bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.child_count_for_parent_is("bf-a1b2", 2)
	})

	t.Run("does not store count for top-level rune", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given
		tc.a_rune_child_count_projector()
		tc.a_projection_store()
		tc.a_rune_created_event_without_parent("bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.no_child_count_stored()
	})

	t.Run("ignores non-RuneCreated events", func(t *testing.T) {
		tc := newRuneChildCountTestContext(t)

		// Given
		tc.a_rune_child_count_projector()
		tc.a_projection_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.no_child_count_stored()
	})
}

// --- Test Context ---

type runeChildCountTestContext struct {
	t *testing.T

	projector  *RuneChildCountProjector
	store      *mockProjectionStore
	event      core.Event
	ctx        context.Context
	realmID    string
	nameResult string
	err        error
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

func (tc *runeChildCountTestContext) a_projection_store() {
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

func (tc *runeChildCountTestContext) existing_child_count(parentID string, count int) {
	tc.t.Helper()
	tc.a_projection_store()
	tc.store.put(tc.realmID, "RuneChildCount", parentID, count)
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

func (tc *runeChildCountTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *runeChildCountTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *runeChildCountTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *runeChildCountTestContext) child_count_for_parent_is(parentID string, expected int) {
	tc.t.Helper()
	var count int
	err := tc.store.Get(tc.ctx, tc.realmID, "RuneChildCount", parentID, &count)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, count)
}

func (tc *runeChildCountTestContext) no_child_count_stored() {
	tc.t.Helper()
	for key := range tc.store.data {
		assert.NotContains(tc.t, key, "RuneChildCount", "expected no RuneChildCount entries in store")
	}
}
