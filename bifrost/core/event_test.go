package core

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestEvent(t *testing.T) {
	t.Run("marshals to JSON with correct field names", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.a_fully_populated_event()

		// When
		tc.event_is_marshaled_to_json()

		// Then
		tc.json_contains_key("realm_id")
		tc.json_contains_key("stream_id")
		tc.json_contains_key("version")
		tc.json_contains_key("global_position")
		tc.json_contains_key("event_type")
		tc.json_contains_key("data")
		tc.json_contains_key("metadata")
		tc.json_contains_key("timestamp")
	})

	t.Run("unmarshals from JSON with correct field mapping", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.a_fully_populated_event()
		tc.event_is_marshaled_to_json()

		// When
		tc.json_is_unmarshaled_to_event()

		// Then
		tc.unmarshaled_event_matches_original()
	})
}

func TestEventData(t *testing.T) {
	t.Run("marshals to JSON with correct field names", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.a_fully_populated_event_data()

		// When
		tc.event_data_is_marshaled_to_json()

		// Then
		tc.event_data_json_contains_key("event_type")
		tc.event_data_json_contains_key("data")
		tc.event_data_json_contains_key("metadata")
	})

	t.Run("unmarshals from JSON with correct field mapping", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.a_fully_populated_event_data()
		tc.event_data_is_marshaled_to_json()

		// When
		tc.json_is_unmarshaled_to_event_data()

		// Then
		tc.unmarshaled_event_data_has_correct_event_type()
	})
}

// --- Test Context ---

type testContext struct {
	t *testing.T

	event          Event
	eventJSON      []byte
	eventMap       map[string]any
	unmarshaledEvt Event

	eventData          EventData
	eventDataJSON      []byte
	eventDataMap       map[string]any
	unmarshaledEvtData EventData
}

func newTestContext(t *testing.T) *testContext {
	t.Helper()
	return &testContext{t: t}
}

// --- Given ---

func (tc *testContext) a_fully_populated_event() {
	tc.t.Helper()
	tc.event = Event{
		RealmID:        "realm-1",
		StreamID:       "stream-1",
		Version:        1,
		GlobalPosition: 42,
		EventType:      "UserCreated",
		Data:           []byte(`{"name":"Alice"}`),
		Metadata:       []byte(`{"correlation_id":"abc"}`),
		Timestamp:      time.Date(2026, 2, 14, 12, 0, 0, 0, time.UTC),
	}
}

func (tc *testContext) a_fully_populated_event_data() {
	tc.t.Helper()
	tc.eventData = EventData{
		EventType: "UserCreated",
		Data:      map[string]string{"name": "Alice"},
		Metadata:  map[string]string{"correlation_id": "abc"},
	}
}

// --- When ---

func (tc *testContext) event_is_marshaled_to_json() {
	tc.t.Helper()
	var err error
	tc.eventJSON, err = json.Marshal(tc.event)
	require.NoError(tc.t, err)

	tc.eventMap = make(map[string]any)
	err = json.Unmarshal(tc.eventJSON, &tc.eventMap)
	require.NoError(tc.t, err)
}

func (tc *testContext) json_is_unmarshaled_to_event() {
	tc.t.Helper()
	err := json.Unmarshal(tc.eventJSON, &tc.unmarshaledEvt)
	require.NoError(tc.t, err)
}

func (tc *testContext) event_data_is_marshaled_to_json() {
	tc.t.Helper()
	var err error
	tc.eventDataJSON, err = json.Marshal(tc.eventData)
	require.NoError(tc.t, err)

	tc.eventDataMap = make(map[string]any)
	err = json.Unmarshal(tc.eventDataJSON, &tc.eventDataMap)
	require.NoError(tc.t, err)
}

func (tc *testContext) json_is_unmarshaled_to_event_data() {
	tc.t.Helper()
	err := json.Unmarshal(tc.eventDataJSON, &tc.unmarshaledEvtData)
	require.NoError(tc.t, err)
}

// --- Then ---

func (tc *testContext) json_contains_key(key string) {
	tc.t.Helper()
	_, ok := tc.eventMap[key]
	assert.True(tc.t, ok, "expected JSON to contain key %q", key)
}

func (tc *testContext) unmarshaled_event_matches_original() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.event.RealmID, tc.unmarshaledEvt.RealmID)
	assert.Equal(tc.t, tc.event.StreamID, tc.unmarshaledEvt.StreamID)
	assert.Equal(tc.t, tc.event.Version, tc.unmarshaledEvt.Version)
	assert.Equal(tc.t, tc.event.GlobalPosition, tc.unmarshaledEvt.GlobalPosition)
	assert.Equal(tc.t, tc.event.EventType, tc.unmarshaledEvt.EventType)
	assert.Equal(tc.t, tc.event.Data, tc.unmarshaledEvt.Data)
	assert.Equal(tc.t, tc.event.Metadata, tc.unmarshaledEvt.Metadata)
	assert.True(tc.t, tc.event.Timestamp.Equal(tc.unmarshaledEvt.Timestamp))
}

func (tc *testContext) event_data_json_contains_key(key string) {
	tc.t.Helper()
	_, ok := tc.eventDataMap[key]
	assert.True(tc.t, ok, "expected JSON to contain key %q", key)
}

func (tc *testContext) unmarshaled_event_data_has_correct_event_type() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.eventData.EventType, tc.unmarshaledEvtData.EventType)
}
