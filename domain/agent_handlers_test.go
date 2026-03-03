package domain

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestRebuildAgentState(t *testing.T) {
	t.Run("returns empty state for no events", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)

		// Given
		tc.no_agent_events()

		// When
		tc.agent_state_is_rebuilt()

		// Then
		tc.agent_state_does_not_exist()
	})

	t.Run("rebuilds state from AgentCreated event", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)

		// Given
		tc.events_from_created_agent()

		// When
		tc.agent_state_is_rebuilt()

		// Then
		tc.agent_state_exists()
		tc.agent_state_has_id("agent-a1b2")
		tc.agent_state_has_name("test-agent")
	})

	t.Run("applies AgentUpdated", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)

		// Given
		tc.events_from_created_and_updated_agent()

		// When
		tc.agent_state_is_rebuilt()

		// Then
		tc.agent_state_has_name("updated-agent")
		tc.agent_state_has_main_workflow_id("wf-123")
	})

	t.Run("applies AgentRealmGranted", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)

		// Given
		tc.events_from_created_agent_with_realm_granted()

		// When
		tc.agent_state_is_rebuilt()

		// Then
		tc.agent_state_has_realm("bf-realm1")
	})

	t.Run("applies AgentRealmRevoked", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)

		// Given
		tc.events_from_created_agent_with_realm_granted_and_revoked()

		// When
		tc.agent_state_is_rebuilt()

		// Then
		tc.agent_state_does_not_have_realm("bf-realm1")
	})

	t.Run("applies AgentSkillAdded", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)

		// Given
		tc.events_from_created_agent_with_skill_added()

		// When
		tc.agent_state_is_rebuilt()

		// Then
		tc.agent_state_has_skill("skill-123")
	})

	t.Run("applies AgentWorkflowAdded", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)

		// Given
		tc.events_from_created_agent_with_workflow_added()

		// When
		tc.agent_state_is_rebuilt()

		// Then
		tc.agent_state_has_workflow("wf-123")
	})
}

func TestHandleCreateAgent(t *testing.T) {
	t.Run("creates agent with valid data", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)

		// Given
		tc.create_agent_command("test-agent")

		// When
		tc.create_agent_is_handled()

		// Then
		tc.agent_is_created()
		tc.result_has_agent_id()
		tc.event_is_appended()
	})

	t.Run("generates unique agent id", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)

		// Given
		tc.create_agent_command("test-agent")

		// When
		tc.create_agent_is_handled()

		// Then
		tc.agent_id_has_prefix("agent-")
	})
}

func TestHandleUpdateAgent(t *testing.T) {
	t.Run("updates existing agent", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)
		tc.given_agent_exists("agent-a1b2", "original-name")

		// Given
		tc.update_agent_command("agent-a1b2", "updated-name", "wf-999")

		// When
		tc.update_agent_is_handled()

		// Then
		tc.agent_updated_event_is_appended()
	})

	t.Run("returns error for non-existent agent", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)

		// Given
		tc.update_agent_command("agent-nonexistent", "updated-name", "")

		// When
		tc.update_agent_is_handled()

		// Then
		tc.not_found_error_is_returned()
	})
}

func TestHandleGrantAgentRealm(t *testing.T) {
	t.Run("grants realm to agent", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)
		tc.given_agent_exists("agent-a1b2", "test-agent")

		// Given
		tc.grant_agent_realm_command("agent-a1b2", "bf-realm1")

		// When
		tc.grant_agent_realm_is_handled()

		// Then
		tc.agent_realm_granted_event_is_appended()
	})

	t.Run("is idempotent for already granted realm", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)
		tc.given_agent_exists_with_realm("agent-a1b2", "test-agent", "bf-realm1")

		// Given
		tc.grant_agent_realm_command("agent-a1b2", "bf-realm1")

		// When
		tc.grant_agent_realm_is_handled()

		// Then
		tc.no_event_is_appended()
	})

	t.Run("returns error for non-existent agent", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)

		// Given
		tc.grant_agent_realm_command("agent-nonexistent", "bf-realm1")

		// When
		tc.grant_agent_realm_is_handled()

		// Then
		tc.not_found_error_is_returned()
	})
}

