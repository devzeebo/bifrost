package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"

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

// Get retrieves a projection value by realm, projection name, and key.
// Returns core.NotFoundError if no row is found.
func (s *ProjectionStore) Get(ctx context.Context, realmID string, projectionName string, key string, dest any) error {
	var value []byte
	err := s.db.QueryRowContext(ctx,
		`SELECT value FROM projections WHERE realm_id = ? AND projection_name = ? AND key = ?`,
		realmID, projectionName, key,
	).Scan(&value)

	if err == sql.ErrNoRows {
		return &core.NotFoundError{Entity: projectionName, ID: key}
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(value, dest)
}

// List returns all projection values for the given realm and projection name.
func (s *ProjectionStore) List(ctx context.Context, realmID string, projectionName string) ([]json.RawMessage, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT value FROM projections WHERE realm_id = ? AND projection_name = ?`,
		realmID, projectionName,
	)
	if err != nil {
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

// Put upserts a projection value for the given realm, projection name, and key.
func (s *ProjectionStore) Put(ctx context.Context, realmID string, projectionName string, key string, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	_, err = s.db.ExecContext(ctx,
		`INSERT OR REPLACE INTO projections (realm_id, projection_name, key, value) VALUES (?, ?, ?, ?)`,
		realmID, projectionName, key, string(data),
	)
	return err
}

// Delete removes a projection entry. Deleting a non-existent key is not an error.
func (s *ProjectionStore) Delete(ctx context.Context, realmID string, projectionName string, key string) error {
	_, err := s.db.ExecContext(ctx,
		`DELETE FROM projections WHERE realm_id = ? AND projection_name = ? AND key = ?`,
		realmID, projectionName, key,
	)
	return err
}
