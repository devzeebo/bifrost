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

func TestPATKeyHashProjector(t *testing.T) {
	t.Run("Name returns pat_keyhash", func(t *testing.T) {
		tc := newPATKeyHashTestContext(t)

		// Given
		tc.a_pat_keyhash_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("pat_keyhash")
	})

	t.Run("TableName returns projection_pat_by_keyhash", func(t *testing.T) {
		tc := newPATKeyHashTestContext(t)

		// Given
		tc.a_pat_keyhash_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("projection_pat_by_keyhash")
	})

	t.Run("handles PATCreated by inserting entry keyed by key_hash", func(t *testing.T) {
		tc := newPATKeyHashTestContext(t)

		// Given
		tc.a_pat_keyhash_projector()
		tc.a_projection_store()
		tc.a_pat_created_event("pat-1", "hash-abc123", "acct-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_exists("hash-abc123")
		tc.entry_has_key_hash("hash-abc123", "hash-abc123")
		tc.entry_has_pat_id("hash-abc123", "pat-1")
		tc.entry_has_account_id("hash-abc123", "acct-1")
		tc.reverse_lookup_exists("pat-1", "hash-abc123")
	})

	t.Run("handles PATRevoked by deleting entry", func(t *testing.T) {
		tc := newPATKeyHashTestContext(t)

		// Given
		tc.a_pat_keyhash_projector()
		tc.a_projection_store()
		tc.existing_pat_entry("pat-1", "hash-xyz", "acct-2")
		tc.a_pat_revoked_event("pat-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_does_not_exist("hash-xyz")
		tc.reverse_lookup_does_not_exist("pat-1")
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newPATKeyHashTestContext(t)

		// Given
		tc.a_pat_keyhash_projector()
		tc.a_projection_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("PATCreated is idempotent - overwrites existing entry", func(t *testing.T) {
		tc := newPATKeyHashTestContext(t)

		// Given
		tc.a_pat_keyhash_projector()
		tc.a_projection_store()
		tc.existing_pat_entry("pat-old", "hash-shared", "acct-old")
		tc.a_pat_created_event("pat-new", "hash-shared", "acct-new")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_exists("hash-shared")
		tc.entry_has_pat_id("hash-shared", "pat-new")
		tc.entry_has_account_id("hash-shared", "acct-new")
	})

	t.Run("PATRevoked for non-existent entry succeeds", func(t *testing.T) {
		tc := newPATKeyHashTestContext(t)

		// Given
		tc.a_pat_keyhash_projector()
		tc.a_projection_store()
		tc.a_pat_revoked_event("pat-nonexistent")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})
}

// --- Test Context ---

type patKeyHashTestContext struct {
	t *testing.T

	projector       *PATKeyHashProjector
	store           *mockProjectionStore
	event           core.Event
	ctx             context.Context
	nameResult      string
	tableNameResult string
	err             error
}

func newPATKeyHashTestContext(t *testing.T) *patKeyHashTestContext {
	t.Helper()
	return &patKeyHashTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *patKeyHashTestContext) a_pat_keyhash_projector() {
	tc.t.Helper()
	tc.projector = NewPATKeyHashProjector()
}

func (tc *patKeyHashTestContext) a_projection_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *patKeyHashTestContext) a_pat_created_event(patID, keyHash, accountID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventPATCreated, domain.PATCreated{
		AccountID: accountID,
		PATID:     patID,
		KeyHash:   keyHash,
		Label:     "test-pat",
		CreatedAt: time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC),
	})
}

func (tc *patKeyHashTestContext) a_pat_revoked_event(patID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventPATRevoked, domain.PATRevoked{
		AccountID: "acct-1",
		PATID:     patID,
	})
}

func (tc *patKeyHashTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *patKeyHashTestContext) existing_pat_entry(patID, keyHash, accountID string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := PATKeyHashEntry{
		KeyHash:   keyHash,
		PATID:     patID,
		AccountID: accountID,
	}
	tc.store.put("realm-1", "projection_pat_by_keyhash", keyHash, entry)
	// Also create reverse lookup for PATRevoked handling
	tc.store.put("realm-1", "projection_pat_by_keyhash", "pat:"+patID, keyHash)
}

// --- When ---

func (tc *patKeyHashTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *patKeyHashTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameResult = tc.projector.TableName()
}

func (tc *patKeyHashTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *patKeyHashTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *patKeyHashTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameResult)
}

func (tc *patKeyHashTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *patKeyHashTestContext) entry_exists(keyHash string) {
	tc.t.Helper()
	var entry PATKeyHashEntry
	err := tc.store.Get(tc.ctx, "realm-1", "projection_pat_by_keyhash", keyHash, &entry)
	require.NoError(tc.t, err, "expected entry for key_hash %s", keyHash)
}

func (tc *patKeyHashTestContext) entry_does_not_exist(keyHash string) {
	tc.t.Helper()
	var entry PATKeyHashEntry
	err := tc.store.Get(tc.ctx, "realm-1", "projection_pat_by_keyhash", keyHash, &entry)
	require.Error(tc.t, err, "expected no entry for key_hash %s", keyHash)
}

func (tc *patKeyHashTestContext) entry_has_key_hash(keyHash, expected string) {
	tc.t.Helper()
	var entry PATKeyHashEntry
	err := tc.store.Get(tc.ctx, "realm-1", "projection_pat_by_keyhash", keyHash, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.KeyHash)
}

func (tc *patKeyHashTestContext) entry_has_pat_id(keyHash, expected string) {
	tc.t.Helper()
	var entry PATKeyHashEntry
	err := tc.store.Get(tc.ctx, "realm-1", "projection_pat_by_keyhash", keyHash, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.PATID)
}

func (tc *patKeyHashTestContext) entry_has_account_id(keyHash, expected string) {
	tc.t.Helper()
	var entry PATKeyHashEntry
	err := tc.store.Get(tc.ctx, "realm-1", "projection_pat_by_keyhash", keyHash, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.AccountID)
}

func (tc *patKeyHashTestContext) reverse_lookup_does_not_exist(patID string) {
	tc.t.Helper()
	var keyHash string
	err := tc.store.Get(tc.ctx, "realm-1", "projection_pat_by_keyhash", "pat:"+patID, &keyHash)
	require.Error(tc.t, err, "expected no reverse lookup entry for pat_id %s", patID)
}

func (tc *patKeyHashTestContext) reverse_lookup_exists(patID, expectedKeyHash string) {
	tc.t.Helper()
	var keyHash string
	err := tc.store.Get(tc.ctx, "realm-1", "projection_pat_by_keyhash", "pat:"+patID, &keyHash)
	require.NoError(tc.t, err, "expected reverse lookup entry for pat_id %s", patID)
	assert.Equal(tc.t, expectedKeyHash, keyHash)
}
