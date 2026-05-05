package sqlite

import (
	"context"
	"database/sql"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"modernc.org/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Compile-time interface satisfaction check
var _ core.EventStore = (*EventStore)(nil)

// --- Tests ---

func TestNewEventStore(t *testing.T) {
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

	t.Run("maintains independent versioning across streams", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_event_store_is_created()
		tc.stream_has_events("realm-1", "stream-1", 2)

		// When
		tc.append_is_called("realm-1", "stream-2", 0, []core.EventData{
			{EventType: "EventA", Data: map[string]string{"name": "first"}, Metadata: nil},
		})

		// Then
		tc.no_error_occurred()
		tc.appended_events_count_is(1)
		tc.appended_event_has_version(0, 1)
	})

	t.Run("appends multiple events atomically", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_event_store_is_created()

		// When
		tc.append_is_called("realm-1", "stream-1", 0, []core.EventData{
			{EventType: "EventA", Data: "a", Metadata: nil},
			{EventType: "EventB", Data: "b", Metadata: nil},
			{EventType: "EventC", Data: "c", Metadata: nil},
		})

		// Then
		tc.no_error_occurred()
		tc.appended_events_count_is(3)
		tc.appended_event_has_version(0, 1)
		tc.appended_event_has_version(1, 2)
		tc.appended_event_has_version(2, 3)
	})
}

func TestEventStore_ReadStream(t *testing.T) {
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

	t.Run("returns events from specified version", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_event_store_is_created()
		tc.stream_has_events("realm-1", "stream-1", 5)

		// When
		tc.read_stream_is_called("realm-1", "stream-1", 3)

		// Then
		tc.no_error_occurred()
		tc.read_events_count_is(3)
		tc.read_event_has_version(0, 3)
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

func TestEventStore_ReadAll(t *testing.T) {
	t.Run("returns events in global_position order across streams", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_event_store_is_created()
		tc.stream_has_events("realm-1", "stream-1", 2)
		tc.stream_has_events("realm-1", "stream-2", 2)

		// When
		tc.read_all_is_called("realm-1", 0)

		// Then
		tc.no_error_occurred()
		tc.read_events_count_is(4)
		tc.read_events_are_in_global_position_order()
	})

	t.Run("filters by realm_id", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_event_store_is_created()
		tc.stream_has_events("realm-1", "stream-1", 2)
		tc.stream_has_events("realm-2", "stream-1", 3)

		// When
		tc.read_all_is_called("realm-1", 0)

		// Then
		tc.no_error_occurred()
		tc.read_events_count_is(2)
		tc.all_read_events_have_realm("realm-1")
	})

	t.Run("returns events from specified global position", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_event_store_is_created()
		tc.stream_has_events("realm-1", "stream-1", 3)

		// When
		tc.read_all_is_called("realm-1", 2)

		// Then
		tc.no_error_occurred()
		tc.read_events_count_is(1)
		tc.read_event_has_global_position_greater_than(0, 2)
	})

	t.Run("returns empty slice when no events match", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_event_store_is_created()

		// When
		tc.read_all_is_called("realm-1", 0)

		// Then
		tc.no_error_occurred()
		tc.read_events_count_is(0)
		tc.read_events_is_empty_slice()
	})
}

func TestEventStore_Concurrency(t *testing.T) {
	t.Run("concurrent appends to same stream: one succeeds, one gets ConcurrencyError", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_file_database_with_wal()
		tc.new_event_store_is_created()

		// When
		tc.two_concurrent_appends_to_same_stream("realm-1", "stream-1")

		// Then
		tc.one_append_succeeded_and_one_got_concurrency_error()
	})
}

