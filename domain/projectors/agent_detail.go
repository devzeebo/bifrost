package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type AgentDetailEntry struct {
	ID             string   `json:"id"`
	Name           string   `json:"name"`
	MainWorkflowID string   `json:"main_workflow_id,omitempty"`
	Skills         []string `json:"skills"`
	Workflows      []string `json:"workflows"`
	Realms         []string `json:"realms"`
}

type AgentDetailProjector struct{}

func NewAgentDetailProjector() *AgentDetailProjector {
	return &AgentDetailProjector{}
}

func (p *AgentDetailProjector) Name() string {
	return "agent_detail"
}

func (p *AgentDetailProjector) TableName() string {
	return "agent_detail"
}

func (p *AgentDetailProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventAgentCreated:
		return p.handleCreated(ctx, event, store)
	case domain.EventAgentUpdated:
		return p.handleUpdated(ctx, event, store)
	case domain.EventAgentRealmGranted:
		return p.handleRealmGranted(ctx, event, store)
	case domain.EventAgentRealmRevoked:
		return p.handleRealmRevoked(ctx, event, store)
	case domain.EventAgentSkillAdded:
		return p.handleSkillAdded(ctx, event, store)
	case domain.EventAgentWorkflowAdded:
		return p.handleWorkflowAdded(ctx, event, store)
	}
	return nil
}

func (p *AgentDetailProjector) handleCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AgentCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Check if agent already exists for idempotency
	var existing AgentDetailEntry
	if err := store.Get(ctx, event.RealmID, "agent_detail", data.AgentID, &existing); err == nil {
		// Agent already exists, idempotent
		return nil
	}

	entry := AgentDetailEntry{
		ID:             data.AgentID,
		Name:           data.Name,
		MainWorkflowID:  "",
		Skills:         []string{},
		Workflows:      []string{},
		Realms:         []string{},
	}
	return store.Put(ctx, event.RealmID, "agent_detail", data.AgentID, entry)
}

func (p *AgentDetailProjector) handleUpdated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AgentUpdated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AgentDetailEntry
	if err := store.Get(ctx, event.RealmID, "agent_detail", data.AgentID, &entry); err != nil {
		return err
	}
	if data.Name != nil {
		entry.Name = *data.Name
	}
	if data.MainWorkflowID != nil {
		entry.MainWorkflowID = *data.MainWorkflowID
	}
	return store.Put(ctx, event.RealmID, "agent_detail", data.AgentID, entry)
}

func (p *AgentDetailProjector) handleRealmGranted(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AgentRealmGranted
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AgentDetailEntry
	if err := store.Get(ctx, event.RealmID, "agent_detail", data.AgentID, &entry); err != nil {
		return err
	}
	// Check for duplicate for idempotency
	for _, r := range entry.Realms {
		if r == data.RealmID {
			return nil // Already exists, idempotent
		}
	}
	entry.Realms = append(entry.Realms, data.RealmID)
	return store.Put(ctx, event.RealmID, "agent_detail", data.AgentID, entry)
}

func (p *AgentDetailProjector) handleRealmRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AgentRealmRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AgentDetailEntry
	if err := store.Get(ctx, event.RealmID, "agent_detail", data.AgentID, &entry); err != nil {
		return err
	}
	filtered := make([]string, 0, len(entry.Realms))
	for _, r := range entry.Realms {
		if r != data.RealmID {
			filtered = append(filtered, r)
		}
	}
	entry.Realms = filtered
	return store.Put(ctx, event.RealmID, "agent_detail", data.AgentID, entry)
}

func (p *AgentDetailProjector) handleSkillAdded(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AgentSkillAdded
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AgentDetailEntry
	if err := store.Get(ctx, event.RealmID, "agent_detail", data.AgentID, &entry); err != nil {
		return err
	}
	// Check for duplicate for idempotency
	for _, s := range entry.Skills {
		if s == data.SkillID {
			return nil // Already exists, idempotent
		}
	}
	entry.Skills = append(entry.Skills, data.SkillID)
	return store.Put(ctx, event.RealmID, "agent_detail", data.AgentID, entry)
}

func (p *AgentDetailProjector) handleWorkflowAdded(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AgentWorkflowAdded
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AgentDetailEntry
	if err := store.Get(ctx, event.RealmID, "agent_detail", data.AgentID, &entry); err != nil {
		return err
	}
	// Check for duplicate for idempotency
	for _, w := range entry.Workflows {
		if w == data.WorkflowID {
			return nil // Already exists, idempotent
		}
	}
	entry.Workflows = append(entry.Workflows, data.WorkflowID)
	return store.Put(ctx, event.RealmID, "agent_detail", data.AgentID, entry)
}
