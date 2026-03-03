package sqlite

import "database/sql"

// EnsureSchema runs idempotent DDL to create all required tables and indexes.
func EnsureSchema(db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS events (
			global_position INTEGER PRIMARY KEY AUTOINCREMENT,
			realm_id TEXT NOT NULL,
			stream_id TEXT NOT NULL,
			version INTEGER NOT NULL,
			event_type TEXT NOT NULL,
			data TEXT,
			metadata TEXT,
			timestamp DATETIME NOT NULL,
			UNIQUE(realm_id, stream_id, version)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_events_realm_stream ON events(realm_id, stream_id, version)`,
		`CREATE INDEX IF NOT EXISTS idx_events_realm_global ON events(realm_id, global_position)`,
		`CREATE TABLE IF NOT EXISTS projections (
			realm_id TEXT NOT NULL,
			projection_name TEXT NOT NULL,
			key TEXT NOT NULL,
			value TEXT,
			PRIMARY KEY(realm_id, projection_name, key)
		)`,
		`CREATE TABLE IF NOT EXISTS checkpoints (
			realm_id TEXT NOT NULL,
			projector_name TEXT NOT NULL,
			last_global_position INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY(realm_id, projector_name)
		)`,
		`CREATE TABLE IF NOT EXISTS agents (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			main_workflow_id TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS agent_skills (
			agent_id TEXT NOT NULL,
			skill_id TEXT NOT NULL,
			PRIMARY KEY(agent_id, skill_id)
		)`,
		`CREATE TABLE IF NOT EXISTS agent_workflows (
			agent_id TEXT NOT NULL,
			workflow_id TEXT NOT NULL,
			is_main INTEGER NOT NULL DEFAULT 0,
			PRIMARY KEY(agent_id, workflow_id)
		)`,
		`CREATE TABLE IF NOT EXISTS agent_realms (
			agent_id TEXT NOT NULL,
			realm_id TEXT NOT NULL,
			PRIMARY KEY(agent_id, realm_id)
		)`,
		`CREATE TABLE IF NOT EXISTS skills (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			content TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS workflows (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			content TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS runner_settings (
			id TEXT PRIMARY KEY,
			runner_type TEXT NOT NULL,
			name TEXT NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS runner_settings_fields (
			settings_id TEXT NOT NULL,
			field_name TEXT NOT NULL,
			value TEXT,
			PRIMARY KEY(settings_id, field_name)
		)`,
	}

	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	return nil
}
