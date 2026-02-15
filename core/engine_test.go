package core

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Compile-time interface satisfaction check
var _ ProjectionEngine = (*projectionEngine)(nil)

// --- Tests ---

func TestNewProjectionEngine(t *testing.T) {
	t.Run("accepts all three store interfaces", func(t *testing.T) {
		tc := newEngineTestContext(t)

		// When
		tc.engine_is_created()

		// Then
		tc.engine_is_not_nil()
	})
}

func TestProjectionEngine_Register(t *testing.T) {
	t.Run("registers a projector", func(t *testing.T) {
		tc := newEngineTestContext(t)

		// Given
		tc.engine_is_created()
		tc.a_projector("projector-a")

		// When
		tc.register_is_called()

		// Then
		tc.projector_count_is(1)
	})

	t.Run("registers multiple projectors", func(t *testing.T) {
		tc := newEngineTestContext(t)

		// Given
		tc.engine_is_created()
		tc.a_projector("projector-a")
		tc.register_is_called()
		tc.a_projector("projector-b")

		// When
		tc.register_is_called()

		// Then
		tc.projector_count_is(2)
	})
}

func TestProjectionEngine_RunSync(t *testing.T) {
	t.Run("calls projector handle for each event", func(t *testing.T) {
		tc := newEngineTestContext(t)

		// Given
		tc.engine_is_created()
		tc.a_recording_projector("recorder")
		tc.register_is_called()
		tc.events(
			Event{EventType: "event-1", GlobalPosition: 1},
			Event{EventType: "event-2", GlobalPosition: 2},
		)

		// When
		tc.run_sync_is_called()

		// Then
		tc.run_sync_returns_nil()
		tc.projector_handled_events("recorder", []string{"event-1", "event-2"})
	})

	t.Run("calls all projectors for all events", func(t *testing.T) {
		tc := newEngineTestContext(t)

		// Given
		tc.engine_is_created()
		tc.a_recording_projector("projector-a")
		tc.register_is_called()
		tc.a_recording_projector("projector-b")
		tc.register_is_called()
		tc.events(
			Event{EventType: "evt-1", GlobalPosition: 1},
		)

		// When
		tc.run_sync_is_called()

		// Then
		tc.run_sync_returns_nil()
		tc.projector_handled_events("projector-a", []string{"evt-1"})
		tc.projector_handled_events("projector-b", []string{"evt-1"})
	})

	t.Run("processes events in order", func(t *testing.T) {
		tc := newEngineTestContext(t)

		// Given
		tc.engine_is_created()
		tc.a_recording_projector("ordered")
		tc.register_is_called()
		tc.events(
			Event{EventType: "first", GlobalPosition: 1},
			Event{EventType: "second", GlobalPosition: 2},
			Event{EventType: "third", GlobalPosition: 3},
		)

		// When
		tc.run_sync_is_called()

		// Then
		tc.run_sync_returns_nil()
		tc.projector_handled_events("ordered", []string{"first", "second", "third"})
	})

	t.Run("error in one projector does not prevent others from running", func(t *testing.T) {
		tc := newEngineTestContext(t)

		// Given
		tc.engine_is_created()
		tc.a_failing_projector("failing")
		tc.register_is_called()
		tc.a_recording_projector("healthy")
		tc.register_is_called()
		tc.events(
			Event{EventType: "evt-1", GlobalPosition: 1},
		)

		// When
		tc.run_sync_is_called()

		// Then
		tc.run_sync_returns_nil()
		tc.projector_handled_events("healthy", []string{"evt-1"})
	})

	t.Run("returns nil with no registered projectors", func(t *testing.T) {
		tc := newEngineTestContext(t)

		// Given
		tc.engine_is_created()
		tc.events(
			Event{EventType: "evt-1", GlobalPosition: 1},
		)

		// When
		tc.run_sync_is_called()

		// Then
		tc.run_sync_returns_nil()
	})

	t.Run("returns nil with empty events slice", func(t *testing.T) {
		tc := newEngineTestContext(t)

		// Given
		tc.engine_is_created()
		tc.a_recording_projector("recorder")
		tc.register_is_called()
		tc.events()

		// When
		tc.run_sync_is_called()

		// Then
		tc.run_sync_returns_nil()
		tc.projector_handled_events("recorder", []string{})
	})
}

