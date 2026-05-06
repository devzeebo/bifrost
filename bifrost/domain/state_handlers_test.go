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
// Tests
// ---------------------------------------------------------------------------

func TestHandleUpdateRuneState(t *testing.T) {
	t.Run("applies patch to rune state", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.an_update_state_command("bf-a1b2", `{"coverage": 85, "tested": false}`)

		// When
		tc.handle_update_state()

		// Then
		tc.no_error()
		tc.event_was_appended_to_stream("rune-bf-a1b2")
		tc.appended_event_has_type(EventRuneStateUpdated)
		tc.appended_state_event_has_patch(`{"coverage":85,"tested":false}`)
	})

	t.Run("merges patch with existing state", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_with_state_in_stream("bf-a1b2", `{"coverage": 50, "legacy": true}`)
		tc.an_update_state_command("bf-a1b2", `{"coverage": 75}`)

		// When
		tc.handle_update_state()

		// Then
		tc.no_error()
		tc.appended_state_event_has_patch(`{"coverage":75}`)
	})

	t.Run("deletes fields with null values", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_with_state_in_stream("bf-a1b2", `{"coverage": 50, "legacy": true}`)
		tc.an_update_state_command("bf-a1b2", `{"legacy": null}`)

		// When
		tc.handle_update_state()

		// Then
		tc.no_error()
		tc.appended_state_event_has_patch(`{"legacy":null}`)
	})

	t.Run("returns error when rune does not exist", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.empty_stream("bf-missing")
		tc.an_update_state_command("bf-missing", `{"foo": "bar"}`)

		// When
		tc.handle_update_state()

		// Then
		tc.error_is_not_found("rune", "bf-missing")
	})

	t.Run("returns error for invalid JSON patch", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.an_update_state_command("bf-a1b2", `{invalid json}`)

		// When
		tc.handle_update_state()

		// Then
		tc.error_contains("invalid patch JSON")
	})

	t.Run("returns error when patch is not an object", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.an_update_state_command("bf-a1b2", `null`)

		// When
		tc.handle_update_state()

		// Then
		tc.error_contains("must be a JSON object")
	})

	t.Run("returns error when patch is an array", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.an_update_state_command("bf-a1b2", `["array", "values"]`)

		// When
		tc.handle_update_state()

		// Then
		tc.error_contains("cannot unmarshal array")
	})

	t.Run("state-gating: returns error when rune is shattered", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "shattered")
		tc.an_update_state_command("bf-a1b2", `{"foo": "bar"}`)

		// When
		tc.handle_update_state()

		// Then
		tc.error_contains("shattered")
	})

	t.Run("allows state update on sealed rune", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "sealed")
		tc.an_update_state_command("bf-a1b2", `{"foo": "bar"}`)

		// When
		tc.handle_update_state()

		// Then
		tc.no_error()
	})

	t.Run("allows state update on draft rune", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "draft")
		tc.an_update_state_command("bf-a1b2", `{"foo": "bar"}`)

		// When
		tc.handle_update_state()

		// Then
		tc.no_error()
	})

	t.Run("allows state update on failed rune", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "failed")
		tc.an_update_state_command("bf-a1b2", `{"foo": "bar"}`)

		// When
		tc.handle_update_state()

		// Then
		tc.no_error()
	})
}

func TestHandleClearRuneState(t *testing.T) {
	t.Run("clears all rune state with empty patch", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_with_state_in_stream("bf-a1b2", `{"coverage": 50, "legacy": true}`)
		tc.a_clear_state_command("bf-a1b2")

		// When
		tc.handle_clear_state()

		// Then
		tc.no_error()
		tc.event_was_appended_to_stream("rune-bf-a1b2")
		tc.appended_event_has_type(EventRuneStateUpdated)
	})

	t.Run("returns error when rune does not exist", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.empty_stream("bf-missing")
		tc.a_clear_state_command("bf-missing")

		// When
		tc.handle_clear_state()

		// Then
		tc.error_is_not_found("rune", "bf-missing")
	})

	t.Run("state-gating: returns error when rune is shattered", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "shattered")
		tc.a_clear_state_command("bf-a1b2")

		// When
		tc.handle_clear_state()

		// Then
		tc.error_contains("shattered")
	})

	t.Run("allows clearing state on sealed rune", func(t *testing.T) {
		tc := newStateHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_rune_with_state_in_stream("bf-a1b2", `{"foo": "bar"}`)
		tc.existing_rune_in_stream("bf-a1b2", "sealed")
		tc.a_clear_state_command("bf-a1b2")

		// When
		tc.handle_clear_state()

		// Then
		tc.no_error()
	})
}

// ---------------------------------------------------------------------------
// Test Context
// ---------------------------------------------------------------------------

type stateHandlerTestContext struct {
	t       *testing.T
	ctx     context.Context
	realmID string

	eventStore     *mockEventStore
	updateStateCmd UpdateRuneState
	clearStateCmd  ClearRuneState
	err            error
}

