package sqlite

import (
	"context"
	"database/sql"
)

// CheckpointStore is a SQLite-backed implementation of core.CheckpointStore.
type CheckpointStore struct {
	db *sql.DB
}

// NewCheckpointStore creates a new CheckpointStore backed by the given database.
func NewCheckpointStore(db *sql.DB) (*CheckpointStore, error) {
	if err := EnsureSchema(db); err != nil {
		return nil, err
	}
	return &CheckpointStore{db: db}, nil
}

// GetCheckpoint returns the last global position for the given projector.
// Returns 0 if no checkpoint exists.
func (s *CheckpointStore) GetCheckpoint(ctx context.Context, realmID string, projectorName string) (int64, error) {
	var pos int64
	err := s.db.QueryRowContext(ctx,
		`SELECT last_global_position FROM checkpoints WHERE realm_id = ? AND projector_name = ?`,
		realmID, projectorName,
	).Scan(&pos)

	if err == sql.ErrNoRows {
		return 0, nil
	}
	if err != nil {
		return 0, err
	}
	return pos, nil
}

// SetCheckpoint upserts the checkpoint for the given projector.
func (s *CheckpointStore) SetCheckpoint(ctx context.Context, realmID string, projectorName string, globalPosition int64) error {
	_, err := s.db.ExecContext(ctx,
		`INSERT OR REPLACE INTO checkpoints (realm_id, projector_name, last_global_position) VALUES (?, ?, ?)`,
		realmID, projectorName, globalPosition,
	)
	return err
}
