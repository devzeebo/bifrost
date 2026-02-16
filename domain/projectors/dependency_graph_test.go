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

func TestDependencyGraphProjector(t *testing.T) {
	t.Run("Name returns dependency_graph", func(t *testing.T) {
		tc := newDepGraphTestContext(t)

		// Given
		tc.a_dependency_graph_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("dependency_graph")
	})

	t.Run("handles DependencyAdded creates source entry with dependency", func(t *testing.T) {
		tc := newDepGraphTestContext(t)

		// Given
		tc.a_dependency_graph_projector()
		tc.a_projection_store()
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.source_entry_exists("bf-a1b2")
		tc.source_has_dependency("bf-a1b2", "bf-c3d4", "blocks")
	})

	t.Run("handles DependencyAdded creates target entry with dependent", func(t *testing.T) {
		tc := newDepGraphTestContext(t)

		// Given
		tc.a_dependency_graph_projector()
		tc.a_projection_store()
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.target_entry_exists("bf-c3d4")
		tc.target_has_dependent("bf-c3d4", "bf-a1b2", "blocks")
	})

	t.Run("handles DependencyAdded appends to existing source entry", func(t *testing.T) {
		tc := newDepGraphTestContext(t)

		// Given
		tc.a_dependency_graph_projector()
		tc.a_projection_store()
		tc.existing_graph_entry_with_dependency("bf-a1b2", "bf-c3d4", "blocks")
		tc.a_dependency_added_event("bf-a1b2", "bf-e5f6", "relates_to")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.source_has_dependency_count("bf-a1b2", 2)
		tc.source_has_dependency("bf-a1b2", "bf-c3d4", "blocks")
		tc.source_has_dependency("bf-a1b2", "bf-e5f6", "relates_to")
	})

	t.Run("handles DependencyAdded appends to existing target entry", func(t *testing.T) {
		tc := newDepGraphTestContext(t)

		// Given
		tc.a_dependency_graph_projector()
		tc.a_projection_store()
		tc.existing_graph_entry_with_dependent("bf-c3d4", "bf-a1b2", "blocks")
		tc.a_dependency_added_event("bf-e5f6", "bf-c3d4", "relates_to")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.target_has_dependent_count("bf-c3d4", 2)
		tc.target_has_dependent("bf-c3d4", "bf-a1b2", "blocks")
		tc.target_has_dependent("bf-c3d4", "bf-e5f6", "relates_to")
	})

	t.Run("handles DependencyRemoved removes from source entry", func(t *testing.T) {
		tc := newDepGraphTestContext(t)

		// Given
		tc.a_dependency_graph_projector()
		tc.a_projection_store()
		tc.existing_graph_entry_with_dependency("bf-a1b2", "bf-c3d4", "blocks")
		tc.a_dependency_removed_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.source_has_dependency_count("bf-a1b2", 0)
	})

	t.Run("handles DependencyRemoved removes from target entry", func(t *testing.T) {
		tc := newDepGraphTestContext(t)

		// Given
		tc.a_dependency_graph_projector()
		tc.a_projection_store()
		tc.existing_graph_entry_with_dependent("bf-c3d4", "bf-a1b2", "blocks")
		tc.a_dependency_removed_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.target_has_dependent_count("bf-c3d4", 0)
	})

	t.Run("handles DependencyAdded stores dep lookup key", func(t *testing.T) {
		tc := newDepGraphTestContext(t)

		// Given
		tc.a_dependency_graph_projector()
		tc.a_projection_store()
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.dep_lookup_exists("bf-a1b2", "bf-c3d4", "blocks")
	})

	t.Run("handles DependencyRemoved removes dep lookup key", func(t *testing.T) {
		tc := newDepGraphTestContext(t)

		// Given
		tc.a_dependency_graph_projector()
		tc.a_projection_store()
		tc.existing_graph_entry_with_dependency("bf-a1b2", "bf-c3d4", "blocks")
		tc.existing_graph_entry_with_dependent("bf-c3d4", "bf-a1b2", "blocks")
		tc.existing_dep_lookup("bf-a1b2", "bf-c3d4", "blocks")
		tc.a_dependency_removed_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.dep_lookup_does_not_exist("bf-a1b2", "bf-c3d4", "blocks")
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newDepGraphTestContext(t)

		// Given
		tc.a_dependency_graph_projector()
		tc.a_projection_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("skips inverse event in handleAdded", func(t *testing.T) {
		tc := newDepGraphTestContext(t)

		// Given
		tc.a_dependency_graph_projector()
		tc.a_projection_store()
		tc.an_inverse_dependency_added_event("bf-a1b2", "bf-c3d4", "blocked_by")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.no_entry_exists("bf-a1b2")
		tc.no_entry_exists("bf-c3d4")
	})

	t.Run("skips inverse relates_to event in handleAdded", func(t *testing.T) {
		tc := newDepGraphTestContext(t)

		// Given
		tc.a_dependency_graph_projector()
		tc.a_projection_store()
		tc.an_inverse_dependency_added_event("bf-a1b2", "bf-c3d4", "relates_to")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.no_entry_exists("bf-a1b2")
		tc.no_entry_exists("bf-c3d4")
	})

	t.Run("skips inverse event in handleRemoved", func(t *testing.T) {
		tc := newDepGraphTestContext(t)

		// Given
		tc.a_dependency_graph_projector()
		tc.a_projection_store()
		tc.existing_graph_entry_with_dependency("bf-a1b2", "bf-c3d4", "blocks")
		tc.existing_graph_entry_with_dependent("bf-c3d4", "bf-a1b2", "blocks")
		tc.an_inverse_dependency_removed_event("bf-a1b2", "bf-c3d4", "blocked_by")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.source_has_dependency_count("bf-a1b2", 1)
		tc.target_has_dependent_count("bf-c3d4", 1)
	})

	t.Run("processes forward relates_to event normally", func(t *testing.T) {
		tc := newDepGraphTestContext(t)

		// Given
		tc.a_dependency_graph_projector()
		tc.a_projection_store()
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "relates_to")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.source_entry_exists("bf-a1b2")
		tc.source_has_dependency("bf-a1b2", "bf-c3d4", "relates_to")
		tc.target_entry_exists("bf-c3d4")
		tc.target_has_dependent("bf-c3d4", "bf-a1b2", "relates_to")
	})
}

// --- Test Context ---

type depGraphTestContext struct {
	t *testing.T

	projector  *DependencyGraphProjector
	store      *mockProjectionStore
	event      core.Event
	ctx        context.Context
	realmID    string
	nameResult string
	err        error
}

func newDepGraphTestContext(t *testing.T) *depGraphTestContext {
	t.Helper()
	return &depGraphTestContext{
		t:       t,
		ctx:     context.Background(),
		realmID: "realm-1",
	}
}

// --- Given ---

func (tc *depGraphTestContext) a_dependency_graph_projector() {
	tc.t.Helper()
	tc.projector = NewDependencyGraphProjector()
}

func (tc *depGraphTestContext) a_projection_store() {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
}

func (tc *depGraphTestContext) a_dependency_added_event(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyAdded, domain.DependencyAdded{
		RuneID: runeID, TargetID: targetID, Relationship: relationship,
	})
}

