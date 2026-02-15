package projectors

import (
	"context"
	"encoding/json"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type RealmListEntry struct {
	RealmID   string    `json:"realm_id"`
	Name      string    `json:"name"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type RealmListProjector struct{}

func NewRealmListProjector() *RealmListProjector {
	return &RealmListProjector{}
}

func (p *RealmListProjector) Name() string {
	return "realm_list"
}

func (p *RealmListProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventRealmCreated:
		return p.handleCreated(ctx, event, store)
	case domain.EventRealmSuspended:
		return p.handleSuspended(ctx, event, store)
	}
	return nil
}

func (p *RealmListProjector) handleCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	entry := RealmListEntry{
		RealmID:   data.RealmID,
		Name:      data.Name,
		Status:    "active",
		CreatedAt: data.CreatedAt,
	}
	return store.Put(ctx, event.RealmID, "realm_list", data.RealmID, entry)
}

func (p *RealmListProjector) handleSuspended(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmSuspended
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry RealmListEntry
	if err := store.Get(ctx, event.RealmID, "realm_list", data.RealmID, &entry); err != nil {
		return err
	}
	entry.Status = "suspended"
	return store.Put(ctx, event.RealmID, "realm_list", data.RealmID, entry)
}
