package domain

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestRealmEventTypeConstants(t *testing.T) {
	t.Run("all realm event type constants have correct values", func(t *testing.T) {
		tc := newRealmEvtTestContext(t)

		// Then
		tc.realm_event_type_constants_are_correct()
	})
}

func TestRealmCreatedEvent(t *testing.T) {
	t.Run("serializes and deserializes with all fields", func(t *testing.T) {
		tc := newRealmEvtTestContext(t)

		// Given
		tc.realm_created_event()

		// When
		tc.marshal_and_unmarshal_realm_created()

		// Then
		tc.realm_created_fields_match()
		tc.realm_created_json_has_expected_keys()
	})
}

func TestRealmSuspendedEvent(t *testing.T) {
	t.Run("serializes and deserializes with all fields", func(t *testing.T) {
		tc := newRealmEvtTestContext(t)

		// Given
		tc.realm_suspended_event()

		// When
		tc.marshal_and_unmarshal_realm_suspended()

		// Then
		tc.realm_suspended_fields_match()
	})
}

// --- Test Context ---

type realmEvtTestContext struct {
	t *testing.T

	realmCreated   RealmCreated
	realmSuspended RealmSuspended

	jsonBytes []byte
	jsonMap   map[string]any

	roundTrippedCreated   RealmCreated
	roundTrippedSuspended RealmSuspended
}

func newRealmEvtTestContext(t *testing.T) *realmEvtTestContext {
	t.Helper()
	return &realmEvtTestContext{t: t}
}

// --- Given ---

func (tc *realmEvtTestContext) realm_created_event() {
	tc.t.Helper()
	tc.realmCreated = RealmCreated{
		RealmID:   "bf-a1b2",
		Name:      "Test Realm",
		CreatedAt: time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
	}
}

func (tc *realmEvtTestContext) realm_suspended_event() {
	tc.t.Helper()
	tc.realmSuspended = RealmSuspended{
		RealmID: "bf-a1b2",
		Reason:  "policy violation",
	}
}

// --- When ---

func (tc *realmEvtTestContext) marshal_and_unmarshal_realm_created() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.realmCreated)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedCreated))
}

func (tc *realmEvtTestContext) marshal_and_unmarshal_realm_suspended() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.realmSuspended)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedSuspended))
}

// --- Then ---

func (tc *realmEvtTestContext) realm_event_type_constants_are_correct() {
	tc.t.Helper()
	assert.Equal(tc.t, "RealmCreated", EventRealmCreated)
	assert.Equal(tc.t, "RealmSuspended", EventRealmSuspended)
}

func (tc *realmEvtTestContext) realm_created_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.realmCreated.RealmID, tc.roundTrippedCreated.RealmID)
	assert.Equal(tc.t, tc.realmCreated.Name, tc.roundTrippedCreated.Name)
	assert.True(tc.t, tc.realmCreated.CreatedAt.Equal(tc.roundTrippedCreated.CreatedAt))
}

func (tc *realmEvtTestContext) realm_created_json_has_expected_keys() {
	tc.t.Helper()
	assert.Contains(tc.t, tc.jsonMap, "realm_id")
	assert.Contains(tc.t, tc.jsonMap, "name")
	assert.Contains(tc.t, tc.jsonMap, "created_at")
}

func (tc *realmEvtTestContext) realm_suspended_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.realmSuspended, tc.roundTrippedSuspended)
}
