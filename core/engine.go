package core

import (
	"context"
	"log"
	"sync"
	"time"
)

type projectionEngine struct {
	projectors      []Projector
	eventStore      EventStore
	projectionStore ProjectionStore
	checkpointStore CheckpointStore
	pollInterval    time.Duration

	cancel context.CancelFunc
	wg     sync.WaitGroup
}

type EngineOption func(*projectionEngine)

func WithPollInterval(d time.Duration) EngineOption {
	return func(e *projectionEngine) {
		e.pollInterval = d
	}
}

func NewProjectionEngine(eventStore EventStore, projectionStore ProjectionStore, checkpointStore CheckpointStore, opts ...EngineOption) *projectionEngine {
	e := &projectionEngine{
		eventStore:      eventStore,
		projectionStore: projectionStore,
		checkpointStore: checkpointStore,
		pollInterval:    1 * time.Second,
	}
	for _, opt := range opts {
		opt(e)
	}
	return e
}

func (e *projectionEngine) Register(projector Projector) {
	e.projectors = append(e.projectors, projector)
}

func (e *projectionEngine) RunSync(ctx context.Context, events []Event) error {
	for _, projector := range e.projectors {
		for _, event := range events {
			if err := projector.Handle(ctx, event, e.projectionStore); err != nil {
				log.Printf("projector %q error: %v", projector.Name(), err)
			}
		}
	}
	return nil
}

func (e *projectionEngine) RunCatchUpOnce(ctx context.Context) {
	e.runCatchUpCycle(ctx)
}

func (e *projectionEngine) StartCatchUp(ctx context.Context) error {
	ctx, e.cancel = context.WithCancel(ctx)
	e.wg.Add(1)
	go func() {
		defer e.wg.Done()
		ticker := time.NewTicker(e.pollInterval)
		defer ticker.Stop()

		e.runCatchUpCycle(ctx)

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				e.runCatchUpCycle(ctx)
			}
		}
	}()
	return nil
}

func (e *projectionEngine) runCatchUpCycle(ctx context.Context) {
	realmIDs, err := e.eventStore.ListRealmIDs(ctx)
	if err != nil {
		log.Printf("catch-up: error listing realms: %v", err)
		return
	}

	for _, realmID := range realmIDs {
		for _, projector := range e.projectors {
			if ctx.Err() != nil {
				return
			}

			checkpoint, err := e.checkpointStore.GetCheckpoint(ctx, realmID, projector.Name())
			if err != nil {
				log.Printf("catch-up: error getting checkpoint for %s/%s: %v", realmID, projector.Name(), err)
				continue
			}

			events, err := e.eventStore.ReadAll(ctx, realmID, checkpoint)
			if err != nil {
				log.Printf("catch-up: error reading events for realm %s: %v", realmID, err)
				continue
			}

			var lastPos int64
			for _, event := range events {
				if err := projector.Handle(ctx, event, e.projectionStore); err != nil {
					log.Printf("catch-up: projector %q error on event %d: %v", projector.Name(), event.GlobalPosition, err)
				}
				lastPos = event.GlobalPosition
			}

			if len(events) > 0 {
				if err := e.checkpointStore.SetCheckpoint(ctx, realmID, projector.Name(), lastPos); err != nil {
					log.Printf("catch-up: error setting checkpoint for %s/%s: %v", realmID, projector.Name(), err)
				}
			}
		}
	}
}

func (e *projectionEngine) Stop() error {
	if e.cancel != nil {
		e.cancel()
	}
	e.wg.Wait()
	return nil
}
