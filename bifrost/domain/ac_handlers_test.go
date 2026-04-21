package domain

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Fixes for pre-existing missing helpers on handlerTestContext
// (required to make the domain package compile)
// ---------------------------------------------------------------------------

func (tc *handlerTestContext) with_add_tags_on_update_command(tags ...string) {
	tc.t.Helper()
	tc.updateCmd.AddTags = tags
}

func (tc *handlerTestContext) with_remove_tags_on_update_command(tags ...string) {
	tc.t.Helper()
	tc.updateCmd.RemoveTags = tags
}

func (tc *handlerTestContext) appended_rune_updated_event_has_add_tags(expected ...string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	for _, evt := range lastCall.events {
		if evt.EventType == EventRuneUpdated {
			dataBytes, _ := json.Marshal(evt.Data)
			var data RuneUpdated
			require.NoError(tc.t, json.Unmarshal(dataBytes, &data))
			assert.Equal(tc.t, expected, data.AddTags)
			return
		}
	}
	tc.t.Fatal("no RuneUpdated event found in last Append call")
}

func (tc *handlerTestContext) appended_rune_updated_event_has_remove_tags(expected ...string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	for _, evt := range lastCall.events {
		if evt.EventType == EventRuneUpdated {
			dataBytes, _ := json.Marshal(evt.Data)
			var data RuneUpdated
			require.NoError(tc.t, json.Unmarshal(dataBytes, &data))
			assert.Equal(tc.t, expected, data.RemoveTags)
			return
		}
	}
	tc.t.Fatal("no RuneUpdated event found in last Append call")
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestHandleAddACItem(t *testing.T) {
	t.Run("US1-AC01: adds AC item to an open rune and assigns first ID AC-01", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.an_add_ac_item_command("bf-a1b2", "happy path", "User logs in successfully")

		// When
		tc.handle_add_ac_item()

		// Then
		tc.no_error()
		tc.event_was_appended_to_stream("rune-bf-a1b2")
		tc.appended_event_has_type(EventRuneACAdded)
		tc.appended_ac_added_event_has_id("AC-01")
	})

	t.Run("US1-AC03: assigns sequential ID AC-02 when one AC already exists", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_with_ac_in_stream("bf-a1b2", "AC-01", "old scenario", "old desc")
		tc.an_add_ac_item_command("bf-a1b2", "new scenario", "new desc")

		// When
		tc.handle_add_ac_item()

		// Then
		tc.no_error()
		tc.appended_event_has_type(EventRuneACAdded)
		tc.appended_ac_added_event_has_id("AC-02")
	})

	t.Run("US4-AC04: never reuses an ID after removal — counter keeps incrementing", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_with_ac_added_then_removed_in_stream("bf-a1b2", "AC-01")
		tc.an_add_ac_item_command("bf-a1b2", "replacement path", "brand new desc")

		// When
		tc.handle_add_ac_item()

		// Then
		tc.no_error()
		tc.appended_event_has_type(EventRuneACAdded)
		tc.appended_ac_added_event_has_id("AC-02")
	})

	t.Run("US1-AC01: appended AC event carries scenario and description", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.an_add_ac_item_command("bf-a1b2", "happy path", "User logs in successfully")

		// When
		tc.handle_add_ac_item()

		// Then
		tc.no_error()
		tc.appended_ac_added_event_has_scenario("happy path")
		tc.appended_ac_added_event_has_description("User logs in successfully")
	})

	t.Run("returns error when rune does not exist", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.empty_stream("bf-missing")
		tc.an_add_ac_item_command("bf-missing", "happy path", "desc")

		// When
		tc.handle_add_ac_item()

		// Then
		tc.error_is_not_found("rune", "bf-missing")
	})

	t.Run("state-gating: returns error when rune is sealed", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "sealed")
		tc.an_add_ac_item_command("bf-a1b2", "happy path", "desc")

		// When
		tc.handle_add_ac_item()

		// Then
		tc.error_contains("sealed")
	})

	t.Run("state-gating: returns error when rune is shattered", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "shattered")
		tc.an_add_ac_item_command("bf-a1b2", "happy path", "desc")

		// When
		tc.handle_add_ac_item()

		// Then
		tc.error_contains("shattered")
	})

	t.Run("adds AC item to a draft rune", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "draft")
		tc.an_add_ac_item_command("bf-a1b2", "happy path", "desc")

		// When
		tc.handle_add_ac_item()

		// Then
		tc.no_error()
		tc.appended_ac_added_event_has_id("AC-01")
	})
}

