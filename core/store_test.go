package core

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
)

// Compile-time interface satisfaction checks
var _ EventStore = (*mockEventStore)(nil)
var _ ProjectionStore = (*mockProjectionStore)(nil)
var _ CheckpointStore = (*mockCheckpointStore)(nil)

// --- Tests ---

func TestEventStore(t *testing.T) {
	t.Run("Append accepts context, realmID, streamID, expectedVersion, and events", func(t *testing.T) {
		tc := newStoreTestContext(t)

		// Given
		tc.a_mock_event_store()

		// When
		tc.append_is_called()

		// Then
		tc.append_returns_events_and_error()
	})

	t.Run("ReadStream accepts context, realmID, streamID, and fromVersion", func(t *testing.T) {
		tc := newStoreTestContext(t)

		// Given
		tc.a_mock_event_store()

		// When
		tc.read_stream_is_called()

		// Then
		tc.read_stream_returns_events_and_error()
	})

	t.Run("ReadAll accepts context, realmID, and fromGlobalPosition", func(t *testing.T) {
		tc := newStoreTestContext(t)

		// Given
		tc.a_mock_event_store()

		// When
		tc.read_all_is_called()

		// Then
		tc.read_all_returns_events_and_error()
	})
}

func TestProjectionStore(t *testing.T) {
	t.Run("Get accepts context, realmID, projectionName, key, and dest", func(t *testing.T) {
		tc := newStoreTestContext(t)

		// Given
		tc.a_mock_projection_store()

		// When
		tc.get_is_called()

		// Then
		tc.get_returns_error()
	})

	t.Run("Put accepts context, realmID, projectionName, key, and value", func(t *testing.T) {
		tc := newStoreTestContext(t)

		// Given
		tc.a_mock_projection_store()

		// When
		tc.put_is_called()

		// Then
		tc.put_returns_error()
	})

	t.Run("Delete accepts context, realmID, projectionName, and key", func(t *testing.T) {
		tc := newStoreTestContext(t)

		// Given
		tc.a_mock_projection_store()

		// When
		tc.delete_is_called()

		// Then
		tc.delete_returns_error()
	})
}

func TestCheckpointStore(t *testing.T) {
	t.Run("GetCheckpoint accepts context, realmID, and projectorName", func(t *testing.T) {
		tc := newStoreTestContext(t)

		// Given
		tc.a_mock_checkpoint_store()

		// When
		tc.get_checkpoint_is_called()

		// Then
		tc.get_checkpoint_returns_position_and_error()
	})

	t.Run("SetCheckpoint accepts context, realmID, projectorName, and globalPosition", func(t *testing.T) {
		tc := newStoreTestContext(t)

		// Given
		tc.a_mock_checkpoint_store()

		// When
		tc.set_checkpoint_is_called()

		// Then
		tc.set_checkpoint_returns_error()
	})
}

// --- Test Context ---

type storeTestContext struct {
	t *testing.T

	eventStore      EventStore
	projectionStore ProjectionStore
	checkpointStore CheckpointStore

	appendResult    []Event
	appendErr       error
	readResult      []Event
	readErr         error
	readAllResult   []Event
	readAllErr      error
	getErr          error
	putErr          error
	deleteErr       error
	checkpointPos   int64
	checkpointErr   error
	setChkErr       error
}

func newStoreTestContext(t *testing.T) *storeTestContext {
	t.Helper()
	return &storeTestContext{t: t}
}

// --- Given ---

func (tc *storeTestContext) a_mock_event_store() {
	tc.t.Helper()
	tc.eventStore = &mockEventStore{}
}

func (tc *storeTestContext) a_mock_projection_store() {
	tc.t.Helper()
	tc.projectionStore = &mockProjectionStore{}
}

func (tc *storeTestContext) a_mock_checkpoint_store() {
	tc.t.Helper()
	tc.checkpointStore = &mockCheckpointStore{}
}

// --- When ---

func (tc *storeTestContext) append_is_called() {
	tc.t.Helper()
	tc.appendResult, tc.appendErr = tc.eventStore.Append(
		context.Background(), "realm-1", "stream-1", 0, []EventData{},
	)
}

