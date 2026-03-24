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

func TestRuneSummaryProjector(t *testing.T) {
	t.Run("Name returns rune_summary", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("rune_summary")
	})

	t.Run("TableName returns rune_summary", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("rune_summary")
	})

	t.Run("handles RuneCreated by putting summary with status draft", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.a_rune_created_event("bf-a1b2", "Fix the bridge", 1, "")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.summary_was_stored("bf-a1b2")
		tc.stored_summary_has_title("Fix the bridge")
		tc.stored_summary_has_status("draft")
		tc.stored_summary_has_priority(1)
		tc.stored_summary_has_parent_id("")
	})

	t.Run("handles RuneCreated with parent ID", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.a_rune_created_event("bf-a1b2.1", "Child task", 2, "bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.summary_was_stored("bf-a1b2.1")
		tc.stored_summary_has_parent_id("bf-a1b2")
	})

	t.Run("handles RuneCreated with branch", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.a_rune_created_event_with_branch("bf-a1b2", "Fix the bridge", 1, "", "feature/bridge")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.summary_was_stored("bf-a1b2")
		tc.stored_summary_has_branch("feature/bridge")
	})

	t.Run("handles RuneCreated with type", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.a_rune_created_event_with_type("bf-a1b2", "Fix the bridge", 1, "", "bug")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.summary_was_stored("bf-a1b2")
		tc.stored_summary_has_type("bug")
	})

	t.Run("handles RuneUpdated by merging changed fields", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.existing_summary("bf-a1b2", "Old title", "open", 1, "", "")
		tc.a_rune_updated_event("bf-a1b2", strPtr("New title"), intPtr(3))

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_summary_has_title("New title")
		tc.stored_summary_has_priority(3)
		tc.stored_summary_has_status("open")
	})

	t.Run("handles RuneUpdated with partial fields", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.existing_summary("bf-a1b2", "Old title", "open", 1, "", "")
		tc.a_rune_updated_event("bf-a1b2", nil, intPtr(5))

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_summary_has_title("Old title")
		tc.stored_summary_has_priority(5)
	})

	t.Run("handles RuneUpdated with branch", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.existing_summary("bf-a1b2", "Old title", "open", 1, "", "")
		tc.a_rune_updated_event_with_branch("bf-a1b2", nil, nil, strPtr("feature/new-branch"))

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_summary_has_branch("feature/new-branch")
	})

	t.Run("handles RuneUpdated without branch leaves branch unchanged", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.existing_summary_with_branch("bf-a1b2", "Old title", "open", 1, "", "", "feature/old")
		tc.a_rune_updated_event_with_branch("bf-a1b2", strPtr("New title"), nil, nil)

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_summary_has_title("New title")
		tc.stored_summary_has_branch("feature/old")
	})

	t.Run("handles RuneClaimed by setting claimant and status", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.existing_summary("bf-a1b2", "Fix the bridge", "open", 1, "", "")
		tc.a_rune_claimed_event("bf-a1b2", "odin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_summary_has_status("claimed")
		tc.stored_summary_has_claimant("odin")
	})

	t.Run("handles RuneUnclaimed by setting status to open and clearing claimant", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.existing_summary("bf-a1b2", "Fix the bridge", "claimed", 1, "odin", "")
		tc.a_rune_unclaimed_event("bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_summary_has_status("open")
		tc.stored_summary_has_claimant("")
	})

	t.Run("handles RuneForged by setting status to open", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.existing_summary("bf-a1b2", "Fix the bridge", "draft", 1, "", "")
		tc.a_rune_forged_event("bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_summary_has_status("open")
	})

	t.Run("handles RuneFulfilled by setting status", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.existing_summary("bf-a1b2", "Fix the bridge", "claimed", 1, "odin", "")
		tc.a_rune_fulfilled_event("bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_summary_has_status("fulfilled")
	})

	t.Run("handles RuneSealed by setting status", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.existing_summary("bf-a1b2", "Fix the bridge", "open", 1, "", "")
		tc.a_rune_sealed_event("bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_summary_has_status("sealed")
	})

	t.Run("handles RuneShattered by deleting rune from projection", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.existing_summary("bf-a1b2", "Fix the bridge", "open", 1, "", "")
		tc.a_rune_shattered_event("bf-a1b2")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.summary_was_deleted("bf-a1b2")
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("sets timestamps on RuneCreated", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.a_rune_created_event_with_timestamp("bf-a1b2", "Fix the bridge", 1, "")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_summary_has_created_at()
		tc.stored_summary_has_updated_at()
	})

	t.Run("updates updatedAt on RuneUpdated", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.existing_summary_with_timestamps("bf-a1b2", "Old title", "open", 1)
		tc.a_rune_updated_event_with_timestamp("bf-a1b2", strPtr("New title"), nil)

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_summary_updated_at_changed()
	})

	t.Run("read-modify-write cycle on RuneClaimed", func(t *testing.T) {
		tc := newRuneSummaryTestContext(t)

		// Given
		tc.a_rune_summary_projector()
		tc.a_store()
		tc.existing_summary("bf-a1b2", "Fix the bridge", "open", 1, "", "")
		tc.a_rune_claimed_event("bf-a1b2", "thor")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.read_modify_write_was_used("bf-a1b2")
	})
}

