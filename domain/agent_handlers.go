package domain

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/devzeebo/bifrost/core"
)

const agentStreamPrefix = "agent-"

type AgentState struct {
	AgentID        string
	Name           string
	MainWorkflowID string
	Exists         bool
	Realms         map[string]bool
	Skills         map[string]bool
	Workflows      map[string]bool
}

func RebuildAgentState(events []core.Event) AgentState {
	var state AgentState
	state.Realms = make(map[string]bool)
	state.Skills = make(map[string]bool)
	state.Workflows = make(map[string]bool)

	for _, evt := range events {
		switch evt.EventType {
		case EventAgentCreated:
			var data AgentCreated
			_ = json.Unmarshal(evt.Data, &data)
			state.Exists = true
			state.AgentID = data.AgentID
			state.Name = data.Name
		case EventAgentUpdated:
			var data AgentUpdated
			_ = json.Unmarshal(evt.Data, &data)
			if data.Name != nil {
				state.Name = *data.Name
			}
			if data.MainWorkflowID != nil {
				state.MainWorkflowID = *data.MainWorkflowID
			}
		case EventAgentRealmGranted:
			var data AgentRealmGranted
			_ = json.Unmarshal(evt.Data, &data)
			state.Realms[data.RealmID] = true
		case EventAgentRealmRevoked:
			var data AgentRealmRevoked
			_ = json.Unmarshal(evt.Data, &data)
			delete(state.Realms, data.RealmID)
		case EventAgentSkillAdded:
			var data AgentSkillAdded
			_ = json.Unmarshal(evt.Data, &data)
			state.Skills[data.SkillID] = true
		case EventAgentWorkflowAdded:
			var data AgentWorkflowAdded
			_ = json.Unmarshal(evt.Data, &data)
			state.Workflows[data.WorkflowID] = true
		}
	}
	return state
}

func agentStreamID(agentID string) string {
	return agentStreamPrefix + agentID
}

func generateAgentID() (string, error) {
	b := make([]byte, 2)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate agent ID: %w", err)
	}
	return "agent-" + hex.EncodeToString(b), nil
}

func readAndRebuildAgentState(ctx context.Context, agentID string, store core.EventStore) (AgentState, []core.Event, error) {
	streamID := agentStreamID(agentID)
	events, err := store.ReadStream(ctx, AdminRealmID, streamID, 0)
	if err != nil {
		return AgentState{}, nil, err
	}
	state := RebuildAgentState(events)
	return state, events, nil
}

func requireExistingAgent(state AgentState, agentID string) error {
	if !state.Exists {
		return &core.NotFoundError{Entity: "agent", ID: agentID}
	}
	return nil
}

func HandleCreateAgent(ctx context.Context, cmd CreateAgent, store core.EventStore) (CreateAgentResult, error) {
	agentID, err := generateAgentID()
	if err != nil {
		return CreateAgentResult{}, err
	}

	created := AgentCreated{
		AgentID: agentID,
		Name:    cmd.Name,
	}

	streamID := agentStreamID(agentID)
	_, err = store.Append(ctx, AdminRealmID, streamID, 0, []core.EventData{
		{EventType: EventAgentCreated, Data: created},
	})
	if err != nil {
		return CreateAgentResult{}, err
	}

	return CreateAgentResult{
		AgentID: agentID,
	}, nil
}

func HandleUpdateAgent(ctx context.Context, cmd UpdateAgent, store core.EventStore) error {
	state, events, err := readAndRebuildAgentState(ctx, cmd.AgentID, store)
	if err != nil {
		return err
	}
	if err := requireExistingAgent(state, cmd.AgentID); err != nil {
		return err
	}

	updated := AgentUpdated(cmd)

	streamID := agentStreamID(cmd.AgentID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventAgentUpdated, Data: updated},
	})
	return err
}

func HandleGrantAgentRealm(ctx context.Context, cmd GrantAgentRealm, store core.EventStore) error {
	state, events, err := readAndRebuildAgentState(ctx, cmd.AgentID, store)
	if err != nil {
		return err
	}
	if err := requireExistingAgent(state, cmd.AgentID); err != nil {
		return err
	}

	// Idempotent: if already granted, return nil
	if state.Realms[cmd.RealmID] {
		return nil
	}

	granted := AgentRealmGranted(cmd)

	streamID := agentStreamID(cmd.AgentID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventAgentRealmGranted, Data: granted},
	})
	return err
}

func HandleRevokeAgentRealm(ctx context.Context, cmd RevokeAgentRealm, store core.EventStore) error {
	state, events, err := readAndRebuildAgentState(ctx, cmd.AgentID, store)
	if err != nil {
		return err
	}
	if err := requireExistingAgent(state, cmd.AgentID); err != nil {
		return err
	}

	if !state.Realms[cmd.RealmID] {
		return fmt.Errorf("realm %q is not granted to agent %q", cmd.RealmID, cmd.AgentID)
	}

	revoked := AgentRealmRevoked(cmd)

	streamID := agentStreamID(cmd.AgentID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventAgentRealmRevoked, Data: revoked},
	})
	return err
}

func HandleAddAgentSkill(ctx context.Context, cmd AddAgentSkill, store core.EventStore) error {
	state, events, err := readAndRebuildAgentState(ctx, cmd.AgentID, store)
	if err != nil {
		return err
	}
	if err := requireExistingAgent(state, cmd.AgentID); err != nil {
		return err
	}

	// Idempotent: if already added, return nil
	if state.Skills[cmd.SkillID] {
		return nil
	}

	added := AgentSkillAdded(cmd)

	streamID := agentStreamID(cmd.AgentID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventAgentSkillAdded, Data: added},
	})
	return err
}

func HandleAddAgentWorkflow(ctx context.Context, cmd AddAgentWorkflow, store core.EventStore) error {
	state, events, err := readAndRebuildAgentState(ctx, cmd.AgentID, store)
	if err != nil {
		return err
	}
	if err := requireExistingAgent(state, cmd.AgentID); err != nil {
		return err
	}

	// Idempotent: if already added, return nil
	if state.Workflows[cmd.WorkflowID] {
		return nil
	}

	added := AgentWorkflowAdded(cmd)

	streamID := agentStreamID(cmd.AgentID)
	_, err = store.Append(ctx, AdminRealmID, streamID, len(events), []core.EventData{
		{EventType: EventAgentWorkflowAdded, Data: added},
	})
	return err
}
