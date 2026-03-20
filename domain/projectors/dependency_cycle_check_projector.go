package projectors

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

// DependencyCycleCheckDoc is the document stored for each potential cycle edge.
// Row existence indicates a cycle would occur if this edge is added.
type DependencyCycleCheckDoc struct {
	SourceID string `json:"source_id"`
	TargetID string `json:"target_id"`
}

// DependencyCycleCheckProjector maintains a table where each row represents
// a potential cycle edge. Row existence is the answer to "would adding this edge create a cycle?".
// Table: dependency_cycle_check
// Key: {source_id}:{target_id}
// Events: DependencyAdded (insert), DependencyRemoved (delete)
type DependencyCycleCheckProjector struct{}

func NewDependencyCycleCheckProjector() *DependencyCycleCheckProjector {
	return &DependencyCycleCheckProjector{}
}

func (p *DependencyCycleCheckProjector) Name() string {
	return "dependency_cycle_check"
}

func (p *DependencyCycleCheckProjector) TableName() string {
	return "dependency_cycle_check"
}

func (p *DependencyCycleCheckProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventDependencyAdded:
		return p.handleAdded(ctx, event, store)
	case domain.EventDependencyRemoved:
		return p.handleRemoved(ctx, event, store)
	}
	return nil
}

func (p *DependencyCycleCheckProjector) handleAdded(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.DependencyAdded
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("dependency_cycle_check: unmarshal %s: %w", domain.EventDependencyAdded, err)
	}

	// Skip inverse events - they're handled by the forward event
	if data.IsInverse {
		return nil
	}

	key := data.RuneID + ":" + data.TargetID
	doc := DependencyCycleCheckDoc{
		SourceID: data.RuneID,
		TargetID: data.TargetID,
	}

	return store.Put(ctx, event.RealmID, p.TableName(), key, doc)
}

func (p *DependencyCycleCheckProjector) handleRemoved(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.DependencyRemoved
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("dependency_cycle_check: unmarshal %s: %w", domain.EventDependencyRemoved, err)
	}

	// Skip inverse events - they're handled by the forward event
	if data.IsInverse {
		return nil
	}

	key := data.RuneID + ":" + data.TargetID
	return store.Delete(ctx, event.RealmID, p.TableName(), key)
}
