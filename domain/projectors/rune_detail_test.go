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

func TestRuneDetailProjector(t *testing.T) {
	t.Run("Name returns rune_detail", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("rune_detail")
	})

	t.Run("handles RuneCreated with full detail and empty arrays", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.a_rune_created_event("bf-a1b2", "Fix the bridge", "Needs repair", 1, "")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.detail_was_stored("bf-a1b2")
		tc.stored_detail_has_title("Fix the bridge")
		tc.stored_detail_has_description("Needs repair")
		tc.stored_detail_has_status("draft")
		tc.stored_detail_has_priority(1)
		tc.stored_detail_has_empty_dependencies()
		tc.stored_detail_has_empty_notes()
	})

	t.Run("handles RuneCreated with parent ID", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.a_rune_created_event("bf-a1b2.1", "Child task", "", 2, "bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_parent_id("bf-a1b2")
	})

	t.Run("handles RuneUpdated by merging fields", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.existing_detail("bf-a1b2", "Old title", "Old desc", "open", 1, "", "")
		tc.a_rune_updated_event("bf-a1b2", strPtr("New title"), strPtr("New desc"), intPtr(3))

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_title("New title")
		tc.stored_detail_has_description("New desc")
		tc.stored_detail_has_priority(3)
	})

	t.Run("handles RuneUpdated with partial fields", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.existing_detail("bf-a1b2", "Old title", "Old desc", "open", 1, "", "")
		tc.a_rune_updated_event("bf-a1b2", nil, nil, intPtr(5))

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_title("Old title")
		tc.stored_detail_has_description("Old desc")
		tc.stored_detail_has_priority(5)
	})

	t.Run("handles RuneClaimed", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.existing_detail("bf-a1b2", "Fix the bridge", "", "open", 1, "", "")
		tc.a_rune_claimed_event("bf-a1b2", "odin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_status("claimed")
		tc.stored_detail_has_claimant("odin")
	})

	t.Run("handles RuneFulfilled", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.existing_detail("bf-a1b2", "Fix the bridge", "", "claimed", 1, "odin", "")
		tc.a_rune_fulfilled_event("bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_status("fulfilled")
	})

	t.Run("handles RuneSealed with reason", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.existing_detail("bf-a1b2", "Fix the bridge", "", "open", 1, "", "")
		tc.a_rune_sealed_event("bf-a1b2", "no longer needed")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_status("sealed")
	})

	t.Run("handles RuneUnclaimed by setting status to open and clearing claimant", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.existing_detail("bf-a1b2", "Fix the bridge", "", "claimed", 1, "odin", "")
		tc.a_rune_unclaimed_event("bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_status("open")
		tc.stored_detail_has_claimant("")
	})

	t.Run("handles DependencyAdded by appending to dependencies", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.existing_detail("bf-a1b2", "Fix the bridge", "", "open", 1, "", "")
		tc.a_dependency_added_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_dependency_count(1)
		tc.stored_detail_has_dependency("bf-c3d4", "blocks")
	})

	t.Run("handles DependencyAdded appends to existing dependencies", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.existing_detail_with_dependency("bf-a1b2", "bf-c3d4", "blocks")
		tc.a_dependency_added_event("bf-a1b2", "bf-e5f6", "relates_to")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_dependency_count(2)
		tc.stored_detail_has_dependency("bf-c3d4", "blocks")
		tc.stored_detail_has_dependency("bf-e5f6", "relates_to")
	})

	t.Run("handles DependencyRemoved by removing from dependencies", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.existing_detail_with_dependency("bf-a1b2", "bf-c3d4", "blocks")
		tc.a_dependency_removed_event("bf-a1b2", "bf-c3d4", "blocks")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_dependency_count(0)
	})

	t.Run("handles RuneNoted by appending to notes", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.existing_detail("bf-a1b2", "Fix the bridge", "", "open", 1, "", "")
		tc.a_rune_noted_event("bf-a1b2", "This is a note")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_note_count(1)
		tc.stored_detail_has_note_text(0, "This is a note")
	})

	t.Run("handles RuneNoted appends to existing notes", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.existing_detail_with_note("bf-a1b2", "First note")
		tc.a_rune_noted_event("bf-a1b2", "Second note")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_note_count(2)
		tc.stored_detail_has_note_text(0, "First note")
		tc.stored_detail_has_note_text(1, "Second note")
	})

	t.Run("handles RuneCreated with branch", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.a_rune_created_event_with_branch("bf-a1b2", "Fix the bridge", "Needs repair", 1, "", "feature/bridge")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.detail_was_stored("bf-a1b2")
		tc.stored_detail_has_branch("feature/bridge")
	})

	t.Run("handles RuneUpdated with branch", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.existing_detail("bf-a1b2", "Old title", "Old desc", "open", 1, "", "")
		tc.a_rune_updated_event_with_branch("bf-a1b2", nil, nil, nil, strPtr("feature/new-branch"))

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_branch("feature/new-branch")
	})

	t.Run("handles RuneUpdated without branch leaves branch unchanged", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.existing_detail_with_branch("bf-a1b2", "Old title", "Old desc", "open", 1, "", "", "feature/old")
		tc.a_rune_updated_event_with_branch("bf-a1b2", strPtr("New title"), nil, nil, nil)

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_title("New title")
		tc.stored_detail_has_branch("feature/old")
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_projection_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})
}

