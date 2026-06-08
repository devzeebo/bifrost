package projectors

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type AccountAuthEntry struct {
	AccountID string            `json:"account_id"`
	Username  string            `json:"username"`
	Status    string            `json:"status"`
	Realms    []string          `json:"realms"`
	Roles     map[string]string `json:"roles"`
	RealmNames map[string]string `json:"realm_names"` // realm_id -> realm_name mapping
}

// AccountAuthTable is the typed table reference for this projector.
var AccountAuthTable = core.TableRef[AccountAuthEntry]{Name: "account_auth"}

type AccountAuthProjector struct{}

func NewAccountAuthProjector() *AccountAuthProjector {
	return &AccountAuthProjector{}
}

func (p *AccountAuthProjector) Name() string {
	return AccountAuthTable.Name
}

func (p *AccountAuthProjector) TableName() string {
	return AccountAuthTable.Name
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
		return fmt.Errorf("account_auth: unmarshal %s: %w", domain.EventAccountCreated, err)
	}

	// Check if account already exists for idempotency
	_, err := core.GetRef(ctx, store, event.RealmID, AccountAuthTable, data.AccountID)
	if err == nil {
		// Account already exists, idempotent
		return nil
	} else if !errors.As(err, new(*core.NotFoundError)) {
		// Genuine error (not a "not found" error)
		return err
	}
	// Account doesn't exist (NotFoundError), continue to create it

	entry := AccountAuthEntry{
		AccountID: data.AccountID,
		Username:  data.Username,
		Status:    "active",
		Realms:    []string{},
		Roles:     map[string]string{},
	}
	return core.PutRef(ctx, store, event.RealmID, AccountAuthTable, data.AccountID, entry)
}

func (p *AccountAuthProjector) handleAccountSuspended(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AccountSuspended
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("account_auth: unmarshal %s: %w", domain.EventAccountSuspended, err)
	}

	entry, err := core.GetRef(ctx, store, event.RealmID, AccountAuthTable, data.AccountID)
	if err != nil {
		return err
	}
	entry.Status = "suspended"
	return core.PutRef(ctx, store, event.RealmID, AccountAuthTable, data.AccountID, entry)
}

func (p *AccountAuthProjector) handleRealmGranted(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmGranted
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("account_auth: unmarshal %s: %w", domain.EventRealmGranted, err)
	}

	entry, err := core.GetRef(ctx, store, event.RealmID, AccountAuthTable, data.AccountID)
	if err != nil {
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
	return core.PutRef(ctx, store, event.RealmID, AccountAuthTable, data.AccountID, entry)
}

func (p *AccountAuthProjector) handleRealmRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("account_auth: unmarshal %s: %w", domain.EventRealmRevoked, err)
	}

	entry, err := core.GetRef(ctx, store, event.RealmID, AccountAuthTable, data.AccountID)
	if err != nil {
		return err
	}

	entry.Realms = removeString(entry.Realms, data.RealmID)
	delete(entry.Roles, data.RealmID)
	delete(entry.RealmNames, data.RealmID)

	return core.PutRef(ctx, store, event.RealmID, AccountAuthTable, data.AccountID, entry)
}

func (p *AccountAuthProjector) handleRoleAssigned(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RoleAssigned
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("account_auth: unmarshal %s: %w", domain.EventRoleAssigned, err)
	}

	entry, err := core.GetRef(ctx, store, event.RealmID, AccountAuthTable, data.AccountID)
	if err != nil {
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

	return core.PutRef(ctx, store, event.RealmID, AccountAuthTable, data.AccountID, entry)
}

func (p *AccountAuthProjector) handleRoleRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RoleRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return fmt.Errorf("account_auth: unmarshal %s: %w", domain.EventRoleRevoked, err)
	}

	entry, err := core.GetRef(ctx, store, event.RealmID, AccountAuthTable, data.AccountID)
	if err != nil {
		return err
	}

	entry.Realms = removeString(entry.Realms, data.RealmID)
	delete(entry.Roles, data.RealmID)
	delete(entry.RealmNames, data.RealmID)

	return core.PutRef(ctx, store, event.RealmID, AccountAuthTable, data.AccountID, entry)
}