func (tc *depGraphTestContext) a_dependency_removed_event(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyRemoved, domain.DependencyRemoved{
		RuneID: runeID, TargetID: targetID, Relationship: relationship,
	})
}

func (tc *depGraphTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *depGraphTestContext) an_inverse_dependency_added_event(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyAdded, domain.DependencyAdded{
		RuneID: runeID, TargetID: targetID, Relationship: relationship, IsInverse: true,
	})
}

func (tc *depGraphTestContext) an_inverse_dependency_removed_event(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyRemoved, domain.DependencyRemoved{
		RuneID: runeID, TargetID: targetID, Relationship: relationship, IsInverse: true,
	})
}

func (tc *depGraphTestContext) existing_graph_entry_with_dependency(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.a_projection_store()
	entry := GraphEntry{
		RuneID: runeID,
		Dependencies: []GraphDependency{
			{TargetID: targetID, Relationship: relationship},
		},
		Dependents: []GraphDependent{},
	}
	tc.store.put(tc.realmID, "dependency_graph", runeID, entry)
}

func (tc *depGraphTestContext) existing_graph_entry_with_dependent(runeID, sourceID, relationship string) {
	tc.t.Helper()
	tc.a_projection_store()
	entry := GraphEntry{
		RuneID:       runeID,
		Dependencies: []GraphDependency{},
		Dependents: []GraphDependent{
			{SourceID: sourceID, Relationship: relationship},
		},
	}
	tc.store.put(tc.realmID, "dependency_graph", runeID, entry)
}

