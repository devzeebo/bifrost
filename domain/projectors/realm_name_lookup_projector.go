package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

// RealmNameLookupEntry is the projection document for realm name lookups.
type RealmNameLookupEntry struct {
	Name    string `json:"name"`
	RealmID string `json:"realm_id"`
}

// RealmNameLookupProjector provides O(1) realm-name-to-ID resolution.
type RealmNameLookupProjector struct{}

func NewRealmNameLookupProjector() *RealmNameLookupProjector {
	return &RealmNameLookupProjector{}
}

func (p *RealmNameLookupProjector) Name() string {
	return "realm_name_lookup"
}

func (p *RealmNameLookupProjector) TableName() string {
	return "realm_name_lookup"
}

func (p *RealmNameLookupProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventRealmCreated:
		return p.handleRealmCreated(ctx, event, store)
	}
	return nil
}

func (p *RealmNameLookupProjector) handleRealmCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Check if entry already exists for idempotency
	var existing RealmNameLookupEntry
	if err := store.Get(ctx, "_admin", "realm_name_lookup", data.Name, &existing); err == nil {
		// Entry already exists, idempotent - don't overwrite
		return nil
	}

	entry := RealmNameLookupEntry{
		Name:    data.Name,
		RealmID: data.RealmID,
	}
	return store.Put(ctx, "_admin", "realm_name_lookup", data.Name, entry)
}
