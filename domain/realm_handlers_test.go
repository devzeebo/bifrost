package domain

import (
	"context"
	"errors"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestRebuildRealmState(t *testing.T) {
	t.Run("returns empty state for no events", func(t *testing.T) {
		tc := newRealmHandlerTestContext(t)

		// Given
		tc.no_realm_events()

		// When
		tc.realm_state_is_rebuilt()

		// Then
		tc.realm_state_does_not_exist()
	})

	t.Run("rebuilds state from RealmCreated event", func(t *testing.T) {
		tc := newRealmHandlerTestContext(t)

		// Given
		tc.events_from_created_realm()

		// When
		tc.realm_state_is_rebuilt()

		// Then
		tc.realm_state_exists()
		tc.realm_state_has_id("bf-a1b2")
		tc.realm_state_has_name("Test Realm")
		tc.realm_state_has_status("active")
	})

	t.Run("applies RealmSuspended", func(t *testing.T) {
		tc := newRealmHandlerTestContext(t)

		// Given
		tc.events_from_created_and_suspended_realm()

		// When
		tc.realm_state_is_rebuilt()

		// Then
		tc.realm_state_has_status("suspended")
	})
}

func TestHandleCreateRealm(t *testing.T) {
	t.Run("creates a realm with generated ID", func(t *testing.T) {
		tc := newRealmHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.a_create_realm_command("My Realm")

		// When
		tc.handle_create_realm()

		// Then
		tc.no_realm_error()
		tc.create_realm_result_has_realm_id_matching_pattern()
		tc.create_realm_event_was_appended_to_admin_realm()
		tc.create_realm_event_stream_has_realm_prefix()
	})
}

func TestHandleSuspendRealm(t *testing.T) {
	t.Run("suspends an active realm", func(t *testing.T) {
		tc := newRealmHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_realm_in_stream("bf-a1b2", "active")
		tc.a_suspend_realm_command("bf-a1b2", "policy violation")

		// When
		tc.handle_suspend_realm()

		// Then
		tc.no_realm_error()
		tc.realm_event_was_appended_to_stream("realm-bf-a1b2")
		tc.appended_realm_event_has_type(EventRealmSuspended)
	})

	t.Run("returns error when realm does not exist", func(t *testing.T) {
		tc := newRealmHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.empty_realm_stream("bf-missing")
		tc.a_suspend_realm_command("bf-missing", "reason")

		// When
		tc.handle_suspend_realm()

		// Then
		tc.realm_error_is_not_found("realm", "bf-missing")
	})

	t.Run("returns error when realm is already suspended", func(t *testing.T) {
		tc := newRealmHandlerTestContext(t)

		// Given
		tc.an_event_store()
		tc.existing_realm_in_stream("bf-a1b2", "suspended")
		tc.a_suspend_realm_command("bf-a1b2", "another reason")

		// When
		tc.handle_suspend_realm()

		// Then
		tc.realm_error_contains("suspended")
	})
}

// --- Test Context ---

type realmHandlerTestContext struct {
	t *testing.T

	eventStore *mockEventStore
	ctx        context.Context

	createRealmCmd  CreateRealm
	suspendRealmCmd SuspendRealm

	createRealmResult CreateRealmResult
	realmState        RealmState
	realmEvents       []core.Event
	err               error
}

func newRealmHandlerTestContext(t *testing.T) *realmHandlerTestContext {
	t.Helper()
	return &realmHandlerTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *realmHandlerTestContext) an_event_store() {
	tc.t.Helper()
	if tc.eventStore == nil {
		tc.eventStore = newMockEventStore()
	}
}

func (tc *realmHandlerTestContext) no_realm_events() {
	tc.t.Helper()
	tc.realmEvents = []core.Event{}
}

func (tc *realmHandlerTestContext) events_from_created_realm() {
	tc.t.Helper()
	tc.realmEvents = []core.Event{
		makeEvent(EventRealmCreated, RealmCreated{
			RealmID: "bf-a1b2", Name: "Test Realm",
		}),
	}
}

func (tc *realmHandlerTestContext) events_from_created_and_suspended_realm() {
	tc.t.Helper()
	tc.realmEvents = []core.Event{
		makeEvent(EventRealmCreated, RealmCreated{
			RealmID: "bf-a1b2", Name: "Test Realm",
		}),
		makeEvent(EventRealmSuspended, RealmSuspended{
			RealmID: "bf-a1b2", Reason: "policy violation",
		}),
	}
}

func (tc *realmHandlerTestContext) existing_realm_in_stream(realmID string, status string) {
	tc.t.Helper()
	tc.an_event_store()
	events := []core.Event{
		makeEvent(EventRealmCreated, RealmCreated{
			RealmID: realmID, Name: "Existing Realm",
		}),
	}
	if status == "suspended" {
		events = append(events, makeEvent(EventRealmSuspended, RealmSuspended{
			RealmID: realmID, Reason: "suspended",
		}))
	}
	tc.eventStore.streams["realm-"+realmID] = events
}

func (tc *realmHandlerTestContext) empty_realm_stream(realmID string) {
	tc.t.Helper()
	tc.an_event_store()
	tc.eventStore.streams["realm-"+realmID] = []core.Event{}
}

func (tc *realmHandlerTestContext) a_create_realm_command(name string) {
	tc.t.Helper()
	tc.createRealmCmd = CreateRealm{Name: name}
}

func (tc *realmHandlerTestContext) a_suspend_realm_command(realmID, reason string) {
	tc.t.Helper()
	tc.suspendRealmCmd = SuspendRealm{RealmID: realmID, Reason: reason}
}

// --- When ---

func (tc *realmHandlerTestContext) realm_state_is_rebuilt() {
	tc.t.Helper()
	tc.realmState = rebuildRealmState(tc.realmEvents)
}

func (tc *realmHandlerTestContext) handle_create_realm() {
	tc.t.Helper()
	tc.createRealmResult, tc.err = HandleCreateRealm(tc.ctx, tc.createRealmCmd, tc.eventStore)
}

func (tc *realmHandlerTestContext) handle_suspend_realm() {
	tc.t.Helper()
	tc.err = HandleSuspendRealm(tc.ctx, tc.suspendRealmCmd, tc.eventStore)
}

// --- Then ---

func (tc *realmHandlerTestContext) no_realm_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *realmHandlerTestContext) realm_error_contains(substring string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), substring)
}

