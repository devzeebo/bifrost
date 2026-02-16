package projectors

import (
	"context"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestAccountLookupProjector(t *testing.T) {
	t.Run("Name returns account_lookup", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("account_lookup")
	})

	t.Run("handles AccountCreated by storing username reverse lookup", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.an_account_created_event("acct-1", "alice")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.username_lookup_has_account_id("alice", "acct-1")
	})

	t.Run("handles PATCreated by storing PAT hash entry and updating account PAT list", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info("acct-1", "alice", "active", []string{})
		tc.existing_account_pat_list("acct-1", []string{})
		tc.a_pat_created_event("acct-1", "pat-1", "hash-abc")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.pat_entry_exists("hash-abc")
		tc.pat_entry_has_account_id("hash-abc", "acct-1")
		tc.pat_entry_has_username("hash-abc", "alice")
		tc.pat_entry_has_status("hash-abc", "active")
		tc.pat_entry_has_realms("hash-abc", []string{})
		tc.account_pat_list_contains("acct-1", "hash-abc")
	})

	t.Run("handles PATCreated with existing realms includes current realms in entry", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info("acct-1", "alice", "active", []string{"realm-1", "realm-2"})
		tc.existing_account_pat_list("acct-1", []string{})
		tc.a_pat_created_event("acct-1", "pat-1", "hash-abc")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.pat_entry_has_realms("hash-abc", []string{"realm-1", "realm-2"})
	})

	t.Run("handles AccountSuspended by updating status on all PAT entries", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info("acct-1", "alice", "active", []string{"realm-1"})
		tc.existing_pat_entry("hash-abc", "acct-1", "alice", "active", []string{"realm-1"})
		tc.existing_pat_entry("hash-def", "acct-1", "alice", "active", []string{"realm-1"})
		tc.existing_account_pat_list("acct-1", []string{"hash-abc", "hash-def"})
		tc.an_account_suspended_event("acct-1", "policy violation")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.pat_entry_has_status("hash-abc", "suspended")
		tc.pat_entry_has_status("hash-def", "suspended")
	})

	t.Run("handles AccountSuspended by updating account info status", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info("acct-1", "alice", "active", []string{})
		tc.existing_account_pat_list("acct-1", []string{})
		tc.an_account_suspended_event("acct-1", "policy violation")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_info_has_status("acct-1", "suspended")
	})

	t.Run("handles RealmGranted by adding realm to all PAT entries", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info("acct-1", "alice", "active", []string{})
		tc.existing_pat_entry("hash-abc", "acct-1", "alice", "active", []string{})
		tc.existing_pat_entry("hash-def", "acct-1", "alice", "active", []string{})
		tc.existing_account_pat_list("acct-1", []string{"hash-abc", "hash-def"})
		tc.a_realm_granted_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.pat_entry_has_realms("hash-abc", []string{"realm-1"})
		tc.pat_entry_has_realms("hash-def", []string{"realm-1"})
	})

	t.Run("handles RealmGranted by updating account info realms", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info("acct-1", "alice", "active", []string{})
		tc.existing_account_pat_list("acct-1", []string{})
		tc.a_realm_granted_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_info_has_realms("acct-1", []string{"realm-1"})
	})

	t.Run("handles RealmRevoked by removing realm from all PAT entries", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info("acct-1", "alice", "active", []string{"realm-1", "realm-2"})
		tc.existing_pat_entry("hash-abc", "acct-1", "alice", "active", []string{"realm-1", "realm-2"})
		tc.existing_pat_entry("hash-def", "acct-1", "alice", "active", []string{"realm-1", "realm-2"})
		tc.existing_account_pat_list("acct-1", []string{"hash-abc", "hash-def"})
		tc.a_realm_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.pat_entry_has_realms("hash-abc", []string{"realm-2"})
		tc.pat_entry_has_realms("hash-def", []string{"realm-2"})
	})

	t.Run("handles RealmRevoked by updating account info realms", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info("acct-1", "alice", "active", []string{"realm-1", "realm-2"})
		tc.existing_account_pat_list("acct-1", []string{})
		tc.a_realm_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_info_has_realms("acct-1", []string{"realm-2"})
	})

	t.Run("handles PATRevoked by deleting PAT hash entry and updating account PAT list", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info("acct-1", "alice", "active", []string{})
		tc.existing_pat_entry("hash-abc", "acct-1", "alice", "active", []string{})
		tc.existing_pat_entry("hash-def", "acct-1", "alice", "active", []string{})
		tc.existing_account_pat_list("acct-1", []string{"hash-abc", "hash-def"})
		tc.a_pat_revoked_event("acct-1", "pat-1", "hash-abc")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.pat_entry_does_not_exist("hash-abc")
		tc.pat_entry_exists("hash-def")
		tc.account_pat_list_does_not_contain("acct-1", "hash-abc")
		tc.account_pat_list_contains("acct-1", "hash-def")
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("handles RoleAssigned by updating account info roles and realms", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info("acct-1", "alice", "active", []string{})
		tc.existing_account_pat_list("acct-1", []string{})
		tc.a_role_assigned_event("acct-1", "realm-1", "admin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_info_has_realms("acct-1", []string{"realm-1"})
		tc.account_info_has_roles("acct-1", map[string]string{"realm-1": "admin"})
	})

	t.Run("handles RoleAssigned by propagating to all PAT entries", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info("acct-1", "alice", "active", []string{})
		tc.existing_pat_entry("hash-abc", "acct-1", "alice", "active", []string{})
		tc.existing_pat_entry("hash-def", "acct-1", "alice", "active", []string{})
		tc.existing_account_pat_list("acct-1", []string{"hash-abc", "hash-def"})
		tc.a_role_assigned_event("acct-1", "realm-1", "admin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.pat_entry_has_realms("hash-abc", []string{"realm-1"})
		tc.pat_entry_has_realms("hash-def", []string{"realm-1"})
		tc.pat_entry_has_roles("hash-abc", map[string]string{"realm-1": "admin"})
		tc.pat_entry_has_roles("hash-def", map[string]string{"realm-1": "admin"})
	})

	t.Run("handles RoleAssigned with existing realm updates role value", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info_with_roles("acct-1", "alice", "active", []string{"realm-1"}, map[string]string{"realm-1": "member"})
		tc.existing_account_pat_list("acct-1", []string{})
		tc.a_role_assigned_event("acct-1", "realm-1", "admin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_info_has_realms("acct-1", []string{"realm-1"})
		tc.account_info_has_roles("acct-1", map[string]string{"realm-1": "admin"})
	})

	t.Run("handles RoleRevoked by updating account info roles and realms", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info_with_roles("acct-1", "alice", "active", []string{"realm-1", "realm-2"}, map[string]string{"realm-1": "admin", "realm-2": "member"})
		tc.existing_account_pat_list("acct-1", []string{})
		tc.a_role_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_info_has_realms("acct-1", []string{"realm-2"})
		tc.account_info_has_roles("acct-1", map[string]string{"realm-2": "member"})
	})

	t.Run("handles RoleRevoked by propagating to all PAT entries", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info_with_roles("acct-1", "alice", "active", []string{"realm-1", "realm-2"}, map[string]string{"realm-1": "admin", "realm-2": "member"})
		tc.existing_pat_entry_with_roles("hash-abc", "acct-1", "alice", "active", []string{"realm-1", "realm-2"}, map[string]string{"realm-1": "admin", "realm-2": "member"})
		tc.existing_account_pat_list("acct-1", []string{"hash-abc"})
		tc.a_role_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.pat_entry_has_realms("hash-abc", []string{"realm-2"})
		tc.pat_entry_has_roles("hash-abc", map[string]string{"realm-2": "member"})
	})

	t.Run("handles RealmGranted by also setting roles map with member", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info("acct-1", "alice", "active", []string{})
		tc.existing_account_pat_list("acct-1", []string{})
		tc.a_realm_granted_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_info_has_roles("acct-1", map[string]string{"realm-1": "member"})
	})

	t.Run("handles RealmRevoked by also removing from roles map", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info_with_roles("acct-1", "alice", "active", []string{"realm-1"}, map[string]string{"realm-1": "member"})
		tc.existing_account_pat_list("acct-1", []string{})
		tc.a_realm_revoked_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_info_has_roles("acct-1", map[string]string{})
	})

	t.Run("handles PATCreated by copying roles map from account info", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info_with_roles("acct-1", "alice", "active", []string{"realm-1"}, map[string]string{"realm-1": "admin"})
		tc.existing_account_pat_list("acct-1", []string{})
		tc.a_pat_created_event("acct-1", "pat-1", "hash-abc")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.pat_entry_has_roles("hash-abc", map[string]string{"realm-1": "admin"})
	})

	t.Run("handles RealmGranted with nil roles map initializes map", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info_with_nil_roles("acct-1", "alice", "active", []string{})
		tc.existing_account_pat_list("acct-1", []string{})
		tc.a_realm_granted_event("acct-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_info_has_roles("acct-1", map[string]string{"realm-1": "member"})
	})

	t.Run("handles RoleAssigned with nil roles map initializes map", func(t *testing.T) {
		tc := newAccountLookupTestContext(t)

		// Given
		tc.an_account_lookup_projector()
		tc.a_projection_store()
		tc.existing_account_info_with_nil_roles("acct-1", "alice", "active", []string{})
		tc.existing_account_pat_list("acct-1", []string{})
		tc.a_role_assigned_event("acct-1", "realm-1", "admin")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.account_info_has_roles("acct-1", map[string]string{"realm-1": "admin"})
	})
}