func (tc *depGraphTestContext) existing_dep_lookup(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.a_projection_store()
	key := "dep:" + runeID + ":" + targetID + ":" + relationship
	tc.store.put(tc.realmID, "dependency_graph", key, true)
}

// --- When ---

func (tc *depGraphTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *depGraphTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *depGraphTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *depGraphTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *depGraphTestContext) source_entry_exists(runeID string) {
	tc.t.Helper()
	var entry GraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "dependency_graph", runeID, &entry)
	require.NoError(tc.t, err, "expected graph entry for %s", runeID)
	assert.Equal(tc.t, runeID, entry.RuneID)
}

func (tc *depGraphTestContext) target_entry_exists(runeID string) {
	tc.t.Helper()
	var entry GraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "dependency_graph", runeID, &entry)
	require.NoError(tc.t, err, "expected graph entry for %s", runeID)
	assert.Equal(tc.t, runeID, entry.RuneID)
}

func (tc *depGraphTestContext) source_has_dependency(runeID, targetID, relationship string) {
	tc.t.Helper()
	var entry GraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "dependency_graph", runeID, &entry)
	require.NoError(tc.t, err)
	found := false
	for _, dep := range entry.Dependencies {
		if dep.TargetID == targetID && dep.Relationship == relationship {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected dependency {%s, %s} in source %s", targetID, relationship, runeID)
}

func (tc *depGraphTestContext) target_has_dependent(runeID, sourceID, relationship string) {
	tc.t.Helper()
	var entry GraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "dependency_graph", runeID, &entry)
	require.NoError(tc.t, err)
	found := false
	for _, dep := range entry.Dependents {
		if dep.SourceID == sourceID && dep.Relationship == relationship {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected dependent {%s, %s} in target %s", sourceID, relationship, runeID)
}

func (tc *depGraphTestContext) source_has_dependency_count(runeID string, expected int) {
	tc.t.Helper()
	var entry GraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "dependency_graph", runeID, &entry)
	require.NoError(tc.t, err)
	assert.Len(tc.t, entry.Dependencies, expected)
}

func (tc *depGraphTestContext) target_has_dependent_count(runeID string, expected int) {
	tc.t.Helper()
	var entry GraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "dependency_graph", runeID, &entry)
	require.NoError(tc.t, err)
	assert.Len(tc.t, entry.Dependents, expected)
}

func (tc *depGraphTestContext) dep_lookup_exists(runeID, targetID, relationship string) {
	tc.t.Helper()
	key := "dep:" + runeID + ":" + targetID + ":" + relationship
	var exists bool
	err := tc.store.Get(tc.ctx, tc.realmID, "dependency_graph", key, &exists)
	assert.NoError(tc.t, err, "expected dep lookup key to exist")
	assert.True(tc.t, exists)
}

func (tc *depGraphTestContext) no_entry_exists(runeID string) {
	tc.t.Helper()
	var entry GraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "dependency_graph", runeID, &entry)
	assert.Error(tc.t, err, "expected no graph entry for %s", runeID)
}

func (tc *depGraphTestContext) dep_lookup_does_not_exist(runeID, targetID, relationship string) {
	tc.t.Helper()
	key := "dep:" + runeID + ":" + targetID + ":" + relationship
	var exists bool
	err := tc.store.Get(tc.ctx, tc.realmID, "dependency_graph", key, &exists)
	if err == nil {
		assert.False(tc.t, exists, "expected dep lookup key to not exist")
	}
	// NotFoundError is also acceptable — means it was deleted
}

