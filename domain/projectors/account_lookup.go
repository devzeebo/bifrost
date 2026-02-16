package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

type AccountLookupEntry struct {
	AccountID string            `json:"account_id"`
	Username  string            `json:"username"`
	Status    string            `json:"status"`
	Realms    []string          `json:"realms"`
	Roles     map[string]string `json:"roles"`
}

type accountInfo struct {
	Username string            `json:"username"`
	Status   string            `json:"status"`
	Realms   []string          `json:"realms"`
	Roles    map[string]string `json:"roles"`
}

type AccountLookupProjector struct{}

func NewAccountLookupProjector() *AccountLookupProjector {
	return &AccountLookupProjector{}
}

func (p *AccountLookupProjector) Name() string {
	return "account_lookup"
}

func (p *AccountLookupProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
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

func (p *AccountLookupProjector) handleAccountCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AccountCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Store username → accountID reverse lookup
	if err := store.Put(ctx, "_admin", "account_lookup", "username:"+data.Username, data.AccountID); err != nil {
		return err
	}

	// Store account info for building PAT entries later
	info := accountInfo{
		Username: data.Username,
		Status:   "active",
		Realms:   []string{},
		Roles:    map[string]string{},
	}
	if err := store.Put(ctx, "_admin", "account_lookup", "accountinfo:"+data.AccountID, info); err != nil {
		return err
	}

	// Initialize empty PAT hash list
	return store.Put(ctx, "_admin", "account_lookup", "account:"+data.AccountID, []string{})
}

func (p *AccountLookupProjector) handleAccountSuspended(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AccountSuspended
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Update account info status
	var info accountInfo
	if err := store.Get(ctx, "_admin", "account_lookup", "accountinfo:"+data.AccountID, &info); err != nil {
		return err
	}
	info.Status = "suspended"
	if err := store.Put(ctx, "_admin", "account_lookup", "accountinfo:"+data.AccountID, info); err != nil {
		return err
	}

	// Update all PAT entries
	var hashes []string
	if err := store.Get(ctx, "_admin", "account_lookup", "account:"+data.AccountID, &hashes); err != nil {
		return err
	}
	for _, hash := range hashes {
		var entry AccountLookupEntry
		if err := store.Get(ctx, "_admin", "account_lookup", hash, &entry); err != nil {
			return err
		}
		entry.Status = "suspended"
		if err := store.Put(ctx, "_admin", "account_lookup", hash, entry); err != nil {
			return err
		}
	}
	return nil
}

func (p *AccountLookupProjector) handleRealmGranted(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmGranted
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Update account info realms
	var info accountInfo
	if err := store.Get(ctx, "_admin", "account_lookup", "accountinfo:"+data.AccountID, &info); err != nil {
		return err
	}
	info.Realms = append(info.Realms, data.RealmID)
	if info.Roles == nil {
		info.Roles = make(map[string]string)
	}
	info.Roles[data.RealmID] = "member"
	if err := store.Put(ctx, "_admin", "account_lookup", "accountinfo:"+data.AccountID, info); err != nil {
		return err
	}

	// Update all PAT entries
	var hashes []string
	if err := store.Get(ctx, "_admin", "account_lookup", "account:"+data.AccountID, &hashes); err != nil {
		return err
	}
	for _, hash := range hashes {
		var entry AccountLookupEntry
		if err := store.Get(ctx, "_admin", "account_lookup", hash, &entry); err != nil {
			return err
		}
		entry.Realms = append(entry.Realms, data.RealmID)
		if entry.Roles == nil {
			entry.Roles = make(map[string]string)
		}
		entry.Roles[data.RealmID] = "member"
		if err := store.Put(ctx, "_admin", "account_lookup", hash, entry); err != nil {
			return err
		}
	}
	return nil
}

func (p *AccountLookupProjector) handleRealmRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Update account info realms
	var info accountInfo
	if err := store.Get(ctx, "_admin", "account_lookup", "accountinfo:"+data.AccountID, &info); err != nil {
		return err
	}
	info.Realms = removeString(info.Realms, data.RealmID)
	delete(info.Roles, data.RealmID)
	if err := store.Put(ctx, "_admin", "account_lookup", "accountinfo:"+data.AccountID, info); err != nil {
		return err
	}

	// Update all PAT entries
	var hashes []string
	if err := store.Get(ctx, "_admin", "account_lookup", "account:"+data.AccountID, &hashes); err != nil {
		return err
	}
	for _, hash := range hashes {
		var entry AccountLookupEntry
		if err := store.Get(ctx, "_admin", "account_lookup", hash, &entry); err != nil {
			return err
		}
		entry.Realms = removeString(entry.Realms, data.RealmID)
		delete(entry.Roles, data.RealmID)
		if err := store.Put(ctx, "_admin", "account_lookup", hash, entry); err != nil {
			return err
		}
	}
	return nil
}