// --- Test Context ---

type accountLookupTestContext struct {
	t *testing.T

	projector  *AccountLookupProjector
	store      *mockProjectionStore
	event      core.Event
	ctx        context.Context
	nameResult string
	err        error
}

func newAccountLookupTestContext(t *testing.T) *accountLookupTestContext {
	t.Helper()
	return &accountLookupTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *accountLookupTestContext) an_account_lookup_projector() {
	tc.t.Helper()
	tc.projector = NewAccountLookupProjector()
}

func (tc *accountLookupTestContext) a_projection_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *accountLookupTestContext) an_account_created_event(accountID, username string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAccountCreated, domain.AccountCreated{
		AccountID: accountID,
		Username:  username,
	})
}

func (tc *accountLookupTestContext) a_pat_created_event(accountID, patID, keyHash string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventPATCreated, domain.PATCreated{
		AccountID: accountID,
		PATID:     patID,
		KeyHash:   keyHash,
	})
}

func (tc *accountLookupTestContext) an_account_suspended_event(accountID, reason string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAccountSuspended, domain.AccountSuspended{
		AccountID: accountID,
		Reason:    reason,
	})
}

func (tc *accountLookupTestContext) a_realm_granted_event(accountID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRealmGranted, domain.RealmGranted{
		AccountID: accountID,
		RealmID:   realmID,
	})
}

