package runners

import (
	"sync"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestRegistry(t *testing.T) {
	t.Run("registers and retrieves runner", func(t *testing.T) {
		tc := newRegistryTestContext(t)

		// Given
		tc.mock_runner_is_created()

		// When
		tc.runner_is_registered()

		// Then
		tc.runner_is_retrievable()
	})

	t.Run("returns nil for non-existent runner", func(t *testing.T) {
		tc := newRegistryTestContext(t)

		// Given
		tc.registry_is_created()

		// When
		tc.non_existent_runner_is_retrieved()

		// Then
		tc.nil_is_returned()
	})

	t.Run("handles concurrent access", func(t *testing.T) {
		tc := newRegistryTestContext(t)

		// Given
		tc.registry_is_created()
		tc.concurrent_goroutines_are_configured()

		// When
		tc.concurrent_register_and_get_operations_are_performed()

		// Then
		tc.all_operations_complete_without_race()
	})
}

// --- Test Context ---

type registryTestContext struct {
	t       *testing.T
	runner  core.Runner
	registry *Registry
	result  core.Runner
	wg      sync.WaitGroup
}

func newRegistryTestContext(t *testing.T) *registryTestContext {
	t.Helper()
	return &registryTestContext{t: t}
}

// --- Given ---

func (tc *registryTestContext) mock_runner_is_created() {
	tc.t.Helper()
	tc.runner = &mockRunner{name: "test-runner"}
}

func (tc *registryTestContext) registry_is_created() {
	tc.t.Helper()
	tc.registry = NewRegistry()
}

func (tc *registryTestContext) concurrent_goroutines_are_configured() {
	tc.t.Helper()
	// No setup needed - wg is embedded in testContext
}

// --- When ---

func (tc *registryTestContext) runner_is_registered() {
	tc.t.Helper()
	tc.registry = NewRegistry()
	tc.registry.Register("test-runner", tc.runner)
}

func (tc *registryTestContext) non_existent_runner_is_retrieved() {
	tc.t.Helper()
	tc.result = tc.registry.Get("non-existent")
}

func (tc *registryTestContext) concurrent_register_and_get_operations_are_performed() {
	tc.t.Helper()
	
	// Register 10 runners concurrently
	for i := 0; i < 10; i++ {
		tc.wg.Add(1)
		go func(n int) {
			defer tc.wg.Done()
			name := string(rune('a' + n))
			tc.registry.Register(name, &mockRunner{name: name})
		}(i)
	}

	// Retrieve 10 runners concurrently
	for i := 0; i < 10; i++ {
		tc.wg.Add(1)
		go func(n int) {
			defer tc.wg.Done()
			name := string(rune('a' + n))
			_ = tc.registry.Get(name)
		}(i)
	}

	tc.wg.Wait()
}

// --- Then ---

func (tc *registryTestContext) runner_is_retrievable() {
	tc.t.Helper()
	result := tc.registry.Get("test-runner")
	require.NotNil(tc.t, result)
	assert.Equal(tc.t, tc.runner, result)
}

func (tc *registryTestContext) nil_is_returned() {
	tc.t.Helper()
	assert.Nil(tc.t, tc.result)
}

func (tc *registryTestContext) all_operations_complete_without_race() {
	tc.t.Helper()
	// If we got here without a race detector firing, the test passed
	assert.True(tc.t, true)
}

// --- Mocks ---

type mockRunner struct {
	name string
}

func (m *mockRunner) Name() string {
	return m.name
}

func (m *mockRunner) ImageName() string {
	return "test-image:latest"
}

func (m *mockRunner) PrepareWorkspace(workspace string, agent core.AgentDetail, settings core.RunnerSettings) error {
	return nil
}

func (m *mockRunner) BuildContainerSpec(workspace string, envVars map[string]string) core.ContainerSpec {
	return core.ContainerSpec{}
}

func (m *mockRunner) ParseOutput(output string) (string, error) {
	return "", nil
}
