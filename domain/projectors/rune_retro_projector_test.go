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

func TestRuneRetroProjector(t *testing.T) {
	t.Run("Name returns rune_retro", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.name_is_called()
		tc.name_is("rune_retro")
	})

	t.Run("TableName returns rune_retro", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.table_name_is_called()
		tc.name_is("rune_retro")
	})

	t.Run("handles RuneCreated with empty retro items", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.a_store()
		tc.a_rune_created_event("bf-a1b2", "Fix the bridge", "Needs repair", 1, "")
		tc.handle_is_called()
		tc.no_error()
		tc.retro_was_stored("bf-a1b2")
		tc.stored_retro_has_title("Fix the bridge")
		tc.stored_retro_has_description("Needs repair")
		tc.stored_retro_has_status("draft")
		tc.stored_retro_has_empty_retro_items()
	})

	t.Run("handles RuneCreated with parent ID", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.a_store()
		tc.a_rune_created_event("bf-a1b2.1", "Child task", "", 2, "bf-a1b2")
		tc.handle_is_called()
		tc.no_error()
		tc.stored_retro_has_parent_id("bf-a1b2")
	})

	t.Run("handles RuneUpdated by merging title and description", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.a_store()
		tc.existing_retro("bf-a1b2", "Old title", "Old desc", "open", "")
		tc.a_rune_updated_event("bf-a1b2", strPtr("New title"), strPtr("New desc"))
		tc.handle_is_called()
		tc.no_error()
		tc.stored_retro_has_title("New title")
		tc.stored_retro_has_description("New desc")
	})

	t.Run("handles RuneForged by setting status to open", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.a_store()
		tc.existing_retro("bf-a1b2", "Task", "", "draft", "")
		tc.a_rune_forged_event("bf-a1b2")
		tc.handle_is_called()
		tc.no_error()
		tc.stored_retro_has_status("open")
	})

	t.Run("handles RuneClaimed by setting status to claimed", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.a_store()
		tc.existing_retro("bf-a1b2", "Task", "", "open", "")
		tc.a_rune_claimed_event("bf-a1b2", "odin")
		tc.handle_is_called()
		tc.no_error()
		tc.stored_retro_has_status("claimed")
	})

	t.Run("handles RuneUnclaimed by setting status to open", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.a_store()
		tc.existing_retro("bf-a1b2", "Task", "", "claimed", "")
		tc.a_rune_unclaimed_event("bf-a1b2")
		tc.handle_is_called()
		tc.no_error()
		tc.stored_retro_has_status("open")
	})

	t.Run("handles RuneFulfilled by setting status to fulfilled", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.a_store()
		tc.existing_retro("bf-a1b2", "Task", "", "claimed", "")
		tc.a_rune_fulfilled_event("bf-a1b2")
		tc.handle_is_called()
		tc.no_error()
		tc.stored_retro_has_status("fulfilled")
	})

	t.Run("handles RuneSealed by setting status to sealed", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.a_store()
		tc.existing_retro("bf-a1b2", "Task", "", "open", "")
		tc.a_rune_sealed_event("bf-a1b2")
		tc.handle_is_called()
		tc.no_error()
		tc.stored_retro_has_status("sealed")
	})

	t.Run("handles RuneShattered by updating status to shattered, NOT deleting record", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.a_store()
		tc.existing_retro("bf-a1b2", "Task", "", "fulfilled", "")
		tc.a_rune_shattered_event("bf-a1b2")
		tc.handle_is_called()
		tc.no_error()
		tc.stored_retro_has_status("shattered")
		tc.retro_still_exists("bf-a1b2")
	})

	t.Run("handles RuneShattered preserves existing retro items", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.a_store()
		tc.existing_retro_with_items("bf-a1b2", "Task", "", "fulfilled", "", []RetroEntry{
			{Text: "Post-mortem note", CreatedAt: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)},
		})
		tc.a_rune_shattered_event("bf-a1b2")
		tc.handle_is_called()
		tc.no_error()
		tc.stored_retro_has_retro_item_count(1)
		tc.stored_retro_has_retro_item_text(0, "Post-mortem note")
	})

	t.Run("handles RuneRetroed by appending retro item", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.a_store()
		tc.existing_retro("bf-a1b2", "Task", "", "fulfilled", "")
		tc.a_rune_retroed_event("bf-a1b2", "We should have broken this down more")
		tc.handle_is_called()
		tc.no_error()
		tc.stored_retro_has_retro_item_count(1)
		tc.stored_retro_has_retro_item_text(0, "We should have broken this down more")
	})

	t.Run("handles RuneRetroed idempotently (same text+timestamp skipped)", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.a_store()
		ts := time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC)
		tc.existing_retro_with_items("bf-a1b2", "Task", "", "fulfilled", "", []RetroEntry{
			{Text: "Duplicate item", CreatedAt: ts},
		})
		tc.a_rune_retroed_event_with_timestamp("bf-a1b2", "Duplicate item", ts)
		tc.handle_is_called()
		tc.no_error()
		tc.stored_retro_has_retro_item_count(1)
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newRuneRetroTestContext(t)
		tc.a_rune_retro_projector()
		tc.a_store()
		tc.an_unknown_event()
		tc.handle_is_called()
		tc.no_error()
	})
}

// --- Test Context ---

type runeRetroTestContext struct {
	t          *testing.T
	ctx        context.Context
	realmID    string
	projector  *RuneRetroProjector
	store      *mockProjectionStore
	event      core.Event
	nameResult string
	err        error
	storedRetro *RuneRetro
}

