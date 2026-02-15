package domain

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/devzeebo/bifrost/core"
)

const (
	realmStreamPrefix = "realm-"
	AdminRealmID      = "_admin"
)

type RealmState struct {
	RealmID string
	Name    string
	Status  string
	Exists  bool
}

type CreateRealmResult struct {
	RealmID string
}

func rebuildRealmState(events []core.Event) RealmState {
	var state RealmState
	for _, evt := range events {
		switch evt.EventType {
		case EventRealmCreated:
			var data RealmCreated
			_ = json.Unmarshal(evt.Data, &data)
			state.Exists = true
			state.RealmID = data.RealmID
			state.Name = data.Name
			state.Status = "active"
		case EventRealmSuspended:
			state.Status = "suspended"
		}
	}
	return state
}

func realmStreamID(realmID string) string {
	return realmStreamPrefix + realmID
}

func generateRealmID() (string, error) {
	b := make([]byte, 2)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate realm ID: %w", err)
	}
	return "bf-" + hex.EncodeToString(b), nil
}

func readAndRebuildRealmState(ctx context.Context, realmID string, store core.EventStore) (RealmState, []core.Event, error) {
	streamID := realmStreamID(realmID)
	events, err := store.ReadStream(ctx, AdminRealmID, streamID, 0)
	if err != nil {
		return RealmState{}, nil, err
	}
	state := rebuildRealmState(events)
	return state, events, nil
}

func HandleCreateRealm(ctx context.Context, cmd CreateRealm, store core.EventStore) (CreateRealmResult, error) {
	realmID, err := generateRealmID()
	if err != nil {
		return CreateRealmResult{}, err
	}

	created := RealmCreated{
		RealmID:   realmID,
		Name:      cmd.Name,
		CreatedAt: time.Now().UTC(),
	}

	streamID := realmStreamID(realmID)
	_, err = store.Append(ctx, AdminRealmID, streamID, 0, []core.EventData{
		{EventType: EventRealmCreated, Data: created},
	})
	if err != nil {
		return CreateRealmResult{}, err
	}

	return CreateRealmResult{
		RealmID: realmID,
	}, nil
}

func HandleSuspendRealm(ctx context.Context, cmd SuspendRealm, store core.EventStore) error {
	state, events, err := readAndRebuildRealmState(ctx, cmd.RealmID, store)
	if err != nil {
		return err
	}
	if !state.Exists {
		return &core.NotFoundError{Entity: "realm", ID: cmd.RealmID}
	}
	if state.Status == "suspended" {
		return fmt.Errorf("realm %q is already suspended", cmd.RealmID)
	}

	suspended := RealmSuspended(cmd)

	streamID := realmStreamID(cmd.RealmID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventRealmSuspended, Data: suspended},
	})
	return err
}
