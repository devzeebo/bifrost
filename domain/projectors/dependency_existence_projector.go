package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

// DependencyExistenceDoc is the document stored for each dependency row.
// Row existence indicates the dependency exists.
type DependencyExistenceDoc struct {
	RuneID       string `json:"rune_id"`
	TargetID     string `json:"target_id"`
	Relationship string `json:"relationship"`
}

// DependencyExistenceProjector maintains a table where each row represents
// a single dependency. Row existence is the answer to "does this dependency exist?".
// Table: projection_dependency_existence
// Key: {rune_id}:{target_id}:{relationship}
// Events: DependencyAdded (insert), DependencyRemoved (delete)
type DependencyExistenceProjector struct{}

func NewDependencyExistenceProjector() *DependencyExistenceProjector {
	return &DependencyExistenceProjector{}
}

func (p *DependencyExistenceProjector) Name() string {
	return "dependency_existence"
}

func (p *DependencyExistenceProjector) TableName() string {
	return "projection_dependency_existence"
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
		return err
	}

	// Skip inverse events - they're handled by the forward event
	if data.IsInverse {
		return nil
	}

	key := data.RuneID + ":" + data.TargetID + ":" + data.Relationship
	doc := DependencyExistenceDoc{
		RuneID:       data.RuneID,
		TargetID:     data.TargetID,
		Relationship: data.Relationship,
	}

	return store.Put(ctx, event.RealmID, p.TableName(), key, doc)
}

func (p *DependencyExistenceProjector) handleRemoved(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.DependencyRemoved
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Skip inverse events - they're handled by the forward event
	if data.IsInverse {
		return nil
	}

	key := data.RuneID + ":" + data.TargetID + ":" + data.Relationship
	return store.Delete(ctx, event.RealmID, p.TableName(), key)
}