// --- Test Context ---

type runeSummaryTestContext struct {
	t *testing.T

	projector       *RuneSummaryProjector
	store           *mockProjectionStore
	event           core.Event
	ctx             context.Context
	realmID         string
	nameResult      string
	tableNameResult string
	err             error
	storedSummary   *RuneSummary
	originalUpdated time.Time
}

func newRuneSummaryTestContext(t *testing.T) *runeSummaryTestContext {
	t.Helper()
	return &runeSummaryTestContext{
		t:       t,
		ctx:     context.Background(),
		realmID: "realm-1",
	}
}

// --- Given ---

func (tc *runeSummaryTestContext) a_rune_summary_projector() {
	tc.t.Helper()
	tc.projector = NewRuneSummaryProjector()
}

func (tc *runeSummaryTestContext) a_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *runeSummaryTestContext) a_rune_created_event(id, title string, priority int, parentID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneCreated, domain.RuneCreated{
		ID: id, Title: title, Priority: priority, ParentID: parentID,
	})
}

func (tc *runeSummaryTestContext) a_rune_created_event_with_timestamp(id, title string, priority int, parentID string) {
	tc.t.Helper()
	tc.event = makeEventWithTimestamp(domain.EventRuneCreated, domain.RuneCreated{
		ID: id, Title: title, Priority: priority, ParentID: parentID,
	}, time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC))
}

func (tc *runeSummaryTestContext) a_rune_created_event_with_branch(id, title string, priority int, parentID, branch string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneCreated, domain.RuneCreated{
		ID: id, Title: title, Priority: priority, ParentID: parentID, Branch: branch,
	})
}

func (tc *runeSummaryTestContext) a_rune_created_event_with_type(id, title string, priority int, parentID, typeStr string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneCreated, domain.RuneCreated{
		ID: id, Title: title, Priority: priority, ParentID: parentID, Type: typeStr,
	})
}

func (tc *runeSummaryTestContext) a_rune_updated_event(id string, title *string, priority *int) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneUpdated, domain.RuneUpdated{
		ID: id, Title: title, Priority: priority,
	})
}

func (tc *runeSummaryTestContext) a_rune_updated_event_with_branch(id string, title *string, priority *int, branch *string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneUpdated, domain.RuneUpdated{
		ID: id, Title: title, Priority: priority, Branch: branch,
	})
}

func (tc *runeSummaryTestContext) a_rune_updated_event_with_timestamp(id string, title *string, priority *int) {
	tc.t.Helper()
	tc.event = makeEventWithTimestamp(domain.EventRuneUpdated, domain.RuneUpdated{
		ID: id, Title: title, Priority: priority,
	}, time.Date(2026, 2, 20, 12, 0, 0, 0, time.UTC))
}

