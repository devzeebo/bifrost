package sqlite

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestEnsureSchema(t *testing.T) {
	t.Run("creates all tables on empty database", func(t *testing.T) {
		tc := newSchemaTestContext(t)

		// Given
		tc.an_empty_database()

		// When
		tc.ensure_schema_is_called()

		// Then
		tc.no_error_occurred()
		tc.events_table_exists()
		tc.projections_table_exists()
		tc.checkpoints_table_exists()
	})

	t.Run("is idempotent", func(t *testing.T) {
		tc := newSchemaTestContext(t)

		// Given
		tc.an_empty_database()
		tc.ensure_schema_is_called()

		// When
		tc.ensure_schema_is_called()

		// Then
		tc.no_error_occurred()
	})

	t.Run("creates indexes", func(t *testing.T) {
		tc := newSchemaTestContext(t)

		// Given
		tc.an_empty_database()

		// When
		tc.ensure_schema_is_called()

		// Then
		tc.no_error_occurred()
		tc.index_exists("idx_events_realm_stream")
		tc.index_exists("idx_events_realm_global")
	})

	t.Run("creates agent projection tables", func(t *testing.T) {
		tc := newSchemaTestContext(t)

		// Given
		tc.an_empty_database()

		// When
		tc.ensure_schema_is_called()

		// Then
		tc.no_error_occurred()
		tc.agents_table_exists()
		tc.agent_skills_table_exists()
		tc.agent_workflows_table_exists()
		tc.agent_realms_table_exists()
		tc.skills_table_exists()
		tc.workflows_table_exists()
		tc.runner_settings_table_exists()
		tc.runner_settings_fields_table_exists()
	})
}

// --- Test Context ---

type schemaTestContext struct {
	t   *testing.T
	db  *sql.DB
	err error
}

func newSchemaTestContext(t *testing.T) *schemaTestContext {
	t.Helper()
	return &schemaTestContext{t: t}
}

// --- Given ---

func (tc *schemaTestContext) an_empty_database() {
	tc.t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	require.NoError(tc.t, err)
	tc.db = db
	tc.t.Cleanup(func() { db.Close() })
}

// --- When ---

func (tc *schemaTestContext) ensure_schema_is_called() {
	tc.t.Helper()
	tc.err = EnsureSchema(tc.db)
}

// --- Then ---

func (tc *schemaTestContext) no_error_occurred() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *schemaTestContext) events_table_exists() {
	tc.t.Helper()
	tc.table_exists("events")
}

func (tc *schemaTestContext) projections_table_exists() {
	tc.t.Helper()
	tc.table_exists("projections")
}

func (tc *schemaTestContext) checkpoints_table_exists() {
	tc.t.Helper()
	tc.table_exists("checkpoints")
}

func (tc *schemaTestContext) agents_table_exists() {
	tc.t.Helper()
	tc.table_exists("agents")
}

func (tc *schemaTestContext) agent_skills_table_exists() {
	tc.t.Helper()
	tc.table_exists("agent_skills")
}

func (tc *schemaTestContext) agent_workflows_table_exists() {
	tc.t.Helper()
	tc.table_exists("agent_workflows")
}

func (tc *schemaTestContext) agent_realms_table_exists() {
	tc.t.Helper()
	tc.table_exists("agent_realms")
}

func (tc *schemaTestContext) skills_table_exists() {
	tc.t.Helper()
	tc.table_exists("skills")
}

func (tc *schemaTestContext) workflows_table_exists() {
	tc.t.Helper()
	tc.table_exists("workflows")
}

func (tc *schemaTestContext) runner_settings_table_exists() {
	tc.t.Helper()
	tc.table_exists("runner_settings")
}

func (tc *schemaTestContext) runner_settings_fields_table_exists() {
	tc.t.Helper()
	tc.table_exists("runner_settings_fields")
}

func (tc *schemaTestContext) table_exists(name string) {
	tc.t.Helper()
	var count int
	err := tc.db.QueryRow(
		"SELECT count(*) FROM sqlite_master WHERE type='table' AND name=?", name,
	).Scan(&count)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, 1, count, "expected table %q to exist", name)
}

func (tc *schemaTestContext) index_exists(name string) {
	tc.t.Helper()
	var count int
	err := tc.db.QueryRow(
		"SELECT count(*) FROM sqlite_master WHERE type='index' AND name=?", name,
	).Scan(&count)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, 1, count, "expected index %q to exist", name)
}
