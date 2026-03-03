package core

// AgentDetail contains information about an agent that will use a runner.
type AgentDetail struct {
	// ID is the unique identifier for the agent.
	ID string
	// Name is the human-readable name of the agent.
	Name string
	// Type is the type of agent (e.g., "cursor", "windsurf").
	Type string
}

// RunnerSettings contains runner-specific configuration.
type RunnerSettings struct {
	// Config is a map of configuration key-value pairs.
	Config map[string]string
	// Secrets is a map of secret key-value pairs (not logged).
	Secrets map[string]string
}

// Runner defines the interface for agent runner plugins.
// Each runner knows how to prepare a workspace and configure a container
// for a specific agent type (e.g., cursor-cli, windsurf-cli).
type Runner interface {
	// Name returns the runner's name (e.g., "cursor-cli").
	Name() string

	// ImageName returns the Docker image to use for this runner.
	ImageName() string

	// PrepareWorkspace prepares the workspace directory for the agent.
	// This may involve creating config files, setting up credentials, etc.
	PrepareWorkspace(workspace string, agent AgentDetail, settings RunnerSettings) error

	// BuildContainerSpec builds a ContainerSpec for running the agent.
	// The workspace should already be prepared via PrepareWorkspace.
	BuildContainerSpec(workspace string, envVars map[string]string) ContainerSpec

	// ParseOutput parses the runner's output and extracts the result.
	// Returns an error if the output indicates failure.
	ParseOutput(output string) (result string, err error)
}
