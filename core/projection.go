package core

import "context"

type Projector interface {
	Name() string
	Handle(ctx context.Context, event Event, store ProjectionStore) error
}

type ProjectionEngine interface {
	Register(projector Projector)
	RunSync(ctx context.Context, events []Event) error
	RunCatchUpOnce(ctx context.Context)
	StartCatchUp(ctx context.Context) error
	Stop() error
}