func (tc *accountLookupTestContext) a_realm_revoked_event(accountID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRealmRevoked, domain.RealmRevoked{
		AccountID: accountID,
		RealmID:   realmID,
	})
}

func (tc *accountLookupTestContext) a_role_assigned_event(accountID, realmID, role string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRoleAssigned, domain.RoleAssigned{
		AccountID: accountID,
		RealmID:   realmID,
		Role:      role,
	})
}

func (tc *accountLookupTestContext) a_role_revoked_event(accountID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRoleRevoked, domain.RoleRevoked{
		AccountID: accountID,
		RealmID:   realmID,
	})
}

func (tc *accountLookupTestContext) a_pat_revoked_event(accountID, patID, keyHash string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventPATRevoked, domain.PATRevoked{
		AccountID: accountID,
		PATID:     patID,
	})
	// Seed the pat:{patID} → keyHash reverse lookup that PATCreated would have stored
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	tc.store.put("_admin", "account_lookup", "pat:"+patID, keyHash)
}

func (tc *accountLookupTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *accountLookupTestContext) existing_account_info(accountID, username, status string, realms []string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	info := accountInfo{
		Username: username,
		Status:   status,
		Realms:   realms,
	}
	tc.store.put("_admin", "account_lookup", "accountinfo:"+accountID, info)
}

func (tc *accountLookupTestContext) existing_pat_entry(keyHash, accountID, username, status string, realms []string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := AccountLookupEntry{
		AccountID: accountID,
		Username:  username,
		Status:    status,
		Realms:    realms,
	}
	tc.store.put("_admin", "account_lookup", keyHash, entry)
}

func (tc *accountLookupTestContext) existing_account_pat_list(accountID string, hashes []string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	tc.store.put("_admin", "account_lookup", "account:"+accountID, hashes)
}

func (tc *accountLookupTestContext) existing_account_info_with_roles(accountID, username, status string, realms []string, roles map[string]string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	info := accountInfo{
		Username: username,
		Status:   status,
		Realms:   realms,
		Roles:    roles,
	}
	tc.store.put("_admin", "account_lookup", "accountinfo:"+accountID, info)
}

func (tc *accountLookupTestContext) existing_account_info_with_nil_roles(accountID, username, status string, realms []string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	info := accountInfo{
		Username: username,
		Status:   status,
		Realms:   realms,
		Roles:    nil,
	}
	tc.store.put("_admin", "account_lookup", "accountinfo:"+accountID, info)
}