func TestHandleRevokeAgentRealm(t *testing.T) {
	t.Run("revokes realm from agent", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)
		tc.given_agent_exists_with_realm("agent-a1b2", "test-agent", "bf-realm1")

		// Given
		tc.revoke_agent_realm_command("agent-a1b2", "bf-realm1")

		// When
		tc.revoke_agent_realm_is_handled()

		// Then
		tc.agent_realm_revoked_event_is_appended()
	})

	t.Run("returns error if realm not granted", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)
		tc.given_agent_exists("agent-a1b2", "test-agent")

		// Given
		tc.revoke_agent_realm_command("agent-a1b2", "bf-realm1")

		// When
		tc.revoke_agent_realm_is_handled()

		// Then
		tc.realm_not_granted_error_is_returned()
	})

	t.Run("returns error for non-existent agent", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)

		// Given
		tc.revoke_agent_realm_command("agent-nonexistent", "bf-realm1")

		// When
		tc.revoke_agent_realm_is_handled()

		// Then
		tc.not_found_error_is_returned()
	})
}

func TestHandleAddAgentSkill(t *testing.T) {
	t.Run("adds skill to agent", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)
		tc.given_agent_exists("agent-a1b2", "test-agent")

		// Given
		tc.add_agent_skill_command("agent-a1b2", "skill-123")

		// When
		tc.add_agent_skill_is_handled()

		// Then
		tc.agent_skill_added_event_is_appended()
	})

	t.Run("is idempotent for already added skill", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)
		tc.given_agent_exists_with_skill("agent-a1b2", "test-agent", "skill-123")

		// Given
		tc.add_agent_skill_command("agent-a1b2", "skill-123")

		// When
		tc.add_agent_skill_is_handled()

		// Then
		tc.no_event_is_appended()
	})

	t.Run("returns error for non-existent agent", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)

		// Given
		tc.add_agent_skill_command("agent-nonexistent", "skill-123")

		// When
		tc.add_agent_skill_is_handled()

		// Then
		tc.not_found_error_is_returned()
	})
}

func TestHandleAddAgentWorkflow(t *testing.T) {
	t.Run("adds workflow to agent", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)
		tc.given_agent_exists("agent-a1b2", "test-agent")

		// Given
		tc.add_agent_workflow_command("agent-a1b2", "wf-123")

		// When
		tc.add_agent_workflow_is_handled()

		// Then
		tc.agent_workflow_added_event_is_appended()
	})

	t.Run("is idempotent for already added workflow", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)
		tc.given_agent_exists_with_workflow("agent-a1b2", "test-agent", "wf-123")

		// Given
		tc.add_agent_workflow_command("agent-a1b2", "wf-123")

		// When
		tc.add_agent_workflow_is_handled()

		// Then
		tc.no_event_is_appended()
	})

	t.Run("returns error for non-existent agent", func(t *testing.T) {
		tc := newAgentHandlerTestContext(t)

		// Given
		tc.add_agent_workflow_command("agent-nonexistent", "wf-123")

		// When
		tc.add_agent_workflow_is_handled()

		// Then
		tc.not_found_error_is_returned()
	})
}

// --- Test Context ---

type agentHandlerTestContext struct {
	t      *testing.T
	events []core.Event
	state  AgentState
	result CreateAgentResult
	err    error

	cmd CreateAgent
	upd UpdateAgent
	grant GrantAgentRealm
	revoke RevokeAgentRealm
	addSkill AddAgentSkill
	addWorkflow AddAgentWorkflow

	mockStore *mockAgentEventStore
}

func newAgentHandlerTestContext(t *testing.T) *agentHandlerTestContext {
	t.Helper()
	return &agentHandlerTestContext{
		t:         t,
		mockStore: newMockAgentEventStore(),
	}
}

// --- Given ---

func (tc *agentHandlerTestContext) no_agent_events() {
	tc.t.Helper()
	tc.events = nil
}

func (tc *agentHandlerTestContext) events_from_created_agent() {
	tc.t.Helper()
	created := AgentCreated{
		AgentID: "agent-a1b2",
		Name:    "test-agent",
	}
	data, _ := json.Marshal(created)
	tc.events = []core.Event{
		{EventType: EventAgentCreated, Data: data},
	}
}

