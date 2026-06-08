package core

import (
	"context"
	"encoding/json"
)

// TableRef binds a projection table name to its document type T.
// Declare one as a package-level variable in the projector that owns the table,
// then import and use it from any projector that reads that table.
// Wrong table name or wrong document type is a compile error.
type TableRef[T any] struct {
	Name string
}

// GetRef fetches a document from the projection store, unmarshaling into T.
func GetRef[T any](ctx context.Context, store ProjectionStore, realmID string, ref TableRef[T], key string) (T, error) {
	var dest T
	err := store.Get(ctx, realmID, ref.Name, key, &dest)
	return dest, err
}

// PutRef stores a document of type T into the projection store.
func PutRef[T any](ctx context.Context, store ProjectionStore, realmID string, ref TableRef[T], key string, value T) error {
	return store.Put(ctx, realmID, ref.Name, key, value)
}

// DeleteRef deletes a key from the given table.
func DeleteRef[T any](ctx context.Context, store ProjectionStore, realmID string, ref TableRef[T], key string) error {
	return store.Delete(ctx, realmID, ref.Name, key)
}

// ListRef lists all documents in the given table as raw JSON.
func ListRef[T any](ctx context.Context, store ProjectionStore, realmID string, ref TableRef[T]) ([]json.RawMessage, error) {
	return store.List(ctx, realmID, ref.Name)
}
