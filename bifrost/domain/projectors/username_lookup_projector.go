package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

// UsernameLookupEntry is the projection document for username lookups.
type UsernameLookupEntry struct {
	Username  string `json:"username"`
	AccountID string `json:"account_id"`
}

// UsernameLookupProjector provides O(1) username-to-account-ID resolution.
type UsernameLookupProjector struct{}

func NewUsernameLookupProjector() *UsernameLookupProjector {
	return &UsernameLookupProjector{}
}

func (p *UsernameLookupProjector) Name() string {
	return "username_lookup"
}

func (p *UsernameLookupProjector) TableName() string {
	return "username_lookup"
}

func (p *UsernameLookupProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventAccountCreated:
		return p.handleAccountCreated(ctx, event, store)
	}
	return nil
}

func (p *UsernameLookupProjector) handleAccountCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AccountCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Check if entry already exists for idempotency
	var existing UsernameLookupEntry
	if err := store.Get(ctx, "_admin", "username_lookup", data.Username, &existing); err == nil {
		// Entry already exists, idempotent - don't overwrite
		return nil
	}

	entry := UsernameLookupEntry{
		Username:  data.Username,
		AccountID: data.AccountID,
	}
	return store.Put(ctx, "_admin", "username_lookup", data.Username, entry)
}
