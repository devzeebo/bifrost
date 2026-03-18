package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type SkillListEntry struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type SkillListProjector struct{}

func NewSkillListProjector() *SkillListProjector {
	return &SkillListProjector{}
}

func (p *SkillListProjector) Name() string {
	return "skill_list"
}

func (p *SkillListProjector) TableName() string {
	return "projection_skill_list"
}

func (p *SkillListProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventSkillCreated:
		return p.handleCreated(ctx, event, store)
	case domain.EventSkillUpdated:
		return p.handleUpdated(ctx, event, store)
	case domain.EventSkillDeleted:
		return p.handleDeleted(ctx, event, store)
	}
	return nil
}

func (p *SkillListProjector) handleCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.SkillCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Check if skill already exists for idempotency
	var existing SkillListEntry
	if err := store.Get(ctx, event.RealmID, "projection_skill_list", data.SkillID, &existing); err == nil {
		// Skill already exists, idempotent
		return nil
	}

	entry := SkillListEntry{
		ID:   data.SkillID,
		Name: data.Name,
	}
	return store.Put(ctx, event.RealmID, "projection_skill_list", data.SkillID, entry)
}

func (p *SkillListProjector) handleUpdated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.SkillUpdated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry SkillListEntry
	if err := store.Get(ctx, event.RealmID, "projection_skill_list", data.SkillID, &entry); err != nil {
		return err
	}
	if data.Name != nil {
		entry.Name = *data.Name
	}
	return store.Put(ctx, event.RealmID, "projection_skill_list", data.SkillID, entry)
}

func (p *SkillListProjector) handleDeleted(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.SkillDeleted
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	return store.Delete(ctx, event.RealmID, "projection_skill_list", data.SkillID)
}