func newRuneRetroTestContext(t *testing.T) *runeRetroTestContext {
	t.Helper()
	return &runeRetroTestContext{
		t:       t,
		ctx:     context.Background(),
		realmID: "realm-1",
	}
}

// --- Given ---

func (tc *runeRetroTestContext) a_rune_retro_projector() {
	tc.t.Helper()
	tc.projector = NewRuneRetroProjector()
}

func (tc *runeRetroTestContext) a_store() {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
}

func (tc *runeRetroTestContext) a_rune_created_event(id, title, description string, priority int, parentID string) {
	tc.t.Helper()
	tc.event = makeEventWithTimestamp(domain.EventRuneCreated, domain.RuneCreated{
		ID: id, Title: title, Description: description, Priority: priority, ParentID: parentID,
	}, time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC))
}

func (tc *runeRetroTestContext) a_rune_updated_event(id string, title, description *string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneUpdated, domain.RuneUpdated{
		ID: id, Title: title, Description: description,
	})
}

func (tc *runeRetroTestContext) a_rune_forged_event(id string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneForged, domain.RuneForged{ID: id})
}

func (tc *runeRetroTestContext) a_rune_claimed_event(id, claimant string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneClaimed, domain.RuneClaimed{ID: id, Claimant: claimant})
}

func (tc *runeRetroTestContext) a_rune_unclaimed_event(id string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneUnclaimed, domain.RuneUnclaimed{ID: id})
}

func (tc *runeRetroTestContext) a_rune_fulfilled_event(id string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneFulfilled, domain.RuneFulfilled{ID: id})
}

func (tc *runeRetroTestContext) a_rune_sealed_event(id string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneSealed, domain.RuneSealed{ID: id})
}

func (tc *runeRetroTestContext) a_rune_shattered_event(id string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneShattered, domain.RuneShattered{ID: id})
}

func (tc *runeRetroTestContext) a_rune_retroed_event(runeID, text string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneRetroed, domain.RuneRetroed{RuneID: runeID, Text: text})
}

func (tc *runeRetroTestContext) a_rune_retroed_event_with_timestamp(runeID, text string, ts time.Time) {
	tc.t.Helper()
	tc.event = makeEventWithTimestamp(domain.EventRuneRetroed, domain.RuneRetroed{RuneID: runeID, Text: text}, ts)
}

func (tc *runeRetroTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *runeRetroTestContext) existing_retro(id, title, description, status, parentID string) {
	tc.t.Helper()
	tc.a_store()
	retro := RuneRetro{
		ID:          id,
		Title:       title,
		Description: description,
		Status:      status,
		ParentID:    parentID,
		RetroItems:  []RetroEntry{},
	}
	tc.store.put(tc.realmID, "rune_retro", id, retro)
}

func (tc *runeRetroTestContext) existing_retro_with_items(id, title, description, status, parentID string, items []RetroEntry) {
	tc.t.Helper()
	tc.a_store()
	retro := RuneRetro{
		ID:          id,
		Title:       title,
		Description: description,
		Status:      status,
		ParentID:    parentID,
		RetroItems:  items,
	}
	tc.store.put(tc.realmID, "rune_retro", id, retro)
}

// --- When ---

func (tc *runeRetroTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *runeRetroTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.TableName()
}

func (tc *runeRetroTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
	tc.load_stored_retro()
}

// --- Then ---

func (tc *runeRetroTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *runeRetroTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *runeRetroTestContext) retro_was_stored(id string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedRetro, "expected retro to be stored for %s", id)
	assert.Equal(tc.t, id, tc.storedRetro.ID)
}

func (tc *runeRetroTestContext) retro_still_exists(id string) {
	tc.t.Helper()
	var retro RuneRetro
	err := tc.store.Get(tc.ctx, tc.realmID, "rune_retro", id, &retro)
	assert.NoError(tc.t, err, "expected retro for %s to still exist after shatter", id)
}

func (tc *runeRetroTestContext) stored_retro_has_title(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedRetro)
	assert.Equal(tc.t, expected, tc.storedRetro.Title)
}

func (tc *runeRetroTestContext) stored_retro_has_description(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedRetro)
	assert.Equal(tc.t, expected, tc.storedRetro.Description)
}

func (tc *runeRetroTestContext) stored_retro_has_status(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedRetro)
	assert.Equal(tc.t, expected, tc.storedRetro.Status)
}

func (tc *runeRetroTestContext) stored_retro_has_parent_id(expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedRetro)
	assert.Equal(tc.t, expected, tc.storedRetro.ParentID)
}

func (tc *runeRetroTestContext) stored_retro_has_empty_retro_items() {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedRetro)
	assert.Empty(tc.t, tc.storedRetro.RetroItems)
}

func (tc *runeRetroTestContext) stored_retro_has_retro_item_count(expected int) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedRetro)
	assert.Len(tc.t, tc.storedRetro.RetroItems, expected)
}

func (tc *runeRetroTestContext) stored_retro_has_retro_item_text(index int, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedRetro)
	require.Greater(tc.t, len(tc.storedRetro.RetroItems), index)
	assert.Equal(tc.t, expected, tc.storedRetro.RetroItems[index].Text)
}

// --- Helpers ---

func (tc *runeRetroTestContext) load_stored_retro() {
	tc.t.Helper()
	if tc.store == nil {
		return
	}
	for _, val := range tc.store.data {
		dataBytes, err := json.Marshal(val)
		if err != nil {
			continue
		}
		var retro RuneRetro
		if err := json.Unmarshal(dataBytes, &retro); err != nil {
			continue
		}
		if retro.ID != "" {
			tc.storedRetro = &retro
			return
		}
	}
}
