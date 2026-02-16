package integration

import (
	"context"
	"database/sql"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/devzeebo/bifrost/providers/sqlite"
	_ "modernc.org/sqlite"
	"github.com/stretchr/testify/require"
)

// openTestDB creates an in-memory SQLite database for testing.
func openTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	require.NoError(t, err)
	t.Cleanup(func() { db.Close() })
	return db
}

// testStack holds the full stack wired together for integration tests.
type testStack struct {
	EventStore      core.EventStore
	ProjectionStore core.ProjectionStore
	Projectors      []core.Projector
}

// newTestStack creates a full stack backed by in-memory SQLite.
func newTestStack(t *testing.T) *testStack {
	t.Helper()
	db := openTestDB(t)

	es, err := sqlite.NewEventStore(db)
	require.NoError(t, err)

	ps, err := sqlite.NewProjectionStore(db)
	require.NoError(t, err)

	return &testStack{
		EventStore:      es,
		ProjectionStore: ps,
		Projectors: []core.Projector{
			projectors.NewRuneListProjector(),
			projectors.NewRuneDetailProjector(),
			projectors.NewDependencyGraphProjector(),
			projectors.NewRuneChildCountProjector(),
		},
	}
}

// projectEvents runs all registered projectors over the given events in order.
func (s *testStack) projectEvents(t *testing.T, events []core.Event) {
	t.Helper()
	ctx := context.Background()
	for _, evt := range events {
		for _, p := range s.Projectors {
			err := p.Handle(ctx, evt, s.ProjectionStore)
			require.NoError(t, err, "projector %s failed on event %s", p.Name(), evt.EventType)
		}
	}
}
