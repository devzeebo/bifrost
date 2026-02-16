package core

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

// Compile-time interface satisfaction checks
var _ Projector = (*mockProjector)(nil)
var _ ProjectionEngine = (*mockProjectionEngine)(nil)

// --- Tests ---

func TestProjector(t *testing.T) {
	t.Run("Name returns the projector name", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_mock_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_returns_string()
	})

	t.Run("Handle accepts context, event, and projection store", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_mock_projector()

		// When
		tc.handle_is_called()

		// Then
		tc.handle_returns_error()
	})
}

func TestProjectionEngine(t *testing.T) {
	t.Run("Register accepts a projector", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_mock_projection_engine()
		tc.a_mock_projector()

		// When
		tc.register_is_called()

		// Then
		tc.register_completes_without_panic()
	})

	t.Run("RunSync accepts context and events", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_mock_projection_engine()

		// When
		tc.run_sync_is_called()

		// Then
		tc.run_sync_returns_error()
	})

	t.Run("StartCatchUp accepts context", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_mock_projection_engine()

		// When
		tc.start_catch_up_is_called()

		// Then
		tc.start_catch_up_returns_error()
	})

	t.Run("Stop returns error", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_mock_projection_engine()

		// When
		tc.stop_is_called()

		// Then
		tc.stop_returns_error()
	})
}

// --- Test Context ---

type projectionTestContext struct {
	t *testing.T

	projector        Projector
	projectionEngine ProjectionEngine

	nameResult     string
	handleErr      error
	runSyncErr     error
	startCatchErr  error
	stopErr        error
	registerPassed bool
}

func newProjectionTestContext(t *testing.T) *projectionTestContext {
	t.Helper()
	return &projectionTestContext{t: t}
}

// --- Given ---

func (tc *projectionTestContext) a_mock_projector() {
	tc.t.Helper()
	tc.projector = &mockProjector{}
}

func (tc *projectionTestContext) a_mock_projection_engine() {
	tc.t.Helper()
	tc.projectionEngine = &mockProjectionEngine{}
}

// --- When ---

func (tc *projectionTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *projectionTestContext) handle_is_called() {
	tc.t.Helper()
	tc.handleErr = tc.projector.Handle(
		context.Background(), Event{}, &mockProjectionStore{},
	)
}

func (tc *projectionTestContext) register_is_called() {
	tc.t.Helper()
	tc.projectionEngine.Register(tc.projector)
	tc.registerPassed = true
}

func (tc *projectionTestContext) run_sync_is_called() {
	tc.t.Helper()
	tc.runSyncErr = tc.projectionEngine.RunSync(
		context.Background(), []Event{},
	)
}

func (tc *projectionTestContext) start_catch_up_is_called() {
	tc.t.Helper()
	tc.startCatchErr = tc.projectionEngine.StartCatchUp(context.Background())
}

func (tc *projectionTestContext) stop_is_called() {
	tc.t.Helper()
	tc.stopErr = tc.projectionEngine.Stop()
}

// --- Then ---

func (tc *projectionTestContext) name_returns_string() {
	tc.t.Helper()
	assert.IsType(tc.t, "", tc.nameResult)
}

func (tc *projectionTestContext) handle_returns_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.handleErr)
}

func (tc *projectionTestContext) register_completes_without_panic() {
	tc.t.Helper()
	assert.True(tc.t, tc.registerPassed)
}

func (tc *projectionTestContext) run_sync_returns_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.runSyncErr)
}

func (tc *projectionTestContext) start_catch_up_returns_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.startCatchErr)
}

func (tc *projectionTestContext) stop_returns_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.stopErr)
}

// --- Mocks ---

type mockProjector struct{}

func (m *mockProjector) Name() string {
	return "mock-projector"
}

func (m *mockProjector) Handle(_ context.Context, _ Event, _ ProjectionStore) error {
	return nil
}

type mockProjectionEngine struct{}

func (m *mockProjectionEngine) Register(_ Projector) {}

func (m *mockProjectionEngine) RunSync(_ context.Context, _ []Event) error {
	return nil
}

func (m *mockProjectionEngine) RunCatchUpOnce(_ context.Context) {}

func (m *mockProjectionEngine) StartCatchUp(_ context.Context) error {
	return nil
}

func (m *mockProjectionEngine) Stop() error {
	return nil
}
