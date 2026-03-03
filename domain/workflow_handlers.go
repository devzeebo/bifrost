package domain

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/devzeebo/bifrost/core"
)

const workflowStreamPrefix = "wf-"

type WorkflowState struct {
	WorkflowID string
	Name       string
	Content    string
	Exists     bool
	Deleted    bool
}

func RebuildWorkflowState(events []core.Event) WorkflowState {
	var state WorkflowState

	for _, evt := range events {
		switch evt.EventType {
		case EventWorkflowCreated:
			var data WorkflowCreated
			_ = json.Unmarshal(evt.Data, &data)
			state.Exists = true
			state.WorkflowID = data.WorkflowID
			state.Name = data.Name
			state.Content = data.Content
		case EventWorkflowUpdated:
			var data WorkflowUpdated
			_ = json.Unmarshal(evt.Data, &data)
			if data.Name != nil {
				state.Name = *data.Name
			}
			if data.Content != nil {
				state.Content = *data.Content
			}
		case EventWorkflowDeleted:
			state.Deleted = true
		}
	}
	return state
}

func workflowStreamID(workflowID string) string {
	return workflowStreamPrefix + workflowID
}

func generateWorkflowID() (string, error) {
	b := make([]byte, 2)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate workflow ID: %w", err)
	}
	return "wf-" + hex.EncodeToString(b), nil
}

func readAndRebuildWorkflowState(ctx context.Context, workflowID string, store core.EventStore) (WorkflowState, []core.Event, error) {
	streamID := workflowStreamID(workflowID)
	events, err := store.ReadStream(ctx, AdminRealmID, streamID, 0)
	if err != nil {
		return WorkflowState{}, nil, err
	}
	state := RebuildWorkflowState(events)
	return state, events, nil
}

func requireExistingWorkflow(state WorkflowState, workflowID string) error {
	if !state.Exists {
		return &core.NotFoundError{Entity: "workflow", ID: workflowID}
	}
	if state.Deleted {
		return fmt.Errorf("workflow %q is deleted", workflowID)
	}
	return nil
}

func HandleCreateWorkflow(ctx context.Context, cmd CreateWorkflow, store core.EventStore) (CreateWorkflowResult, error) {
	workflowID, err := generateWorkflowID()
	if err != nil {
		return CreateWorkflowResult{}, err
	}

	created := WorkflowCreated{
		WorkflowID: workflowID,
		Name:       cmd.Name,
		Content:    cmd.Content,
	}

	streamID := workflowStreamID(workflowID)
	_, err = store.Append(ctx, AdminRealmID, streamID, 0, []core.EventData{
		{EventType: EventWorkflowCreated, Data: created},
	})
	if err != nil {
		return CreateWorkflowResult{}, err
	}

	return CreateWorkflowResult{
		WorkflowID: workflowID,
	}, nil
}

func HandleUpdateWorkflow(ctx context.Context, cmd UpdateWorkflow, store core.EventStore) error {
	state, events, err := readAndRebuildWorkflowState(ctx, cmd.WorkflowID, store)
	if err != nil {
		return err
	}
	if err := requireExistingWorkflow(state, cmd.WorkflowID); err != nil {
		return err
	}

	updated := WorkflowUpdated(cmd)

	streamID := workflowStreamID(cmd.WorkflowID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventWorkflowUpdated, Data: updated},
	})
	return err
}

func HandleDeleteWorkflow(ctx context.Context, cmd DeleteWorkflow, store core.EventStore) error {
	state, events, err := readAndRebuildWorkflowState(ctx, cmd.WorkflowID, store)
	if err != nil {
		return err
	}
	if !state.Exists {
		return &core.NotFoundError{Entity: "workflow", ID: cmd.WorkflowID}
	}
	// Idempotent: already deleted
	if state.Deleted {
		return nil
	}

	deleted := WorkflowDeleted(cmd)

	streamID := workflowStreamID(cmd.WorkflowID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventWorkflowDeleted, Data: deleted},
	})
	return err
}
