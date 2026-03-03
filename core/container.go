package core

import (
	"context"
	"io"
)

// MountSpec represents a volume mount specification for a container.
type MountSpec struct {
	// Source is the path on the host machine.
	Source string
	// Target is the path inside the container.
	Target string
}

// ContainerSpec defines the configuration for creating a container.
type ContainerSpec struct {
	// Image is the container image to use (e.g., "golang:1.21").
	Image string
	// EnvVars are environment variables to set in the container.
	EnvVars map[string]string
	// Mounts are volume mounts to attach to the container.
	Mounts []MountSpec
	// WorkingDir is the working directory inside the container.
	WorkingDir string
	// Cmd is the command to run in the container.
	Cmd []string
}

// ContainerOrchestrator defines the interface for container lifecycle management.
// Implementations can be swapped between different container runtimes (Docker, Podman, etc.).
type ContainerOrchestrator interface {
	// CreateContainer creates a new container with the given specification.
	// Returns the container ID if successful.
	CreateContainer(ctx context.Context, spec ContainerSpec) (containerID string, err error)

	// StartContainer starts a previously created container.
	StartContainer(ctx context.Context, containerID string) error

	// AttachContainer attaches to a running container's stdin/stdout.
	// Returns readers/writers for interacting with the container.
	AttachContainer(ctx context.Context, containerID string) (stdout io.Reader, stdin io.Writer, err error)

	// WaitContainer waits for a container to finish and returns its exit code.
	WaitContainer(ctx context.Context, containerID string) (exitCode int, err error)

	// RemoveContainer removes a container from the system.
	RemoveContainer(ctx context.Context, containerID string) error
}
