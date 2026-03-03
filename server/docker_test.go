package server

import (
	"context"
	"io"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/devzeebo/bifrost/core"
)

// --- Tests ---

func TestDockerOrchestrator(t *testing.T) {
	t.Run("CreateContainer", func(t *testing.T) {
		t.Run("creates container with valid spec and returns id", func(t *testing.T) {
			tc := newDockerTestContext(t)

			// Given
			tc.docker_client_is_configured()
			tc.valid_container_spec()

			// When
			tc.container_is_created()

			// Then
			tc.container_id_is_returned()
			tc.create_was_called_with_correct_spec()
		})

		t.Run("returns error when docker client fails", func(t *testing.T) {
			tc := newDockerTestContext(t)

			// Given
			tc.docker_client_returns_create_error()

			// When
			tc.container_is_created()

			// Then
			tc.error_is_returned()
		})
	})

	t.Run("StartContainer", func(t *testing.T) {
		t.Run("starts a created container", func(t *testing.T) {
			tc := newDockerTestContext(t)

			// Given
			tc.docker_client_is_configured()
			tc.container_exists()

			// When
			tc.container_is_started()

			// Then
			tc.no_error_is_returned()
			tc.start_was_called()
		})

		t.Run("returns error when docker client fails", func(t *testing.T) {
			tc := newDockerTestContext(t)

			// Given
			tc.docker_client_returns_start_error()

			// When
			tc.container_is_started()

			// Then
			tc.error_is_returned()
		})
	})

	t.Run("AttachContainer", func(t *testing.T) {
		t.Run("attaches to running container", func(t *testing.T) {
			tc := newDockerTestContext(t)

			// Given
			tc.docker_client_is_configured()
			tc.container_is_running()

			// When
			tc.container_is_attached()

			// Then
			tc.stdout_reader_is_returned()
			tc.stdin_writer_is_returned()
			tc.attach_was_called()
		})

		t.Run("returns error when docker client fails", func(t *testing.T) {
			tc := newDockerTestContext(t)

			// Given
			tc.docker_client_returns_attach_error()

			// When
			tc.container_is_attached()

			// Then
			tc.error_is_returned()
		})
	})

	t.Run("WaitContainer", func(t *testing.T) {
		t.Run("waits for container and returns exit code", func(t *testing.T) {
			tc := newDockerTestContext(t)

			// Given
			tc.docker_client_is_configured()
			tc.container_finishes_with_exit_code(0)

			// When
			tc.container_is_waited_on()

			// Then
			tc.exit_code_is(0)
		})

		t.Run("returns error when docker client fails", func(t *testing.T) {
			tc := newDockerTestContext(t)

			// Given
			tc.docker_client_returns_wait_error()

			// When
			tc.container_is_waited_on()

			// Then
			tc.error_is_returned()
		})
	})

	t.Run("RemoveContainer", func(t *testing.T) {
		t.Run("removes container", func(t *testing.T) {
			tc := newDockerTestContext(t)

			// Given
			tc.docker_client_is_configured()
			tc.container_exists()

			// When
			tc.container_is_removed()

			// Then
			tc.no_error_is_returned()
			tc.remove_was_called()
		})

		t.Run("returns error when docker client fails", func(t *testing.T) {
			tc := newDockerTestContext(t)

			// Given
			tc.docker_client_returns_remove_error()

			// When
			tc.container_is_removed()

			// Then
			tc.error_is_returned()
		})
	})
}

// --- Test Context ---

type dockerTestContext struct {
	t *testing.T

	// Inputs
	spec         core.ContainerSpec
	containerID  string
	ctx          context.Context

	// Mocks
	mockClient *mockDockerClient

	// Results
	resultID   string
	exitCode   int
	stdout     io.Reader
	stdin      io.Writer
	err        error
}

func newDockerTestContext(t *testing.T) *dockerTestContext {
	t.Helper()
	return &dockerTestContext{
		t:           t,
		ctx:         context.Background(),
		containerID: "test-container-id",
		spec: core.ContainerSpec{
			Image:       "golang:1.21",
			EnvVars:     map[string]string{"FOO": "bar"},
			WorkingDir:  "/app",
			Cmd:         []string{"go", "test", "./..."},
			Mounts:      []core.MountSpec{{Source: "/host/path", Target: "/container/path"}},
		},
	}
}

// --- Given ---

func (tc *dockerTestContext) docker_client_is_configured() {
	tc.t.Helper()
	tc.mockClient = newMockDockerClient()
}

func (tc *dockerTestContext) valid_container_spec() {
	tc.t.Helper()
	// spec is already set in newTestContext
}

func (tc *dockerTestContext) container_exists() {
	tc.t.Helper()
	// containerID is already set
}

func (tc *dockerTestContext) container_is_running() {
	tc.t.Helper()
	// containerID is already set
}

func (tc *dockerTestContext) container_finishes_with_exit_code(code int) {
	tc.t.Helper()
	tc.mockClient.exitCode = code
}

func (tc *dockerTestContext) docker_client_returns_create_error() {
	tc.t.Helper()
	tc.mockClient = newMockDockerClient()
	tc.mockClient.createErr = assert.AnError
}

func (tc *dockerTestContext) docker_client_returns_start_error() {
	tc.t.Helper()
	tc.mockClient = newMockDockerClient()
	tc.mockClient.startErr = assert.AnError
}

func (tc *dockerTestContext) docker_client_returns_attach_error() {
	tc.t.Helper()
	tc.mockClient = newMockDockerClient()
	tc.mockClient.attachErr = assert.AnError
}

func (tc *dockerTestContext) docker_client_returns_wait_error() {
	tc.t.Helper()
	tc.mockClient = newMockDockerClient()
	tc.mockClient.waitErr = assert.AnError
}

