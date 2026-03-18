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

func TestRuneDependencyGraphProjector(t *testing.T) {
	t.Run("Name returns rune_dependency_graph", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("rune_dependency_graph")
	})

	t.Run("TableName returns projection_rune_dependency_graph", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("projection_rune_dependency_graph")
	})

	// --- DependencyAdded ---

	t.Run("DependencyAdded creates source entry with dependency", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()
		tc.a_projection_store()
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.source_entry_exists("bf-a1b2")
		tc.source_has_dependency("bf-a1b2", "bf-c3d4", "blocks")
	})

	t.Run("DependencyAdded creates target entry with dependent", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()
		tc.a_projection_store()
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.target_entry_exists("bf-c3d4")
		tc.target_has_dependent("bf-c3d4", "bf-a1b2", "blocks")
	})

	t.Run("DependencyAdded appends to existing source entry", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()
		tc.a_projection_store()
		tc.existing_entry_with_dependency("bf-a1b2", "bf-c3d4", "blocks")
		tc.a_dependency_added_event("bf-a1b2", "bf-e5f6", "relates_to")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.source_has_dependency_count("bf-a1b2", 2)
		tc.source_has_dependency("bf-a1b2", "bf-c3d4", "blocks")
		tc.source_has_dependency("bf-a1b2", "bf-e5f6", "relates_to")
	})

	t.Run("DependencyAdded appends to existing target entry", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()
		tc.a_projection_store()
		tc.existing_entry_with_dependent("bf-c3d4", "bf-a1b2", "blocks")
		tc.a_dependency_added_event("bf-e5f6", "bf-c3d4", "relates_to")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.target_has_dependent_count("bf-c3d4", 2)
		tc.target_has_dependent("bf-c3d4", "bf-a1b2", "blocks")
		tc.target_has_dependent("bf-c3d4", "bf-e5f6", "relates_to")
	})

	t.Run("DependencyAdded is idempotent for duplicate dependency", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()
		tc.a_projection_store()
		tc.existing_entry_with_dependency("bf-a1b2", "bf-c3d4", "blocks")
		tc.existing_entry_with_dependent("bf-c3d4", "bf-a1b2", "blocks")
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.source_has_dependency_count("bf-a1b2", 1)
		tc.target_has_dependent_count("bf-c3d4", 1)
	})

	t.Run("DependencyAdded skips inverse events", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()
		tc.a_projection_store()
		tc.an_inverse_dependency_added_event("bf-a1b2", "bf-c3d4", "blocked_by")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.no_entry_exists("bf-a1b2")
		tc.no_entry_exists("bf-c3d4")
	})

	// --- DependencyRemoved ---

	t.Run("DependencyRemoved removes from source entry", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()
		tc.a_projection_store()
		tc.existing_entry_with_dependency("bf-a1b2", "bf-c3d4", "blocks")
		tc.a_dependency_removed_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.source_has_dependency_count("bf-a1b2", 0)
	})

	t.Run("DependencyRemoved removes from target entry", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()
		tc.a_projection_store()
		tc.existing_entry_with_dependent("bf-c3d4", "bf-a1b2", "blocks")
		tc.a_dependency_removed_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.target_has_dependent_count("bf-c3d4", 0)
	})

	t.Run("DependencyRemoved handles missing source entry gracefully", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()
		tc.a_projection_store()
		tc.a_dependency_removed_event("bf-nonexistent", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("DependencyRemoved skips inverse events", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()
		tc.a_projection_store()
		tc.existing_entry_with_dependency("bf-a1b2", "bf-c3d4", "blocks")
		tc.existing_entry_with_dependent("bf-c3d4", "bf-a1b2", "blocks")
		tc.an_inverse_dependency_removed_event("bf-a1b2", "bf-c3d4", "blocked_by")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.source_has_dependency_count("bf-a1b2", 1)
		tc.target_has_dependent_count("bf-c3d4", 1)
	})

	// --- RuneShattered ---

	t.Run("RuneShattered cleans up dependencies from targets", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()
		tc.a_projection_store()
		tc.a_full_dependency_graph("bf-a1b2", "bf-c3d4", "blocks", "bf-e5f6", "relates_to")
		tc.a_rune_shattered_event("bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.no_entry_exists("bf-a1b2")
		tc.target_has_no_dependent("bf-c3d4", "bf-a1b2")
		tc.target_has_no_dependent("bf-e5f6", "bf-a1b2")
	})

	t.Run("RuneShattered cleans up dependents from sources", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()
		tc.a_projection_store()
		tc.a_graph_where_rune_is_dependent("bf-a1b2", "bf-c3d4", "blocks")
		tc.a_rune_shattered_event("bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.no_entry_exists("bf-a1b2")
		tc.source_has_no_dependency("bf-c3d4", "bf-a1b2")
	})

	t.Run("RuneShattered handles missing entry gracefully", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()
		tc.a_projection_store()
		tc.a_rune_shattered_event("bf-nonexistent")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	// --- Unknown events ---

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newRuneDepGraphTestContext(t)

		// Given
		tc.a_rune_dependency_graph_projector()
		tc.a_projection_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})
}