func TestHandleUpdateACItem(t *testing.T) {
	t.Run("US3-AC01: updates scenario and description of existing AC", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_with_ac_in_stream("bf-a1b2", "AC-01", "old scenario", "old desc")
		tc.an_update_ac_item_command("bf-a1b2", "AC-01", "new scenario", "new desc")

		// When
		tc.handle_update_ac_item()

		// Then
		tc.no_error()
		tc.event_was_appended_to_stream("rune-bf-a1b2")
		tc.appended_event_has_type(EventRuneACUpdated)
	})

	t.Run("US3-AC02: returns error when AC ID does not exist", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.an_update_ac_item_command("bf-a1b2", "AC-99", "scenario", "desc")

		// When
		tc.handle_update_ac_item()

		// Then
		tc.error_contains("AC-99")
	})

	t.Run("returns error when rune does not exist", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.empty_stream("bf-missing")
		tc.an_update_ac_item_command("bf-missing", "AC-01", "scenario", "desc")

		// When
		tc.handle_update_ac_item()

		// Then
		tc.error_is_not_found("rune", "bf-missing")
	})

	t.Run("state-gating: returns error when rune is sealed", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "sealed")
		tc.an_update_ac_item_command("bf-a1b2", "AC-01", "scenario", "desc")

		// When
		tc.handle_update_ac_item()

		// Then
		tc.error_contains("sealed")
	})

	t.Run("state-gating: returns error when rune is shattered", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "shattered")
		tc.an_update_ac_item_command("bf-a1b2", "AC-01", "scenario", "desc")

		// When
		tc.handle_update_ac_item()

		// Then
		tc.error_contains("shattered")
	})

	t.Run("US3-AC04: AC ID counter is unaffected by updates", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given — rune with AC-01, then update AC-01, then add new AC
		tc.an_event_store()
		tc.existing_rune_with_ac_updated_in_stream("bf-a1b2", "AC-01", "updated scenario", "updated desc")
		tc.an_add_ac_item_command("bf-a1b2", "new scenario", "new desc")

		// When
		tc.handle_add_ac_item()

		// Then — next ID is still AC-02 (update doesn't increment counter)
		tc.no_error()
		tc.appended_ac_added_event_has_id("AC-02")
	})
}

func TestHandleRemoveACItem(t *testing.T) {
	t.Run("US4-AC01: removes existing AC from rune", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_with_ac_in_stream("bf-a1b2", "AC-01", "happy path", "desc")
		tc.a_remove_ac_item_command("bf-a1b2", "AC-01")

		// When
		tc.handle_remove_ac_item()

		// Then
		tc.no_error()
		tc.event_was_appended_to_stream("rune-bf-a1b2")
		tc.appended_event_has_type(EventRuneACRemoved)
	})

	t.Run("US4-AC02: returns error when AC ID does not exist", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.a_remove_ac_item_command("bf-a1b2", "AC-99")

		// When
		tc.handle_remove_ac_item()

		// Then
		tc.error_contains("AC-99")
	})

	t.Run("returns error when rune does not exist", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.empty_stream("bf-missing")
		tc.a_remove_ac_item_command("bf-missing", "AC-01")

		// When
		tc.handle_remove_ac_item()

		// Then
		tc.error_is_not_found("rune", "bf-missing")
	})

	t.Run("state-gating: returns error when rune is sealed", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "sealed")
		tc.a_remove_ac_item_command("bf-a1b2", "AC-01")

		// When
		tc.handle_remove_ac_item()

		// Then
		tc.error_contains("sealed")
	})

	t.Run("state-gating: returns error when rune is shattered", func(t *testing.T) {
		tc := newACHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "shattered")
		tc.a_remove_ac_item_command("bf-a1b2", "AC-01")

		// When
		tc.handle_remove_ac_item()

		// Then
		tc.error_contains("shattered")
	})
}

// ---------------------------------------------------------------------------
// Test Context
// ---------------------------------------------------------------------------

