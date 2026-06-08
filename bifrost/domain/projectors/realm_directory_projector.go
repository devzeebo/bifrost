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

// RealmDirectoryTable is the typed table reference for this projector.
var RealmDirectoryTable = core.TableRef[RealmDirectoryEntry]{Name: "realm_directory"}

type RealmDirectoryProjector struct{}

func NewRealmDirectoryProjector() *RealmDirectoryProjector {
	return &RealmDirectoryProjector{}
}

func (p *RealmDirectoryProjector) Name() string {
	return RealmDirectoryTable.Name
}

func (p *RealmDirectoryProjector) TableName() string {
	return RealmDirectoryTable.Name
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
	return core.PutRef(ctx, store, "_admin", RealmDirectoryTable, data.RealmID, entry)
}

func (p *RealmDirectoryProjector) handleSuspended(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmSuspended
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	entry, err := core.GetRef(ctx, store, "_admin", RealmDirectoryTable, data.RealmID)
	if err != nil {
		return err
	}
	entry.Status = "suspended"
	return core.PutRef(ctx, store, "_admin", RealmDirectoryTable, data.RealmID, entry)
}
