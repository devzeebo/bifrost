package server

import (
	"context"
	"fmt"
	"io"

	"github.com/devzeebo/bifrost/core"
)

// dockerClient is a minimal interface for the Docker SDK methods we use.
// This allows mocking without depending on the full Docker SDK types.
type dockerClient interface {
	ContainerCreate(ctx context.Context, config *containerConfig, hostConfig *hostConfig, name string) (containerCreateResponse, error)
	ContainerStart(ctx context.Context, containerID string) error
	ContainerAttach(ctx context.Context, containerID string) (hijackedResponse, error)
	ContainerWait(ctx context.Context, containerID string) (int, error)
	ContainerRemove(ctx context.Context, containerID string) error
}

// containerConfig represents the Docker container config.
type containerConfig struct {
	Image      string
	Env        []string
	WorkingDir string
	Cmd        []string
	Tty        bool
	OpenStdin  bool
	StdinOnce  bool
}

// hostConfig represents the Docker host config.
type hostConfig struct {
	Binds []string
}

// containerCreateResponse is the response from ContainerCreate.
type containerCreateResponse struct {
	ID string
}

// hijackedResponse holds the stdout/stdin connections.
type hijackedResponse struct {
	Reader io.Reader
	Writer io.Writer
}

// DockerOrchestrator implements ContainerOrchestrator using the Docker SDK.
type DockerOrchestrator struct {
	client dockerClient
}

// NewDockerOrchestrator creates a new DockerOrchestrator with the given client.
func NewDockerOrchestrator(client dockerClient) *DockerOrchestrator {
	return &DockerOrchestrator{client: client}
}

// CreateContainer creates a new container with the given specification.
// Returns the container ID if successful.
func (d *DockerOrchestrator) CreateContainer(ctx context.Context, spec core.ContainerSpec) (string, error) {
	// Convert env vars map to slice of "KEY=VALUE" strings
	env := make([]string, 0, len(spec.EnvVars))
	for k, v := range spec.EnvVars {
		env = append(env, fmt.Sprintf("%s=%s", k, v))
	}

	// Convert mounts to binds
	binds := make([]string, 0, len(spec.Mounts))
	for _, m := range spec.Mounts {
		binds = append(binds, fmt.Sprintf("%s:%s", m.Source, m.Target))
	}

	config := &containerConfig{
		Image:      spec.Image,
		Env:        env,
		WorkingDir: spec.WorkingDir,
		Cmd:        spec.Cmd,
		Tty:        true,
		OpenStdin:  true,
		StdinOnce:  true,
	}

	hostConfig := &hostConfig{
		Binds: binds,
	}

	resp, err := d.client.ContainerCreate(ctx, config, hostConfig, "")
	if err != nil {
		return "", fmt.Errorf("failed to create container: %w", err)
	}

	return resp.ID, nil
}

// StartContainer starts a previously created container.
func (d *DockerOrchestrator) StartContainer(ctx context.Context, containerID string) error {
	if err := d.client.ContainerStart(ctx, containerID); err != nil {
		return fmt.Errorf("failed to start container %s: %w", containerID, err)
	}
	return nil
}

// AttachContainer attaches to a running container's stdin/stdout.
// Returns readers/writers for interacting with the container.
func (d *DockerOrchestrator) AttachContainer(ctx context.Context, containerID string) (io.Reader, io.Writer, error) {
	resp, err := d.client.ContainerAttach(ctx, containerID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to attach to container %s: %w", containerID, err)
	}
	return resp.Reader, resp.Writer, nil
}

// WaitContainer waits for a container to finish and returns its exit code.
func (d *DockerOrchestrator) WaitContainer(ctx context.Context, containerID string) (int, error) {
	exitCode, err := d.client.ContainerWait(ctx, containerID)
	if err != nil {
		return -1, fmt.Errorf("failed to wait for container %s: %w", containerID, err)
	}
	return exitCode, nil
}

// RemoveContainer removes a container from the system.
func (d *DockerOrchestrator) RemoveContainer(ctx context.Context, containerID string) error {
	if err := d.client.ContainerRemove(ctx, containerID); err != nil {
		return fmt.Errorf("failed to remove container %s: %w", containerID, err)
	}
	return nil
}