func (tc *agentHandlerTestContext) events_from_created_and_updated_agent() {
	tc.t.Helper()
	created := AgentCreated{
		AgentID: "agent-a1b2",
		Name:    "test-agent",
	}
	createdData, _ := json.Marshal(created)
	
	name := "updated-agent"
	workflowID := "wf-123"
	updated := AgentUpdated{
		AgentID:        "agent-a1b2",
		Name:           &name,
		MainWorkflowID: &workflowID,
	}
	updatedData, _ := json.Marshal(updated)
	
	tc.events = []core.Event{
		{EventType: EventAgentCreated, Data: createdData},
		{EventType: EventAgentUpdated, Data: updatedData},
	}
}

func (tc *agentHandlerTestContext) events_from_created_agent_with_realm_granted() {
	tc.t.Helper()
	created := AgentCreated{
		AgentID: "agent-a1b2",
		Name:    "test-agent",
	}
	createdData, _ := json.Marshal(created)
	
	granted := AgentRealmGranted{
		AgentID: "agent-a1b2",
		RealmID: "bf-realm1",
	}
	grantedData, _ := json.Marshal(granted)
	
	tc.events = []core.Event{
		{EventType: EventAgentCreated, Data: createdData},
		{EventType: EventAgentRealmGranted, Data: grantedData},
	}
}

func (tc *agentHandlerTestContext) events_from_created_agent_with_realm_granted_and_revoked() {
	tc.t.Helper()
	created := AgentCreated{
		AgentID: "agent-a1b2",
		Name:    "test-agent",
	}
	createdData, _ := json.Marshal(created)
	
	granted := AgentRealmGranted{
		AgentID: "agent-a1b2",
		RealmID: "bf-realm1",
	}
	grantedData, _ := json.Marshal(granted)
	
	revoked := AgentRealmRevoked{
		AgentID: "agent-a1b2",
		RealmID: "bf-realm1",
	}
	revokedData, _ := json.Marshal(revoked)
	
	tc.events = []core.Event{
		{EventType: EventAgentCreated, Data: createdData},
		{EventType: EventAgentRealmGranted, Data: grantedData},
		{EventType: EventAgentRealmRevoked, Data: revokedData},
	}
}

func (tc *agentHandlerTestContext) events_from_created_agent_with_skill_added() {
	tc.t.Helper()
	created := AgentCreated{
		AgentID: "agent-a1b2",
		Name:    "test-agent",
	}
	createdData, _ := json.Marshal(created)
	
	added := AgentSkillAdded{
		AgentID: "agent-a1b2",
		SkillID: "skill-123",
	}
	addedData, _ := json.Marshal(added)
	
	tc.events = []core.Event{
		{EventType: EventAgentCreated, Data: createdData},
		{EventType: EventAgentSkillAdded, Data: addedData},
	}
}

func (tc *agentHandlerTestContext) events_from_created_agent_with_workflow_added() {
	tc.t.Helper()
	created := AgentCreated{
		AgentID: "agent-a1b2",
		Name:    "test-agent",
	}
	createdData, _ := json.Marshal(created)
	
	added := AgentWorkflowAdded{
		AgentID:    "agent-a1b2",
		WorkflowID: "wf-123",
	}
	addedData, _ := json.Marshal(added)
	
	tc.events = []core.Event{
		{EventType: EventAgentCreated, Data: createdData},
		{EventType: EventAgentWorkflowAdded, Data: addedData},
	}
}

func (tc *agentHandlerTestContext) create_agent_command(name string) {
	tc.t.Helper()
	tc.cmd = CreateAgent{Name: name}
}

func (tc *agentHandlerTestContext) update_agent_command(agentID, name, mainWorkflowID string) {
	tc.t.Helper()
	tc.upd = UpdateAgent{
		AgentID: agentID,
	}
	if name != "" {
		tc.upd.Name = &name
	}
	if mainWorkflowID != "" {
		tc.upd.MainWorkflowID = &mainWorkflowID
	}
}

