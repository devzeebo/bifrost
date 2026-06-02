package core

import (
	"context"
	"fmt"
)

type Projector interface {
	Name() string
	TableName() string
	Handle(ctx context.Context, event Event, store ProjectionStore) error
}

type ProjectionEngine interface {
	Register(projector Projector) error
	RegisteredTables() []string
	RunSync(ctx context.Context, events []Event) error
	RunCatchUpOnce(ctx context.Context)
	StartCatchUp(ctx context.Context) error
	Stop() error
}

// ErrProjectorNotReady is returned by the engine's checkpoint-aware store when a
// cross-projector read targets a table whose owning projector hasn't yet processed
// the current event. The engine defers the projector to the end of the cycle and retries.
type ErrProjectorNotReady struct {
	DependencyTable string
	RequiredPos     int64
}

func (e *ErrProjectorNotReady) Error() string {
	return fmt.Sprintf("projector dependency %q has not yet processed event at position %d", e.DependencyTable, e.RequiredPos)
}
