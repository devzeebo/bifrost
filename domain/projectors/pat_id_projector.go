package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

// PATIDEntry represents a PAT lookup by ID.
type PATIDEntry struct {
	PATID     string `json:"pat_id"`
	KeyHash   string `json:"key_hash"`
	AccountID string `json:"account_id"`
}

// PATIDProjector projects PAT lookup by PAT ID.
type PATIDProjector struct{}

// NewPATIDProjector creates a new PATIDProjector.
func NewPATIDProjector() *PATIDProjector {
	return &PATIDProjector{}
}

// Name returns the projector name.
func (p *PATIDProjector) Name() string {
	return "pat_id"
}

// TableName returns the projection table name.
func (p *PATIDProjector) TableName() string {
	return "pat_by_id"
}

// Handle processes events and updates the projection.
func (p *PATIDProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventPATCreated:
		return p.handlePATCreated(ctx, event, store)
	case domain.EventPATRevoked:
		return p.handlePATRevoked(ctx, event, store)
	}
	return nil
}

func (p *PATIDProjector) handlePATCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.PATCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	entry := PATIDEntry{
		PATID:     data.PATID,
		KeyHash:   data.KeyHash,
		AccountID: data.AccountID,
	}
	return store.Put(ctx, event.RealmID, "pat_by_id", data.PATID, entry)
}

func (p *PATIDProjector) handlePATRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.PATRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	return store.Delete(ctx, event.RealmID, "pat_by_id", data.PATID)
}
