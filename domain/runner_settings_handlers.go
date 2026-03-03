package domain

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/devzeebo/bifrost/core"
)

const runnerSettingsStreamPrefix = "rs-"

type RunnerSettingsState struct {
	RunnerSettingsID string
	RunnerType       string
	Name             string
	Fields           map[string]string
	Exists           bool
	Deleted          bool
}

func RebuildRunnerSettingsState(events []core.Event) RunnerSettingsState {
	var state RunnerSettingsState
	state.Fields = make(map[string]string)

	for _, evt := range events {
		switch evt.EventType {
		case EventRunnerSettingsCreated:
			var data RunnerSettingsCreated
			_ = json.Unmarshal(evt.Data, &data)
			state.Exists = true
			state.RunnerSettingsID = data.RunnerSettingsID
			state.RunnerType = data.RunnerType
			state.Name = data.Name
		case EventRunnerSettingsFieldSet:
			var data RunnerSettingsFieldSet
			_ = json.Unmarshal(evt.Data, &data)
			state.Fields[data.Key] = data.Value
		case EventRunnerSettingsFieldDeleted:
			var data RunnerSettingsFieldDeleted
			_ = json.Unmarshal(evt.Data, &data)
			delete(state.Fields, data.Key)
		case EventRunnerSettingsDeleted:
			state.Deleted = true
		}
	}
	return state
}

func runnerSettingsStreamID(runnerSettingsID string) string {
	return runnerSettingsStreamPrefix + runnerSettingsID
}

func generateRunnerSettingsID() (string, error) {
	b := make([]byte, 2)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate runner settings ID: %w", err)
	}
	return "rs-" + hex.EncodeToString(b), nil
}

func readAndRebuildRunnerSettingsState(ctx context.Context, runnerSettingsID string, store core.EventStore) (RunnerSettingsState, []core.Event, error) {
	streamID := runnerSettingsStreamID(runnerSettingsID)
	events, err := store.ReadStream(ctx, AdminRealmID, streamID, 0)
	if err != nil {
		return RunnerSettingsState{}, nil, err
	}
	state := RebuildRunnerSettingsState(events)
	return state, events, nil
}

func requireExistingRunnerSettings(state RunnerSettingsState, runnerSettingsID string) error {
	if !state.Exists {
		return &core.NotFoundError{Entity: "runner_settings", ID: runnerSettingsID}
	}
	if state.Deleted {
		return fmt.Errorf("runner settings %q is deleted", runnerSettingsID)
	}
	return nil
}

func HandleCreateRunnerSettings(ctx context.Context, cmd CreateRunnerSettings, store core.EventStore) (CreateRunnerSettingsResult, error) {
	runnerSettingsID, err := generateRunnerSettingsID()
	if err != nil {
		return CreateRunnerSettingsResult{}, err
	}

	created := RunnerSettingsCreated{
		RunnerSettingsID: runnerSettingsID,
		RunnerType:       cmd.RunnerType,
		Name:             cmd.Name,
	}

	streamID := runnerSettingsStreamID(runnerSettingsID)
	_, err = store.Append(ctx, AdminRealmID, streamID, 0, []core.EventData{
		{EventType: EventRunnerSettingsCreated, Data: created},
	})
	if err != nil {
		return CreateRunnerSettingsResult{}, err
	}

	return CreateRunnerSettingsResult{
		RunnerSettingsID: runnerSettingsID,
	}, nil
}

func HandleSetRunnerSettingsField(ctx context.Context, cmd SetRunnerSettingsField, store core.EventStore) error {
	state, events, err := readAndRebuildRunnerSettingsState(ctx, cmd.RunnerSettingsID, store)
	if err != nil {
		return err
	}
	if err := requireExistingRunnerSettings(state, cmd.RunnerSettingsID); err != nil {
		return err
	}

	fieldSet := RunnerSettingsFieldSet(cmd)

	streamID := runnerSettingsStreamID(cmd.RunnerSettingsID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventRunnerSettingsFieldSet, Data: fieldSet},
	})
	return err
}

func HandleDeleteRunnerSettingsField(ctx context.Context, cmd DeleteRunnerSettingsField, store core.EventStore) error {
	state, events, err := readAndRebuildRunnerSettingsState(ctx, cmd.RunnerSettingsID, store)
	if err != nil {
		return err
	}
	if err := requireExistingRunnerSettings(state, cmd.RunnerSettingsID); err != nil {
		return err
	}

	if _, exists := state.Fields[cmd.Key]; !exists {
		return fmt.Errorf("field %q not found in runner settings %q", cmd.Key, cmd.RunnerSettingsID)
	}

	fieldDeleted := RunnerSettingsFieldDeleted(cmd)

	streamID := runnerSettingsStreamID(cmd.RunnerSettingsID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventRunnerSettingsFieldDeleted, Data: fieldDeleted},
	})
	return err
}

func HandleDeleteRunnerSettings(ctx context.Context, cmd DeleteRunnerSettings, store core.EventStore) error {
	state, events, err := readAndRebuildRunnerSettingsState(ctx, cmd.RunnerSettingsID, store)
	if err != nil {
		return err
	}
	if !state.Exists {
		return &core.NotFoundError{Entity: "runner_settings", ID: cmd.RunnerSettingsID}
	}
	// Idempotent: already deleted
	if state.Deleted {
		return nil
	}

	deleted := RunnerSettingsDeleted(cmd)

	streamID := runnerSettingsStreamID(cmd.RunnerSettingsID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventRunnerSettingsDeleted, Data: deleted},
	})
	return err
}
