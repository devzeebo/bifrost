package projectors

import (
	"context"
	"encoding/json"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type RealmDirectoryEntry struct {
	RealmID   string    `json:"realm_id"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type RealmDirectoryProjector struct{}

func NewRealmDirectoryProjector() *RealmDirectoryProjector {
	return &RealmDirectoryProjector{}
}

func (p *RealmDirectoryProjector) Name() string {
	return "realm_directory"
}

func (p *RealmDirectoryProjector) TableName() string {
	return "realm_directory"
}

func (p *RealmDirectoryProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventRealmCreated:
		return p.handleCreated(ctx, event, store)
	case domain.EventRealmSuspended:
		return p.handleSuspended(ctx, event, store)
	}
	return nil
}

func (p *RealmDirectoryProjector) handleCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	entry := RealmDirectoryEntry{
		RealmID:   data.RealmID,
		Name:      data.Name,
		Status:    "active",
		CreatedAt: data.CreatedAt,
	}
	return store.Put(ctx, data.RealmID, "realm_directory", data.RealmID, entry)
}

func (p *RealmDirectoryProjector) handleSuspended(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmSuspended
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry RealmDirectoryEntry
	if err := store.Get(ctx, data.RealmID, "realm_directory", data.RealmID, &entry); err != nil {
		return err
	}
	entry.Status = "suspended"
	return store.Put(ctx, data.RealmID, "realm_directory", data.RealmID, entry)
}