// --- Test Context ---

type engineTestContext struct {
	t *testing.T

	eventStore      EventStore
	projectionStore ProjectionStore
	checkpointStore CheckpointStore

	engine     *projectionEngine
	projector  Projector
	inputEvts  []Event
	runSyncErr error

	recorders map[string]*recordingProjector
}

func newEngineTestContext(t *testing.T) *engineTestContext {
	t.Helper()
	return &engineTestContext{
		t:               t,
		eventStore:      &mockEventStore{},
		projectionStore: &mockProjectionStore{},
		checkpointStore: &mockCheckpointStore{},
		recorders:       make(map[string]*recordingProjector),
	}
}

// --- Given ---

func (tc *engineTestContext) engine_is_created() {
	tc.t.Helper()
	tc.engine = NewProjectionEngine(tc.eventStore, tc.projectionStore, tc.checkpointStore)
	require.NotNil(tc.t, tc.engine)
}

func (tc *engineTestContext) a_projector(name string) {
	tc.t.Helper()
	tc.projector = &recordingProjector{name: name}
}

func (tc *engineTestContext) a_recording_projector(name string) {
	tc.t.Helper()
	rp := &recordingProjector{name: name}
	tc.recorders[name] = rp
	tc.projector = rp
}

func (tc *engineTestContext) a_failing_projector(name string) {
	tc.t.Helper()
	tc.projector = &failingProjector{name: name}
}

func (tc *engineTestContext) events(evts ...Event) {
	tc.t.Helper()
	tc.inputEvts = evts
}

// --- When ---

func (tc *engineTestContext) register_is_called() {
	tc.t.Helper()
	tc.engine.Register(tc.projector)
}

func (tc *engineTestContext) run_sync_is_called() {
	tc.t.Helper()
	tc.runSyncErr = tc.engine.RunSync(context.Background(), tc.inputEvts)
}

// --- Then ---

func (tc *engineTestContext) engine_is_not_nil() {
	tc.t.Helper()
	assert.NotNil(tc.t, tc.engine)
}

func (tc *engineTestContext) projector_count_is(expected int) {
	tc.t.Helper()
	assert.Len(tc.t, tc.engine.projectors, expected)
}

func (tc *engineTestContext) run_sync_returns_nil() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.runSyncErr)
}

func (tc *engineTestContext) projector_handled_events(name string, expectedTypes []string) {
	tc.t.Helper()
	rp, ok := tc.recorders[name]
	require.True(tc.t, ok, "recorder %q not found", name)

	actual := make([]string, len(rp.handledEvents))
	for i, e := range rp.handledEvents {
		actual[i] = e.EventType
	}
	assert.Equal(tc.t, expectedTypes, actual)
}

// --- Test Doubles ---

type recordingProjector struct {
	name          string
	handledEvents []Event
}

func (r *recordingProjector) Name() string {
	return r.name
}

func (r *recordingProjector) Handle(_ context.Context, event Event, _ ProjectionStore) error {
	r.handledEvents = append(r.handledEvents, event)
	return nil
}

type failingProjector struct {
	name string
}

func (f *failingProjector) Name() string {
	return f.name
}

func (f *failingProjector) Handle(_ context.Context, _ Event, _ ProjectionStore) error {
	return errors.New("projector error")
}

// =============================================================================
// Catch-Up Tests
// =============================================================================

