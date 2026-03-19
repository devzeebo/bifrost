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

func TestPATIDProjector(t *testing.T) {
	t.Run("Name returns pat_id", func(t *testing.T) {
		tc := newPATIDTestContext(t)

		// Given
		tc.a_pat_id_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("pat_id")
	})

	t.Run("TableName returns pat_by_id", func(t *testing.T) {
		tc := newPATIDTestContext(t)

		// Given
		tc.a_pat_id_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("pat_by_id")
	})

	t.Run("handles PATCreated by inserting entry keyed by pat_id", func(t *testing.T) {
		tc := newPATIDTestContext(t)

		// Given
		tc.a_pat_id_projector()
		tc.a_store()
		tc.a_pat_created_event("pat-1", "hash-abc123", "acct-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_exists("pat-1")
		tc.entry_has_pat_id("pat-1", "pat-1")
		tc.entry_has_key_hash("pat-1", "hash-abc123")
		tc.entry_has_account_id("pat-1", "acct-1")
	})

	t.Run("handles PATRevoked by deleting entry", func(t *testing.T) {
		tc := newPATIDTestContext(t)

		// Given
		tc.a_pat_id_projector()
		tc.a_store()
		tc.existing_pat_entry("pat-1", "hash-xyz", "acct-2")
		tc.a_pat_revoked_event("pat-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_does_not_exist("pat-1")
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newPATIDTestContext(t)

		// Given
		tc.a_pat_id_projector()
		tc.a_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("PATCreated is idempotent - overwrites existing entry", func(t *testing.T) {
		tc := newPATIDTestContext(t)

		// Given
		tc.a_pat_id_projector()
		tc.a_store()
		tc.existing_pat_entry("pat-1", "old-hash", "acct-old")
		tc.a_pat_created_event("pat-1", "new-hash", "acct-new")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.entry_exists("pat-1")
		tc.entry_has_key_hash("pat-1", "new-hash")
		tc.entry_has_account_id("pat-1", "acct-new")
	})

	t.Run("PATRevoked for non-existent entry succeeds", func(t *testing.T) {
		tc := newPATIDTestContext(t)

		// Given
		tc.a_pat_id_projector()
		tc.a_store()
		tc.a_pat_revoked_event("pat-nonexistent")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})
}

// --- Test Context ---

type patIDTestContext struct {
	t *testing.T

	projector      *PATIDProjector
	store          *mockProjectionStore
	event          core.Event
	ctx            context.Context
	nameResult     string
	tableNameResult string
	err            error
}

func newPATIDTestContext(t *testing.T) *patIDTestContext {
	t.Helper()
	return &patIDTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *patIDTestContext) a_pat_id_projector() {
	tc.t.Helper()
	tc.projector = NewPATIDProjector()
}

func (tc *patIDTestContext) a_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *patIDTestContext) a_pat_created_event(patID, keyHash, accountID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventPATCreated, domain.PATCreated{
		AccountID: accountID,
		PATID:     patID,
		KeyHash:   keyHash,
		Label:     "test-pat",
		CreatedAt: time.Date(2026, 2, 1, 12, 0, 0, 0, time.UTC),
	})
}

func (tc *patIDTestContext) a_pat_revoked_event(patID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventPATRevoked, domain.PATRevoked{
		PATID: patID,
	})
}

func (tc *patIDTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *patIDTestContext) existing_pat_entry(patID, keyHash, accountID string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := PATIDEntry{
		PATID:     patID,
		KeyHash:   keyHash,
		AccountID: accountID,
	}
	tc.store.put("realm-1", "pat_by_id", patID, entry)
}

// --- When ---

func (tc *patIDTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *patIDTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameResult = tc.projector.TableName()
}

func (tc *patIDTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *patIDTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *patIDTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameResult)
}

func (tc *patIDTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *patIDTestContext) entry_exists(patID string) {
	tc.t.Helper()
	var entry PATIDEntry
	err := tc.store.Get(tc.ctx, "realm-1", "pat_by_id", patID, &entry)
	require.NoError(tc.t, err, "expected entry for pat_id %s", patID)
}

func (tc *patIDTestContext) entry_does_not_exist(patID string) {
	tc.t.Helper()
	var entry PATIDEntry
	err := tc.store.Get(tc.ctx, "realm-1", "pat_by_id", patID, &entry)
	require.Error(tc.t, err, "expected no entry for pat_id %s", patID)
}

func (tc *patIDTestContext) entry_has_pat_id(patID, expected string) {
	tc.t.Helper()
	var entry PATIDEntry
	err := tc.store.Get(tc.ctx, "realm-1", "pat_by_id", patID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.PATID)
}

func (tc *patIDTestContext) entry_has_key_hash(patID, expected string) {
	tc.t.Helper()
	var entry PATIDEntry
	err := tc.store.Get(tc.ctx, "realm-1", "pat_by_id", patID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.KeyHash)
}

func (tc *patIDTestContext) entry_has_account_id(patID, expected string) {
	tc.t.Helper()
	var entry PATIDEntry
	err := tc.store.Get(tc.ctx, "realm-1", "pat_by_id", patID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.AccountID)
}
