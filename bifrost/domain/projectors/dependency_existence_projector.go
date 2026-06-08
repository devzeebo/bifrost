package projectors

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

// DependencyExistenceProjector maintains a table where each row represents
// a single dependency. Row existence is the answer to "does this dependency exist?".
// Table: dependency_existence
// Key: {rune_id}:{target_id}:{relationship}
// Events: DependencyAdded (insert), DependencyRemoved (delete)
// DependencyExistenceTable is the typed table reference for this projector.
var DependencyExistenceTable = core.TableRef[core.DependencyExistenceDoc]{Name: "dependency_existence"}

type DependencyExistenceProjector struct{}

func NewDependencyExistenceProjector() *DependencyExistenceProjector {
	return &DependencyExistenceProjector{}
}

func (p *DependencyExistenceProjector) Name() string {
	return DependencyExistenceTable.Name
}

func (p *DependencyExistenceProjector) TableName() string {
	return DependencyExistenceTable.Name
}

func (p *DependencyExistenceProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventDependencyAdded:
		return p.handleAdded(ctx, event, store)
	case domain.EventDependencyRemoved:
		return p.handleRemoved(ctx, event, store)
	}
	return nil
}

func (p *DependencyExistenceProjector) handleAdded(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.DependencyAdded
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("dependency_existence: unmarshal %s: %w", domain.EventDependencyAdded, err)
	}

	// Skip inverse events - they're handled by the forward event
	if data.IsInverse {
		return nil
	}

	key := data.RuneID + ":" + data.TargetID + ":" + data.Relationship
	doc := core.DependencyExistenceDoc{
		RuneID:       data.RuneID,
		TargetID:     data.TargetID,
		Relationship: data.Relationship,
	}

	return core.PutRef(ctx, store, event.RealmID, DependencyExistenceTable, key, doc)
}

func (p *DependencyExistenceProjector) handleRemoved(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.DependencyRemoved
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("dependency_existence: unmarshal %s: %w", domain.EventDependencyRemoved, err)
	}

	// Skip inverse events - they're handled by the forward event
	if data.IsInverse {
		return nil
	}

	key := data.RuneID + ":" + data.TargetID + ":" + data.Relationship
	return core.DeleteRef(ctx, store, event.RealmID, DependencyExistenceTable, key)
}
