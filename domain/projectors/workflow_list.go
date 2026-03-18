package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type WorkflowListEntry struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type WorkflowListProjector struct{}

func NewWorkflowListProjector() *WorkflowListProjector {
	return &WorkflowListProjector{}
}

func (p *WorkflowListProjector) Name() string {
	return "workflow_list"
}

func (p *WorkflowListProjector) TableName() string {
	return "projection_workflow_list"
}

func (p *WorkflowListProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventWorkflowCreated:
		return p.handleCreated(ctx, event, store)
	case domain.EventWorkflowUpdated:
		return p.handleUpdated(ctx, event, store)
	case domain.EventWorkflowDeleted:
		return p.handleDeleted(ctx, event, store)
	}
	return nil
}

func (p *WorkflowListProjector) handleCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.WorkflowCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Check if workflow already exists for idempotency
	var existing WorkflowListEntry
	if err := store.Get(ctx, event.RealmID, "projection_workflow_list", data.WorkflowID, &existing); err == nil {
		// Workflow already exists, idempotent
		return nil
	}

	entry := WorkflowListEntry{
		ID:   data.WorkflowID,
		Name: data.Name,
	}
	return store.Put(ctx, event.RealmID, "projection_workflow_list", data.WorkflowID, entry)
}

func (p *WorkflowListProjector) handleUpdated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.WorkflowUpdated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry WorkflowListEntry
	if err := store.Get(ctx, event.RealmID, "projection_workflow_list", data.WorkflowID, &entry); err != nil {
		return err
	}
	if data.Name != nil {
		entry.Name = *data.Name
	}
	return store.Put(ctx, event.RealmID, "projection_workflow_list", data.WorkflowID, entry)
}

func (p *WorkflowListProjector) handleDeleted(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.WorkflowDeleted
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	return store.Delete(ctx, event.RealmID, "projection_workflow_list", data.WorkflowID)
}