func (p *AccountLookupProjector) handleRoleAssigned(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RoleAssigned
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Update account info
	var info accountInfo
	if err := store.Get(ctx, "_admin", "account_lookup", "accountinfo:"+data.AccountID, &info); err != nil {
		return err
	}
	if info.Roles == nil {
		info.Roles = make(map[string]string)
	}
	_, alreadyInRealms := info.Roles[data.RealmID]
	info.Roles[data.RealmID] = data.Role
	if !alreadyInRealms {
		info.Realms = append(info.Realms, data.RealmID)
	}
	if err := store.Put(ctx, "_admin", "account_lookup", "accountinfo:"+data.AccountID, info); err != nil {
		return err
	}

	// Update all PAT entries
	var hashes []string
	if err := store.Get(ctx, "_admin", "account_lookup", "account:"+data.AccountID, &hashes); err != nil {
		return err
	}
	for _, hash := range hashes {
		var entry AccountLookupEntry
		if err := store.Get(ctx, "_admin", "account_lookup", hash, &entry); err != nil {
			return err
		}
		if entry.Roles == nil {
			entry.Roles = make(map[string]string)
		}
		_, alreadyInEntry := entry.Roles[data.RealmID]
		entry.Roles[data.RealmID] = data.Role
		if !alreadyInEntry {
			entry.Realms = append(entry.Realms, data.RealmID)
		}
		if err := store.Put(ctx, "_admin", "account_lookup", hash, entry); err != nil {
			return err
		}
	}
	return nil
}

func (p *AccountLookupProjector) handleRoleRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RoleRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Update account info
	var info accountInfo
	if err := store.Get(ctx, "_admin", "account_lookup", "accountinfo:"+data.AccountID, &info); err != nil {
		return err
	}
	info.Realms = removeString(info.Realms, data.RealmID)
	delete(info.Roles, data.RealmID)
	if err := store.Put(ctx, "_admin", "account_lookup", "accountinfo:"+data.AccountID, info); err != nil {
		return err
	}

	// Update all PAT entries
	var hashes []string
	if err := store.Get(ctx, "_admin", "account_lookup", "account:"+data.AccountID, &hashes); err != nil {
		return err
	}
	for _, hash := range hashes {
		var entry AccountLookupEntry
		if err := store.Get(ctx, "_admin", "account_lookup", hash, &entry); err != nil {
			return err
		}
		entry.Realms = removeString(entry.Realms, data.RealmID)
		delete(entry.Roles, data.RealmID)
		if err := store.Put(ctx, "_admin", "account_lookup", hash, entry); err != nil {
			return err
		}
	}
	return nil
}

func (p *AccountLookupProjector) handlePATCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.PATCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Get account info to build the lookup entry
	var info accountInfo
	if err := store.Get(ctx, "_admin", "account_lookup", "accountinfo:"+data.AccountID, &info); err != nil {
		return err
	}

	// Store PAT hash → entry
	realms := info.Realms
	if realms == nil {
		realms = []string{}
	}
	roles := info.Roles
	if roles == nil {
		roles = map[string]string{}
	}
	entry := AccountLookupEntry{
		AccountID: data.AccountID,
		Username:  info.Username,
		Status:    info.Status,
		Realms:    realms,
		Roles:     roles,
	}
	if err := store.Put(ctx, "_admin", "account_lookup", data.KeyHash, entry); err != nil {
		return err
	}

	// Store PATID → keyHash reverse lookup for revocation
	if err := store.Put(ctx, "_admin", "account_lookup", "pat:"+data.PATID, data.KeyHash); err != nil {
		return err
	}

	// Add to account's PAT hash list
	var hashes []string
	if err := store.Get(ctx, "_admin", "account_lookup", "account:"+data.AccountID, &hashes); err != nil {
		return err
	}
	hashes = append(hashes, data.KeyHash)
	return store.Put(ctx, "_admin", "account_lookup", "account:"+data.AccountID, hashes)
}

func (p *AccountLookupProjector) handlePATRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.PATRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Look up key hash from PATID reverse lookup
	var keyHash string
	if err := store.Get(ctx, "_admin", "account_lookup", "pat:"+data.PATID, &keyHash); err != nil {
		return err
	}

	// Get account's PAT hash list
	var hashes []string
	if err := store.Get(ctx, "_admin", "account_lookup", "account:"+data.AccountID, &hashes); err != nil {
		return err
	}

	// Delete PAT hash entry
	if err := store.Delete(ctx, "_admin", "account_lookup", keyHash); err != nil {
		return err
	}

	// Remove from account's PAT hash list
	hashes = removeString(hashes, keyHash)
	if err := store.Put(ctx, "_admin", "account_lookup", "account:"+data.AccountID, hashes); err != nil {
		return err
	}

	// Clean up pat reverse lookup
	return store.Delete(ctx, "_admin", "account_lookup", "pat:"+data.PATID)
}

func removeString(slice []string, s string) []string {
	result := make([]string, 0, len(slice))
	for _, v := range slice {
		if v != s {
			result = append(result, v)
		}
	}
	return result
}
