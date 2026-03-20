package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"

	"github.com/devzeebo/bifrost/core"
)

// ProjectionStore is a SQLite-backed implementation of core.ProjectionStore.
type ProjectionStore struct {
	db *sql.DB
}

// NewProjectionStore creates a new ProjectionStore backed by the given database.
func NewProjectionStore(db *sql.DB) (*ProjectionStore, error) {
	if err := EnsureSchema(db); err != nil {
		return nil, err
	}
	return &ProjectionStore{db: db}, nil
}

// Get retrieves a projection value by realm, table, and key.
// Returns core.NotFoundError if no row is found or table doesn't exist.
func (s *ProjectionStore) Get(ctx context.Context, realmID string, table string, key string, dest any) error {
	var value []byte
	err := s.db.QueryRowContext(ctx,
		`SELECT value FROM projection_`+table+` WHERE realm_id = ? AND key = ?`,
		realmID, key,
	).Scan(&value)

	if err == sql.ErrNoRows {
		return &core.NotFoundError{Entity: table, ID: key}
	}
	if err != nil {
		// Handle "no such table" error as NotFoundError
		if isTableNotExistError(err) {
			return &core.NotFoundError{Entity: table, ID: key}
		}
		return err
	}
	return json.Unmarshal(value, dest)
}

// List returns all projection values for the given realm and table.
// Returns empty slice if table doesn't exist.
func (s *ProjectionStore) List(ctx context.Context, realmID string, table string) ([]json.RawMessage, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT value FROM projection_`+table+` WHERE realm_id = ?`,
		realmID,
	)
	if err != nil {
		// Handle "no such table" error as empty result
		if isTableNotExistError(err) {
			return []json.RawMessage{}, nil
		}
		return nil, err
	}
	defer rows.Close()

	results := make([]json.RawMessage, 0)
	for rows.Next() {
		var value []byte
		if err := rows.Scan(&value); err != nil {
			return nil, err
		}
		results = append(results, json.RawMessage(value))
	}
	return results, rows.Err()
}

// ensureTable creates the projection table if it doesn't exist.
func (s *ProjectionStore) ensureTable(ctx context.Context, table string) error {
	_, err := s.db.ExecContext(ctx,
		`CREATE TABLE IF NOT EXISTS projection_`+table+` (
			realm_id TEXT NOT NULL,
			key TEXT NOT NULL,
			value TEXT,
			PRIMARY KEY(realm_id, key)
		)`,
	)
	return err
}

// CreateTable creates the projection table if it doesn't exist.
// This is the public method implementing the ProjectionStore interface.
func (s *ProjectionStore) CreateTable(ctx context.Context, table string) error {
	return s.ensureTable(ctx, table)
}

// Put upserts a projection value for the given realm, table, and key.
func (s *ProjectionStore) Put(ctx context.Context, realmID string, table string, key string, value any) error {
	if err := s.ensureTable(ctx, table); err != nil {
		return err
	}
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx,
		`INSERT OR REPLACE INTO projection_`+table+` (realm_id, key, value) VALUES (?, ?, ?)`,
		realmID, key, string(data),
	)
	return err
}

// Delete removes a projection entry. Deleting a non-existent key is not an error.
// If the table doesn't exist, it's also not an error.
func (s *ProjectionStore) Delete(ctx context.Context, realmID string, table string, key string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM projection_`+table+` WHERE realm_id = ? AND key = ?`,
		realmID, key,
	)
	if err != nil && isTableNotExistError(err) {
		return nil
	}
	return err
}

// ClearTable removes all entries from a projection table.
// If the table doesn't exist, it's not an error.
func (s *ProjectionStore) ClearTable(ctx context.Context, table string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM projection_`+table)
	if err != nil && isTableNotExistError(err) {
		return nil
	}
	return err
}

// isTableNotExistError checks if the error indicates the table doesn't exist.
func isTableNotExistError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "no such table")
}