func (tc *runeSummaryTestContext) a_rune_claimed_event(id, claimant string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneClaimed, domain.RuneClaimed{
		ID: id, Claimant: claimant,
	})
}

func (tc *runeSummaryTestContext) a_rune_forged_event(id string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneForged, domain.RuneForged{
		ID: id,
	})
}

func (tc *runeSummaryTestContext) a_rune_fulfilled_event(id string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneFulfilled, domain.RuneFulfilled{
		ID: id,
	})
}

func (tc *runeSummaryTestContext) a_rune_sealed_event(id string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneSealed, domain.RuneSealed{
		ID: id, Reason: "done",
	})
}

func (tc *runeSummaryTestContext) a_rune_unclaimed_event(id string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneUnclaimed, domain.RuneUnclaimed{
		ID: id,
	})
}

func (tc *runeSummaryTestContext) a_rune_shattered_event(id string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneShattered, domain.RuneShattered{
		ID: id,
	})
}

func (tc *runeSummaryTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{
		EventType: "UnknownEvent",
		Data:      []byte(`{}`),
	}
}

func (tc *runeSummaryTestContext) existing_summary(id, title, status string, priority int, claimant, parentID string) {
	tc.t.Helper()
	tc.a_store()
	summary := RuneSummary{
		ID:       id,
		Title:    title,
		Status:   status,
		Priority: priority,
		Claimant: claimant,
		ParentID: parentID,
	}
	tc.store.put(tc.realmID, "rune_summary", id, summary)
}

func (tc *runeSummaryTestContext) existing_summary_with_branch(id, title, status string, priority int, claimant, parentID, branch string) {
	tc.t.Helper()
	tc.a_store()
	summary := RuneSummary{
		ID:       id,
		Title:    title,
		Status:   status,
		Priority: priority,
		Claimant: claimant,
		ParentID: parentID,
		Branch:   branch,
	}
	tc.store.put(tc.realmID, "rune_summary", id, summary)
}

func (tc *runeSummaryTestContext) existing_summary_with_timestamps(id, title, status string, priority int) {
	tc.t.Helper()
	tc.a_store()
	created := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	tc.originalUpdated = created
	summary := RuneSummary{
		ID:        id,
		Title:     title,
		Status:    status,
		Priority:  priority,
		CreatedAt: created,
		UpdatedAt: created,
	}
	tc.store.put(tc.realmID, "rune_summary", id, summary)
}

// --- When ---

func (tc *runeSummaryTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *runeSummaryTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameResult = tc.projector.TableName()
}

func (tc *runeSummaryTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
	tc.load_stored_summary()
}

// --- Then ---

func (tc *runeSummaryTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *runeSummaryTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameResult)
}

func (tc *runeSummaryTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *runeSummaryTestContext) summary_was_stored(id string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedSummary, "expected summary to be stored for %s", id)
	assert.Equal(tc.t, id, tc.storedSummary.ID)
}

func (tc *runeSummaryTestContext) stored_summary_has_title(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedSummary)
	assert.Equal(tc.t, expected, tc.storedSummary.Title)
}

func (tc *runeSummaryTestContext) stored_summary_has_status(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedSummary)
	assert.Equal(tc.t, expected, tc.storedSummary.Status)
}

func (tc *runeSummaryTestContext) stored_summary_has_priority(expected int) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedSummary)
	assert.Equal(tc.t, expected, tc.storedSummary.Priority)
}

func (tc *runeSummaryTestContext) stored_summary_has_claimant(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedSummary)
	assert.Equal(tc.t, expected, tc.storedSummary.Claimant)
}

func (tc *runeSummaryTestContext) stored_summary_has_parent_id(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedSummary)
	assert.Equal(tc.t, expected, tc.storedSummary.ParentID)
}

