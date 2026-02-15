package core

import (
	"context"
	"encoding/json"
)

type EventStore interface {
	Append(ctx context.Context, realmID string, streamID string, expectedVersion int, events []EventData) ([]Event, error)
	ReadStream(ctx context.Context, realmID string, streamID string, fromVersion int) ([]Event, error)
	ReadAll(ctx context.Context, realmID string, fromGlobalPosition int64) ([]Event, error)
	ListRealmIDs(ctx context.Context) ([]string, error)
}

type ProjectionStore interface {
	Get(ctx context.Context, realmID string, projectionName string, key string, dest any) error
	List(ctx context.Context, realmID string, projectionName string) ([]json.RawMessage, error)
	Put(ctx context.Context, realmID string, projectionName string, key string, value any) error
	Delete(ctx context.Context, realmID string, projectionName string, key string) error
}

type CheckpointStore interface {
	GetCheckpoint(ctx context.Context, realmID string, projectorName string) (int64, error)
	SetCheckpoint(ctx context.Context, realmID string, projectorName string, globalPosition int64) error
}
