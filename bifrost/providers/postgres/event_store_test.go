package postgres

import (
	"context"
	"database/sql"
	"os"
	"testing"

	"github.com/devzeebo/bifrost/core"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Compile-time interface satisfaction check
var _ core.EventStore = (*EventStore)(nil)

// --- Tests ---

func TestNewEventStore(t *testing.T) {
	t.Skip("Skipping PostgreSQL tests - requires database connection")
	
	t.Run("returns a valid store", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_database_with_schema()

		// When
		tc.new_event_store_is_created()

		// Then
		tc.no_error_occurred()
		tc.store_is_not_nil()
	})
}

func TestEventStore_Append(t *testing.T) {
	t.Skip("Skipping PostgreSQL tests - requires database connection")
	
	t.Run("succeeds for new stream with expectedVersion 0", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_event_store_is_created()

		// When
		tc.append_is_called("realm-1", "stream-1", 0, []core.EventData{
			{EventType: "UserCreated", Data: map[string]string{"name": "Alice"}, Metadata: map[string]string{"source": "test"}},
		})

		// Then
		tc.no_error_occurred()
		tc.appended_events_count_is(1)
		tc.appended_event_has_version(0, 1)
		tc.appended_event_has_global_position(0)
		tc.appended_event_has_type(0, "UserCreated")
		tc.appended_event_has_realm(0, "realm-1")
		tc.appended_event_has_stream(0, "stream-1")
		tc.appended_event_has_json_data(0)
		tc.appended_event_has_json_metadata(0)
		tc.appended_event_has_timestamp(0)
	})

	t.Run("succeeds for existing stream with correct expectedVersion", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_event_store_is_created()
		tc.stream_has_events("realm-1", "stream-1", 2)

		// When
		tc.append_is_called("realm-1", "stream-1", 2, []core.EventData{
			{EventType: "UserUpdated", Data: map[string]string{"name": "Bob"}, Metadata: nil},
		})

		// Then
		tc.no_error_occurred()
		tc.appended_events_count_is(1)
		tc.appended_event_has_version(0, 3)
	})

	t.Run("returns ConcurrencyError for wrong expectedVersion", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_event_store_is_created()
		tc.stream_has_events("realm-1", "stream-1", 2)

		// When
		tc.append_is_called("realm-1", "stream-1", 1, []core.EventData{
			{EventType: "UserUpdated", Data: map[string]string{"name": "Bob"}, Metadata: nil},
		})

		// Then
		tc.concurrency_error_is_returned("stream-1", 1, 2)
	})
}

func TestEventStore_ReadStream(t *testing.T) {
	t.Skip("Skipping PostgreSQL tests - requires database connection")
	
	t.Run("returns events in version order", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_event_store_is_created()
		tc.stream_has_events("realm-1", "stream-1", 3)

		// When
		tc.read_stream_is_called("realm-1", "stream-1", 1)

		// Then
		tc.no_error_occurred()
		tc.read_events_count_is(3)
		tc.read_events_are_in_version_order()
	})

	t.Run("returns empty slice for non-existent stream", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_event_store_is_created()

		// When
		tc.read_stream_is_called("realm-1", "no-such-stream", 1)

		// Then
		tc.no_error_occurred()
		tc.read_events_count_is(0)
		tc.read_events_is_empty_slice()
	})
}

// --- Test Context ---

type eventStoreTestContext struct {
	t              *testing.T
	db             *sql.DB
	store          *EventStore
	appendedEvents []core.Event
	readEvents     []core.Event
	err            error
}

func newEventStoreTestContext(t *testing.T) *eventStoreTestContext {
	t.Helper()
	return &eventStoreTestContext{t: t}
}

// --- Given ---