func (tc *realmHandlerTestContext) realm_error_is_not_found(entity, id string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	var nfe *core.NotFoundError
	require.True(tc.t, errors.As(tc.err, &nfe), "expected NotFoundError, got %T: %v", tc.err, tc.err)
	assert.Equal(tc.t, entity, nfe.Entity)
	assert.Equal(tc.t, id, nfe.ID)
}

func (tc *realmHandlerTestContext) realm_state_does_not_exist() {
	tc.t.Helper()
	assert.False(tc.t, tc.realmState.Exists)
}

func (tc *realmHandlerTestContext) realm_state_exists() {
	tc.t.Helper()
	assert.True(tc.t, tc.realmState.Exists)
}

func (tc *realmHandlerTestContext) realm_state_has_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.realmState.RealmID)
}

func (tc *realmHandlerTestContext) realm_state_has_name(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.realmState.Name)
}

func (tc *realmHandlerTestContext) realm_state_has_status(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.realmState.Status)
}

func (tc *realmHandlerTestContext) create_realm_result_has_realm_id_matching_pattern() {
	tc.t.Helper()
	assert.Regexp(tc.t, `^bf-[0-9a-f]{4}$`, tc.createRealmResult.RealmID)
}

func (tc *realmHandlerTestContext) create_realm_event_was_appended_to_admin_realm() {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	assert.Equal(tc.t, AdminRealmID, lastCall.realmID)
}

func (tc *realmHandlerTestContext) create_realm_event_stream_has_realm_prefix() {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	assert.Contains(tc.t, lastCall.streamID, "realm-")
}

func (tc *realmHandlerTestContext) realm_event_was_appended_to_stream(streamID string) {
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

func (tc *realmHandlerTestContext) appended_realm_event_has_type(eventType string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	require.NotEmpty(tc.t, lastCall.events)
	found := false
	for _, evt := range lastCall.events {
		if evt.EventType == eventType {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected event type %q in appended events", eventType)
}
