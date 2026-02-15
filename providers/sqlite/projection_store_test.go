package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"testing"

	"github.com/devzeebo/bifrost/core"
	_ "modernc.org/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Compile-time interface satisfaction check
var _ core.ProjectionStore = (*ProjectionStore)(nil)

// --- Tests ---

func TestNewProjectionStore(t *testing.T) {
	t.Run("returns a valid store", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_database_with_schema()

		// When
		tc.new_projection_store_is_created()

		// Then
		tc.no_error_occurred()
		tc.store_is_not_nil()
	})
}

func TestProjectionStore_Get(t *testing.T) {
	t.Run("returns NotFoundError for non-existent key", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()

		// When
		tc.get_is_called("realm-1", "users", "user-42")

		// Then
		tc.not_found_error_is_returned("users", "user-42")
	})
}

func TestProjectionStore_Put(t *testing.T) {
	t.Run("stores and retrieves a value (round-trip)", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()
		tc.a_simple_value("hello world")

		// When
		tc.put_is_called("realm-1", "greetings", "key-1")
		tc.get_is_called("realm-1", "greetings", "key-1")

		// Then
		tc.no_error_occurred()
		tc.retrieved_value_equals("hello world")
	})

	t.Run("overwrites existing value (upsert)", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()
		tc.a_simple_value("original")
		tc.put_is_called("realm-1", "data", "key-1")

		// When
		tc.a_simple_value("updated")
		tc.put_is_called("realm-1", "data", "key-1")
		tc.get_is_called("realm-1", "data", "key-1")

		// Then
		tc.no_error_occurred()
		tc.retrieved_value_equals("updated")
	})

	t.Run("isolates by realm_id", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()
		tc.a_simple_value("realm-1-value")
		tc.put_is_called("realm-1", "data", "key-1")
		tc.a_simple_value("realm-2-value")
		tc.put_is_called("realm-2", "data", "key-1")

		// When
		tc.get_is_called("realm-1", "data", "key-1")

		// Then
		tc.no_error_occurred()
		tc.retrieved_value_equals("realm-1-value")
	})

	t.Run("round-trips complex nested structs", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()
		tc.a_complex_value()

		// When
		tc.put_complex_is_called("realm-1", "profiles", "user-1")
		tc.get_complex_is_called("realm-1", "profiles", "user-1")

		// Then
		tc.no_error_occurred()
		tc.retrieved_complex_value_matches()
	})
}

func TestProjectionStore_List(t *testing.T) {
	t.Run("returns all entries for a realm and projection", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()
		tc.projection_has_entries("realm-1", "rune_list", map[string]string{
			"rune-1": `{"id":"rune-1","title":"First"}`,
			"rune-2": `{"id":"rune-2","title":"Second"}`,
		})

		// When
		tc.list_is_called("realm-1", "rune_list")

		// Then
		tc.no_error_occurred()
		tc.list_has_n_entries(2)
	})

	t.Run("returns empty slice when no entries exist", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()

		// When
		tc.list_is_called("realm-1", "rune_list")

		// Then
		tc.no_error_occurred()
		tc.list_has_n_entries(0)
	})

	t.Run("isolates entries by realm", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()
		tc.projection_has_entries("realm-1", "rune_list", map[string]string{
			"rune-1": `{"id":"rune-1"}`,
			"rune-2": `{"id":"rune-2"}`,
		})
		tc.projection_has_entries("realm-2", "rune_list", map[string]string{
			"rune-3": `{"id":"rune-3"}`,
		})

		// When
		tc.list_is_called("realm-1", "rune_list")

		// Then
		tc.no_error_occurred()
		tc.list_has_n_entries(2)
	})

	t.Run("isolates entries by projection name", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()
		tc.projection_has_entries("realm-1", "rune_list", map[string]string{
			"rune-1": `{"id":"rune-1"}`,
		})
		tc.projection_has_entries("realm-1", "realm_list", map[string]string{
			"realm-1": `{"realm_id":"realm-1"}`,
			"realm-2": `{"realm_id":"realm-2"}`,
		})

		// When
		tc.list_is_called("realm-1", "rune_list")

		// Then
		tc.no_error_occurred()
		tc.list_has_n_entries(1)
	})
}

func TestProjectionStore_Delete(t *testing.T) {
	t.Run("removes an existing entry", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()
		tc.a_simple_value("to-delete")
		tc.put_is_called("realm-1", "data", "key-1")

		// When
		tc.delete_is_called("realm-1", "data", "key-1")
		tc.get_is_called("realm-1", "data", "key-1")

		// Then
		tc.not_found_error_is_returned("data", "key-1")
	})

	t.Run("does not error on non-existent key", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()

		// When
		tc.delete_is_called("realm-1", "data", "no-such-key")

		// Then
		tc.no_error_occurred()
	})
}

func TestProjectionStore_Put_StoresValueAsText(t *testing.T) {
	t.Run("stores value as text not blob", func(t *testing.T) {
		tc := newProjectionTestContext(t)

		// Given
		tc.a_database_with_schema()
		tc.new_projection_store_is_created()
		tc.a_simple_value("hello world")

		// When
		tc.put_is_called("realm-1", "greetings", "key-1")

		// Then
		tc.no_error_occurred()
		tc.stored_projection_value_column_has_type("text")
	})
}

