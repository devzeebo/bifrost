package postgres

import (
	"context"
	"database/sql"
	"os"
	"testing"

	"github.com/devzeebo/bifrost/core"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Compile-time interface satisfaction check
var _ core.CheckpointStore = (*CheckpointStore)(nil)

func TestNewCheckpointStore(t *testing.T) {
	t.Skip("Skipping PostgreSQL tests - requires database connection")
	
	t.Run("returns a valid store", func(t *testing.T) {
		tc := newCheckpointStoreTestContext(t)

		// Given
		tc.a_database_with_schema()

		// When
		tc.new_checkpoint_store_is_created()

		// Then
		tc.no_error_occurred()
		tc.store_is_not_nil()
	})
}

func TestCheckpointStore_GetSet(t *testing.T) {
	t.Skip("Skipping PostgreSQL tests - requires database connection")
	
	t.Run("returns 0 for non-existent checkpoint", func(t *testing.T) {
		tc := newCheckpointStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_checkpoint_store_is_created()

		// When
		tc.get_checkpoint_is_called("realm-1", "test-projector")

		// Then
		tc.no_error_occurred()
		tc.checkpoint_position_is(0)
	})

	t.Run("stores and retrieves checkpoint", func(t *testing.T) {
		tc := newCheckpointStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_checkpoint_store_is_created()

		// When
		tc.set_checkpoint_is_called("realm-1", "test-projector", 42)
		tc.get_checkpoint_is_called("realm-1", "test-projector")

		// Then
		tc.no_error_occurred()
		tc.checkpoint_position_is(42)
	})

	t.Run("updates existing checkpoint", func(t *testing.T) {
		tc := newCheckpointStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_checkpoint_store_is_created()
		tc.set_checkpoint_is_called("realm-1", "test-projector", 10)

		// When
		tc.set_checkpoint_is_called("realm-1", "test-projector", 100)
		tc.get_checkpoint_is_called("realm-1", "test-projector")

		// Then
		tc.no_error_occurred()
		tc.checkpoint_position_is(100)
	})
}

// --- Test Context ---

type checkpointStoreTestContext struct {
	t       *testing.T
	db      *sql.DB
	store   *CheckpointStore
	pos     int64
	err     error
}

func newCheckpointStoreTestContext(t *testing.T) *checkpointStoreTestContext {
	t.Helper()
	return &checkpointStoreTestContext{t: t}
}

// --- Given ---

func (tc *checkpointStoreTestContext) a_database_with_schema() {
	tc.t.Helper()
	
	// Try to get connection string from environment
	connStr := os.Getenv("BIFROST_TEST_POSTGRES_URL")
	if connStr == "" {
		tc.t.Skip("BIFROST_TEST_POSTGRES_URL not set, skipping PostgreSQL tests")
		return
	}
	
	db, err := sql.Open("pgx", connStr)
	require.NoError(tc.t, err)
	tc.t.Cleanup(func() { db.Close() })
	
	// Test connection
	err = db.Ping()
	require.NoError(tc.t, err)
	
	// Clean schema and recreate
	_, err = db.Exec(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`)
	require.NoError(tc.t, err)
	
	err = EnsureSchema(db)
	require.NoError(tc.t, err)
	tc.db = db
}

// --- When ---

func (tc *checkpointStoreTestContext) new_checkpoint_store_is_created() {
	tc.t.Helper()
	tc.store, tc.err = NewCheckpointStore(tc.db)
}

func (tc *checkpointStoreTestContext) get_checkpoint_is_called(realmID, projectorName string) {
	tc.t.Helper()
	tc.pos, tc.err = tc.store.GetCheckpoint(context.Background(), realmID, projectorName)
}

func (tc *checkpointStoreTestContext) set_checkpoint_is_called(realmID, projectorName string, position int64) {
	tc.t.Helper()
	tc.err = tc.store.SetCheckpoint(context.Background(), realmID, projectorName, position)
}

// --- Then ---

func (tc *checkpointStoreTestContext) no_error_occurred() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *checkpointStoreTestContext) store_is_not_nil() {
	tc.t.Helper()
	assert.NotNil(tc.t, tc.store)
}

func (tc *checkpointStoreTestContext) checkpoint_position_is(expected int64) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.pos)
}