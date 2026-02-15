package sqlite

import (
	"context"
	"database/sql"
	"testing"

	"github.com/devzeebo/bifrost/core"
	_ "modernc.org/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Compile-time interface satisfaction check
var _ core.CheckpointStore = (*CheckpointStore)(nil)

// --- Tests ---

func TestNewCheckpointStore(t *testing.T) {
	t.Run("returns a valid store", func(t *testing.T) {
		tc := newCheckpointTestContext(t)

		// Given
		tc.a_database_with_schema()

		// When
		tc.new_checkpoint_store_is_created()

		// Then
		tc.no_error_occurred()
		tc.store_is_not_nil()
	})
}

func TestCheckpointStore_GetCheckpoint(t *testing.T) {
	t.Run("returns 0 for non-existent checkpoint", func(t *testing.T) {
		tc := newCheckpointTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_checkpoint_store_is_created()

		// When
		tc.get_checkpoint_is_called("realm-1", "projector-1")

		// Then
		tc.no_error_occurred()
		tc.checkpoint_position_is(0)
	})
}

func TestCheckpointStore_SetCheckpoint(t *testing.T) {
	t.Run("stores and retrieves a checkpoint", func(t *testing.T) {
		tc := newCheckpointTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_checkpoint_store_is_created()

		// When
		tc.set_checkpoint_is_called("realm-1", "projector-1", 42)
		tc.get_checkpoint_is_called("realm-1", "projector-1")

		// Then
		tc.no_error_occurred()
		tc.checkpoint_position_is(42)
	})

	t.Run("upserts on duplicate key", func(t *testing.T) {
		tc := newCheckpointTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_checkpoint_store_is_created()
		tc.set_checkpoint_is_called("realm-1", "projector-1", 10)

		// When
		tc.set_checkpoint_is_called("realm-1", "projector-1", 99)
		tc.get_checkpoint_is_called("realm-1", "projector-1")

		// Then
		tc.no_error_occurred()
		tc.checkpoint_position_is(99)
	})

	t.Run("isolates by realm", func(t *testing.T) {
		tc := newCheckpointTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_checkpoint_store_is_created()
		tc.set_checkpoint_is_called("realm-1", "projector-1", 10)
		tc.set_checkpoint_is_called("realm-2", "projector-1", 20)

		// When
		tc.get_checkpoint_is_called("realm-1", "projector-1")

		// Then
		tc.no_error_occurred()
		tc.checkpoint_position_is(10)
	})

	t.Run("isolates by projector", func(t *testing.T) {
		tc := newCheckpointTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_checkpoint_store_is_created()
		tc.set_checkpoint_is_called("realm-1", "projector-A", 42)

		// When
		tc.get_checkpoint_is_called("realm-1", "projector-B")

		// Then
		tc.no_error_occurred()
		tc.checkpoint_position_is(0)
	})
}

// --- Test Context ---

type checkpointTestContext struct {
	t     *testing.T
	db    *sql.DB
	store *CheckpointStore
	pos   int64
	err   error
}

func newCheckpointTestContext(t *testing.T) *checkpointTestContext {
	t.Helper()
	return &checkpointTestContext{t: t}
}

// --- Given ---

func (tc *checkpointTestContext) a_database_with_schema() {
	tc.t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	require.NoError(tc.t, err)
	tc.t.Cleanup(func() { db.Close() })
	err = EnsureSchema(db)
	require.NoError(tc.t, err)
	tc.db = db
}

// --- When ---

func (tc *checkpointTestContext) new_checkpoint_store_is_created() {
	tc.t.Helper()
	tc.store, tc.err = NewCheckpointStore(tc.db)
}

func (tc *checkpointTestContext) get_checkpoint_is_called(realmID, projectorName string) {
	tc.t.Helper()
	tc.pos, tc.err = tc.store.GetCheckpoint(context.Background(), realmID, projectorName)
}

func (tc *checkpointTestContext) set_checkpoint_is_called(realmID, projectorName string, pos int64) {
	tc.t.Helper()
	tc.err = tc.store.SetCheckpoint(context.Background(), realmID, projectorName, pos)
	require.NoError(tc.t, tc.err)
}

// --- Then ---

func (tc *checkpointTestContext) no_error_occurred() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *checkpointTestContext) store_is_not_nil() {
	tc.t.Helper()
	assert.NotNil(tc.t, tc.store)
}

func (tc *checkpointTestContext) checkpoint_position_is(expected int64) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.pos)
}