// --- Test Context ---

type complexProfile struct {
	Name    string            `json:"name"`
	Age     int               `json:"age"`
	Tags    []string          `json:"tags"`
	Address address           `json:"address"`
	Meta    map[string]string `json:"meta"`
}

type address struct {
	Street string `json:"street"`
	City   string `json:"city"`
}

type projectionTestContext struct {
	t     *testing.T
	db    *sql.DB
	store *ProjectionStore
	err   error

	simpleValue   string
	complexValue  complexProfile
	retrievedStr  string
	retrievedProf complexProfile
	listResult    []json.RawMessage
}

func newProjectionTestContext(t *testing.T) *projectionTestContext {
	t.Helper()
	return &projectionTestContext{t: t}
}

// --- Given ---

func (tc *projectionTestContext) a_database_with_schema() {
	tc.t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	require.NoError(tc.t, err)
	tc.t.Cleanup(func() { db.Close() })
	err = EnsureSchema(db)
	require.NoError(tc.t, err)
	tc.db = db
}

func (tc *projectionTestContext) a_simple_value(val string) {
	tc.t.Helper()
	tc.simpleValue = val
}

func (tc *projectionTestContext) a_complex_value() {
	tc.t.Helper()
	tc.complexValue = complexProfile{
		Name: "Alice",
		Age:  30,
		Tags: []string{"admin", "user"},
		Address: address{
			Street: "123 Main St",
			City:   "Springfield",
		},
		Meta: map[string]string{
			"role":   "engineer",
			"status": "active",
		},
	}
}

func (tc *projectionTestContext) projection_has_entries(realmID, projectionName string, entries map[string]string) {
	tc.t.Helper()
	for key, val := range entries {
		tc.err = tc.store.Put(context.Background(), realmID, projectionName, key, json.RawMessage(val))
		require.NoError(tc.t, tc.err)
	}
}

// --- When ---

func (tc *projectionTestContext) new_projection_store_is_created() {
	tc.t.Helper()
	tc.store, tc.err = NewProjectionStore(tc.db)
}

func (tc *projectionTestContext) get_is_called(realmID, projectionName, key string) {
	tc.t.Helper()
	tc.retrievedStr = ""
	tc.err = tc.store.Get(context.Background(), realmID, projectionName, key, &tc.retrievedStr)
}

func (tc *projectionTestContext) put_is_called(realmID, projectionName, key string) {
	tc.t.Helper()
	tc.err = tc.store.Put(context.Background(), realmID, projectionName, key, tc.simpleValue)
	require.NoError(tc.t, tc.err)
}

func (tc *projectionTestContext) delete_is_called(realmID, projectionName, key string) {
	tc.t.Helper()
	tc.err = tc.store.Delete(context.Background(), realmID, projectionName, key)
}

func (tc *projectionTestContext) put_complex_is_called(realmID, projectionName, key string) {
	tc.t.Helper()
	tc.err = tc.store.Put(context.Background(), realmID, projectionName, key, tc.complexValue)
	require.NoError(tc.t, tc.err)
}

func (tc *projectionTestContext) get_complex_is_called(realmID, projectionName, key string) {
	tc.t.Helper()
	tc.retrievedProf = complexProfile{}
	tc.err = tc.store.Get(context.Background(), realmID, projectionName, key, &tc.retrievedProf)
}

func (tc *projectionTestContext) list_is_called(realmID, projectionName string) {
	tc.t.Helper()
	tc.listResult, tc.err = tc.store.List(context.Background(), realmID, projectionName)
}

// --- Then ---

func (tc *projectionTestContext) no_error_occurred() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *projectionTestContext) store_is_not_nil() {
	tc.t.Helper()
	assert.NotNil(tc.t, tc.store)
}

func (tc *projectionTestContext) not_found_error_is_returned(entity, id string) {
	tc.t.Helper()
	var nfe *core.NotFoundError
	require.Error(tc.t, tc.err)
	require.True(tc.t, errors.As(tc.err, &nfe), "expected NotFoundError, got %T: %v", tc.err, tc.err)
	assert.Equal(tc.t, entity, nfe.Entity)
	assert.Equal(tc.t, id, nfe.ID)
}

func (tc *projectionTestContext) retrieved_value_equals(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.retrievedStr)
}

func (tc *projectionTestContext) retrieved_complex_value_matches() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.complexValue, tc.retrievedProf)
}

func (tc *projectionTestContext) list_has_n_entries(n int) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.listResult, "expected non-nil list result")
	assert.Len(tc.t, tc.listResult, n)
}

func (tc *projectionTestContext) stored_projection_value_column_has_type(expectedType string) {
	tc.t.Helper()
	var colType string
	err := tc.db.QueryRow(`SELECT typeof(value) FROM projections LIMIT 1`).Scan(&colType)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expectedType, colType)
}