// --- Test Context ---

type runeDepGraphTestContext struct {
	t *testing.T

	projector     *RuneDependencyGraphProjector
	store         *mockProjectionStore
	event         core.Event
	ctx           context.Context
	realmID       string
	nameResult    string
	tableNameRes  string
	err           error
}

func newRuneDepGraphTestContext(t *testing.T) *runeDepGraphTestContext {
	t.Helper()
	return &runeDepGraphTestContext{
		t:       t,
		ctx:     context.Background(),
		realmID: "realm-1",
	}
}

// --- Given ---

func (tc *runeDepGraphTestContext) a_rune_dependency_graph_projector() {
	tc.t.Helper()
	tc.projector = NewRuneDependencyGraphProjector()
}

func (tc *runeDepGraphTestContext) a_projection_store() {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
}

func (tc *runeDepGraphTestContext) a_dependency_added_event(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyAdded, domain.DependencyAdded{
		RuneID: runeID, TargetID: targetID, Relationship: relationship,
	})
}

func (tc *runeDepGraphTestContext) a_dependency_removed_event(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyRemoved, domain.DependencyRemoved{
		RuneID: runeID, TargetID: targetID, Relationship: relationship,
	})
}

func (tc *runeDepGraphTestContext) an_inverse_dependency_added_event(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyAdded, domain.DependencyAdded{
		RuneID: runeID, TargetID: targetID, Relationship: relationship, IsInverse: true,
	})
}

func (tc *runeDepGraphTestContext) an_inverse_dependency_removed_event(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyRemoved, domain.DependencyRemoved{
		RuneID: runeID, TargetID: targetID, Relationship: relationship, IsInverse: true,
	})
}

func (tc *runeDepGraphTestContext) a_rune_shattered_event(id string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneShattered, domain.RuneShattered{
		ID: id,
	})
}

func (tc *runeDepGraphTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *runeDepGraphTestContext) existing_entry_with_dependency(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.a_projection_store()
	entry := RuneDependencyGraphEntry{
		RuneID: runeID,
		Dependencies: []RuneDependencyGraphDependency{
			{TargetID: targetID, Relationship: relationship},
		},
		Dependents: []RuneDependencyGraphDependent{},
	}
	tc.store.put(tc.realmID, "projection_rune_dependency_graph", runeID, entry)
}

func (tc *runeDepGraphTestContext) existing_entry_with_dependent(runeID, sourceID, relationship string) {
	tc.t.Helper()
	tc.a_projection_store()
	entry := RuneDependencyGraphEntry{
		RuneID:       runeID,
		Dependencies: []RuneDependencyGraphDependency{},
		Dependents: []RuneDependencyGraphDependent{
			{SourceID: sourceID, Relationship: relationship},
		},
	}
	tc.store.put(tc.realmID, "projection_rune_dependency_graph", runeID, entry)
}

func (tc *runeDepGraphTestContext) a_full_dependency_graph(runeID, target1, rel1, target2, rel2 string) {
	tc.t.Helper()
	tc.a_projection_store()
	// Source rune has two dependencies
	sourceEntry := RuneDependencyGraphEntry{
		RuneID: runeID,
		Dependencies: []RuneDependencyGraphDependency{
			{TargetID: target1, Relationship: rel1},
			{TargetID: target2, Relationship: rel2},
		},
		Dependents: []RuneDependencyGraphDependent{},
	}
	tc.store.put(tc.realmID, "projection_rune_dependency_graph", runeID, sourceEntry)

	// Target1 has source as dependent
	target1Entry := RuneDependencyGraphEntry{
		RuneID:       target1,
		Dependencies: []RuneDependencyGraphDependency{},
		Dependents: []RuneDependencyGraphDependent{
			{SourceID: runeID, Relationship: rel1},
		},
	}
	tc.store.put(tc.realmID, "projection_rune_dependency_graph", target1, target1Entry)

	// Target2 has source as dependent
	target2Entry := RuneDependencyGraphEntry{
		RuneID:       target2,
		Dependencies: []RuneDependencyGraphDependency{},
		Dependents: []RuneDependencyGraphDependent{
			{SourceID: runeID, Relationship: rel2},
		},
	}
	tc.store.put(tc.realmID, "projection_rune_dependency_graph", target2, target2Entry)
}