func newStateHandlerTestContext(t *testing.T) *stateHandlerTestContext {
	t.Helper()
	return &stateHandlerTestContext{
		t:       t,
		ctx:     context.Background(),
		realmID: "realm-1",
	}
}

// ---------------------------------------------------------------------------
// Given
// ---------------------------------------------------------------------------

func (tc *stateHandlerTestContext) an_event_store() {
	tc.t.Helper()
	if tc.eventStore == nil {
		tc.eventStore = newMockEventStore()
	}
}

func (tc *stateHandlerTestContext) existing_rune_in_stream(runeID, status string) {
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
	case "failed":
		events = append(events, makeEvent(EventRuneForged, RuneForged{ID: runeID}))
		events = append(events, makeEvent(EventRuneClaimed, RuneClaimed{ID: runeID, Claimant: "someone"}))
		events = append(events, makeEvent(EventRuneFailed, RuneFailed{ID: runeID, Reason: "broke"}))
	case "draft":
		// No additional events needed
	}
	tc.eventStore.streams["rune-"+runeID] = events
}

func (tc *stateHandlerTestContext) existing_rune_with_state_in_stream(runeID, stateJSON string) {
	tc.t.Helper()
	tc.an_event_store()
	var state map[string]any
	_ = json.Unmarshal([]byte(stateJSON), &state)

	events := []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{ID: runeID, Title: "Existing rune", Priority: 1}),
		makeEvent(EventRuneForged, RuneForged{ID: runeID}),
		makeEvent(EventRuneStateUpdated, RuneStateUpdated{
			RuneID: runeID,
			Patch:  state,
		}),
	}
	tc.eventStore.streams["rune-"+runeID] = events
}

func (tc *stateHandlerTestContext) empty_stream(runeID string) {
	tc.t.Helper()
	tc.an_event_store()
	tc.eventStore.streams["rune-"+runeID] = []core.Event{}
}

func (tc *stateHandlerTestContext) an_update_state_command(runeID, patch string) {
	tc.t.Helper()
	tc.updateStateCmd = UpdateRuneState{
		RuneID: runeID,
		Patch:  patch,
	}
}

func (tc *stateHandlerTestContext) a_clear_state_command(runeID string) {
	tc.t.Helper()
	tc.clearStateCmd = ClearRuneState{
		RuneID: runeID,
	}
}

// ---------------------------------------------------------------------------
// When
// ---------------------------------------------------------------------------

func (tc *stateHandlerTestContext) handle_update_state() {
	tc.t.Helper()
	tc.err = HandleUpdateRuneState(tc.ctx, tc.realmID, tc.updateStateCmd, tc.eventStore)
}

func (tc *stateHandlerTestContext) handle_clear_state() {
	tc.t.Helper()
	tc.err = HandleClearRuneState(tc.ctx, tc.realmID, tc.clearStateCmd, tc.eventStore)
}

// ---------------------------------------------------------------------------
// Then
// ---------------------------------------------------------------------------

func (tc *stateHandlerTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *stateHandlerTestContext) error_contains(substr string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), substr)
}

func (tc *stateHandlerTestContext) error_is_not_found(entity, id string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	var nfe *core.NotFoundError
	require.True(tc.t, errors.As(tc.err, &nfe), "expected NotFoundError, got %T: %v", tc.err, tc.err)
	assert.Equal(tc.t, entity, nfe.Entity)
	assert.Equal(tc.t, id, nfe.ID)
}

func (tc *stateHandlerTestContext) event_was_appended_to_stream(streamID string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	found := false
	for _, call := range tc.eventStore.appendedCalls {
		if call.streamID == streamID {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected Append to stream %q", streamID)
}

func (tc *stateHandlerTestContext) appended_event_has_type(eventType string) {
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
	assert.True(tc.t, found, "expected event type %q", eventType)
}

func (tc *stateHandlerTestContext) appended_state_event_has_patch(expectedPatchJSON string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]

	// Normalize expected JSON
	var expectedPatch map[string]any
	require.NoError(tc.t, json.Unmarshal([]byte(expectedPatchJSON), &expectedPatch))

	found := false
	for _, evt := range lastCall.events {
		if evt.EventType == EventRuneStateUpdated {
			dataBytes, _ := json.Marshal(evt.Data)
			var data RuneStateUpdated
			require.NoError(tc.t, json.Unmarshal(dataBytes, &data))

			// Compare JSON after normalization
			actualBytes, _ := json.Marshal(data.Patch)
			expectedBytes, _ := json.Marshal(expectedPatch)
			assert.JSONEq(tc.t, string(expectedBytes), string(actualBytes), "patch mismatch")
			found = true
			break
		}
	}
	require.True(tc.t, found, "no %s event found in last Append call", EventRuneStateUpdated)
}