func TestProjectionEngine_StartCatchUp(t *testing.T) {
	t.Run("processes events from last checkpoint", func(t *testing.T) {
		tc := newCatchUpTestContext(t)

		// Given
		tc.realms("realm-1")
		tc.checkpoint("realm-1", "recorder", 2)
		tc.realm_events("realm-1", 2,
			Event{EventType: "evt-3", GlobalPosition: 3, RealmID: "realm-1"},
			Event{EventType: "evt-4", GlobalPosition: 4, RealmID: "realm-1"},
		)
		tc.a_catch_up_recording_projector("recorder")
		tc.catch_up_engine_is_created()
		tc.register_catch_up_projector()

		// When
		tc.start_catch_up_is_called()
		tc.wait_for_poll_cycle()
		tc.stop_is_called()

		// Then
		tc.catch_up_projector_handled_events("recorder", []string{"evt-3", "evt-4"})
		tc.checkpoint_was_set("realm-1", "recorder", 4)
	})

	t.Run("new projectors start from position 0", func(t *testing.T) {
		tc := newCatchUpTestContext(t)

		// Given
		tc.realms("realm-1")
		tc.realm_events("realm-1", 0,
			Event{EventType: "evt-1", GlobalPosition: 1, RealmID: "realm-1"},
			Event{EventType: "evt-2", GlobalPosition: 2, RealmID: "realm-1"},
		)
		tc.a_catch_up_recording_projector("new-projector")
		tc.catch_up_engine_is_created()
		tc.register_catch_up_projector()

		// When
		tc.start_catch_up_is_called()
		tc.wait_for_poll_cycle()
		tc.stop_is_called()

		// Then
		tc.catch_up_projector_handled_events("new-projector", []string{"evt-1", "evt-2"})
		tc.checkpoint_was_set("realm-1", "new-projector", 2)
	})

	t.Run("error in one projector does not block others", func(t *testing.T) {
		tc := newCatchUpTestContext(t)

		// Given
		tc.realms("realm-1")
		tc.realm_events("realm-1", 0,
			Event{EventType: "evt-1", GlobalPosition: 1, RealmID: "realm-1"},
		)
		tc.a_catch_up_failing_projector("failing")
		tc.catch_up_engine_is_created()
		tc.register_catch_up_projector()
		tc.a_catch_up_recording_projector("healthy")
		tc.register_catch_up_projector()

		// When
		tc.start_catch_up_is_called()
		tc.wait_for_poll_cycle()
		tc.stop_is_called()

		// Then
		tc.catch_up_projector_handled_events("healthy", []string{"evt-1"})
	})

	t.Run("processes multiple realms", func(t *testing.T) {
		tc := newCatchUpTestContext(t)

		// Given
		tc.realms("realm-a", "realm-b")
		tc.realm_events("realm-a", 0,
			Event{EventType: "a-evt", GlobalPosition: 1, RealmID: "realm-a"},
		)
		tc.realm_events("realm-b", 0,
			Event{EventType: "b-evt", GlobalPosition: 2, RealmID: "realm-b"},
		)
		tc.a_catch_up_recording_projector("multi")
		tc.catch_up_engine_is_created()
		tc.register_catch_up_projector()

		// When
		tc.start_catch_up_is_called()
		tc.wait_for_poll_cycle()
		tc.stop_is_called()

		// Then
		tc.catch_up_projector_handled_event_count("multi", 2)
	})

	t.Run("no-op when no realms exist", func(t *testing.T) {
		tc := newCatchUpTestContext(t)

		// Given
		tc.a_catch_up_recording_projector("recorder")
		tc.catch_up_engine_is_created()
		tc.register_catch_up_projector()

		// When
		tc.start_catch_up_is_called()
		tc.wait_for_poll_cycle()
		tc.stop_is_called()

		// Then
		tc.catch_up_projector_handled_events("recorder", []string{})
	})

	t.Run("poll interval is configurable", func(t *testing.T) {
		tc := newCatchUpTestContext(t)

		// Given
		tc.poll_interval(50 * time.Millisecond)
		tc.a_catch_up_recording_projector("recorder")
		tc.catch_up_engine_is_created()
		tc.register_catch_up_projector()

		// When
		tc.start_catch_up_is_called()
		tc.wait_for_poll_cycle()
		tc.stop_is_called()

		// Then
		tc.catch_up_projector_handled_events("recorder", []string{})
		tc.engine_poll_interval_is(50 * time.Millisecond)
	})
}

func TestProjectionEngine_Stop(t *testing.T) {
	t.Run("graceful shutdown waits for in-flight processing", func(t *testing.T) {
		tc := newCatchUpTestContext(t)

		// Given
		tc.realms("realm-1")
		tc.realm_events("realm-1", 0,
			Event{EventType: "evt-1", GlobalPosition: 1, RealmID: "realm-1"},
		)
		tc.a_catch_up_slow_projector("slow", 100*time.Millisecond)
		tc.catch_up_engine_is_created()
		tc.register_catch_up_projector()

		// When
		tc.start_catch_up_is_called()
		tc.wait_briefly()
		tc.stop_is_called()

		// Then
		tc.stop_returns_nil()
		tc.slow_projector_completed("slow")
	})

	t.Run("returns nil", func(t *testing.T) {
		tc := newCatchUpTestContext(t)

		// Given
		tc.catch_up_engine_is_created()

		// When
		tc.start_catch_up_is_called()
		tc.stop_is_called()

		// Then
		tc.stop_returns_nil()
	})
}

