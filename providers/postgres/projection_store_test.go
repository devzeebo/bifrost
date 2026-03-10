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
var _ core.ProjectionStore = (*ProjectionStore)(nil)

func TestNewProjectionStore(t *testing.T) {
	t.Skip("Skipping PostgreSQL tests - requires database connection")
	
	t.Run("returns a valid store", func(t *testing.T) {
		tc := newProjectionStoreTestContext(t)

		// Given
		tc.a_database_with_schema()

		// When
		tc.new_projection_store_is_created()

		// Then
		tc.no_error_occurred()
		tc.store_is_not_nil()
	})
}

func TestProjectionStore_PutGet(t *testing.T) {
	t.Skip("Skipping PostgreSQL tests - requires database connection")
	
	t.Run("stores and retrieves projection data", func(t *testing.T) {
		tc := newProjectionStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()

		// When
		tc.put_is_called("realm-1", "test-projection", "key-1", map[string]string{"name": "Alice"})
		tc.get_is_called("realm-1", "test-projection", "key-1")

		// Then
		tc.no_error_occurred()
		tc.retrieved_data_equals(map[string]string{"name": "Alice"})
	})

	t.Run("returns NotFoundError for non-existent key", func(t *testing.T) {
		tc := newProjectionStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()

		// When
		tc.get_is_called("realm-1", "test-projection", "non-existent")

		// Then
		tc.not_found_error_is_returned("test-projection", "non-existent")
	})
}

func TestProjectionStore_List(t *testing.T) {
	t.Skip("Skipping PostgreSQL tests - requires database connection")
	
	t.Run("returns all projection values for realm", func(t *testing.T) {
		tc := newProjectionStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()
		tc.put_is_called("realm-1", "test-projection", "key-1", map[string]string{"name": "Alice"})
		tc.put_is_called("realm-1", "test-projection", "key-2", map[string]string{"name": "Bob"})

		// When
		tc.list_is_called("realm-1", "test-projection")

		// Then
		tc.no_error_occurred()
		tc.list_count_is(2)
	})
}

func TestProjectionStore_Delete(t *testing.T) {
	t.Skip("Skipping PostgreSQL tests - requires database connection")
	
	t.Run("deletes projection entry", func(t *testing.T) {
		tc := newProjectionStoreTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()
		tc.put_is_called("realm-1", "test-projection", "key-1", map[string]string{"name": "Alice"})

		// When
		tc.delete_is_called("realm-1", "test-projection", "key-1")
		tc.get_is_called("realm-1", "test-projection", "key-1")

		// Then
		tc.no_error_occurred()
		tc.not_found_error_is_returned("test-projection", "key-1")
	})
}

// --- Test Context ---

type projectionStoreTestContext struct {
	t           *testing.T
	db          *sql.DB
	store       *ProjectionStore
	retrievedData any
	err         error
}

func newProjectionStoreTestContext(t *testing.T) *projectionStoreTestContext {
	t.Helper()
	return &projectionStoreTestContext{t: t}
}

// --- Given ---

func (tc *projectionStoreTestContext) a_database_with_schema() {
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

func (tc *projectionStoreTestContext) new_projection_store_is_created() {
	tc.t.Helper()
	tc.store, tc.err = NewProjectionStore(tc.db)
}

func (tc *projectionStoreTestContext) put_is_called(realmID, projectionName, key string, value any) {
	tc.t.Helper()
	tc.err = tc.store.Put(context.Background(), realmID, projectionName, key, value)
}

func (tc *projectionStoreTestContext) get_is_called(realmID, projectionName, key string) {
	tc.t.Helper()
	var dest map[string]string
	tc.err = tc.store.Get(context.Background(), realmID, projectionName, key, &dest)
	if tc.err == nil {
		tc.retrievedData = dest
	}
}

func (tc *projectionStoreTestContext) list_is_called(realmID, projectionName string) {
	tc.t.Helper()
	// For simplicity, we'll just count the results
	results, err := tc.store.List(context.Background(), realmID, projectionName)
	tc.err = err
	if err == nil {
		tc.retrievedData = len(results)
	}
}

func (tc *projectionStoreTestContext) delete_is_called(realmID, projectionName, key string) {
	tc.t.Helper()
	tc.err = tc.store.Delete(context.Background(), realmID, projectionName, key)
}

// --- Then ---

func (tc *projectionStoreTestContext) no_error_occurred() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *projectionStoreTestContext) store_is_not_nil() {
	tc.t.Helper()
	assert.NotNil(tc.t, tc.store)
}

func (tc *projectionStoreTestContext) retrieved_data_equals(expected any) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.retrievedData)
}

func (tc *projectionStoreTestContext) not_found_error_is_returned(entity, id string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	var notFoundErr *core.NotFoundError
	require.ErrorAs(tc.t, tc.err, &notFoundErr)
	assert.Equal(tc.t, entity, notFoundErr.Entity)
	assert.Equal(tc.t, id, notFoundErr.ID)
}

func (tc *projectionStoreTestContext) list_count_is(expected int) {
	tc.t.Helper()
	count, ok := tc.retrievedData.(int)
	require.True(tc.t, ok, "retrievedData should be an int representing count")
	assert.Equal(tc.t, expected, count)
}