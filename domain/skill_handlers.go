package domain

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/devzeebo/bifrost/core"
)

const skillStreamPrefix = "skill-"

type SkillState struct {
	SkillID string
	Name    string
	Content string
	Exists  bool
	Deleted bool
}

func RebuildSkillState(events []core.Event) SkillState {
	var state SkillState

	for _, evt := range events {
		switch evt.EventType {
		case EventSkillCreated:
			var data SkillCreated
			_ = json.Unmarshal(evt.Data, &data)
			state.Exists = true
			state.SkillID = data.SkillID
			state.Name = data.Name
			state.Content = data.Content
		case EventSkillUpdated:
			var data SkillUpdated
			_ = json.Unmarshal(evt.Data, &data)
			if data.Name != nil {
				state.Name = *data.Name
			}
			if data.Content != nil {
				state.Content = *data.Content
			}
		case EventSkillDeleted:
			state.Deleted = true
		}
	}
	return state
}

func skillStreamID(skillID string) string {
	return skillStreamPrefix + skillID
}

func generateSkillID() (string, error) {
	b := make([]byte, 2)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate skill ID: %w", err)
	}
	return "skill-" + hex.EncodeToString(b), nil
}

func readAndRebuildSkillState(ctx context.Context, skillID string, store core.EventStore) (SkillState, []core.Event, error) {
	streamID := skillStreamID(skillID)
	events, err := store.ReadStream(ctx, AdminRealmID, streamID, 0)
	if err != nil {
		return SkillState{}, nil, err
	}
	state := RebuildSkillState(events)
	return state, events, nil
}

func requireExistingSkill(state SkillState, skillID string) error {
	if !state.Exists {
		return &core.NotFoundError{Entity: "skill", ID: skillID}
	}
	if state.Deleted {
		return fmt.Errorf("skill %q is deleted", skillID)
	}
	return nil
}

func HandleCreateSkill(ctx context.Context, cmd CreateSkill, store core.EventStore) (CreateSkillResult, error) {
	skillID, err := generateSkillID()
	if err != nil {
		return CreateSkillResult{}, err
	}

	created := SkillCreated{
		SkillID: skillID,
		Name:    cmd.Name,
		Content: cmd.Content,
	}

	streamID := skillStreamID(skillID)
	_, err = store.Append(ctx, AdminRealmID, streamID, 0, []core.EventData{
		{EventType: EventSkillCreated, Data: created},
	})
	if err != nil {
		return CreateSkillResult{}, err
	}

	return CreateSkillResult{
		SkillID: skillID,
	}, nil
}

func HandleUpdateSkill(ctx context.Context, cmd UpdateSkill, store core.EventStore) error {
	state, events, err := readAndRebuildSkillState(ctx, cmd.SkillID, store)
	if err != nil {
		return err
	}
	if err := requireExistingSkill(state, cmd.SkillID); err != nil {
		return err
	}

	updated := SkillUpdated(cmd)

	streamID := skillStreamID(cmd.SkillID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventSkillUpdated, Data: updated},
	})
	return err
}

func HandleDeleteSkill(ctx context.Context, cmd DeleteSkill, store core.EventStore) error {
	state, events, err := readAndRebuildSkillState(ctx, cmd.SkillID, store)
	if err != nil {
		return err
	}
	if !state.Exists {
		return &core.NotFoundError{Entity: "skill", ID: cmd.SkillID}
	}
	// Idempotent: already deleted
	if state.Deleted {
		return nil
	}

	deleted := SkillDeleted(cmd)

	streamID := skillStreamID(cmd.SkillID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventSkillDeleted, Data: deleted},
	})
	return err
}