// --- Catch-Up Test Context ---

type catchUpTestContext struct {
	t *testing.T

	configEventStore      *configurableEventStore
	configCheckpointStore *configurableCheckpointStore

	engine        *projectionEngine
	projector     Projector
	startErr      error
	stopErr       error
	pollInterval  time.Duration

	recorders     map[string]*recordingProjector
	slowRecorders map[string]*slowProjector
}

func newCatchUpTestContext(t *testing.T) *catchUpTestContext {
	t.Helper()
	return &catchUpTestContext{
		t:                     t,
		configEventStore:      newConfigurableEventStore(),
		configCheckpointStore: newConfigurableCheckpointStore(),
		pollInterval:          10 * time.Millisecond,
		recorders:             make(map[string]*recordingProjector),
		slowRecorders:         make(map[string]*slowProjector),
	}
}

// --- Given ---

func (tc *catchUpTestContext) realms(ids ...string) {
	tc.t.Helper()
	tc.configEventStore.realmIDs = ids
}

func (tc *catchUpTestContext) checkpoint(realmID, projectorName string, pos int64) {
	tc.t.Helper()
	tc.configCheckpointStore.setCheckpoint(realmID, projectorName, pos)
}

func (tc *catchUpTestContext) realm_events(realmID string, fromPos int64, evts ...Event) {
	tc.t.Helper()
	key := realmEventsKey{realmID: realmID, fromPos: fromPos}
	tc.configEventStore.events[key] = evts
}

func (tc *catchUpTestContext) a_catch_up_recording_projector(name string) {
	tc.t.Helper()
	rp := &recordingProjector{name: name}
	tc.recorders[name] = rp
	tc.projector = rp
}

func (tc *catchUpTestContext) a_catch_up_failing_projector(name string) {
	tc.t.Helper()
	tc.projector = &failingProjector{name: name}
}

func (tc *catchUpTestContext) a_catch_up_slow_projector(name string, delay time.Duration) {
	tc.t.Helper()
	sp := &slowProjector{name: name, delay: delay}
	tc.slowRecorders[name] = sp
	tc.projector = sp
}

func (tc *catchUpTestContext) poll_interval(d time.Duration) {
	tc.t.Helper()
	tc.pollInterval = d
}

func (tc *catchUpTestContext) catch_up_engine_is_created() {
	tc.t.Helper()
	tc.engine = NewProjectionEngine(
		tc.configEventStore,
		&mockProjectionStore{},
		tc.configCheckpointStore,
		WithPollInterval(tc.pollInterval),
	)
	require.NotNil(tc.t, tc.engine)
}

func (tc *catchUpTestContext) register_catch_up_projector() {
	tc.t.Helper()
	tc.engine.Register(tc.projector)
}

// --- When ---

func (tc *catchUpTestContext) start_catch_up_is_called() {
	tc.t.Helper()
	tc.startErr = tc.engine.StartCatchUp(context.Background())
}

func (tc *catchUpTestContext) stop_is_called() {
	tc.t.Helper()
	tc.stopErr = tc.engine.Stop()
}

func (tc *catchUpTestContext) wait_for_poll_cycle() {
	tc.t.Helper()
	time.Sleep(tc.pollInterval * 3)
}

func (tc *catchUpTestContext) wait_briefly() {
	tc.t.Helper()
	time.Sleep(20 * time.Millisecond)
}

// --- Then ---

func (tc *catchUpTestContext) catch_up_projector_handled_events(name string, expectedTypes []string) {
	tc.t.Helper()
	rp, ok := tc.recorders[name]
	require.True(tc.t, ok, "recorder %q not found", name)

	actual := make([]string, len(rp.handledEvents))
	for i, e := range rp.handledEvents {
		actual[i] = e.EventType
	}
	assert.Equal(tc.t, expectedTypes, actual)
}