func (tc *agentHandlerTestContext) grant_agent_realm_command(agentID, realmID string) {
	tc.t.Helper()
	tc.grant = GrantAgentRealm{
		AgentID: agentID,
		RealmID: realmID,
	}
}

func (tc *agentHandlerTestContext) revoke_agent_realm_command(agentID, realmID string) {
	tc.t.Helper()
	tc.revoke = RevokeAgentRealm{
		AgentID: agentID,
		RealmID: realmID,
	}
}

func (tc *agentHandlerTestContext) add_agent_skill_command(agentID, skillID string) {
	tc.t.Helper()
	tc.addSkill = AddAgentSkill{
		AgentID: agentID,
		SkillID: skillID,
	}
}

func (tc *agentHandlerTestContext) add_agent_workflow_command(agentID, workflowID string) {
	tc.t.Helper()
	tc.addWorkflow = AddAgentWorkflow{
		AgentID:    agentID,
		WorkflowID: workflowID,
	}
}

func (tc *agentHandlerTestContext) given_agent_exists(agentID, name string) {
	tc.t.Helper()
	created := AgentCreated{
		AgentID: agentID,
		Name:    name,
	}
	createdData, _ := json.Marshal(created)
	tc.mockStore.events = []core.Event{
		{EventType: EventAgentCreated, Data: createdData},
	}
}

func (tc *agentHandlerTestContext) given_agent_exists_with_realm(agentID, name, realmID string) {
	tc.t.Helper()
	created := AgentCreated{
		AgentID: agentID,
		Name:    name,
	}
	createdData, _ := json.Marshal(created)
	
	granted := AgentRealmGranted{
		AgentID: agentID,
		RealmID: realmID,
	}
	grantedData, _ := json.Marshal(granted)
	
	tc.mockStore.events = []core.Event{
		{EventType: EventAgentCreated, Data: createdData},
		{EventType: EventAgentRealmGranted, Data: grantedData},
	}
}

func (tc *agentHandlerTestContext) given_agent_exists_with_skill(agentID, name, skillID string) {
	tc.t.Helper()
	created := AgentCreated{
		AgentID: agentID,
		Name:    name,
	}
	createdData, _ := json.Marshal(created)
	
	added := AgentSkillAdded{
		AgentID: agentID,
		SkillID: skillID,
	}
	addedData, _ := json.Marshal(added)
	
	tc.mockStore.events = []core.Event{
		{EventType: EventAgentCreated, Data: createdData},
		{EventType: EventAgentSkillAdded, Data: addedData},
	}
}

func (tc *agentHandlerTestContext) given_agent_exists_with_workflow(agentID, name, workflowID string) {
	tc.t.Helper()
	created := AgentCreated{
		AgentID: agentID,
		Name:    name,
	}
	createdData, _ := json.Marshal(created)
	
	added := AgentWorkflowAdded{
		AgentID:    agentID,
		WorkflowID: workflowID,
	}
	addedData, _ := json.Marshal(added)
	
	tc.mockStore.events = []core.Event{
		{EventType: EventAgentCreated, Data: createdData},
		{EventType: EventAgentWorkflowAdded, Data: addedData},
	}
}

// --- When ---

func (tc *agentHandlerTestContext) agent_state_is_rebuilt() {
	tc.t.Helper()
	tc.state = RebuildAgentState(tc.events)
}

func (tc *agentHandlerTestContext) create_agent_is_handled() {
	tc.t.Helper()
	tc.result, tc.err = HandleCreateAgent(context.Background(), tc.cmd, tc.mockStore)
}

func (tc *agentHandlerTestContext) update_agent_is_handled() {
	tc.t.Helper()
	tc.err = HandleUpdateAgent(context.Background(), tc.upd, tc.mockStore)
}

func (tc *agentHandlerTestContext) grant_agent_realm_is_handled() {
	tc.t.Helper()
	tc.err = HandleGrantAgentRealm(context.Background(), tc.grant, tc.mockStore)
}

func (tc *agentHandlerTestContext) revoke_agent_realm_is_handled() {
	tc.t.Helper()
	tc.err = HandleRevokeAgentRealm(context.Background(), tc.revoke, tc.mockStore)
}