// --- Test Context ---

type runeDetailTestContext struct {
	t *testing.T

	projector    *RuneDetailProjector
	store        *mockProjectionStore
	event        core.Event
	ctx          context.Context
	realmID      string
	nameResult   string
	err          error
	storedDetail *RuneDetail
}

func newRuneDetailTestContext(t *testing.T) *runeDetailTestContext {
	t.Helper()
	return &runeDetailTestContext{
		t:       t,
		ctx:     context.Background(),
		realmID: "realm-1",
	}
}

// --- Given ---

func (tc *runeDetailTestContext) a_rune_detail_projector() {
	tc.t.Helper()
	tc.projector = NewRuneDetailProjector()
}

func (tc *runeDetailTestContext) a_projection_store() {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
}

func (tc *runeDetailTestContext) a_rune_created_event(id, title, description string, priority int, parentID string) {
	tc.t.Helper()
	tc.event = makeEventWithTimestamp(domain.EventRuneCreated, domain.RuneCreated{
		ID: id, Title: title, Description: description, Priority: priority, ParentID: parentID,
	}, time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC))
}

func (tc *runeDetailTestContext) a_rune_created_event_with_branch(id, title, description string, priority int, parentID, branch string) {
	tc.t.Helper()
	tc.event = makeEventWithTimestamp(domain.EventRuneCreated, domain.RuneCreated{
		ID: id, Title: title, Description: description, Priority: priority, ParentID: parentID, Branch: branch,
	}, time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC))
}

func (tc *runeDetailTestContext) a_rune_updated_event(id string, title, description *string, priority *int) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneUpdated, domain.RuneUpdated{
		ID: id, Title: title, Description: description, Priority: priority,
	})
}

func (tc *runeDetailTestContext) a_rune_updated_event_with_branch(id string, title, description *string, priority *int, branch *string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneUpdated, domain.RuneUpdated{
		ID: id, Title: title, Description: description, Priority: priority, Branch: branch,
	})
}

func (tc *runeDetailTestContext) a_rune_claimed_event(id, claimant string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneClaimed, domain.RuneClaimed{
		ID: id, Claimant: claimant,
	})
}

func (tc *runeDetailTestContext) a_rune_fulfilled_event(id string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneFulfilled, domain.RuneFulfilled{ID: id})
}

func (tc *runeDetailTestContext) a_rune_sealed_event(id, reason string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneSealed, domain.RuneSealed{ID: id, Reason: reason})
}

func (tc *runeDetailTestContext) a_dependency_added_event(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyAdded, domain.DependencyAdded{
		RuneID: runeID, TargetID: targetID, Relationship: relationship,
	})
}

func (tc *runeDetailTestContext) a_dependency_removed_event(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventDependencyRemoved, domain.DependencyRemoved{
		RuneID: runeID, TargetID: targetID, Relationship: relationship,
	})
}

func (tc *runeDetailTestContext) a_rune_noted_event(runeID, text string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneNoted, domain.RuneNoted{
		RuneID: runeID, Text: text,
	})
}

func (tc *runeDetailTestContext) a_rune_unclaimed_event(id string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneUnclaimed, domain.RuneUnclaimed{
		ID: id,
	})
}

func (tc *runeDetailTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *runeDetailTestContext) existing_detail(id, title, description, status string, priority int, claimant, parentID string) {
	tc.t.Helper()
	tc.a_projection_store()
	detail := RuneDetail{
		ID:           id,
		Title:        title,
		Description:  description,
		Status:       status,
		Priority:     priority,
		Claimant:     claimant,
		ParentID:     parentID,
		Dependencies: []DependencyRef{},
		Notes:        []NoteEntry{},
	}
	tc.store.put(tc.realmID, "rune_detail", id, detail)
}

