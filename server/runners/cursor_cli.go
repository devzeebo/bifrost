package runners

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/devzeebo/bifrost/core"
)

// CursorCLIRunner implements the Runner interface for cursor-cli.
type CursorCLIRunner struct {
	imageName string
}

// NewCursorCLIRunner creates a new cursor-cli runner.
// If imageName is empty, uses the default image.
func NewCursorCLIRunner(imageName string) *CursorCLIRunner {
	if imageName == "" {
		imageName = "bifrost-cursor-cli:latest"
	}
	return &CursorCLIRunner{
		imageName: imageName,
	}
}

// Name returns the runner name.
func (r *CursorCLIRunner) Name() string {
	return "cursor-cli"
}

// ImageName returns the Docker image to use.
func (r *CursorCLIRunner) ImageName() string {
	return r.imageName
}

// PrepareWorkspace prepares the workspace directory for cursor-cli.
func (r *CursorCLIRunner) PrepareWorkspace(workspace string, agent core.AgentDetail, settings core.RunnerSettings) error {
	// Create .windsurf directory
	windsurfDir := filepath.Join(workspace, ".windsurf")
	if err := os.MkdirAll(windsurfDir, 0755); err != nil {
		return fmt.Errorf("failed to create .windsurf directory: %w", err)
	}

	// Write workflow file if present in config
	if workflow, ok := settings.Config["workflow"]; ok && workflow != "" {
		workflowPath := filepath.Join(windsurfDir, "workflow.md")
		if err := os.WriteFile(workflowPath, []byte(workflow), 0644); err != nil {
			return fmt.Errorf("failed to write workflow file: %w", err)
		}
	}

	// Write skill file if present in config
	if skill, ok := settings.Config["skill"]; ok && skill != "" {
		skillPath := filepath.Join(windsurfDir, "skill.md")
		if err := os.WriteFile(skillPath, []byte(skill), 0644); err != nil {
			return fmt.Errorf("failed to write skill file: %w", err)
		}
	}

	return nil
}

// BuildContainerSpec creates a ContainerSpec for running cursor-cli.
func (r *CursorCLIRunner) BuildContainerSpec(workspace string, envVars map[string]string) core.ContainerSpec {
	// Create workspace mount
	mounts := []core.MountSpec{
		{
			Source: workspace,
			Target: "/workspace",
		},
	}

	return core.ContainerSpec{
		Image:       r.imageName,
		EnvVars:     envVars,
		Mounts:      mounts,
		WorkingDir:  "/workspace",
		Cmd:         []string{"run"},
	}
}

// ParseOutput extracts the result from cursor-cli output.
func (r *CursorCLIRunner) ParseOutput(output string) (string, error) {
	// Check for error indicators
	if strings.Contains(output, "ERROR:") {
		// Extract error message
		lines := strings.Split(output, "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "ERROR:") {
				return "", errors.New(strings.TrimSpace(line))
			}
		}
		return "", errors.New("cursor-cli execution failed")
	}

	// Extract result from output
	if strings.Contains(output, "RESULT:") {
		lines := strings.Split(output, "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "RESULT:") {
				return strings.TrimSpace(strings.TrimPrefix(line, "RESULT:")), nil
			}
		}
	}

	// Return full output if no specific result marker
	return strings.TrimSpace(output), nil
}
