package projectors

import (
	"context"

	"github.com/devzeebo/bifrost/core"
)

// RuneDependencyGraphDependency represents a dependency from a rune to another rune.
type RuneDependencyGraphDependency struct {
	TargetID     string `json:"target_id"`
	Relationship string `json:"relationship"`
}

// RuneDependencyGraphDependent represents a rune that depends on this rune.
type RuneDependencyGraphDependent struct {
	SourceID     string `json:"source_id"`
	Relationship string `json:"relationship"`
}

// RuneDependencyGraphEntry is the projection document for a rune's dependency graph.
type RuneDependencyGraphEntry struct {
	RuneID       string                        `json:"rune_id"`
	Dependencies []RuneDependencyGraphDependency `json:"dependencies"`
	Dependents   []RuneDependencyGraphDependent `json:"dependents"`
}

// RuneDependencyGraphProjector maintains the dependency graph for each rune.
type RuneDependencyGraphProjector struct{}

// NewRuneDependencyGraphProjector creates a new projector.
func NewRuneDependencyGraphProjector() *RuneDependencyGraphProjector {
	return &RuneDependencyGraphProjector{}
}

// Name returns the projector name.
func (p *RuneDependencyGraphProjector) Name() string {
	return "rune_dependency_graph"
}

// TableName returns the projection table name.
func (p *RuneDependencyGraphProjector) TableName() string {
	return "projection_rune_dependency_graph"
}

// Handle processes events. NOT YET IMPLEMENTED.
func (p *RuneDependencyGraphProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	// TODO: implement
	return nil
}