func (tc *agentHandlerTestContext) add_agent_skill_is_handled() {
	tc.t.Helper()
	tc.err = HandleAddAgentSkill(context.Background(), tc.addSkill, tc.mockStore)
}

func (tc *agentHandlerTestContext) add_agent_workflow_is_handled() {
	tc.t.Helper()
	tc.err = HandleAddAgentWorkflow(context.Background(), tc.addWorkflow, tc.mockStore)
}

// --- Then ---

func (tc *agentHandlerTestContext) agent_state_does_not_exist() {
	tc.t.Helper()
	assert.False(tc.t, tc.state.Exists)
}

func (tc *agentHandlerTestContext) agent_state_exists() {
	tc.t.Helper()
	assert.True(tc.t, tc.state.Exists)
}

func (tc *agentHandlerTestContext) agent_state_has_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.AgentID)
}

func (tc *agentHandlerTestContext) agent_state_has_name(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.Name)
}

func (tc *agentHandlerTestContext) agent_state_has_main_workflow_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.MainWorkflowID)
}

func (tc *agentHandlerTestContext) agent_state_has_realm(realmID string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.state.Realms, realmID)
}

func (tc *agentHandlerTestContext) agent_state_does_not_have_realm(realmID string) {
	tc.t.Helper()
	assert.NotContains(tc.t, tc.state.Realms, realmID)
}

func (tc *agentHandlerTestContext) agent_state_has_skill(skillID string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.state.Skills, skillID)
}

func (tc *agentHandlerTestContext) agent_state_has_workflow(workflowID string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.state.Workflows, workflowID)
}

func (tc *agentHandlerTestContext) agent_is_created() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *agentHandlerTestContext) result_has_agent_id() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.NotEmpty(tc.t, tc.result.AgentID)
}

func (tc *agentHandlerTestContext) agent_id_has_prefix(prefix string) {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, len(tc.result.AgentID) > len(prefix))
	assert.Equal(tc.t, prefix, tc.result.AgentID[:len(prefix)])
}

func (tc *agentHandlerTestContext) event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *agentHandlerTestContext) agent_updated_event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *agentHandlerTestContext) agent_realm_granted_event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *agentHandlerTestContext) agent_realm_revoked_event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *agentHandlerTestContext) agent_skill_added_event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *agentHandlerTestContext) agent_workflow_added_event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *agentHandlerTestContext) no_event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.False(tc.t, tc.mockStore.appended)
}

func (tc *agentHandlerTestContext) not_found_error_is_returned() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	var nfe *core.NotFoundError
	require.ErrorAs(tc.t, tc.err, &nfe)
}

func (tc *agentHandlerTestContext) realm_not_granted_error_is_returned() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), "not granted")
}

// --- Mock ---

type mockAgentEventStore struct {
	events   []core.Event
	appended bool
	lastData []core.EventData
}

func newMockAgentEventStore() *mockAgentEventStore {
	return &mockAgentEventStore{
		events: make([]core.Event, 0),
	}
}

func (m *mockAgentEventStore) Append(ctx context.Context, realmID, streamID string, expectedVersion int, events []core.EventData) ([]core.Event, error) {
	m.appended = true
	m.lastData = events
	var result []core.Event
	for _, e := range events {
		data, _ := json.Marshal(e.Data)
		evt := core.Event{EventType: e.EventType, Data: data}
		m.events = append(m.events, evt)
		result = append(result, evt)
	}
	return result, nil
}

func (m *mockAgentEventStore) ReadStream(ctx context.Context, realmID, streamID string, version int) ([]core.Event, error) {
	return m.events, nil
}

func (m *mockAgentEventStore) ReadStreamBackwards(ctx context.Context, realmID, streamID string, count int) ([]core.Event, error) {
	return m.events, nil
}

func (m *mockAgentEventStore) ReadAll(ctx context.Context, realmID string, fromGlobalPosition int64) ([]core.Event, error) {
	return m.events, nil
}

func (m *mockAgentEventStore) ListRealmIDs(ctx context.Context) ([]string, error) {
	return []string{AdminRealmID}, nil
}
