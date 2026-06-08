package projectors

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

func isNotFoundError(err error) bool {
	var nfe *core.NotFoundError
	return errors.As(err, &nfe)
}

type GraphDependency struct {
	TargetID     string `json:"target_id"`
	Relationship string `json:"relationship"`
}

type GraphDependent struct {
	SourceID     string `json:"source_id"`
	Relationship string `json:"relationship"`
}

type GraphEntry struct {
	RuneID       string            `json:"rune_id"`
	Dependencies []GraphDependency `json:"dependencies"`
	Dependents   []GraphDependent  `json:"dependents"`
}

// GraphDepExistsEntry records that a specific dependency edge exists (for idempotency checks).
type GraphDepExistsEntry struct {
	Exists bool `json:"exists"`
}

// DependencyGraphTable is the typed table reference for this projector.
var DependencyGraphTable = core.TableRef[GraphEntry]{Name: "dependency_graph"}

// DependencyGraphExistsTable is the typed table reference for dep-existence lookup entries.
var DependencyGraphExistsTable = core.TableRef[GraphDepExistsEntry]{Name: "dependency_graph_exists"}

type DependencyGraphProjector struct{}

func NewDependencyGraphProjector() *DependencyGraphProjector {
	return &DependencyGraphProjector{}
}

func (p *DependencyGraphProjector) Name() string {
	return DependencyGraphTable.Name
}

func (p *DependencyGraphProjector) TableName() string {
	return DependencyGraphTable.Name
}

func (p *DependencyGraphProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
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

func (p *DependencyGraphProjector) getOrCreateEntry(ctx context.Context, realmID, runeID string, store core.ProjectionStore) (GraphEntry, error) {
	entry, err := core.GetRef(ctx, store, realmID, DependencyGraphTable, runeID)
	if err != nil {
		if isNotFoundError(err) {
			return GraphEntry{
				RuneID:       runeID,
				Dependencies: []GraphDependency{},
				Dependents:   []GraphDependent{},
			}, nil
		}
		return GraphEntry{}, err
	}
	return entry, nil
}

func (p *DependencyGraphProjector) handleAdded(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.DependencyAdded
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	if data.IsInverse {
		return nil
	}

	// Check if dependency already exists for idempotency
	depKey := "dep:" + data.RuneID + ":" + data.TargetID + ":" + data.Relationship
	existing, err := core.GetRef(ctx, store, event.RealmID, DependencyGraphExistsTable, depKey)
	if err == nil && existing.Exists {
		return nil // Already exists, idempotent
	}

	// Update source entry: append dependency
	sourceEntry, err := p.getOrCreateEntry(ctx, event.RealmID, data.RuneID, store)
	if err != nil {
		return err
	}
	sourceEntry.Dependencies = append(sourceEntry.Dependencies, GraphDependency{
		TargetID:     data.TargetID,
		Relationship: data.Relationship,
	})
	if err := core.PutRef(ctx, store, event.RealmID, DependencyGraphTable, data.RuneID, sourceEntry); err != nil {
		return err
	}

	// Update target entry: append dependent
	targetEntry, err := p.getOrCreateEntry(ctx, event.RealmID, data.TargetID, store)
	if err != nil {
		return err
	}
	targetEntry.Dependents = append(targetEntry.Dependents, GraphDependent{
		SourceID:     data.RuneID,
		Relationship: data.Relationship,
	})
	if err := core.PutRef(ctx, store, event.RealmID, DependencyGraphTable, data.TargetID, targetEntry); err != nil {
		return err
	}

	// Store dep lookup key for existence checks
	return core.PutRef(ctx, store, event.RealmID, DependencyGraphExistsTable, depKey, GraphDepExistsEntry{Exists: true})
}

func (p *DependencyGraphProjector) handleShattered(ctx context.Context, event core.Event, store core.ProjectionStore) error {
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
		filtered := make([]GraphDependent, 0, len(targetEntry.Dependents))
		for _, d := range targetEntry.Dependents {
			if d.SourceID != data.ID {
				filtered = append(filtered, d)
			}
		}
		targetEntry.Dependents = filtered
		if err := core.PutRef(ctx, store, event.RealmID, DependencyGraphTable, dep.TargetID, targetEntry); err != nil {
			return err
		}

		// Remove dep lookup key
		depKey := "dep:" + data.ID + ":" + dep.TargetID + ":" + dep.Relationship
		if err := core.DeleteRef(ctx, store, event.RealmID, DependencyGraphExistsTable, depKey); err != nil {
			return err
		}
	}

	// For each dependent, remove the shattered rune from the source's Dependencies list
	for _, dep := range entry.Dependents {
		sourceEntry, err := p.getOrCreateEntry(ctx, event.RealmID, dep.SourceID, store)
		if err != nil {
			return err
		}
		filtered := make([]GraphDependency, 0, len(sourceEntry.Dependencies))
		for _, d := range sourceEntry.Dependencies {
			if d.TargetID != data.ID {
				filtered = append(filtered, d)
			}
		}
		sourceEntry.Dependencies = filtered
		if err := core.PutRef(ctx, store, event.RealmID, DependencyGraphTable, dep.SourceID, sourceEntry); err != nil {
			return err
		}
	}

	// Delete the shattered rune's own graph entry
	return core.DeleteRef(ctx, store, event.RealmID, DependencyGraphTable, data.ID)
}

func (p *DependencyGraphProjector) handleRemoved(ctx context.Context, event core.Event, store core.ProjectionStore) error {
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
	filtered := make([]GraphDependency, 0, len(sourceEntry.Dependencies))
	for _, dep := range sourceEntry.Dependencies {
		if dep.TargetID != data.TargetID || dep.Relationship != data.Relationship {
			filtered = append(filtered, dep)
		}
	}
	sourceEntry.Dependencies = filtered
	if err := core.PutRef(ctx, store, event.RealmID, DependencyGraphTable, data.RuneID, sourceEntry); err != nil {
		return err
	}

	// Update target entry: remove dependent
	targetEntry, err := p.getOrCreateEntry(ctx, event.RealmID, data.TargetID, store)
	if err != nil {
		return err
	}
	filteredDeps := make([]GraphDependent, 0, len(targetEntry.Dependents))
	for _, dep := range targetEntry.Dependents {
		if dep.SourceID != data.RuneID || dep.Relationship != data.Relationship {
			filteredDeps = append(filteredDeps, dep)
		}
	}
	targetEntry.Dependents = filteredDeps
	if err := core.PutRef(ctx, store, event.RealmID, DependencyGraphTable, data.TargetID, targetEntry); err != nil {
		return err
	}

	// Remove dep lookup key
	depKey := "dep:" + data.RuneID + ":" + data.TargetID + ":" + data.Relationship
	return core.DeleteRef(ctx, store, event.RealmID, DependencyGraphExistsTable, depKey)
}