func (tc *runeDetailTestContext) existing_detail_with_branch(id, title, description, status string, priority int, claimant, parentID, branch string) {
	tc.t.Helper()
	tc.a_projection_store()
	detail := RuneDetail{
		ID:           id,
		Title:        title,
		Description:  description,
		Status:       status,
		Priority:     priority,
		Claimant:     claimant,
		ParentID:     parentID,
		Branch:       branch,
		Dependencies: []DependencyRef{},
		Notes:        []NoteEntry{},
	}
	tc.store.put(tc.realmID, "rune_detail", id, detail)
}

func (tc *runeDetailTestContext) existing_detail_with_dependency(id, targetID, relationship string) {
	tc.t.Helper()
	tc.a_projection_store()
	detail := RuneDetail{
		ID:       id,
		Title:    "Existing rune",
		Status:   "open",
		Priority: 1,
		Dependencies: []DependencyRef{
			{TargetID: targetID, Relationship: relationship},
		},
		Notes: []NoteEntry{},
	}
	tc.store.put(tc.realmID, "rune_detail", id, detail)
}

func (tc *runeDetailTestContext) existing_detail_with_note(id, noteText string) {
	tc.t.Helper()
	tc.a_projection_store()
	detail := RuneDetail{
		ID:           id,
		Title:        "Existing rune",
		Status:       "open",
		Priority:     1,
		Dependencies: []DependencyRef{},
		Notes: []NoteEntry{
			{Text: noteText, CreatedAt: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)},
		},
	}
	tc.store.put(tc.realmID, "rune_detail", id, detail)
}

// --- When ---

func (tc *runeDetailTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *runeDetailTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
	tc.load_stored_detail()
}

// --- Then ---

func (tc *runeDetailTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *runeDetailTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *runeDetailTestContext) detail_was_stored(id string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail, "expected detail to be stored for %s", id)
	assert.Equal(tc.t, id, tc.storedDetail.ID)
}

func (tc *runeDetailTestContext) stored_detail_has_title(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	assert.Equal(tc.t, expected, tc.storedDetail.Title)
}

func (tc *runeDetailTestContext) stored_detail_has_description(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	assert.Equal(tc.t, expected, tc.storedDetail.Description)
}

func (tc *runeDetailTestContext) stored_detail_has_status(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	assert.Equal(tc.t, expected, tc.storedDetail.Status)
}

func (tc *runeDetailTestContext) stored_detail_has_priority(expected int) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	assert.Equal(tc.t, expected, tc.storedDetail.Priority)
}

func (tc *runeDetailTestContext) stored_detail_has_claimant(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	assert.Equal(tc.t, expected, tc.storedDetail.Claimant)
}

func (tc *runeDetailTestContext) stored_detail_has_parent_id(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	assert.Equal(tc.t, expected, tc.storedDetail.ParentID)
}

func (tc *runeDetailTestContext) stored_detail_has_empty_dependencies() {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	assert.Empty(tc.t, tc.storedDetail.Dependencies)
}

func (tc *runeDetailTestContext) stored_detail_has_empty_notes() {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	assert.Empty(tc.t, tc.storedDetail.Notes)
}

func (tc *runeDetailTestContext) stored_detail_has_dependency_count(expected int) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	assert.Len(tc.t, tc.storedDetail.Dependencies, expected)
}

func (tc *runeDetailTestContext) stored_detail_has_dependency(targetID, relationship string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	found := false
	for _, dep := range tc.storedDetail.Dependencies {
		if dep.TargetID == targetID && dep.Relationship == relationship {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected dependency {%s, %s} not found", targetID, relationship)
}

func (tc *runeDetailTestContext) stored_detail_has_note_count(expected int) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	assert.Len(tc.t, tc.storedDetail.Notes, expected)
}

func (tc *runeDetailTestContext) stored_detail_has_branch(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	assert.Equal(tc.t, expected, tc.storedDetail.Branch)
}

func (tc *runeDetailTestContext) stored_detail_has_note_text(index int, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	require.Greater(tc.t, len(tc.storedDetail.Notes), index)
	assert.Equal(tc.t, expected, tc.storedDetail.Notes[index].Text)
}

// --- Helpers ---

func (tc *runeDetailTestContext) load_stored_detail() {
	tc.t.Helper()
	if tc.store == nil {
		return
	}
	for key, val := range tc.store.data {
		_ = key
		dataBytes, err := json.Marshal(val)
		if err != nil {
			continue
		}
		var detail RuneDetail
		if err := json.Unmarshal(dataBytes, &detail); err != nil {
			continue
		}
		if detail.ID != "" {
			tc.storedDetail = &detail
			return
		}
	}
}
