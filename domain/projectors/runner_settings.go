package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type RunnerSettingsEntry struct {
	ID         string            `json:"id"`
	RunnerType string            `json:"runner_type"`
	Name       string            `json:"name"`
	Fields     map[string]string `json:"fields"`
}

type RunnerSettingsProjector struct{}

func NewRunnerSettingsProjector() *RunnerSettingsProjector {
	return &RunnerSettingsProjector{}
}

func (p *RunnerSettingsProjector) Name() string {
	return "runner_settings"
}

func (p *RunnerSettingsProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventRunnerSettingsCreated:
		return p.handleCreated(ctx, event, store)
	case domain.EventRunnerSettingsFieldSet:
		return p.handleFieldSet(ctx, event, store)
	case domain.EventRunnerSettingsFieldDeleted:
		return p.handleFieldDeleted(ctx, event, store)
	case domain.EventRunnerSettingsDeleted:
		return p.handleDeleted(ctx, event, store)
	}
	return nil
}

func (p *RunnerSettingsProjector) handleCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RunnerSettingsCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Check if runner settings already exists for idempotency
	var existing RunnerSettingsEntry
	if err := store.Get(ctx, event.RealmID, "runner_settings", data.RunnerSettingsID, &existing); err == nil {
		// Runner settings already exists, idempotent
		return nil
	}

	entry := RunnerSettingsEntry{
		ID:         data.RunnerSettingsID,
		RunnerType: data.RunnerType,
		Name:       data.Name,
		Fields:     map[string]string{},
	}
	return store.Put(ctx, event.RealmID, "runner_settings", data.RunnerSettingsID, entry)
}

func (p *RunnerSettingsProjector) handleFieldSet(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RunnerSettingsFieldSet
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry RunnerSettingsEntry
	if err := store.Get(ctx, event.RealmID, "runner_settings", data.RunnerSettingsID, &entry); err != nil {
		return err
	}
	if entry.Fields == nil {
		entry.Fields = make(map[string]string)
	}
	entry.Fields[data.Key] = data.Value
	return store.Put(ctx, event.RealmID, "runner_settings", data.RunnerSettingsID, entry)
}

func (p *RunnerSettingsProjector) handleFieldDeleted(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RunnerSettingsFieldDeleted
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry RunnerSettingsEntry
	if err := store.Get(ctx, event.RealmID, "runner_settings", data.RunnerSettingsID, &entry); err != nil {
		return err
	}
	delete(entry.Fields, data.Key)
	return store.Put(ctx, event.RealmID, "runner_settings", data.RunnerSettingsID, entry)
}

func (p *RunnerSettingsProjector) handleDeleted(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RunnerSettingsDeleted
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	return store.Delete(ctx, event.RealmID, "runner_settings", data.RunnerSettingsID)
}
