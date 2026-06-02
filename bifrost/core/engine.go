package core

import (
	"context"
	"errors"
	"fmt"
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

	registeredTables []string
	tableToProjector map[string]string
}

type EngineOption func(*projectionEngine)

func WithPollInterval(d time.Duration) EngineOption {
	return func(e *projectionEngine) {
		e.pollInterval = d
	}
}

func NewProjectionEngine(eventStore EventStore, projectionStore ProjectionStore, checkpointStore CheckpointStore, opts ...EngineOption) *projectionEngine {
	e := &projectionEngine{
		eventStore:       eventStore,
		projectionStore:  projectionStore,
		checkpointStore:  checkpointStore,
		pollInterval:     1 * time.Second,
		tableToProjector: make(map[string]string),
	}
	for _, opt := range opts {
		opt(e)
	}
	return e
}

func (e *projectionEngine) Register(projector Projector) error {
	// Auto-create the projection table first
	tableName := projector.TableName()
	if err := e.projectionStore.CreateTable(context.Background(), tableName); err != nil {
		return fmt.Errorf("failed to create table %q: %w", tableName, err)
	}

	// Only register after successful table creation
	e.projectors = append(e.projectors, projector)
	e.registeredTables = append(e.registeredTables, tableName)
	e.tableToProjector[tableName] = projector.Name()
	return nil
}

func (e *projectionEngine) RegisteredTables() []string {
	return e.registeredTables
}

func (e *projectionEngine) RunSync(ctx context.Context, events []Event) error {
	for _, event := range events {
		// syncAdvanced tracks which projectors completed in this RunSync call.
		// Checkpoints are not written during sync, so cross-projector reads rely on
		// this in-memory set instead of checkpoint lookups.
		syncAdvanced := make(map[string]bool, len(e.projectors))
		e.runProjectorsForEvent(ctx, event, e.projectors, "sync", syncAdvanced)
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
		if ctx.Err() != nil {
			return
		}

		// Load per-projector checkpoints
		checkpoints := make(map[string]int64, len(e.projectors))
		minCheckpoint := int64(-1)
		for _, projector := range e.projectors {
			cp, err := e.checkpointStore.GetCheckpoint(ctx, realmID, projector.Name())
			if err != nil {
				log.Printf("catch-up: error getting checkpoint for %s/%s: %v", realmID, projector.Name(), err)
				cp = 0
			}
			checkpoints[projector.Name()] = cp
			if minCheckpoint < 0 || cp < minCheckpoint {
				minCheckpoint = cp
			}
		}
		if minCheckpoint < 0 {
			minCheckpoint = 0
		}

		events, err := e.eventStore.ReadAll(ctx, realmID, minCheckpoint)
		if err != nil {
			log.Printf("catch-up: error reading events for realm %s: %v", realmID, err)
			continue
		}

		// Track last position seen per projector for checkpoint updates
		lastPos := make(map[string]int64, len(e.projectors))

		// Fan out each event to all projectors that haven't seen it yet, in event order
		for _, event := range events {
			// Build the subset of projectors that need this event
			var pending []Projector
			for _, projector := range e.projectors {
				if event.GlobalPosition > checkpoints[projector.Name()] {
					pending = append(pending, projector)
				}
			}
			advanced := e.runProjectorsForEvent(ctx, event, pending, "catch-up", nil)
			for name, pos := range advanced {
				lastPos[name] = pos
			}
		}

		for _, projector := range e.projectors {
			pos, ok := lastPos[projector.Name()]
			if !ok {
				continue
			}
			if err := e.checkpointStore.SetCheckpoint(ctx, realmID, projector.Name(), pos); err != nil {
				log.Printf("catch-up: error setting checkpoint for %s/%s: %v", realmID, projector.Name(), err)
			}
		}
	}
}

// runProjectorsForEvent runs pending projectors against a single event, retrying
// any that return ErrProjectorNotReady until no further progress is made.
// Returns a map of projector name → GlobalPosition for each projector that
// successfully processed the event (used by the catch-up loop to update lastPos).
//
// syncAdvanced, when non-nil, is used instead of checkpoint lookups to determine
// whether a dependency projector has processed the current event. This is required
// for RunSync where checkpoints are not written mid-call.
func (e *projectionEngine) runProjectorsForEvent(ctx context.Context, event Event, pending []Projector, logPrefix string, syncAdvanced map[string]bool) map[string]int64 {
	advanced := make(map[string]int64, len(pending))
	for len(pending) > 0 {
		var deferred []Projector
		progress := false
		for _, projector := range pending {
			store := &checkpointAwareStore{
				ProjectionStore:  e.projectionStore,
				checkpointStore:  e.checkpointStore,
				realmID:          event.RealmID,
				currentPos:       event.GlobalPosition,
				ownTable:         projector.TableName(),
				tableToProjector: e.tableToProjector,
				syncAdvanced:     syncAdvanced,
			}
			err := projector.Handle(ctx, event, store)
			if err != nil {
				var notReady *ErrProjectorNotReady
				if errors.As(err, &notReady) {
					deferred = append(deferred, projector)
					continue
				}
				log.Printf("%s: projector %q error on event %d: %v", logPrefix, projector.Name(), event.GlobalPosition, err)
			}
			advanced[projector.Name()] = event.GlobalPosition
			if syncAdvanced != nil {
				syncAdvanced[projector.Name()] = true
			}
			progress = true
		}
		if !progress {
			for _, projector := range deferred {
				log.Printf("%s: projector %q could not be satisfied for event %d (dependency not ready)", logPrefix, projector.Name(), event.GlobalPosition)
			}
			break
		}
		pending = deferred
	}
	return advanced
}

func (e *projectionEngine) Stop() error {
	if e.cancel != nil {
		e.cancel()
	}
	e.wg.Wait()
	return nil
}

// RebuildProjections clears all projection tables and checkpoints, then replays all events.
// This is useful when projector logic has been fixed and projections need to be reconstructed.
func (e *projectionEngine) RebuildProjections(ctx context.Context) error {
	// Preflight: Verify we can list realm IDs and reset checkpoints
	realmIDs, err := e.eventStore.ListRealmIDs(ctx)
	if err != nil {
		return fmt.Errorf("rebuild preflight: failed to list realm IDs: %w", err)
	}

	// Preflight: Test checkpoint reset for all realm/projector combinations
	for _, realmID := range realmIDs {
		for _, projector := range e.projectors {
			if err := e.checkpointStore.SetCheckpoint(ctx, realmID, projector.Name(), 0); err != nil {
				return fmt.Errorf("rebuild preflight: failed to reset checkpoint for %s/%s: %w", realmID, projector.Name(), err)
			}
		}
	}

	// Preflight passed - now clear all registered projection tables
	for _, table := range e.registeredTables {
		if err := e.projectionStore.ClearTable(ctx, table); err != nil {
			return fmt.Errorf("rebuild: failed to clear table %s: %w", table, err)
		}
	}

	// Run catch-up to rebuild from events
	e.runCatchUpCycle(ctx)
	return nil
}