type acHandlerTestContext struct {
	t       *testing.T
	ctx     context.Context
	realmID string

	eventStore *mockEventStore

	addACItemCmd    AddACItem
	updateACItemCmd UpdateACItem
	removeACItemCmd RemoveACItem

	err error
}

func newACHandlerTestContext(t *testing.T) *acHandlerTestContext {
	t.Helper()
	return &acHandlerTestContext{
		t:       t,
		ctx:     context.Background(),
		realmID: "realm-1",
	}
}

// ---------------------------------------------------------------------------
// Given
// ---------------------------------------------------------------------------

func (tc *acHandlerTestContext) an_event_store() {
	tc.t.Helper()
	if tc.eventStore == nil {
		tc.eventStore = newMockEventStore()
	}
}

func (tc *acHandlerTestContext) existing_rune_in_stream(runeID, status string) {
	tc.t.Helper()
	tc.an_event_store()
	events := []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{ID: runeID, Title: "Existing rune", Priority: 1}),
	}
	switch status {
	case "open":
		events = append(events, makeEvent(EventRuneForged, RuneForged{ID: runeID}))
	case "claimed":
		events = append(events, makeEvent(EventRuneForged, RuneForged{ID: runeID}))
		events = append(events, makeEvent(EventRuneClaimed, RuneClaimed{ID: runeID, Claimant: "someone"}))
	case "fulfilled":
		events = append(events, makeEvent(EventRuneForged, RuneForged{ID: runeID}))
		events = append(events, makeEvent(EventRuneClaimed, RuneClaimed{ID: runeID, Claimant: "someone"}))
		events = append(events, makeEvent(EventRuneFulfilled, RuneFulfilled{ID: runeID}))
	case "sealed":
		events = append(events, makeEvent(EventRuneSealed, RuneSealed{ID: runeID, Reason: "no longer needed"}))
	case "shattered":
		events = append(events, makeEvent(EventRuneSealed, RuneSealed{ID: runeID, Reason: "done"}))
		events = append(events, makeEvent(EventRuneShattered, RuneShattered{ID: runeID}))
	}
	tc.eventStore.streams["rune-"+runeID] = events
}

func (tc *acHandlerTestContext) empty_stream(runeID string) {
	tc.t.Helper()
	tc.an_event_store()
	tc.eventStore.streams["rune-"+runeID] = []core.Event{}
}

func (tc *acHandlerTestContext) existing_rune_with_ac_in_stream(runeID, acID, scenario, desc string) {
	tc.t.Helper()
	tc.an_event_store()
	events := []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{ID: runeID, Title: "Existing rune", Priority: 1}),
		makeEvent(EventRuneForged, RuneForged{ID: runeID}),
		makeEvent(EventRuneACAdded, RuneACAdded{
			RuneID: runeID, ID: acID, Scenario: scenario, Description: desc,
		}),
	}
	tc.eventStore.streams["rune-"+runeID] = events
}

func (tc *acHandlerTestContext) existing_rune_with_ac_added_then_removed_in_stream(runeID, acID string) {
	tc.t.Helper()
	tc.an_event_store()
	events := []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{ID: runeID, Title: "Existing rune", Priority: 1}),
		makeEvent(EventRuneForged, RuneForged{ID: runeID}),
		makeEvent(EventRuneACAdded, RuneACAdded{
			RuneID: runeID, ID: acID, Scenario: "old scenario", Description: "old desc",
		}),
		makeEvent(EventRuneACRemoved, RuneACRemoved{RuneID: runeID, ID: acID}),
	}
	tc.eventStore.streams["rune-"+runeID] = events
}

func (tc *acHandlerTestContext) existing_rune_with_ac_updated_in_stream(runeID, acID, newScenario, newDesc string) {
	tc.t.Helper()
	tc.an_event_store()
	events := []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{ID: runeID, Title: "Existing rune", Priority: 1}),
		makeEvent(EventRuneForged, RuneForged{ID: runeID}),
		makeEvent(EventRuneACAdded, RuneACAdded{
			RuneID: runeID, ID: acID, Scenario: "original scenario", Description: "original desc",
		}),
		makeEvent(EventRuneACUpdated, RuneACUpdated{
			RuneID: runeID, ID: acID, Scenario: newScenario, Description: newDesc,
		}),
	}
	tc.eventStore.streams["rune-"+runeID] = events
}