func (tc *storeTestContext) read_stream_is_called() {
	tc.t.Helper()
	tc.readResult, tc.readErr = tc.eventStore.ReadStream(
		context.Background(), "realm-1", "stream-1", 0,
	)
}

func (tc *storeTestContext) read_all_is_called() {
	tc.t.Helper()
	tc.readAllResult, tc.readAllErr = tc.eventStore.ReadAll(
		context.Background(), "realm-1", 0,
	)
}

func (tc *storeTestContext) get_is_called() {
	tc.t.Helper()
	var dest map[string]any
	tc.getErr = tc.projectionStore.Get(
		context.Background(), "realm-1", "projection-1", "key-1", &dest,
	)
}

func (tc *storeTestContext) put_is_called() {
	tc.t.Helper()
	tc.putErr = tc.projectionStore.Put(
		context.Background(), "realm-1", "projection-1", "key-1", map[string]any{"foo": "bar"},
	)
}

func (tc *storeTestContext) delete_is_called() {
	tc.t.Helper()
	tc.deleteErr = tc.projectionStore.Delete(
		context.Background(), "realm-1", "projection-1", "key-1",
	)
}

func (tc *storeTestContext) get_checkpoint_is_called() {
	tc.t.Helper()
	tc.checkpointPos, tc.checkpointErr = tc.checkpointStore.GetCheckpoint(
		context.Background(), "realm-1", "projector-1",
	)
}

func (tc *storeTestContext) set_checkpoint_is_called() {
	tc.t.Helper()
	tc.setChkErr = tc.checkpointStore.SetCheckpoint(
		context.Background(), "realm-1", "projector-1", 42,
	)
}

// --- Then ---

func (tc *storeTestContext) append_returns_events_and_error() {
	tc.t.Helper()
	assert.IsType(tc.t, []Event{}, tc.appendResult)
	assert.NoError(tc.t, tc.appendErr)
}

func (tc *storeTestContext) read_stream_returns_events_and_error() {
	tc.t.Helper()
	assert.IsType(tc.t, []Event{}, tc.readResult)
	assert.NoError(tc.t, tc.readErr)
}

func (tc *storeTestContext) read_all_returns_events_and_error() {
	tc.t.Helper()
	assert.IsType(tc.t, []Event{}, tc.readAllResult)
	assert.NoError(tc.t, tc.readAllErr)
}

func (tc *storeTestContext) get_returns_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.getErr)
}

func (tc *storeTestContext) put_returns_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.putErr)
}

func (tc *storeTestContext) delete_returns_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.deleteErr)
}

func (tc *storeTestContext) get_checkpoint_returns_position_and_error() {
	tc.t.Helper()
	assert.IsType(tc.t, int64(0), tc.checkpointPos)
	assert.NoError(tc.t, tc.checkpointErr)
}

func (tc *storeTestContext) set_checkpoint_returns_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.setChkErr)
}

// --- Mocks ---

type mockEventStore struct{}

func (m *mockEventStore) Append(_ context.Context, _ string, _ string, _ int, _ []EventData) ([]Event, error) {
	return []Event{}, nil
}

func (m *mockEventStore) ReadStream(_ context.Context, _ string, _ string, _ int) ([]Event, error) {
	return []Event{}, nil
}

func (m *mockEventStore) ReadAll(_ context.Context, _ string, _ int64) ([]Event, error) {
	return []Event{}, nil
}

func (m *mockEventStore) ListRealmIDs(_ context.Context) ([]string, error) {
	return []string{}, nil
}

type mockProjectionStore struct{}

func (m *mockProjectionStore) Get(_ context.Context, _ string, _ string, _ string, _ any) error {
	return nil
}

func (m *mockProjectionStore) Put(_ context.Context, _ string, _ string, _ string, _ any) error {
	return nil
}

func (m *mockProjectionStore) List(_ context.Context, _ string, _ string) ([]json.RawMessage, error) {
	return nil, nil
}

func (m *mockProjectionStore) Delete(_ context.Context, _ string, _ string, _ string) error {
	return nil
}

type mockCheckpointStore struct{}

func (m *mockCheckpointStore) GetCheckpoint(_ context.Context, _ string, _ string) (int64, error) {
	return 0, nil
}

func (m *mockCheckpointStore) SetCheckpoint(_ context.Context, _ string, _ string, _ int64) error {
	return nil
}