func (tc *catchUpTestContext) catch_up_projector_handled_event_count(name string, expected int) {
	tc.t.Helper()
	rp, ok := tc.recorders[name]
	require.True(tc.t, ok, "recorder %q not found", name)
	assert.Len(tc.t, rp.handledEvents, expected)
}

func (tc *catchUpTestContext) checkpoint_was_set(realmID, projectorName string, expectedPos int64) {
	tc.t.Helper()
	pos, ok := tc.configCheckpointStore.getLastSet(realmID, projectorName)
	require.True(tc.t, ok, "checkpoint for %s/%s was never set", realmID, projectorName)
	assert.Equal(tc.t, expectedPos, pos)
}

func (tc *catchUpTestContext) stop_returns_nil() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.stopErr)
}

func (tc *catchUpTestContext) engine_poll_interval_is(expected time.Duration) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.engine.pollInterval)
}

func (tc *catchUpTestContext) slow_projector_completed(name string) {
	tc.t.Helper()
	sp, ok := tc.slowRecorders[name]
	require.True(tc.t, ok, "slow projector %q not found", name)
	assert.True(tc.t, sp.completed(), "slow projector %q did not complete", name)
}

// --- Catch-Up Test Doubles ---

type realmEventsKey struct {
	realmID string
	fromPos int64
}

type configurableEventStore struct {
	realmIDs []string
	events   map[realmEventsKey][]Event
}

func newConfigurableEventStore() *configurableEventStore {
	return &configurableEventStore{
		events: make(map[realmEventsKey][]Event),
	}
}

func (m *configurableEventStore) Append(_ context.Context, _ string, _ string, _ int, _ []EventData) ([]Event, error) {
	return []Event{}, nil
}

func (m *configurableEventStore) ReadStream(_ context.Context, _ string, _ string, _ int) ([]Event, error) {
	return []Event{}, nil
}

func (m *configurableEventStore) ReadAll(_ context.Context, realmID string, fromPos int64) ([]Event, error) {
	key := realmEventsKey{realmID: realmID, fromPos: fromPos}
	if evts, ok := m.events[key]; ok {
		return evts, nil
	}
	return []Event{}, nil
}

func (m *configurableEventStore) ListRealmIDs(_ context.Context) ([]string, error) {
	if m.realmIDs == nil {
		return []string{}, nil
	}
	return m.realmIDs, nil
}

type checkpointEntry struct {
	realmID       string
	projectorName string
	position      int64
}

type configurableCheckpointStore struct {
	mu          sync.Mutex
	checkpoints map[string]int64
	setCalls    []checkpointEntry
}

func newConfigurableCheckpointStore() *configurableCheckpointStore {
	return &configurableCheckpointStore{
		checkpoints: make(map[string]int64),
	}
}

func (m *configurableCheckpointStore) key(realmID, projectorName string) string {
	return realmID + "/" + projectorName
}

func (m *configurableCheckpointStore) setCheckpoint(realmID, projectorName string, pos int64) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.checkpoints[m.key(realmID, projectorName)] = pos
}

func (m *configurableCheckpointStore) GetCheckpoint(_ context.Context, realmID string, projectorName string) (int64, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	pos := m.checkpoints[m.key(realmID, projectorName)]
	return pos, nil
}

func (m *configurableCheckpointStore) SetCheckpoint(_ context.Context, realmID string, projectorName string, globalPosition int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.checkpoints[m.key(realmID, projectorName)] = globalPosition
	m.setCalls = append(m.setCalls, checkpointEntry{realmID: realmID, projectorName: projectorName, position: globalPosition})
	return nil
}

func (m *configurableCheckpointStore) getLastSet(realmID, projectorName string) (int64, bool) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := len(m.setCalls) - 1; i >= 0; i-- {
		c := m.setCalls[i]
		if c.realmID == realmID && c.projectorName == projectorName {
			return c.position, true
		}
	}
	return 0, false
}

type slowProjector struct {
	name  string
	delay time.Duration
	mu    sync.Mutex
	done  bool
}

func (s *slowProjector) Name() string {
	return s.name
}

func (s *slowProjector) Handle(_ context.Context, _ Event, _ ProjectionStore) error {
	time.Sleep(s.delay)
	s.mu.Lock()
	defer s.mu.Unlock()
	s.done = true
	return nil
}

func (s *slowProjector) completed() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.done
}