func (tc *eventStoreTestContext) a_database_with_schema() {
	tc.t.Helper()
	
	// Try to get connection string from environment
	connStr := os.Getenv("BIFROST_TEST_POSTGRES_URL")
	if connStr == "" {
		tc.t.Skip("BIFROST_TEST_POSTGRES_URL not set, skipping PostgreSQL tests")
		return
	}
	
	db, err := sql.Open("pgx", connStr)
	require.NoError(tc.t, err)
	tc.t.Cleanup(func() { db.Close() })
	
	// Test connection
	err = db.Ping()
	require.NoError(tc.t, err)
	
	// Clean schema and recreate
	_, err = db.Exec(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`)
	require.NoError(tc.t, err)
	
	err = EnsureSchema(db)
	require.NoError(tc.t, err)
	tc.db = db
}

func (tc *eventStoreTestContext) stream_has_events(realmID, streamID string, count int) {
	tc.t.Helper()
	events := make([]core.EventData, count)
	for i := 0; i < count; i++ {
		events[i] = core.EventData{
			EventType: "TestEvent",
			Data:      map[string]string{"index": string(rune('0' + i))},
			Metadata:  nil,
		}
	}
	_, err := tc.store.Append(context.Background(), realmID, streamID, 0, events)
	require.NoError(tc.t, err)
}

// --- When ---

func (tc *eventStoreTestContext) new_event_store_is_created() {
	tc.t.Helper()
	tc.store, tc.err = NewEventStore(tc.db)
}

func (tc *eventStoreTestContext) append_is_called(realmID, streamID string, expectedVersion int, events []core.EventData) {
	tc.t.Helper()
	tc.appendedEvents, tc.err = tc.store.Append(context.Background(), realmID, streamID, expectedVersion, events)
}

func (tc *eventStoreTestContext) read_stream_is_called(realmID, streamID string, fromVersion int) {
	tc.t.Helper()
	tc.readEvents, tc.err = tc.store.ReadStream(context.Background(), realmID, streamID, fromVersion)
}

// --- Then ---

func (tc *eventStoreTestContext) no_error_occurred() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *eventStoreTestContext) store_is_not_nil() {
	tc.t.Helper()
	assert.NotNil(tc.t, tc.store)
}

func (tc *eventStoreTestContext) appended_events_count_is(expected int) {
	tc.t.Helper()
	assert.Len(tc.t, tc.appendedEvents, expected)
}

func (tc *eventStoreTestContext) appended_event_has_version(index, expectedVersion int) {
	tc.t.Helper()
	require.Greater(tc.t, len(tc.appendedEvents), index)
	assert.Equal(tc.t, expectedVersion, tc.appendedEvents[index].Version)
}

func (tc *eventStoreTestContext) appended_event_has_global_position(index int) {
	tc.t.Helper()
	require.Greater(tc.t, len(tc.appendedEvents), index)
	assert.Greater(tc.t, tc.appendedEvents[index].GlobalPosition, int64(0))
}

func (tc *eventStoreTestContext) appended_event_has_type(index int, eventType string) {
	tc.t.Helper()
	require.Greater(tc.t, len(tc.appendedEvents), index)
	assert.Equal(tc.t, eventType, tc.appendedEvents[index].EventType)
}

func (tc *eventStoreTestContext) appended_event_has_realm(index int, realmID string) {
	tc.t.Helper()
	require.Greater(tc.t, len(tc.appendedEvents), index)
	assert.Equal(tc.t, realmID, tc.appendedEvents[index].RealmID)
}

func (tc *eventStoreTestContext) appended_event_has_stream(index int, streamID string) {
	tc.t.Helper()
	require.Greater(tc.t, len(tc.appendedEvents), index)
	assert.Equal(tc.t, streamID, tc.appendedEvents[index].StreamID)
}

func (tc *eventStoreTestContext) appended_event_has_json_data(index int) {
	tc.t.Helper()
	require.Greater(tc.t, len(tc.appendedEvents), index)
	assert.NotEmpty(tc.t, tc.appendedEvents[index].Data)
}

func (tc *eventStoreTestContext) appended_event_has_json_metadata(index int) {
	tc.t.Helper()
	require.Greater(tc.t, len(tc.appendedEvents), index)
	assert.NotEmpty(tc.t, tc.appendedEvents[index].Metadata)
}

func (tc *eventStoreTestContext) appended_event_has_timestamp(index int) {
	tc.t.Helper()
	require.Greater(tc.t, len(tc.appendedEvents), index)
	assert.False(tc.t, tc.appendedEvents[index].Timestamp.IsZero())
}

func (tc *eventStoreTestContext) concurrency_error_is_returned(streamID string, expectedVersion, actualVersion int) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	var concErr *core.ConcurrencyError
	require.ErrorAs(tc.t, tc.err, &concErr)
	assert.Equal(tc.t, streamID, concErr.StreamID)
	assert.Equal(tc.t, expectedVersion, concErr.ExpectedVersion)
	assert.Equal(tc.t, actualVersion, concErr.ActualVersion)
}

func (tc *eventStoreTestContext) read_events_count_is(expected int) {
	tc.t.Helper()
	assert.Len(tc.t, tc.readEvents, expected)
}

func (tc *eventStoreTestContext) read_events_is_empty_slice() {
	tc.t.Helper()
	assert.NotNil(tc.t, tc.readEvents)
	assert.Empty(tc.t, tc.readEvents)
}

func (tc *eventStoreTestContext) read_events_are_in_version_order() {
	tc.t.Helper()
	for i := 1; i < len(tc.readEvents); i++ {
		assert.Greater(tc.t, tc.readEvents[i].Version, tc.readEvents[i-1].Version)
	}
}