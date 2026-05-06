package projectors

import (
	"testing"

	"github.com/devzeebo/bifrost/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestRuneDetailProjector_State(t *testing.T) {
	t.Run("handles RuneCreated with empty state map", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_store()
		tc.a_rune_created_event("bf-a1b2", "Fix the bridge", "Needs repair", 1, "")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_empty_state()
	})

	t.Run("handles RuneStateUpdated by setting state", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_store()
		tc.existing_detail("bf-a1b2", "Fix the bridge", "", "open", 1, "", "")
		tc.a_rune_state_updated_event("bf-a1b2", map[string]any{
			"coverage": 85,
			"tested":   false,
		})

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_state_value("coverage", 85.0)
		tc.stored_detail_has_state_value("tested", false)
	})

	t.Run("merges state patches on subsequent updates", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_store()
		tc.existing_detail_with_state("bf-a1b2", map[string]any{
			"coverage": 50,
			"legacy":   true,
			"tags":     []any{"old"},
		})
		tc.a_rune_state_updated_event("bf-a1b2", map[string]any{
			"coverage": 75,
			"new":      true,
		})

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_state_value("coverage", 75.0)
		tc.stored_detail_has_state_value("legacy", true) // preserved
		tc.stored_detail_has_state_value("new", true)
		tc.stored_detail_has_state_value("tags", []any{"old"}) // preserved
	})

	t.Run("deletes state fields with null values", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_store()
		tc.existing_detail_with_state("bf-a1b2", map[string]any{
			"coverage": 50,
			"legacy":   true,
		})
		tc.a_rune_state_updated_event("bf-a1b2", map[string]any{
			"legacy": nil,
		})

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_state_value("coverage", 50.0)
		tc.stored_detail_state_lacks_key("legacy")
	})

	t.Run("replaces nested objects", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_store()
		tc.existing_detail_with_state("bf-a1b2", map[string]any{
			"nested": map[string]any{
				"old": "value",
			},
		})
		tc.a_rune_state_updated_event("bf-a1b2", map[string]any{
			"nested": "replaced",
		})

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_state_value("nested", "replaced")
	})

	t.Run("empty patch preserves existing state", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_store()
		tc.existing_detail_with_state("bf-a1b2", map[string]any{
			"coverage": 50,
			"legacy":   true,
		})
		tc.a_rune_state_updated_event("bf-a1b2", map[string]any{})

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		// Empty patch doesn't change state (JSON Merge Patch semantics)
		tc.stored_detail_has_state_value("coverage", 50.0)
		tc.stored_detail_has_state_value("legacy", true)
	})
}

// ---------------------------------------------------------------------------
// Test Context Extensions
// ---------------------------------------------------------------------------

func (tc *runeDetailTestContext) a_rune_state_updated_event(runeID string, patch map[string]any) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneStateUpdated, domain.RuneStateUpdated{
		RuneID: runeID,
		Patch:  patch,
	})
}

func (tc *runeDetailTestContext) existing_detail_with_state(runeID string, state map[string]any) {
	tc.t.Helper()
	tc.existing_detail_with_full_state(runeID, "Existing rune", "", "open", 1, "", "", state)
}

func (tc *runeDetailTestContext) existing_detail_with_full_state(runeID, title, description, status string, priority int, parentID, branch string, state map[string]any) {
	tc.t.Helper()
	detail := RuneDetail{
		ID:          runeID,
		Title:       title,
		Description: description,
		Status:      status,
		Priority:    priority,
		ParentID:    parentID,
		Branch:      branch,
		Tags:        []string{},
		Type:        "rune",
		Dependencies: []DependencyRef{},
		Notes:       []NoteEntry{},
		RetroItems:  []RetroEntry{},
		AcceptanceCriteria: []ACEntry{},
		State:       state,
		CreatedAt:   tc.event.Timestamp,
		UpdatedAt:   tc.event.Timestamp,
	}
	tc.store.put(tc.realmID, "rune_detail", runeID, detail)
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

func (tc *runeDetailTestContext) stored_detail_has_empty_state() {
	tc.t.Helper()
	detail := tc.get_stored_detail()
	require.NotNil(tc.t, detail.State)
	assert.Empty(tc.t, detail.State, "expected empty state, got %v", detail.State)
}

func (tc *runeDetailTestContext) stored_detail_has_state_value(key string, expected any) {
	tc.t.Helper()
	detail := tc.get_stored_detail()
	require.NotNil(tc.t, detail.State)
	require.Contains(tc.t, detail.State, key, "state missing key %q", key)
	assert.Equal(tc.t, expected, detail.State[key], "state[%s] = %v, want %v", key, detail.State[key], expected)
}

func (tc *runeDetailTestContext) stored_detail_state_lacks_key(key string) {
	tc.t.Helper()
	detail := tc.get_stored_detail()
	require.NotNil(tc.t, detail.State)
	assert.NotContains(tc.t, detail.State, key, "state should not contain key %q", key)
}
