package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

// PATKeyhashProjector projects PAT keyhash-to-PATID lookup for token validation.
type PATKeyhashProjector struct{}

// NewPATKeyhashProjector creates a new PATKeyhashProjector.
func NewPATKeyhashProjector() *PATKeyhashProjector {
	return &PATKeyhashProjector{}
}

// Name returns the projector name.
func (p *PATKeyhashProjector) Name() string {
	return "pat_keyhash"
}

// TableName returns the projection table name.
func (p *PATKeyhashProjector) TableName() string {
	return "projection_pat_by_keyhash"
}

// Handle processes events and updates the projection.
func (p *PATKeyhashProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventPATCreated:
		return p.handlePATCreated(ctx, event, store)
	case domain.EventPATRevoked:
		return p.handlePATRevoked(ctx, event, store)
	}
	return nil
}

func (p *PATKeyhashProjector) handlePATCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.PATCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	// Store PAT ID keyed by keyhash for token validation lookup
	return store.Put(ctx, event.RealmID, "projection_pat_by_keyhash", data.KeyHash, data.PATID)
}

func (p *PATKeyhashProjector) handlePATRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.PATRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	// We need to look up the keyhash from the PAT ID to delete the entry
	var patEntry PATIDEntry
	if err := store.Get(ctx, event.RealmID, "projection_pat_by_id", data.PATID, &patEntry); err != nil {
		// If the PAT entry doesn't exist, nothing to delete
		return nil
	}
	return store.Delete(ctx, event.RealmID, "projection_pat_by_keyhash", patEntry.KeyHash)
}
