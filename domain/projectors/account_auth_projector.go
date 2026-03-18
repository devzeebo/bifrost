package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type AccountAuthEntry struct {
	AccountID string            `json:"account_id"`
	Username  string            `json:"username"`
	Status    string            `json:"status"`
	Realms    []string          `json:"realms"`
	Roles     map[string]string `json:"roles"`
}

type AccountAuthProjector struct{}

func NewAccountAuthProjector() *AccountAuthProjector {
	return &AccountAuthProjector{}
}

func (p *AccountAuthProjector) Name() string {
	return "account_auth"
}

func (p *AccountAuthProjector) TableName() string {
	return "projection_account_auth"
}

func (p *AccountAuthProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventAccountCreated:
		return p.handleAccountCreated(ctx, event, store)
	case domain.EventAccountSuspended:
		return p.handleAccountSuspended(ctx, event, store)
	case domain.EventRealmGranted:
		return p.handleRealmGranted(ctx, event, store)
	case domain.EventRealmRevoked:
		return p.handleRealmRevoked(ctx, event, store)
	case domain.EventRoleAssigned:
		return p.handleRoleAssigned(ctx, event, store)
	case domain.EventRoleRevoked:
		return p.handleRoleRevoked(ctx, event, store)
	}
	return nil
}

func (p *AccountAuthProjector) handleAccountCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AccountCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Check if account already exists for idempotency
	var existing AccountAuthEntry
	if err := store.Get(ctx, event.RealmID, "projection_account_auth", data.AccountID, &existing); err == nil {
		// Account already exists, idempotent
		return nil
	}

	entry := AccountAuthEntry{
		AccountID: data.AccountID,
		Username:  data.Username,
		Status:    "active",
		Realms:    []string{},
		Roles:     map[string]string{},
	}
	return store.Put(ctx, event.RealmID, "projection_account_auth", data.AccountID, entry)
}

func (p *AccountAuthProjector) handleAccountSuspended(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AccountSuspended
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	var entry AccountAuthEntry
	if err := store.Get(ctx, event.RealmID, "projection_account_auth", data.AccountID, &entry); err != nil {
		return err
	}
	entry.Status = "suspended"
	return store.Put(ctx, event.RealmID, "projection_account_auth", data.AccountID, entry)
}

func (p *AccountAuthProjector) handleRealmGranted(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmGranted
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	var entry AccountAuthEntry
	if err := store.Get(ctx, event.RealmID, "projection_account_auth", data.AccountID, &entry); err != nil {
		return err
	}

	// Check for duplicate for idempotency
	for _, r := range entry.Realms {
		if r == data.RealmID {
			return nil // Already exists, idempotent
		}
	}

	entry.Realms = append(entry.Realms, data.RealmID)
	if entry.Roles == nil {
		entry.Roles = make(map[string]string)
	}
	entry.Roles[data.RealmID] = "member"
	return store.Put(ctx, event.RealmID, "projection_account_auth", data.AccountID, entry)
}

func (p *AccountAuthProjector) handleRealmRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	var entry AccountAuthEntry
	if err := store.Get(ctx, event.RealmID, "projection_account_auth", data.AccountID, &entry); err != nil {
		return err
	}

	entry.Realms = removeString(entry.Realms, data.RealmID)
	delete(entry.Roles, data.RealmID)

	return store.Put(ctx, event.RealmID, "projection_account_auth", data.AccountID, entry)
}

func (p *AccountAuthProjector) handleRoleAssigned(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RoleAssigned
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	var entry AccountAuthEntry
	if err := store.Get(ctx, event.RealmID, "projection_account_auth", data.AccountID, &entry); err != nil {
		return err
	}

	if entry.Roles == nil {
		entry.Roles = make(map[string]string)
	}

	// Check if realm already in list
	_, alreadyInRealms := entry.Roles[data.RealmID]
	entry.Roles[data.RealmID] = data.Role

	// Add realm to list if not already present
	if !alreadyInRealms {
		entry.Realms = append(entry.Realms, data.RealmID)
	}

	return store.Put(ctx, event.RealmID, "projection_account_auth", data.AccountID, entry)
}

func (p *AccountAuthProjector) handleRoleRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RoleRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	var entry AccountAuthEntry
	if err := store.Get(ctx, event.RealmID, "projection_account_auth", data.AccountID, &entry); err != nil {
		return err
	}

	entry.Realms = removeString(entry.Realms, data.RealmID)
	delete(entry.Roles, data.RealmID)

	return store.Put(ctx, event.RealmID, "projection_account_auth", data.AccountID, entry)
}
