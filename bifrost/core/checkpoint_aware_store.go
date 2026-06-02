package core

import (
	"context"
	"encoding/json"
)

// checkpointAwareStore wraps ProjectionStore and intercepts Get calls for tables
// owned by other projectors. If the owning projector's checkpoint is behind the
// current event position, it returns ErrProjectorNotReady so the engine can defer
// and retry the calling projector after others have run.
//
// syncAdvanced, when non-nil, is checked instead of the checkpoint store. This
// is used during RunSync where checkpoints are not written mid-call; the engine
// populates it as each projector successfully processes the event.
type checkpointAwareStore struct {
	ProjectionStore
	checkpointStore  CheckpointStore
	realmID          string
	currentPos       int64
	ownTable         string
	tableToProjector map[string]string
	syncAdvanced     map[string]bool
}

func (s *checkpointAwareStore) Get(ctx context.Context, realmID string, table string, key string, dest any) error {
	if table != s.ownTable {
		if projName, ok := s.tableToProjector[table]; ok {
			if s.syncAdvanced != nil {
				if !s.syncAdvanced[projName] {
					return &ErrProjectorNotReady{DependencyTable: table, RequiredPos: s.currentPos}
				}
			} else {
				cp, err := s.checkpointStore.GetCheckpoint(ctx, realmID, projName)
				if err != nil || cp < s.currentPos {
					return &ErrProjectorNotReady{DependencyTable: table, RequiredPos: s.currentPos}
				}
			}
		}
	}
	return s.ProjectionStore.Get(ctx, realmID, table, key, dest)
}

func (s *checkpointAwareStore) List(ctx context.Context, realmID string, table string) ([]json.RawMessage, error) {
	return s.ProjectionStore.List(ctx, realmID, table)
}

func (s *checkpointAwareStore) Put(ctx context.Context, realmID string, table string, key string, value any) error {
	return s.ProjectionStore.Put(ctx, realmID, table, key, value)
}

func (s *checkpointAwareStore) Delete(ctx context.Context, realmID string, table string, key string) error {
	return s.ProjectionStore.Delete(ctx, realmID, table, key)
}
