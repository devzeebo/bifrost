package projectors

import (
	"context"
	"encoding/json"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type AccountListEntry struct {
	AccountID string            `json:"account_id"`
	Username  string            `json:"username"`
	Status    string            `json:"status"`
	Realms    []string          `json:"realms"`
	Roles     map[string]string `json:"roles"`
	PATCount  int               `json:"pat_count"`
	CreatedAt time.Time         `json:"created_at"`
}

type AccountListProjector struct{}

func NewAccountListProjector() *AccountListProjector {
	return &AccountListProjector{}
}

func (p *AccountListProjector) Name() string {
	return "account_list"
}

func (p *AccountListProjector) TableName() string {
	return "account_list"
}

func (p *AccountListProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
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
	case domain.EventPATCreated:
		return p.handlePATCreated(ctx, event, store)
	case domain.EventPATRevoked:
		return p.handlePATRevoked(ctx, event, store)
	}
	return nil
}

func (p *AccountListProjector) handleAccountCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AccountCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Check if account already exists for idempotency
	var existing AccountListEntry
	if err := store.Get(ctx, "_admin", "account_list", data.AccountID, &existing); err == nil {
		// Account already exists, idempotent - don't reset accumulated state
		return nil
	}

	entry := AccountListEntry{
		AccountID: data.AccountID,
		Username:  data.Username,
		Status:    "active",
		Realms:    []string{},
		Roles:     map[string]string{},
		PATCount:  0,
		CreatedAt: data.CreatedAt,
	}
	return store.Put(ctx, "_admin", "account_list", data.AccountID, entry)
}

func (p *AccountListProjector) handleAccountSuspended(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AccountSuspended
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AccountListEntry
	if err := store.Get(ctx, "_admin", "account_list", data.AccountID, &entry); err != nil {
		return err
	}
	entry.Status = "suspended"
	return store.Put(ctx, "_admin", "account_list", data.AccountID, entry)
}

func (p *AccountListProjector) handleRealmGranted(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmGranted
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AccountListEntry
	if err := store.Get(ctx, "_admin", "account_list", data.AccountID, &entry); err != nil {
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
	return store.Put(ctx, "_admin", "account_list", data.AccountID, entry)
}

func (p *AccountListProjector) handleRealmRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AccountListEntry
	if err := store.Get(ctx, "_admin", "account_list", data.AccountID, &entry); err != nil {
		return err
	}
	filtered := make([]string, 0, len(entry.Realms))
	for _, r := range entry.Realms {
		if r != data.RealmID {
			filtered = append(filtered, r)
		}
	}
	entry.Realms = filtered
	delete(entry.Roles, data.RealmID)
	return store.Put(ctx, "_admin", "account_list", data.AccountID, entry)
}

func (p *AccountListProjector) handleRoleAssigned(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RoleAssigned
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AccountListEntry
	if err := store.Get(ctx, "_admin", "account_list", data.AccountID, &entry); err != nil {
		return err
	}
	if entry.Roles == nil {
		entry.Roles = make(map[string]string)
	}
	_, alreadyInRealms := entry.Roles[data.RealmID]
	entry.Roles[data.RealmID] = data.Role
	if !alreadyInRealms {
		entry.Realms = append(entry.Realms, data.RealmID)
	}
	return store.Put(ctx, "_admin", "account_list", data.AccountID, entry)
}

func (p *AccountListProjector) handleRoleRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RoleRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AccountListEntry
	if err := store.Get(ctx, "_admin", "account_list", data.AccountID, &entry); err != nil {
		return err
	}
	entry.Realms = removeString(entry.Realms, data.RealmID)
	delete(entry.Roles, data.RealmID)
	return store.Put(ctx, "_admin", "account_list", data.AccountID, entry)
}

func (p *AccountListProjector) handlePATCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.PATCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AccountListEntry
	if err := store.Get(ctx, "_admin", "account_list", data.AccountID, &entry); err != nil {
		return err
	}
	// Check if PAT already counted for idempotency
	countedKey := "pat_counted:" + data.PATID
	var alreadyCounted bool
	if err := store.Get(ctx, "_admin", "account_list", countedKey, &alreadyCounted); err == nil && alreadyCounted {
		return nil // Already counted, idempotent
	}
	entry.PATCount++
	if err := store.Put(ctx, "_admin", "account_list", data.AccountID, entry); err != nil {
		return err
	}
	return store.Put(ctx, "_admin", "account_list", countedKey, true)
}

func (p *AccountListProjector) handlePATRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.PATRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AccountListEntry
	if err := store.Get(ctx, "_admin", "account_list", data.AccountID, &entry); err != nil {
		return err
	}
	// Check if PAT already decremented for idempotency
	countedKey := "pat_counted:" + data.PATID
	var alreadyCounted bool
	if err := store.Get(ctx, "_admin", "account_list", countedKey, &alreadyCounted); err != nil || !alreadyCounted {
		// Never counted or already decremented, nothing to do
		return nil
	}
	entry.PATCount--
	if err := store.Put(ctx, "_admin", "account_list", data.AccountID, entry); err != nil {
		return err
	}
	return store.Delete(ctx, "_admin", "account_list", countedKey)
}