func TestEventStore_Append_StoresDataAsText(t *testing.T) {
	t.Run("stores data and metadata as text not blob", func(t *testing.T) {
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
		tc.stored_event_data_column_has_type("text")
		tc.stored_event_metadata_column_has_type("text")
	})

	t.Run("stores null metadata as null not blob", func(t *testing.T) {
		tc := newEventStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_event_store_is_created()

		// When
		tc.append_is_called("realm-1", "stream-1", 0, []core.EventData{
			{EventType: "UserCreated", Data: map[string]string{"name": "Alice"}, Metadata: nil},
		})

		// Then
		tc.no_error_occurred()
		tc.stored_event_metadata_column_has_type("null")
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
	concurrentErrs []error
}

func newEventStoreTestContext(t *testing.T) *eventStoreTestContext {
	t.Helper()
	return &eventStoreTestContext{t: t}
}

// --- Given ---

func (tc *eventStoreTestContext) a_database_with_schema() {
	tc.t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	require.NoError(tc.t, err)
	tc.t.Cleanup(func() { db.Close() })
	err = EnsureSchema(db)
	require.NoError(tc.t, err)
	tc.db = db
}

func (tc *eventStoreTestContext) a_file_database_with_wal() {
	tc.t.Helper()
	dir, err := os.MkdirTemp("", "bifrost-test-*")
	require.NoError(tc.t, err)
	tc.t.Cleanup(func() { os.RemoveAll(dir) })
	dbPath := filepath.Join(dir, "test.db")
	sqlite.RegisterConnectionHook(func(conn sqlite.ExecQuerierContext, _ string) error {
		_, err := conn.ExecContext(context.Background(), "PRAGMA journal_mode=WAL", nil)
		if err != nil {
			return err
		}
		_, err = conn.ExecContext(context.Background(), "PRAGMA busy_timeout=5000", nil)
		return err
	})
	db, err := sql.Open("sqlite", dbPath)
	require.NoError(tc.t, err)
	tc.t.Cleanup(func() {
		db.Close()
		sqlite.RegisterConnectionHook(func(sqlite.ExecQuerierContext, string) error { return nil })
	})
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

func (tc *eventStoreTestContext) read_all_is_called(realmID string, fromGlobalPosition int64) {
	tc.t.Helper()
	tc.readEvents, tc.err = tc.store.ReadAll(context.Background(), realmID, fromGlobalPosition)
}

func (tc *eventStoreTestContext) two_concurrent_appends_to_same_stream(realmID, streamID string) {
	tc.t.Helper()
	var wg sync.WaitGroup
	var mu sync.Mutex
	tc.concurrentErrs = make([]error, 2)

	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, err := tc.store.Append(context.Background(), realmID, streamID, 0, []core.EventData{
				{EventType: "ConcurrentEvent", Data: map[string]string{"idx": string(rune('0' + idx))}, Metadata: nil},
			})
			mu.Lock()
			tc.concurrentErrs[idx] = err
			mu.Unlock()
		}(i)
	}
	wg.Wait()
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

func (tc *eventStoreTestContext) read_event_has_version(index, expectedVersion int) {
	tc.t.Helper()
	require.Greater(tc.t, len(tc.readEvents), index)
	assert.Equal(tc.t, expectedVersion, tc.readEvents[index].Version)
}

func (tc *eventStoreTestContext) read_events_are_in_global_position_order() {
	tc.t.Helper()
	for i := 1; i < len(tc.readEvents); i++ {
		assert.Greater(tc.t, tc.readEvents[i].GlobalPosition, tc.readEvents[i-1].GlobalPosition)
	}
}

func (tc *eventStoreTestContext) all_read_events_have_realm(realmID string) {
	tc.t.Helper()
	for i, e := range tc.readEvents {
		assert.Equal(tc.t, realmID, e.RealmID, "event at index %d has wrong realm", i)
	}
}

func (tc *eventStoreTestContext) read_event_has_global_position_greater_than(index int, minPos int64) {
	tc.t.Helper()
	require.Greater(tc.t, len(tc.readEvents), index)
	assert.Greater(tc.t, tc.readEvents[index].GlobalPosition, minPos)
}

func (tc *eventStoreTestContext) stored_event_data_column_has_type(expectedType string) {
	tc.t.Helper()
	var colType string
	err := tc.db.QueryRow(`SELECT typeof(data) FROM events LIMIT 1`).Scan(&colType)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expectedType, colType)
}

func (tc *eventStoreTestContext) stored_event_metadata_column_has_type(expectedType string) {
	tc.t.Helper()
	var colType string
	err := tc.db.QueryRow(`SELECT typeof(metadata) FROM events LIMIT 1`).Scan(&colType)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expectedType, colType)
}

func (tc *eventStoreTestContext) one_append_succeeded_and_one_got_concurrency_error() {
	tc.t.Helper()
	require.Len(tc.t, tc.concurrentErrs, 2)

	successCount := 0
	concurrencyErrCount := 0
	for _, err := range tc.concurrentErrs {
		if err == nil {
			successCount++
		} else {
			var concErr *core.ConcurrencyError
			if assert.ErrorAs(tc.t, err, &concErr) {
				concurrencyErrCount++
			}
		}
	}
	assert.Equal(tc.t, 1, successCount, "expected exactly one successful append")
	assert.Equal(tc.t, 1, concurrencyErrCount, "expected exactly one ConcurrencyError")
}