func (tc *runeSummaryTestContext) stored_summary_has_branch(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedSummary)
	assert.Equal(tc.t, expected, tc.storedSummary.Branch)
}

func (tc *runeSummaryTestContext) stored_summary_has_type(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedSummary)
	assert.Equal(tc.t, expected, tc.storedSummary.Type)
}

func (tc *runeSummaryTestContext) stored_summary_has_created_at() {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedSummary)
	assert.False(tc.t, tc.storedSummary.CreatedAt.IsZero(), "expected CreatedAt to be set")
}

func (tc *runeSummaryTestContext) stored_summary_has_updated_at() {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedSummary)
	assert.False(tc.t, tc.storedSummary.UpdatedAt.IsZero(), "expected UpdatedAt to be set")
}

func (tc *runeSummaryTestContext) summary_was_deleted(id string) {
	tc.t.Helper()
	var summary RuneSummary
	err := tc.store.Get(tc.ctx, tc.realmID, "rune_summary", id, &summary)
	assert.Error(tc.t, err, "expected summary for %s to be deleted", id)
}

func (tc *runeSummaryTestContext) stored_summary_updated_at_changed() {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedSummary)
	assert.True(tc.t, tc.storedSummary.UpdatedAt.After(tc.originalUpdated),
		"expected UpdatedAt to be after original %v, got %v", tc.originalUpdated, tc.storedSummary.UpdatedAt)
}

func (tc *runeSummaryTestContext) read_modify_write_was_used(id string) {
	tc.t.Helper()
	// Verify that the existing data was loaded and modified, not overwritten
	// The fact that we have a stored summary with the correct ID indicates read-modify-write worked
	require.NotNil(tc.t, tc.storedSummary)
	assert.Equal(tc.t, id, tc.storedSummary.ID)
	assert.Equal(tc.t, "Fix the bridge", tc.storedSummary.Title, "title should be preserved from read")
	assert.Equal(tc.t, 1, tc.storedSummary.Priority, "priority should be preserved from read")
}

func (tc *runeSummaryTestContext) load_stored_summary() {
	tc.t.Helper()
	if tc.event.EventType == "UnknownEvent" {
		return
	}
	
	// Extract ID from event data to load the stored summary
	var id string
	switch tc.event.EventType {
	case domain.EventRuneCreated:
		var data domain.RuneCreated
		if err := json.Unmarshal(tc.event.Data, &data); err == nil {
			id = data.ID
		}
	case domain.EventRuneUpdated:
		var data domain.RuneUpdated
		if err := json.Unmarshal(tc.event.Data, &data); err == nil {
			id = data.ID
		}
	case domain.EventRuneClaimed:
		var data domain.RuneClaimed
		if err := json.Unmarshal(tc.event.Data, &data); err == nil {
			id = data.ID
		}
	case domain.EventRuneUnclaimed:
		var data domain.RuneUnclaimed
		if err := json.Unmarshal(tc.event.Data, &data); err == nil {
			id = data.ID
		}
	case domain.EventRuneForged:
		var data domain.RuneForged
		if err := json.Unmarshal(tc.event.Data, &data); err == nil {
			id = data.ID
		}
	case domain.EventRuneFulfilled:
		var data domain.RuneFulfilled
		if err := json.Unmarshal(tc.event.Data, &data); err == nil {
			id = data.ID
		}
	case domain.EventRuneSealed:
		var data domain.RuneSealed
		if err := json.Unmarshal(tc.event.Data, &data); err == nil {
			id = data.ID
		}
	case domain.EventRuneShattered:
		var data domain.RuneShattered
		if err := json.Unmarshal(tc.event.Data, &data); err == nil {
			id = data.ID
		}
	}
	
	if id == "" {
		return
	}
	
	var summary RuneSummary
	if err := tc.store.Get(tc.ctx, tc.realmID, "rune_summary", id, &summary); err == nil {
		tc.storedSummary = &summary
	}
}
