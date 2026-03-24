package projectors

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

// PATEntry represents a PAT in the account directory.
type PATEntry struct {
	PATID     string    `json:"pat_id"`
	KeyHash   string    `json:"key_hash"`
	Label     string    `json:"label"`
	CreatedAt time.Time `json:"created_at"`
}

// AccountDirectoryEntry is the projection document for an account.
type AccountDirectoryEntry struct {
	AccountID string            `json:"account_id"`
	Username  string            `json:"username"`
	Status    string            `json:"status"`
	Realms    []string          `json:"realms"`
	Roles     map[string]string `json:"roles"`
	PATs      []PATEntry        `json:"pats"`
	CreatedAt time.Time         `json:"created_at"`
}

// PATCount returns the number of PATs (derived from len(pats)).
func (e *AccountDirectoryEntry) PATCount() int {
	return len(e.PATs)
}

// AccountDirectoryProjector projects account directory information.
type AccountDirectoryProjector struct{}

func NewAccountDirectoryProjector() *AccountDirectoryProjector {
	return &AccountDirectoryProjector{}
}

func (p *AccountDirectoryProjector) Name() string {
	return "account_directory"
}

func (p *AccountDirectoryProjector) TableName() string {
	return "account_directory"
}

func (p *AccountDirectoryProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
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

func (p *AccountDirectoryProjector) handleAccountCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AccountCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Check if account already exists for idempotency
	var existing AccountDirectoryEntry
	if err := store.Get(ctx, "_admin", "account_directory", data.AccountID, &existing); err == nil {
		// Account already exists, idempotent - don't reset accumulated state
		return nil
	} else {
		var nfe *core.NotFoundError
		if !errors.As(err, &nfe) {
			// For any non-not-found error, propagate it instead of overwriting state
			return err
		}
		// Account doesn't exist, proceed with creation
	}

	entry := AccountDirectoryEntry{
		AccountID: data.AccountID,
		Username:  data.Username,
		Status:    "active",
		Realms:    []string{},
		Roles:     map[string]string{},
		PATs:      []PATEntry{},
		CreatedAt: data.CreatedAt,
	}
	return store.Put(ctx, "_admin", "account_directory", data.AccountID, entry)
}

func (p *AccountDirectoryProjector) handleAccountSuspended(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AccountSuspended
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AccountDirectoryEntry
	if err := store.Get(ctx, "_admin", "account_directory", data.AccountID, &entry); err != nil {
		return err
	}
	entry.Status = "suspended"
	return store.Put(ctx, "_admin", "account_directory", data.AccountID, entry)
}

func (p *AccountDirectoryProjector) handleRealmGranted(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmGranted
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AccountDirectoryEntry
	if err := store.Get(ctx, "_admin", "account_directory", data.AccountID, &entry); err != nil {
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
	return store.Put(ctx, "_admin", "account_directory", data.AccountID, entry)
}

func (p *AccountDirectoryProjector) handleRealmRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AccountDirectoryEntry
	if err := store.Get(ctx, "_admin", "account_directory", data.AccountID, &entry); err != nil {
		return err
	}
	entry.Realms = removeString(entry.Realms, data.RealmID)
	delete(entry.Roles, data.RealmID)
	return store.Put(ctx, "_admin", "account_directory", data.AccountID, entry)
}

func (p *AccountDirectoryProjector) handleRoleAssigned(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RoleAssigned
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AccountDirectoryEntry
	if err := store.Get(ctx, "_admin", "account_directory", data.AccountID, &entry); err != nil {
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
	return store.Put(ctx, "_admin", "account_directory", data.AccountID, entry)
}

func (p *AccountDirectoryProjector) handleRoleRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RoleRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AccountDirectoryEntry
	if err := store.Get(ctx, "_admin", "account_directory", data.AccountID, &entry); err != nil {
		return err
	}
	
	// Only adjust the role, not realm membership
	// Check if account is still a member of the realm
	isRealmMember := false
	for _, realmID := range entry.Realms {
		if realmID == data.RealmID {
			isRealmMember = true
			break
		}
	}
	
	if isRealmMember {
		// Account is still a member, downgrade role to "member"
		if entry.Roles == nil {
			entry.Roles = make(map[string]string)
		}
		entry.Roles[data.RealmID] = "member"
	} else {
		// Account is not a member (shouldn't happen in normal flow), remove role entry
		delete(entry.Roles, data.RealmID)
	}
	
	return store.Put(ctx, "_admin", "account_directory", data.AccountID, entry)
}

func (p *AccountDirectoryProjector) handlePATCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.PATCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AccountDirectoryEntry
	if err := store.Get(ctx, "_admin", "account_directory", data.AccountID, &entry); err != nil {
		return err
	}
	// Check for duplicate for idempotency
	for _, pat := range entry.PATs {
		if pat.PATID == data.PATID {
			return nil // Already exists, idempotent
		}
	}
	entry.PATs = append(entry.PATs, PATEntry{
		PATID:     data.PATID,
		KeyHash:   data.KeyHash,
		Label:     data.Label,
		CreatedAt: data.CreatedAt,
	})
	return store.Put(ctx, "_admin", "account_directory", data.AccountID, entry)
}

func (p *AccountDirectoryProjector) handlePATRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.PATRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}
	var entry AccountDirectoryEntry
	if err := store.Get(ctx, "_admin", "account_directory", data.AccountID, &entry); err != nil {
		return err
	}
	// Remove PAT from array (idempotent - no-op if not found)
	filtered := make([]PATEntry, 0, len(entry.PATs))
	for _, pat := range entry.PATs {
		if pat.PATID != data.PATID {
			filtered = append(filtered, pat)
		}
	}
	entry.PATs = filtered
	return store.Put(ctx, "_admin", "account_directory", data.AccountID, entry)
}
