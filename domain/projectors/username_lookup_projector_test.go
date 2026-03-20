package projectors

import (
	"context"
	"testing"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestUsernameLookupProjector(t *testing.T) {
	t.Run("Name returns username_lookup", func(t *testing.T) {
		tc := newUsernameLookupTestContext(t)

		// Given
		tc.a_username_lookup_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("username_lookup")
	})

	t.Run("TableName returns username_lookup", func(t *testing.T) {
		tc := newUsernameLookupTestContext(t)

		// Given
		tc.a_username_lookup_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("username_lookup")
	})

	t.Run("handles AccountCreated by putting username to account_id mapping", func(t *testing.T) {
		tc := newUsernameLookupTestContext(t)

		// Given
		tc.a_username_lookup_projector()
		tc.a_store()
		tc.an_account_created_event("acct-123", "alice")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.lookup_entry_exists("alice")
		tc.lookup_entry_has_account_id("alice", "acct-123")
		tc.lookup_entry_has_username("alice", "alice")
	})

	t.Run("AccountCreated is idempotent - duplicate username not overwritten", func(t *testing.T) {
		tc := newUsernameLookupTestContext(t)

		// Given
		tc.a_username_lookup_projector()
		tc.a_store()
		tc.existing_lookup_entry("alice", "acct-original")
		tc.an_account_created_event("acct-new", "alice")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.lookup_entry_has_account_id("alice", "acct-original")
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newUsernameLookupTestContext(t)

		// Given
		tc.a_username_lookup_projector()
		tc.a_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})
}

// --- Test Context ---

type usernameLookupTestContext struct {
	t            *testing.T
	projector    *UsernameLookupProjector
	store        *mockProjectionStore
	event        core.Event
	ctx          context.Context
	nameResult   string
	tableNameRes string
	err          error
}

func newUsernameLookupTestContext(t *testing.T) *usernameLookupTestContext {
	t.Helper()
	return &usernameLookupTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *usernameLookupTestContext) a_username_lookup_projector() {
	tc.t.Helper()
	tc.projector = NewUsernameLookupProjector()
}

func (tc *usernameLookupTestContext) a_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *usernameLookupTestContext) an_account_created_event(accountID, username string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAccountCreated, domain.AccountCreated{
		AccountID: accountID,
		Username:  username,
		CreatedAt: time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC),
	})
}

func (tc *usernameLookupTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *usernameLookupTestContext) existing_lookup_entry(username, accountID string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := UsernameLookupEntry{
		Username:  username,
		AccountID: accountID,
	}
	tc.store.put("_admin", "username_lookup", username, entry)
}

// --- When ---

func (tc *usernameLookupTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *usernameLookupTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameRes = tc.projector.TableName()
}

func (tc *usernameLookupTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *usernameLookupTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *usernameLookupTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameRes)
}

func (tc *usernameLookupTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *usernameLookupTestContext) lookup_entry_exists(username string) {
	tc.t.Helper()
	var entry UsernameLookupEntry
	err := tc.store.Get(tc.ctx, "_admin", "username_lookup", username, &entry)
	require.NoError(tc.t, err, "expected lookup entry for username %s", username)
}

func (tc *usernameLookupTestContext) lookup_entry_has_account_id(username, expected string) {
	tc.t.Helper()
	var entry UsernameLookupEntry
	err := tc.store.Get(tc.ctx, "_admin", "username_lookup", username, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.AccountID)
}

func (tc *usernameLookupTestContext) lookup_entry_has_username(username, expected string) {
	tc.t.Helper()
	var entry UsernameLookupEntry
	err := tc.store.Get(tc.ctx, "_admin", "username_lookup", username, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Username)
}