func (tc *acHandlerTestContext) an_add_ac_item_command(runeID, scenario, desc string) {
	tc.t.Helper()
	tc.addACItemCmd = AddACItem{
		RuneID:      runeID,
		Scenario:    scenario,
		Description: desc,
	}
}

func (tc *acHandlerTestContext) an_update_ac_item_command(runeID, acID, scenario, desc string) {
	tc.t.Helper()
	tc.updateACItemCmd = UpdateACItem{
		RuneID:      runeID,
		ID:          acID,
		Scenario:    scenario,
		Description: desc,
	}
}

func (tc *acHandlerTestContext) a_remove_ac_item_command(runeID, acID string) {
	tc.t.Helper()
	tc.removeACItemCmd = RemoveACItem{
		RuneID: runeID,
		ID:     acID,
	}
}

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

func (tc *acHandlerTestContext) handle_add_ac_item() {
	tc.t.Helper()
	tc.err = HandleAddACItem(tc.ctx, tc.realmID, tc.addACItemCmd, tc.eventStore)
}

func (tc *acHandlerTestContext) handle_update_ac_item() {
	tc.t.Helper()
	tc.err = HandleUpdateACItem(tc.ctx, tc.realmID, tc.updateACItemCmd, tc.eventStore)
}

func (tc *acHandlerTestContext) handle_remove_ac_item() {
	tc.t.Helper()
	tc.err = HandleRemoveACItem(tc.ctx, tc.realmID, tc.removeACItemCmd, tc.eventStore)
}

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

func (tc *acHandlerTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *acHandlerTestContext) error_contains(substr string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), substr)
}

func (tc *acHandlerTestContext) error_is_not_found(entity, id string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	var nfe *core.NotFoundError
	require.True(tc.t, errors.As(tc.err, &nfe), "expected NotFoundError, got %T: %v", tc.err, tc.err)
	assert.Equal(tc.t, entity, nfe.Entity)
	assert.Equal(tc.t, id, nfe.ID)
}

func (tc *acHandlerTestContext) event_was_appended_to_stream(streamID string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	found := false
	for _, call := range tc.eventStore.appendedCalls {
		if call.streamID == streamID {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected Append to stream %q, got: %v", streamID, tc.eventStore.appendedCalls)
}

func (tc *acHandlerTestContext) appended_event_has_type(eventType string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	require.NotEmpty(tc.t, lastCall.events, "expected at least one event in Append call")
	found := false
	for _, evt := range lastCall.events {
		if evt.EventType == eventType {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected event type %q in appended events", eventType)
}

func (tc *acHandlerTestContext) appended_ac_added_event_has_id(expected string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	for _, evt := range lastCall.events {
		if evt.EventType == EventRuneACAdded {
			dataBytes, _ := json.Marshal(evt.Data)
			var data RuneACAdded
			require.NoError(tc.t, json.Unmarshal(dataBytes, &data))
			assert.Equal(tc.t, expected, data.ID, "expected AC ID %q, got %q", expected, data.ID)
			return
		}
	}
	tc.t.Fatalf("no %s event found in last Append call", EventRuneACAdded)
}

func (tc *acHandlerTestContext) appended_ac_added_event_has_scenario(expected string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	for _, evt := range lastCall.events {
		if evt.EventType == EventRuneACAdded {
			dataBytes, _ := json.Marshal(evt.Data)
			var data RuneACAdded
			require.NoError(tc.t, json.Unmarshal(dataBytes, &data))
			assert.Equal(tc.t, expected, data.Scenario)
			return
		}
	}
	tc.t.Fatalf("no %s event found in last Append call", EventRuneACAdded)
}

func (tc *acHandlerTestContext) appended_ac_added_event_has_description(expected string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	for _, evt := range lastCall.events {
		if evt.EventType == EventRuneACAdded {
			dataBytes, _ := json.Marshal(evt.Data)
			var data RuneACAdded
			require.NoError(tc.t, json.Unmarshal(dataBytes, &data))
			assert.Equal(tc.t, expected, data.Description)
			return
		}
	}
	tc.t.Fatalf("no %s event found in last Append call", EventRuneACAdded)
}
