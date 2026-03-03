package projectors

import (
	"context"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestAgentDetailProjector(t *testing.T) {
	t.Run("Name returns agent_detail", func(t *testing.T) {
		tc := newAgentDetailTestContext(t)

		// Given
		tc.an_agent_detail_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("agent_detail")
	})

	t.Run("handles AgentCreated by putting entry with name", func(t *testing.T) {
		tc := newAgentDetailTestContext(t)

		// Given
		tc.an_agent_detail_projector()
		tc.a_projection_store()
		tc.an_agent_created_event("agent-1", "TestAgent")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.agent_entry_exists("agent-1")
		tc.agent_entry_has_name("agent-1", "TestAgent")
		tc.agent_entry_has_empty_main_workflow_id("agent-1")
		tc.agent_entry_has_empty_skills("agent-1")
		tc.agent_entry_has_empty_workflows("agent-1")
		tc.agent_entry_has_empty_realms("agent-1")
	})

	t.Run("handles AgentUpdated with name change", func(t *testing.T) {
		tc := newAgentDetailTestContext(t)

		// Given
		tc.an_agent_detail_projector()
		tc.a_projection_store()
		tc.existing_agent_entry("agent-1", "OldName")
		tc.an_agent_updated_event_with_name("agent-1", "NewName")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.agent_entry_has_name("agent-1", "NewName")
	})

	t.Run("handles AgentUpdated with main_workflow_id change", func(t *testing.T) {
		tc := newAgentDetailTestContext(t)

		// Given
		tc.an_agent_detail_projector()
		tc.a_projection_store()
		tc.existing_agent_entry("agent-1", "TestAgent")
		tc.an_agent_updated_event_with_main_workflow_id("agent-1", "workflow-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.agent_entry_has_main_workflow_id("agent-1", "workflow-1")
	})

	t.Run("handles AgentRealmGranted by appending realm to list", func(t *testing.T) {
		tc := newAgentDetailTestContext(t)

		// Given
		tc.an_agent_detail_projector()
		tc.a_projection_store()
		tc.existing_agent_entry("agent-1", "TestAgent")
		tc.an_agent_realm_granted_event("agent-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.agent_entry_has_realms("agent-1", []string{"realm-1"})
	})

	t.Run("handles AgentRealmRevoked by removing realm from list", func(t *testing.T) {
		tc := newAgentDetailTestContext(t)

		// Given
		tc.an_agent_detail_projector()
		tc.a_projection_store()
		tc.existing_agent_entry_with_realms("agent-1", "TestAgent", []string{"realm-1", "realm-2"})
		tc.an_agent_realm_revoked_event("agent-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.agent_entry_has_realms("agent-1", []string{"realm-2"})
	})

	t.Run("handles AgentSkillAdded by appending skill to list", func(t *testing.T) {
		tc := newAgentDetailTestContext(t)

		// Given
		tc.an_agent_detail_projector()
		tc.a_projection_store()
		tc.existing_agent_entry("agent-1", "TestAgent")
		tc.an_agent_skill_added_event("agent-1", "skill-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.agent_entry_has_skills("agent-1", []string{"skill-1"})
	})

	t.Run("handles AgentWorkflowAdded by appending workflow to list", func(t *testing.T) {
		tc := newAgentDetailTestContext(t)

		// Given
		tc.an_agent_detail_projector()
		tc.a_projection_store()
		tc.existing_agent_entry("agent-1", "TestAgent")
		tc.an_agent_workflow_added_event("agent-1", "workflow-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.agent_entry_has_workflows("agent-1", []string{"workflow-1"})
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newAgentDetailTestContext(t)

		// Given
		tc.an_agent_detail_projector()
		tc.a_projection_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("AgentRealmGranted is idempotent for duplicate realm", func(t *testing.T) {
		tc := newAgentDetailTestContext(t)

		// Given
		tc.an_agent_detail_projector()
		tc.a_projection_store()
		tc.existing_agent_entry_with_realms("agent-1", "TestAgent", []string{"realm-1"})
		tc.an_agent_realm_granted_event("agent-1", "realm-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.agent_entry_has_realms("agent-1", []string{"realm-1"})
	})

	t.Run("AgentSkillAdded is idempotent for duplicate skill", func(t *testing.T) {
		tc := newAgentDetailTestContext(t)

		// Given
		tc.an_agent_detail_projector()
		tc.a_projection_store()
		tc.existing_agent_entry_with_skills("agent-1", "TestAgent", []string{"skill-1"})
		tc.an_agent_skill_added_event("agent-1", "skill-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.agent_entry_has_skills("agent-1", []string{"skill-1"})
	})

	t.Run("AgentWorkflowAdded is idempotent for duplicate workflow", func(t *testing.T) {
		tc := newAgentDetailTestContext(t)

		// Given
		tc.an_agent_detail_projector()
		tc.a_projection_store()
		tc.existing_agent_entry_with_workflows("agent-1", "TestAgent", []string{"workflow-1"})
		tc.an_agent_workflow_added_event("agent-1", "workflow-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.agent_entry_has_workflows("agent-1", []string{"workflow-1"})
	})
}

// --- Test Context ---

type agentDetailTestContext struct {
	t *testing.T

	projector  *AgentDetailProjector
	store      *mockProjectionStore
	event      core.Event
	ctx        context.Context
	nameResult string
	err        error
}

func newAgentDetailTestContext(t *testing.T) *agentDetailTestContext {
	t.Helper()
	return &agentDetailTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *agentDetailTestContext) an_agent_detail_projector() {
	tc.t.Helper()
	tc.projector = NewAgentDetailProjector()
}

func (tc *agentDetailTestContext) a_projection_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *agentDetailTestContext) an_agent_created_event(agentID, name string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAgentCreated, domain.AgentCreated{
		AgentID: agentID,
		Name:    name,
	})
}

func (tc *agentDetailTestContext) an_agent_updated_event_with_name(agentID, name string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAgentUpdated, domain.AgentUpdated{
		AgentID: agentID,
		Name:    strPtr(name),
	})
}

func (tc *agentDetailTestContext) an_agent_updated_event_with_main_workflow_id(agentID, workflowID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAgentUpdated, domain.AgentUpdated{
		AgentID:        agentID,
		MainWorkflowID: strPtr(workflowID),
	})
}

func (tc *agentDetailTestContext) an_agent_realm_granted_event(agentID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAgentRealmGranted, domain.AgentRealmGranted{
		AgentID: agentID,
		RealmID: realmID,
	})
}

func (tc *agentDetailTestContext) an_agent_realm_revoked_event(agentID, realmID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAgentRealmRevoked, domain.AgentRealmRevoked{
		AgentID: agentID,
		RealmID: realmID,
	})
}

func (tc *agentDetailTestContext) an_agent_skill_added_event(agentID, skillID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAgentSkillAdded, domain.AgentSkillAdded{
		AgentID: agentID,
		SkillID: skillID,
	})
}

func (tc *agentDetailTestContext) an_agent_workflow_added_event(agentID, workflowID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventAgentWorkflowAdded, domain.AgentWorkflowAdded{
		AgentID:    agentID,
		WorkflowID: workflowID,
	})
}

func (tc *agentDetailTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *agentDetailTestContext) existing_agent_entry(agentID, name string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := AgentDetailEntry{
		ID:           agentID,
		Name:         name,
		MainWorkflowID: "",
		Skills:       []string{},
		Workflows:    []string{},
		Realms:       []string{},
	}
	tc.store.put("realm-1", "agent_detail", agentID, entry)
}

func (tc *agentDetailTestContext) existing_agent_entry_with_realms(agentID, name string, realms []string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := AgentDetailEntry{
		ID:           agentID,
		Name:         name,
		MainWorkflowID: "",
		Skills:       []string{},
		Workflows:    []string{},
		Realms:       realms,
	}
	tc.store.put("realm-1", "agent_detail", agentID, entry)
}

func (tc *agentDetailTestContext) existing_agent_entry_with_skills(agentID, name string, skills []string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := AgentDetailEntry{
		ID:           agentID,
		Name:         name,
		MainWorkflowID: "",
		Skills:       skills,
		Workflows:    []string{},
		Realms:       []string{},
	}
	tc.store.put("realm-1", "agent_detail", agentID, entry)
}

func (tc *agentDetailTestContext) existing_agent_entry_with_workflows(agentID, name string, workflows []string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := AgentDetailEntry{
		ID:           agentID,
		Name:         name,
		MainWorkflowID: "",
		Skills:       []string{},
		Workflows:    workflows,
		Realms:       []string{},
	}
	tc.store.put("realm-1", "agent_detail", agentID, entry)
}

// --- When ---

func (tc *agentDetailTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *agentDetailTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *agentDetailTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *agentDetailTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *agentDetailTestContext) agent_entry_exists(agentID string) {
	tc.t.Helper()
	var entry AgentDetailEntry
	err := tc.store.Get(tc.ctx, "realm-1", "agent_detail", agentID, &entry)
	require.NoError(tc.t, err, "expected agent detail entry for %s", agentID)
}

func (tc *agentDetailTestContext) agent_entry_has_name(agentID, expected string) {
	tc.t.Helper()
	var entry AgentDetailEntry
	err := tc.store.Get(tc.ctx, "realm-1", "agent_detail", agentID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Name)
}

func (tc *agentDetailTestContext) agent_entry_has_main_workflow_id(agentID, expected string) {
	tc.t.Helper()
	var entry AgentDetailEntry
	err := tc.store.Get(tc.ctx, "realm-1", "agent_detail", agentID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.MainWorkflowID)
}

func (tc *agentDetailTestContext) agent_entry_has_empty_main_workflow_id(agentID string) {
	tc.t.Helper()
	var entry AgentDetailEntry
	err := tc.store.Get(tc.ctx, "realm-1", "agent_detail", agentID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, "", entry.MainWorkflowID)
}

func (tc *agentDetailTestContext) agent_entry_has_skills(agentID string, expected []string) {
	tc.t.Helper()
	var entry AgentDetailEntry
	err := tc.store.Get(tc.ctx, "realm-1", "agent_detail", agentID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Skills)
}

func (tc *agentDetailTestContext) agent_entry_has_empty_skills(agentID string) {
	tc.t.Helper()
	var entry AgentDetailEntry
	err := tc.store.Get(tc.ctx, "realm-1", "agent_detail", agentID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, []string{}, entry.Skills)
}

func (tc *agentDetailTestContext) agent_entry_has_workflows(agentID string, expected []string) {
	tc.t.Helper()
	var entry AgentDetailEntry
	err := tc.store.Get(tc.ctx, "realm-1", "agent_detail", agentID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Workflows)
}

func (tc *agentDetailTestContext) agent_entry_has_empty_workflows(agentID string) {
	tc.t.Helper()
	var entry AgentDetailEntry
	err := tc.store.Get(tc.ctx, "realm-1", "agent_detail", agentID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, []string{}, entry.Workflows)
}

func (tc *agentDetailTestContext) agent_entry_has_realms(agentID string, expected []string) {
	tc.t.Helper()
	var entry AgentDetailEntry
	err := tc.store.Get(tc.ctx, "realm-1", "agent_detail", agentID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Realms)
}

func (tc *agentDetailTestContext) agent_entry_has_empty_realms(agentID string) {
	tc.t.Helper()
	var entry AgentDetailEntry
	err := tc.store.Get(tc.ctx, "realm-1", "agent_detail", agentID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, []string{}, entry.Realms)
}
