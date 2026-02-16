package projectors

import (
	"context"
	"encoding/json"
	"time"

	"github.com/devzeebo/bifrost/core"
)

// Compile-time interface satisfaction checks
var _ core.Projector = (*RuneListProjector)(nil)
var _ core.Projector = (*RuneDetailProjector)(nil)
var _ core.Projector = (*DependencyGraphProjector)(nil)
var _ core.Projector = (*RealmListProjector)(nil)
var _ core.Projector = (*AccountListProjector)(nil)
var _ core.Projector = (*AccountLookupProjector)(nil)
var _ core.Projector = (*RuneChildCountProjector)(nil)

// --- Helpers ---

func strPtr(s string) *string { return &s }
func intPtr(i int) *int       { return &i }

func makeEvent(eventType string, data any) core.Event {
	dataBytes, _ := json.Marshal(data)
	return core.Event{
		EventType: eventType,
		Data:      dataBytes,
		RealmID:   "realm-1",
		Timestamp: time.Now(),
	}
}

func makeEventWithTimestamp(eventType string, data any, ts time.Time) core.Event {
	dataBytes, _ := json.Marshal(data)
	return core.Event{
		EventType: eventType,
		Data:      dataBytes,
		RealmID:   "realm-1",
		Timestamp: ts,
	}
}

// --- Mock Projection Store ---

type mockProjectionStore struct {
	data map[string]any
}

func newMockProjectionStore() *mockProjectionStore {
	return &mockProjectionStore{
		data: make(map[string]any),
	}
}

func (m *mockProjectionStore) put(realmID, projectionName, key string, value any) {
	compositeKey := realmID + ":" + projectionName + ":" + key
	m.data[compositeKey] = value
}

func (m *mockProjectionStore) Get(_ context.Context, realmID string, projectionName string, key string, dest any) error {
	compositeKey := realmID + ":" + projectionName + ":" + key
	val, ok := m.data[compositeKey]
	if !ok {
		return &core.NotFoundError{Entity: projectionName, ID: key}
	}
	dataBytes, err := json.Marshal(val)
	if err != nil {
		return err
	}
	return json.Unmarshal(dataBytes, dest)
}

func (m *mockProjectionStore) Put(_ context.Context, realmID string, projectionName string, key string, value any) error {
	compositeKey := realmID + ":" + projectionName + ":" + key
	m.data[compositeKey] = value
	return nil
}

func (m *mockProjectionStore) List(_ context.Context, _ string, _ string) ([]json.RawMessage, error) {
	return nil, nil
}

func (m *mockProjectionStore) Delete(_ context.Context, realmID string, projectionName string, key string) error {
	compositeKey := realmID + ":" + projectionName + ":" + key
	delete(m.data, compositeKey)
	return nil
}