func (tc *dockerTestContext) docker_client_returns_remove_error() {
	tc.t.Helper()
	tc.mockClient = newMockDockerClient()
	tc.mockClient.removeErr = assert.AnError
}

// --- When ---

func (tc *dockerTestContext) container_is_created() {
	tc.t.Helper()
	orchestrator := NewDockerOrchestrator(tc.mockClient)
	tc.resultID, tc.err = orchestrator.CreateContainer(tc.ctx, tc.spec)
}

func (tc *dockerTestContext) container_is_started() {
	tc.t.Helper()
	orchestrator := NewDockerOrchestrator(tc.mockClient)
	tc.err = orchestrator.StartContainer(tc.ctx, tc.containerID)
}

func (tc *dockerTestContext) container_is_attached() {
	tc.t.Helper()
	orchestrator := NewDockerOrchestrator(tc.mockClient)
	tc.stdout, tc.stdin, tc.err = orchestrator.AttachContainer(tc.ctx, tc.containerID)
}

func (tc *dockerTestContext) container_is_waited_on() {
	tc.t.Helper()
	orchestrator := NewDockerOrchestrator(tc.mockClient)
	tc.exitCode, tc.err = orchestrator.WaitContainer(tc.ctx, tc.containerID)
}

func (tc *dockerTestContext) container_is_removed() {
	tc.t.Helper()
	orchestrator := NewDockerOrchestrator(tc.mockClient)
	tc.err = orchestrator.RemoveContainer(tc.ctx, tc.containerID)
}

// --- Then ---

func (tc *dockerTestContext) container_id_is_returned() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.Equal(tc.t, "mock-container-id", tc.resultID)
}

func (tc *dockerTestContext) create_was_called_with_correct_spec() {
	tc.t.Helper()
	require.NotNil(tc.t, tc.mockClient.createConfig)
	assert.Equal(tc.t, tc.spec.Image, tc.mockClient.createConfig.Image)
	assert.Equal(tc.t, tc.spec.WorkingDir, tc.mockClient.createConfig.WorkingDir)
	assert.Equal(tc.t, tc.spec.Cmd, tc.mockClient.createConfig.Cmd)
}

func (tc *dockerTestContext) no_error_is_returned() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *dockerTestContext) error_is_returned() {
	tc.t.Helper()
	assert.Error(tc.t, tc.err)
}

func (tc *dockerTestContext) start_was_called() {
	tc.t.Helper()
	assert.True(tc.t, tc.mockClient.startCalled)
	assert.Equal(tc.t, tc.containerID, tc.mockClient.startContainerID)
}

func (tc *dockerTestContext) stdout_reader_is_returned() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.NotNil(tc.t, tc.stdout)
}

func (tc *dockerTestContext) stdin_writer_is_returned() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.NotNil(tc.t, tc.stdin)
}

func (tc *dockerTestContext) attach_was_called() {
	tc.t.Helper()
	assert.True(tc.t, tc.mockClient.attachCalled)
	assert.Equal(tc.t, tc.containerID, tc.mockClient.attachContainerID)
}

func (tc *dockerTestContext) exit_code_is(expected int) {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.Equal(tc.t, expected, tc.exitCode)
}

func (tc *dockerTestContext) remove_was_called() {
	tc.t.Helper()
	assert.True(tc.t, tc.mockClient.removeCalled)
	assert.Equal(tc.t, tc.containerID, tc.mockClient.removeContainerID)
}

// --- Mock ---

// mockDockerClient implements dockerClient for testing.
type mockDockerClient struct {
	createCalled    bool
	createConfig    *containerConfig
	createResp      containerCreateResponse
	createErr       error

	startCalled      bool
	startContainerID string
	startErr         error

	attachCalled      bool
	attachContainerID string
	attachResp        hijackedResponse
	attachErr         error

	waitCalled      bool
	waitContainerID string
	exitCode        int
	waitErr         error

	removeCalled      bool
	removeContainerID string
	removeErr         error
}

func newMockDockerClient() *mockDockerClient {
	return &mockDockerClient{
		createResp: containerCreateResponse{ID: "mock-container-id"},
		attachResp: hijackedResponse{
			Reader: &mockReader{},
			Writer: &mockWriter{},
		},
	}
}

func (m *mockDockerClient) ContainerCreate(ctx context.Context, config *containerConfig, hc *hostConfig, name string) (containerCreateResponse, error) {
	m.createCalled = true
	m.createConfig = config
	return m.createResp, m.createErr
}

func (m *mockDockerClient) ContainerStart(ctx context.Context, containerID string) error {
	m.startCalled = true
	m.startContainerID = containerID
	return m.startErr
}

func (m *mockDockerClient) ContainerAttach(ctx context.Context, containerID string) (hijackedResponse, error) {
	m.attachCalled = true
	m.attachContainerID = containerID
	return m.attachResp, m.attachErr
}

func (m *mockDockerClient) ContainerWait(ctx context.Context, containerID string) (int, error) {
	m.waitCalled = true
	m.waitContainerID = containerID
	return m.exitCode, m.waitErr
}

func (m *mockDockerClient) ContainerRemove(ctx context.Context, containerID string) error {
	m.removeCalled = true
	m.removeContainerID = containerID
	return m.removeErr
}

// mockReader implements io.Reader for testing.
type mockReader struct{}

func (m *mockReader) Read(p []byte) (n int, err error) {
	return 0, io.EOF
}

// mockWriter implements io.Writer for testing.
type mockWriter struct{}

func (m *mockWriter) Write(p []byte) (n int, err error) {
	return len(p), nil
}
