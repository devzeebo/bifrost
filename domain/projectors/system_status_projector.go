package projectors

import (
	"context"
	"encoding/json"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
)

// SystemStatusEntry is the projection document for system status.
// Key: constant string 'status' (single row per realm).
type SystemStatusEntry struct {
	AdminAccountIDs []string `json:"admin_account_ids"`
	RealmIDs        []string `json:"realm_ids"`
}

// SystemStatusProjector projects system-wide status information.
// Tracks which accounts have admin/owner role in _admin realm and which realms exist.
type SystemStatusProjector struct{}

func NewSystemStatusProjector() *SystemStatusProjector {
	return &SystemStatusProjector{}
}

func (p *SystemStatusProjector) Name() string {
	return "system_status"
}

func (p *SystemStatusProjector) TableName() string {
	return "projection_system_status"
}

func (p *SystemStatusProjector) Handle(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	switch event.EventType {
	case domain.EventAccountCreated:
		return p.handleAccountCreated(ctx, event, store)
	case domain.EventRoleAssigned:
		return p.handleRoleAssigned(ctx, event, store)
	case domain.EventRoleRevoked:
		return p.handleRoleRevoked(ctx, event, store)
	case domain.EventRealmCreated:
		return p.handleRealmCreated(ctx, event, store)
	}
	return nil
}

func (p *SystemStatusProjector) handleAccountCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.AccountCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Check if status already exists for idempotency
	var existing SystemStatusEntry
	if err := store.Get(ctx, "_admin", "projection_system_status", "status", &existing); err == nil {
		// Status already exists, idempotent - don't reset accumulated state
		return nil
	}

	// Initialize empty status
	entry := SystemStatusEntry{
		AdminAccountIDs: []string{},
		RealmIDs:        []string{},
	}
	return store.Put(ctx, "_admin", "projection_system_status", "status", entry)
}

func (p *SystemStatusProjector) handleRoleAssigned(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RoleAssigned
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Only track admin/owner roles in _admin realm
	if data.RealmID != "_admin" || (data.Role != "admin" && data.Role != "owner") {
		return nil
	}

	var entry SystemStatusEntry
	if err := store.Get(ctx, "_admin", "projection_system_status", "status", &entry); err != nil {
		return err
	}

	// Check for duplicate for idempotency
	for _, id := range entry.AdminAccountIDs {
		if id == data.AccountID {
			return nil // Already exists, idempotent
		}
	}

	entry.AdminAccountIDs = append(entry.AdminAccountIDs, data.AccountID)
	return store.Put(ctx, "_admin", "projection_system_status", "status", entry)
}

func (p *SystemStatusProjector) handleRoleRevoked(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RoleRevoked
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	// Only track revocations in _admin realm
	if data.RealmID != "_admin" {
		return nil
	}

	var entry SystemStatusEntry
	if err := store.Get(ctx, "_admin", "projection_system_status", "status", &entry); err != nil {
		return err
	}

	// Remove account from admin list (idempotent - no-op if not found)
	filtered := make([]string, 0, len(entry.AdminAccountIDs))
	for _, id := range entry.AdminAccountIDs {
		if id != data.AccountID {
			filtered = append(filtered, id)
		}
	}
	entry.AdminAccountIDs = filtered
	return store.Put(ctx, "_admin", "projection_system_status", "status", entry)
}

func (p *SystemStatusProjector) handleRealmCreated(ctx context.Context, event core.Event, store core.ProjectionStore) error {
	var data domain.RealmCreated
	if err := json.Unmarshal(event.Data, &data); err != nil {
		return err
	}

	var entry SystemStatusEntry
	if err := store.Get(ctx, "_admin", "projection_system_status", "status", &entry); err != nil {
		return err
	}

	// Check for duplicate for idempotency
	for _, id := range entry.RealmIDs {
		if id == data.RealmID {
			return nil // Already exists, idempotent
		}
	}

	entry.RealmIDs = append(entry.RealmIDs, data.RealmID)
	return store.Put(ctx, "_admin", "projection_system_status", "status", entry)
}
