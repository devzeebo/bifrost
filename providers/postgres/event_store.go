package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/devzeebo/bifrost/core"
	"github.com/jackc/pgx/v5/pgconn"
	_ "github.com/jackc/pgx/v5/stdlib"
)

// EventStore is a PostgreSQL-backed implementation of core.EventStore.
type EventStore struct {
	db *sql.DB
}

// NewEventStore creates a new EventStore backed by the given database.
func NewEventStore(db *sql.DB) (*EventStore, error) {
	if err := EnsureSchema(db); err != nil {
		return nil, err
	}
	return &EventStore{db: db}, nil
}

// Append persists new events to a stream with optimistic concurrency control.
func (s *EventStore) Append(ctx context.Context, realmID string, streamID string, expectedVersion int, events []core.EventData) ([]core.Event, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var actualVersion int
	err = tx.QueryRowContext(ctx,
		`SELECT COALESCE(MAX(version), 0) FROM events WHERE realm_id = $1 AND stream_id = $2`,
		realmID, streamID,
	).Scan(&actualVersion)
	if err != nil {
		return nil, err
	}

	if actualVersion != expectedVersion {
		return nil, &core.ConcurrencyError{
			StreamID:        streamID,
			ExpectedVersion: expectedVersion,
			ActualVersion:   actualVersion,
		}
	}

	result := make([]core.Event, len(events))
	now := time.Now().UTC()

	for i, ed := range events {
		data, err := json.Marshal(ed.Data)
		if err != nil {
			return nil, err
		}

		var metadata []byte
		if ed.Metadata != nil {
			metadata, err = json.Marshal(ed.Metadata)
			if err != nil {
				return nil, err
			}
		}

		version := expectedVersion + i + 1
		var metadataVal any
		if metadata != nil {
			metadataVal = string(metadata)
		}

		res, err := tx.ExecContext(ctx,
			`INSERT INTO events (realm_id, stream_id, version, event_type, _data, _metadata, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
			realmID, streamID, version, ed.EventType, string(data), metadataVal, now,
		)
		if err != nil {
			if isPostgresConcurrencyError(err) {
				return nil, &core.ConcurrencyError{
					StreamID:        streamID,
					ExpectedVersion: expectedVersion,
					ActualVersion:   expectedVersion,
				}
			}
			return nil, err
		}

		globalPosition, err := res.LastInsertId()
		if err != nil {
			return nil, err
		}

		result[i] = core.Event{
			RealmID:        realmID,
			StreamID:       streamID,
			Version:        version,
			GlobalPosition: globalPosition,
			EventType:      ed.EventType,
			Data:           data,
			Metadata:       metadata,
			Timestamp:      now,
		}
	}

	if err := tx.Commit(); err != nil {
		if isPostgresConcurrencyError(err) {
			return nil, &core.ConcurrencyError{
				StreamID:        streamID,
				ExpectedVersion: expectedVersion,
				ActualVersion:   expectedVersion,
			}
		}
		return nil, err
	}

	return result, nil
}

// ReadStream returns events for a specific stream starting from the given version.
func (s *EventStore) ReadStream(ctx context.Context, realmID string, streamID string, fromVersion int) ([]core.Event, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT global_position, realm_id, stream_id, version, event_type, _data, _metadata, timestamp
		 FROM events
		 WHERE realm_id = $1 AND stream_id = $2 AND version >= $3
		 ORDER BY version ASC`,
		realmID, streamID, fromVersion,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanEvents(rows)
}

// ReadAll returns events across all streams in a realm starting from the given global position.
func (s *EventStore) ReadAll(ctx context.Context, realmID string, fromGlobalPosition int64) ([]core.Event, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT global_position, realm_id, stream_id, version, event_type, _data, _metadata, timestamp
		 FROM events
		 WHERE realm_id = $1 AND global_position > $2
		 ORDER BY global_position ASC`,
		realmID, fromGlobalPosition,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	return scanEvents(rows)
}

// ListRealmIDs returns all distinct realm IDs from the events table.
func (s *EventStore) ListRealmIDs(ctx context.Context) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT DISTINCT realm_id FROM events`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var realmIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		realmIDs = append(realmIDs, id)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return realmIDs, nil
}

func scanEvents(rows *sql.Rows) ([]core.Event, error) {
	events := make([]core.Event, 0)
	for rows.Next() {
		var e core.Event
		if err := rows.Scan(
			&e.GlobalPosition,
			&e.RealmID,
			&e.StreamID,
			&e.Version,
			&e.EventType,
			&e.Data,
			&e.Metadata,
			&e.Timestamp,
		); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return events, nil
}

// isPostgresConcurrencyError returns true if the error is a PostgreSQL error
// indicating a concurrency conflict.
func isPostgresConcurrencyError(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		// Check for unique constraint violation (23505) or serialization failure (40001)
		switch pgErr.Code {
		case "23505", "40001":
			return true
		}
	}
	return false
}