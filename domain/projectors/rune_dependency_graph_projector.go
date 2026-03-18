package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
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
	RuneID       string                         `json:"rune_id"`
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

// Handle processes events.
func (p *RuneDependencyGraphProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventDependencyAdded:
		return p.handleAdded(ctx, event, store)
	case domain.EventDependencyRemoved:
		return p.handleRemoved(ctx, event, store)
	case domain.EventRuneShattered:
		return p.handleShattered(ctx, event, store)
	}
	return nil
}

func (p *RuneDependencyGraphProjector) getOrCreateEntry(ctx context.Context, realmID, runeID string, store core.ProjectionStore) (RuneDependencyGraphEntry, error) {
	var entry RuneDependencyGraphEntry
	err := store.Get(ctx, realmID, "projection_rune_dependency_graph", runeID, &entry)
	if err != nil {
		if isNotFoundError(err) {
			return RuneDependencyGraphEntry{
				RuneID:       runeID,
				Dependencies: []RuneDependencyGraphDependency{},
				Dependents:   []RuneDependencyGraphDependent{},
			}, nil
		}
		return RuneDependencyGraphEntry{}, err
	}
	return entry, nil
}

func (p *RuneDependencyGraphProjector) handleAdded(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.DependencyAdded
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	if data.IsInverse {
		return nil
	}

	// Update source entry: append dependency (if not already present for idempotency)
	sourceEntry, err := p.getOrCreateEntry(ctx, event.RealmID, data.RuneID, store)
	if err != nil {
		return err
	}

	// Check if dependency already exists for idempotency
	for _, dep := range sourceEntry.Dependencies {
		if dep.TargetID == data.TargetID && dep.Relationship == data.Relationship {
			// Already exists, update target and return
			targetEntry, err := p.getOrCreateEntry(ctx, event.RealmID, data.TargetID, store)
			if err != nil {
				return err
			}
			// Ensure target has the dependent too
			dependentExists := false
			for _, d := range targetEntry.Dependents {
				if d.SourceID == data.RuneID && d.Relationship == data.Relationship {
					dependentExists = true
					break
				}
			}
			if !dependentExists {
				targetEntry.Dependents = append(targetEntry.Dependents, RuneDependencyGraphDependent{
					SourceID:     data.RuneID,
					Relationship: data.Relationship,
				})
				if err := store.Put(ctx, event.RealmID, "projection_rune_dependency_graph", data.TargetID, targetEntry); err != nil {
					return err
				}
			}
			return nil
		}
	}

	sourceEntry.Dependencies = append(sourceEntry.Dependencies, RuneDependencyGraphDependency{
		TargetID:     data.TargetID,
		Relationship: data.Relationship,
	})
	if err := store.Put(ctx, event.RealmID, "projection_rune_dependency_graph", data.RuneID, sourceEntry); err != nil {
		return err
	}

	// Update target entry: append dependent
	targetEntry, err := p.getOrCreateEntry(ctx, event.RealmID, data.TargetID, store)
	if err != nil {
		return err
	}
	targetEntry.Dependents = append(targetEntry.Dependents, RuneDependencyGraphDependent{
		SourceID:     data.RuneID,
		Relationship: data.Relationship,
	})
	if err := store.Put(ctx, event.RealmID, "projection_rune_dependency_graph", data.TargetID, targetEntry); err != nil {
		return err
	}

	return nil
}

func (p *RuneDependencyGraphProjector) handleRemoved(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.DependencyRemoved
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	if data.IsInverse {
		return nil
	}

	// Update source entry: remove dependency
	sourceEntry, err := p.getOrCreateEntry(ctx, event.RealmID, data.RuneID, store)
	if err != nil {
		return err
	}
	filtered := make([]RuneDependencyGraphDependency, 0, len(sourceEntry.Dependencies))
	for _, dep := range sourceEntry.Dependencies {
		if dep.TargetID != data.TargetID || dep.Relationship != data.Relationship {
			filtered = append(filtered, dep)
		}
	}
	sourceEntry.Dependencies = filtered
	if err := store.Put(ctx, event.RealmID, "projection_rune_dependency_graph", data.RuneID, sourceEntry); err != nil {
		return err
	}

	// Update target entry: remove dependent
	targetEntry, err := p.getOrCreateEntry(ctx, event.RealmID, data.TargetID, store)
	if err != nil {
		return err
	}
	filteredDeps := make([]RuneDependencyGraphDependent, 0, len(targetEntry.Dependents))
	for _, dep := range targetEntry.Dependents {
		if dep.SourceID != data.RuneID || dep.Relationship != data.Relationship {
			filteredDeps = append(filteredDeps, dep)
		}
	}
	targetEntry.Dependents = filteredDeps
	if err := store.Put(ctx, event.RealmID, "projection_rune_dependency_graph", data.TargetID, targetEntry); err != nil {
		return err
	}

	return nil
}

func (p *RuneDependencyGraphProjector) handleShattered(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RuneShattered
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	entry, err := p.getOrCreateEntry(ctx, event.RealmID, data.ID, store)
	if err != nil {
		return err
	}

	// For each dependency, remove the shattered rune from the target's Dependents list
	for _, dep := range entry.Dependencies {
		targetEntry, err := p.getOrCreateEntry(ctx, event.RealmID, dep.TargetID, store)
		if err != nil {
			return err
		}
		filtered := make([]RuneDependencyGraphDependent, 0, len(targetEntry.Dependents))
		for _, d := range targetEntry.Dependents {
			if d.SourceID != data.ID {
				filtered = append(filtered, d)
			}
		}
		targetEntry.Dependents = filtered
		if err := store.Put(ctx, event.RealmID, "projection_rune_dependency_graph", dep.TargetID, targetEntry); err != nil {
			return err
		}
	}

	// For each dependent, remove the shattered rune from the source's Dependencies list
	for _, dep := range entry.Dependents {
		sourceEntry, err := p.getOrCreateEntry(ctx, event.RealmID, dep.SourceID, store)
		if err != nil {
			return err
		}
		filtered := make([]RuneDependencyGraphDependency, 0, len(sourceEntry.Dependencies))
		for _, d := range sourceEntry.Dependencies {
			if d.TargetID != data.ID {
				filtered = append(filtered, d)
			}
		}
		sourceEntry.Dependencies = filtered
		if err := store.Put(ctx, event.RealmID, "projection_rune_dependency_graph", dep.SourceID, sourceEntry); err != nil {
			return err
		}
	}

	// Delete the shattered rune's own graph entry
	return store.Delete(ctx, event.RealmID, "projection_rune_dependency_graph", data.ID)
}
