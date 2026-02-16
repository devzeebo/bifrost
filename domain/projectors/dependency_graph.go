package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

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

type DependencyGraphProjector struct{}

func NewDependencyGraphProjector() *DependencyGraphProjector {
	return &DependencyGraphProjector{}
}

func (p *DependencyGraphProjector) Name() string {
	return "dependency_graph"
}

func (p *DependencyGraphProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventDependencyAdded:
		return p.handleAdded(ctx, event, store)
	case domain.EventDependencyRemoved:
		return p.handleRemoved(ctx, event, store)
	}
	return nil
}

func (p *DependencyGraphProjector) getOrCreateEntry(ctx context.Context, realmID, runeID string, store core.ProjectionStore) (GraphEntry, error) {
	var entry GraphEntry
	err := store.Get(ctx, realmID, "dependency_graph", runeID, &entry)
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

	// Update source entry: append dependency
	sourceEntry, err := p.getOrCreateEntry(ctx, event.RealmID, data.RuneID, store)
	if err != nil {
		return err
	}
	sourceEntry.Dependencies = append(sourceEntry.Dependencies, GraphDependency{
		TargetID:     data.TargetID,
		Relationship: data.Relationship,
	})
	if err := store.Put(ctx, event.RealmID, "dependency_graph", data.RuneID, sourceEntry); err != nil {
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
	if err := store.Put(ctx, event.RealmID, "dependency_graph", data.TargetID, targetEntry); err != nil {
		return err
	}

	// Store dep lookup key for existence checks
	depKey := "dep:" + data.RuneID + ":" + data.TargetID + ":" + data.Relationship
	return store.Put(ctx, event.RealmID, "dependency_graph", depKey, true)
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
	if err := store.Put(ctx, event.RealmID, "dependency_graph", data.RuneID, sourceEntry); err != nil {
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
	if err := store.Put(ctx, event.RealmID, "dependency_graph", data.TargetID, targetEntry); err != nil {
		return err
	}

	// Remove dep lookup key
	depKey := "dep:" + data.RuneID + ":" + data.TargetID + ":" + data.Relationship
	return store.Delete(ctx, event.RealmID, "dependency_graph", depKey)
}
