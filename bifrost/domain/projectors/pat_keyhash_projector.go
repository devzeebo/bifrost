package projectors

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

// PATByKeyhashTable is the typed table reference for this projector.
var PATByKeyhashTable = core.TableRef[string]{Name: "pat_by_keyhash"}

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
	return PATByKeyhashTable.Name
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
	return core.PutRef(ctx, store, event.RealmID, PATByKeyhashTable, data.KeyHash, data.PATID)
}

func (p *PATKeyhashProjector) handlePATRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.PATRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	// We need to look up the keyhash from the PAT ID to delete the entry
	patEntry, err := core.GetRef(ctx, store, event.RealmID, PATByIDTable, data.PATID)
	if err != nil {
		var nfe *core.NotFoundError
		if errors.As(err, &nfe) {
			// If the PAT entry doesn't exist, nothing to delete
			return nil
		}
		// For any other error (database, decode, etc.), propagate it
		return err
	}
	return core.DeleteRef(ctx, store, event.RealmID, PATByKeyhashTable, patEntry.KeyHash)
}