func (tc *runeDepGraphTestContext) a_graph_where_rune_is_dependent(runeID, sourceID, relationship string) {
	tc.t.Helper()
	tc.a_projection_store()
	// runeID's entry has sourceID as a dependent (sourceID depends on runeID)
	runeEntry := RuneDependencyGraphEntry{
		RuneID:       runeID,
		Dependencies: []RuneDependencyGraphDependency{},
		Dependents: []RuneDependencyGraphDependent{
			{SourceID: sourceID, Relationship: relationship},
		},
	}
	tc.store.put(tc.realmID, "projection_rune_dependency_graph", runeID, runeEntry)

	// sourceID has runeID as a dependency
	sourceEntry := RuneDependencyGraphEntry{
		RuneID: sourceID,
		Dependencies: []RuneDependencyGraphDependency{
			{TargetID: runeID, Relationship: relationship},
		},
		Dependents: []RuneDependencyGraphDependent{},
	}
	tc.store.put(tc.realmID, "projection_rune_dependency_graph", sourceID, sourceEntry)
}

// --- When ---

func (tc *runeDepGraphTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *runeDepGraphTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameRes = tc.projector.TableName()
}

func (tc *runeDepGraphTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *runeDepGraphTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *runeDepGraphTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameRes)
}

func (tc *runeDepGraphTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *runeDepGraphTestContext) source_entry_exists(runeID string) {
	tc.t.Helper()
	var entry RuneDependencyGraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "projection_rune_dependency_graph", runeID, &entry)
	require.NoError(tc.t, err, "expected graph entry for %s", runeID)
	assert.Equal(tc.t, runeID, entry.RuneID)
}

func (tc *runeDepGraphTestContext) target_entry_exists(runeID string) {
	tc.t.Helper()
	var entry RuneDependencyGraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "projection_rune_dependency_graph", runeID, &entry)
	require.NoError(tc.t, err, "expected graph entry for %s", runeID)
	assert.Equal(tc.t, runeID, entry.RuneID)
}

func (tc *runeDepGraphTestContext) source_has_dependency(runeID, targetID, relationship string) {
	tc.t.Helper()
	var entry RuneDependencyGraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "projection_rune_dependency_graph", runeID, &entry)
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

func (tc *runeDepGraphTestContext) target_has_dependent(runeID, sourceID, relationship string) {
	tc.t.Helper()
	var entry RuneDependencyGraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "projection_rune_dependency_graph", runeID, &entry)
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

func (tc *runeDepGraphTestContext) source_has_dependency_count(runeID string, expected int) {
	tc.t.Helper()
	var entry RuneDependencyGraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "projection_rune_dependency_graph", runeID, &entry)
	require.NoError(tc.t, err)
	assert.Len(tc.t, entry.Dependencies, expected)
}

func (tc *runeDepGraphTestContext) target_has_dependent_count(runeID string, expected int) {
	tc.t.Helper()
	var entry RuneDependencyGraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "projection_rune_dependency_graph", runeID, &entry)
	require.NoError(tc.t, err)
	assert.Len(tc.t, entry.Dependents, expected)
}

func (tc *runeDepGraphTestContext) no_entry_exists(runeID string) {
	tc.t.Helper()
	var entry RuneDependencyGraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "projection_rune_dependency_graph", runeID, &entry)
	assert.Error(tc.t, err, "expected no graph entry for %s", runeID)
}

func (tc *runeDepGraphTestContext) target_has_no_dependent(runeID, sourceID string) {
	tc.t.Helper()
	var entry RuneDependencyGraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "projection_rune_dependency_graph", runeID, &entry)
	if err != nil {
		return // entry doesn't exist, so no dependent
	}
	for _, dep := range entry.Dependents {
		if dep.SourceID == sourceID {
			tc.t.Errorf("expected no dependent with source %s in %s, but found one", sourceID, runeID)
			return
		}
	}
}

func (tc *runeDepGraphTestContext) source_has_no_dependency(runeID, targetID string) {
	tc.t.Helper()
	var entry RuneDependencyGraphEntry
	err := tc.store.Get(tc.ctx, tc.realmID, "projection_rune_dependency_graph", runeID, &entry)
	if err != nil {
		return // entry doesn't exist, so no dependency
	}
	for _, dep := range entry.Dependencies {
		if dep.TargetID == targetID {
			tc.t.Errorf("expected no dependency with target %s in %s, but found one", targetID, runeID)
			return
		}
	}
}
