package projectors

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

// PATKeyHashEntry represents a PAT lookup by key hash.
type PATKeyHashEntry struct {
	KeyHash   string `json:"key_hash"`
	PATID     string `json:"pat_id"`
	AccountID string `json:"account_id"`
}

// PATKeyHashProjector projects PAT lookup by key hash.
type PATKeyHashProjector struct{}

// NewPATKeyHashProjector creates a new PATKeyHashProjector.
func NewPATKeyHashProjector() *PATKeyHashProjector {
	return &PATKeyHashProjector{}
}

// Name returns the projector name.
func (p *PATKeyHashProjector) Name() string {
	return "pat_keyhash"
}

// TableName returns the projection table name.
func (p *PATKeyHashProjector) TableName() string {
	return "projection_pat_by_keyhash"
}

// Handle processes events and updates the projection.
func (p *PATKeyHashProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventPATCreated:
		return p.handlePATCreated(ctx, event, store)
	case domain.EventPATRevoked:
		return p.handlePATRevoked(ctx, event, store)
	}
	return nil
}

func (p *PATKeyHashProjector) handlePATCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.PATCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	entry := PATKeyHashEntry{
		KeyHash:   data.KeyHash,
		PATID:     data.PATID,
		AccountID: data.AccountID,
	}
	// Store key_hash -> entry
	if err := store.Put(ctx, event.RealmID, "projection_pat_by_keyhash", data.KeyHash, entry); err != nil {
		return err
	}
	// Store reverse lookup pat_id -> key_hash for PATRevoked handling
	return store.Put(ctx, event.RealmID, "projection_pat_by_keyhash", "pat:"+data.PATID, data.KeyHash)
}

func (p *PATKeyHashProjector) handlePATRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.PATRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	// Look up key_hash from reverse lookup
	var keyHash string
	if err := store.Get(ctx, event.RealmID, "projection_pat_by_keyhash", "pat:"+data.PATID, &keyHash); err != nil {
		// If reverse lookup doesn't exist, PAT was never created or already revoked - idempotent
		var nfe *core.NotFoundError
		if errors.As(err, &nfe) {
			return nil
		}
		return err
	}
	// Delete key_hash entry
	if err := store.Delete(ctx, event.RealmID, "projection_pat_by_keyhash", keyHash); err != nil {
		return err
	}
	// Delete reverse lookup
	return store.Delete(ctx, event.RealmID, "projection_pat_by_keyhash", "pat:"+data.PATID)
}
