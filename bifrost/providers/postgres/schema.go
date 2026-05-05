package postgres

import "database/sql"

// EnsureSchema runs idempotent DDL to create all required tables and indexes.
func EnsureSchema(db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS events (
			global_position BIGSERIAL PRIMARY KEY,
			realm_id TEXT NOT NULL,
			stream_id TEXT NOT NULL,
			version INTEGER NOT NULL,
			event_type TEXT NOT NULL,
			_data TEXT,
			_metadata TEXT,
			timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
			UNIQUE(realm_id, stream_id, version)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_events_realm_stream ON events(realm_id, stream_id, version)`,
		`CREATE INDEX IF NOT EXISTS idx_events_realm_global ON events(realm_id, global_position)`,
		`CREATE TABLE IF NOT EXISTS checkpoints (
			realm_id TEXT NOT NULL,
			projector_name TEXT NOT NULL,
			last_global_position BIGINT NOT NULL DEFAULT 0,
			PRIMARY KEY(realm_id, projector_name)
		)`,
	}

	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	return nil
}