func (tc *accountLookupTestContext) existing_pat_entry_with_roles(keyHash, accountID, username, status string, realms []string, roles map[string]string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := AccountLookupEntry{
		AccountID: accountID,
		Username:  username,
		Status:    status,
		Realms:    realms,
		Roles:     roles,
	}
	tc.store.put("_admin", "account_lookup", keyHash, entry)
}

// --- When ---

func (tc *accountLookupTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *accountLookupTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *accountLookupTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *accountLookupTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *accountLookupTestContext) username_lookup_has_account_id(username, expectedAccountID string) {
	tc.t.Helper()
	var accountID string
	err := tc.store.Get(tc.ctx, "_admin", "account_lookup", "username:"+username, &accountID)
	require.NoError(tc.t, err, "expected username lookup for %s", username)
	assert.Equal(tc.t, expectedAccountID, accountID)
}

func (tc *accountLookupTestContext) pat_entry_exists(keyHash string) {
	tc.t.Helper()
	var entry AccountLookupEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_lookup", keyHash, &entry)
	require.NoError(tc.t, err, "expected PAT entry for key hash %s", keyHash)
}

func (tc *accountLookupTestContext) pat_entry_does_not_exist(keyHash string) {
	tc.t.Helper()
	var entry AccountLookupEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_lookup", keyHash, &entry)
	assert.Error(tc.t, err, "expected no PAT entry for key hash %s", keyHash)
}

func (tc *accountLookupTestContext) pat_entry_has_account_id(keyHash, expected string) {
	tc.t.Helper()
	var entry AccountLookupEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_lookup", keyHash, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.AccountID)
}

func (tc *accountLookupTestContext) pat_entry_has_username(keyHash, expected string) {
	tc.t.Helper()
	var entry AccountLookupEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_lookup", keyHash, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Username)
}

func (tc *accountLookupTestContext) pat_entry_has_status(keyHash, expected string) {
	tc.t.Helper()
	var entry AccountLookupEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_lookup", keyHash, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Status)
}

func (tc *accountLookupTestContext) pat_entry_has_realms(keyHash string, expected []string) {
	tc.t.Helper()
	var entry AccountLookupEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_lookup", keyHash, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Realms)
}

func (tc *accountLookupTestContext) account_pat_list_contains(accountID, keyHash string) {
	tc.t.Helper()
	var hashes []string
	err := tc.store.Get(tc.ctx, "_admin", "account_lookup", "account:"+accountID, &hashes)
	require.NoError(tc.t, err, "expected account PAT list for %s", accountID)
	assert.Contains(tc.t, hashes, keyHash)
}

func (tc *accountLookupTestContext) account_pat_list_does_not_contain(accountID, keyHash string) {
	tc.t.Helper()
	var hashes []string
	err := tc.store.Get(tc.ctx, "_admin", "account_lookup", "account:"+accountID, &hashes)
	require.NoError(tc.t, err, "expected account PAT list for %s", accountID)
	assert.NotContains(tc.t, hashes, keyHash)
}

func (tc *accountLookupTestContext) account_info_has_status(accountID, expected string) {
	tc.t.Helper()
	var info accountInfo
	err := tc.store.Get(tc.ctx, "_admin", "account_lookup", "accountinfo:"+accountID, &info)
	require.NoError(tc.t, err, "expected account info for %s", accountID)
	assert.Equal(tc.t, expected, info.Status)
}

func (tc *accountLookupTestContext) account_info_has_realms(accountID string, expected []string) {
	tc.t.Helper()
	var info accountInfo
	err := tc.store.Get(tc.ctx, "_admin", "account_lookup", "accountinfo:"+accountID, &info)
	require.NoError(tc.t, err, "expected account info for %s", accountID)
	assert.Equal(tc.t, expected, info.Realms)
}

func (tc *accountLookupTestContext) account_info_has_roles(accountID string, expected map[string]string) {
	tc.t.Helper()
	var info accountInfo
	err := tc.store.Get(tc.ctx, "_admin", "account_lookup", "accountinfo:"+accountID, &info)
	require.NoError(tc.t, err, "expected account info for %s", accountID)
	assert.Equal(tc.t, expected, info.Roles)
}

func (tc *accountLookupTestContext) pat_entry_has_roles(keyHash string, expected map[string]string) {
	tc.t.Helper()
	var entry AccountLookupEntry
	err := tc.store.Get(tc.ctx, "_admin", "account_lookup", keyHash, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Roles)
}
