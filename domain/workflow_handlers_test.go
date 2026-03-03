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

func TestRebuildWorkflowState(t *testing.T) {
	t.Run("returns empty state for no events", func(t *testing.T) {
		tc := newWorkflowHandlerTestContext(t)

		// Given
		tc.no_workflow_events()

		// When
		tc.workflow_state_is_rebuilt()

		// Then
		tc.workflow_state_does_not_exist()
	})

	t.Run("rebuilds state from WorkflowCreated event", func(t *testing.T) {
		tc := newWorkflowHandlerTestContext(t)

		// Given
		tc.events_from_created_workflow()

		// When
		tc.workflow_state_is_rebuilt()

		// Then
		tc.workflow_state_exists()
		tc.workflow_state_has_id("wf-a1b2")
		tc.workflow_state_has_name("test-workflow")
		tc.workflow_state_has_content("# Test Workflow\nSteps here")
	})

	t.Run("applies WorkflowUpdated", func(t *testing.T) {
		tc := newWorkflowHandlerTestContext(t)

		// Given
		tc.events_from_created_and_updated_workflow()

		// When
		tc.workflow_state_is_rebuilt()

		// Then
		tc.workflow_state_has_name("updated-workflow")
		tc.workflow_state_has_content("# Updated Content")
	})

	t.Run("applies WorkflowDeleted", func(t *testing.T) {
		tc := newWorkflowHandlerTestContext(t)

		// Given
		tc.events_from_created_and_deleted_workflow()

		// When
		tc.workflow_state_is_rebuilt()

		// Then
		tc.workflow_state_is_deleted()
	})
}

func TestHandleCreateWorkflow(t *testing.T) {
	t.Run("creates workflow with valid data", func(t *testing.T) {
		tc := newWorkflowHandlerTestContext(t)

		// Given
		tc.create_workflow_command("test-workflow", "# Test Workflow")

		// When
		tc.create_workflow_is_handled()

		// Then
		tc.workflow_is_created()
		tc.result_has_workflow_id()
		tc.event_is_appended()
	})

	t.Run("generates unique workflow id", func(t *testing.T) {
		tc := newWorkflowHandlerTestContext(t)

		// Given
		tc.create_workflow_command("test-workflow", "# Test Workflow")

		// When
		tc.create_workflow_is_handled()

		// Then
		tc.workflow_id_has_prefix("wf-")
	})
}

func TestHandleUpdateWorkflow(t *testing.T) {
	t.Run("updates existing workflow", func(t *testing.T) {
		tc := newWorkflowHandlerTestContext(t)
		tc.given_workflow_exists("wf-a1b2", "original-name", "# Original")

		// Given
		tc.update_workflow_command("wf-a1b2", "updated-name", "# Updated")

		// When
		tc.update_workflow_is_handled()

		// Then
		tc.workflow_updated_event_is_appended()
	})

	t.Run("returns error for non-existent workflow", func(t *testing.T) {
		tc := newWorkflowHandlerTestContext(t)

		// Given
		tc.update_workflow_command("wf-nonexistent", "updated-name", "# Updated")

		// When
		tc.update_workflow_is_handled()

		// Then
		tc.not_found_error_is_returned()
	})

	t.Run("returns error for deleted workflow", func(t *testing.T) {
		tc := newWorkflowHandlerTestContext(t)
		tc.given_workflow_is_deleted("wf-a1b2", "test-workflow", "# Test")

		// Given
		tc.update_workflow_command("wf-a1b2", "updated-name", "# Updated")

		// When
		tc.update_workflow_is_handled()

		// Then
		tc.workflow_deleted_error_is_returned()
	})
}

func TestHandleDeleteWorkflow(t *testing.T) {
	t.Run("deletes existing workflow", func(t *testing.T) {
		tc := newWorkflowHandlerTestContext(t)
		tc.given_workflow_exists("wf-a1b2", "test-workflow", "# Test")

		// Given
		tc.delete_workflow_command("wf-a1b2")

		// When
		tc.delete_workflow_is_handled()

		// Then
		tc.workflow_deleted_event_is_appended()
	})

	t.Run("returns error for non-existent workflow", func(t *testing.T) {
		tc := newWorkflowHandlerTestContext(t)

		// Given
		tc.delete_workflow_command("wf-nonexistent")

		// When
		tc.delete_workflow_is_handled()

		// Then
		tc.not_found_error_is_returned()
	})

	t.Run("is idempotent for already deleted workflow", func(t *testing.T) {
		tc := newWorkflowHandlerTestContext(t)
		tc.given_workflow_is_deleted("wf-a1b2", "test-workflow", "# Test")

		// Given
		tc.delete_workflow_command("wf-a1b2")

		// When
		tc.delete_workflow_is_handled()

		// Then
		tc.no_error_is_returned()
	})
}

// --- Test Context ---

type workflowHandlerTestContext struct {
	t       *testing.T
	events  []core.Event
	state   WorkflowState
	result  CreateWorkflowResult
	err     error

	cmd CreateWorkflow
	upd UpdateWorkflow
	del DeleteWorkflow

	mockStore *mockWorkflowEventStore
}

func newWorkflowHandlerTestContext(t *testing.T) *workflowHandlerTestContext {
	t.Helper()
	return &workflowHandlerTestContext{
		t:         t,
		mockStore: newMockWorkflowEventStore(),
	}
}

// --- Given ---

func (tc *workflowHandlerTestContext) no_workflow_events() {
	tc.t.Helper()
	tc.events = nil
}

func (tc *workflowHandlerTestContext) events_from_created_workflow() {
	tc.t.Helper()
	created := WorkflowCreated{
		WorkflowID: "wf-a1b2",
		Name:       "test-workflow",
		Content:    "# Test Workflow\nSteps here",
	}
	data, _ := json.Marshal(created)
	tc.events = []core.Event{
		{EventType: EventWorkflowCreated, Data: data},
	}
}

func (tc *workflowHandlerTestContext) events_from_created_and_updated_workflow() {
	tc.t.Helper()
	created := WorkflowCreated{
		WorkflowID: "wf-a1b2",
		Name:       "test-workflow",
		Content:    "# Test Workflow",
	}
	createdData, _ := json.Marshal(created)
	
	name := "updated-workflow"
	content := "# Updated Content"
	updated := WorkflowUpdated{
		WorkflowID: "wf-a1b2",
		Name:       &name,
		Content:    &content,
	}
	updatedData, _ := json.Marshal(updated)
	
	tc.events = []core.Event{
		{EventType: EventWorkflowCreated, Data: createdData},
		{EventType: EventWorkflowUpdated, Data: updatedData},
	}
}

func (tc *workflowHandlerTestContext) events_from_created_and_deleted_workflow() {
	tc.t.Helper()
	created := WorkflowCreated{
		WorkflowID: "wf-a1b2",
		Name:       "test-workflow",
		Content:    "# Test Workflow",
	}
	createdData, _ := json.Marshal(created)
	
	deleted := WorkflowDeleted{
		WorkflowID: "wf-a1b2",
	}
	deletedData, _ := json.Marshal(deleted)
	
	tc.events = []core.Event{
		{EventType: EventWorkflowCreated, Data: createdData},
		{EventType: EventWorkflowDeleted, Data: deletedData},
	}
}

func (tc *workflowHandlerTestContext) create_workflow_command(name, content string) {
	tc.t.Helper()
	tc.cmd = CreateWorkflow{Name: name, Content: content}
}

func (tc *workflowHandlerTestContext) update_workflow_command(workflowID, name, content string) {
	tc.t.Helper()
	tc.upd = UpdateWorkflow{
		WorkflowID: workflowID,
	}
	if name != "" {
		tc.upd.Name = &name
	}
	if content != "" {
		tc.upd.Content = &content
	}
}

func (tc *workflowHandlerTestContext) delete_workflow_command(workflowID string) {
	tc.t.Helper()
	tc.del = DeleteWorkflow{WorkflowID: workflowID}
}

func (tc *workflowHandlerTestContext) given_workflow_exists(workflowID, name, content string) {
	tc.t.Helper()
	created := WorkflowCreated{
		WorkflowID: workflowID,
		Name:       name,
		Content:    content,
	}
	createdData, _ := json.Marshal(created)
	tc.mockStore.events = []core.Event{
		{EventType: EventWorkflowCreated, Data: createdData},
	}
}

func (tc *workflowHandlerTestContext) given_workflow_is_deleted(workflowID, name, content string) {
	tc.t.Helper()
	created := WorkflowCreated{
		WorkflowID: workflowID,
		Name:       name,
		Content:    content,
	}
	createdData, _ := json.Marshal(created)
	
	deleted := WorkflowDeleted{WorkflowID: workflowID}
	deletedData, _ := json.Marshal(deleted)
	
	tc.mockStore.events = []core.Event{
		{EventType: EventWorkflowCreated, Data: createdData},
		{EventType: EventWorkflowDeleted, Data: deletedData},
	}
}

// --- When ---

func (tc *workflowHandlerTestContext) workflow_state_is_rebuilt() {
	tc.t.Helper()
	tc.state = RebuildWorkflowState(tc.events)
}

func (tc *workflowHandlerTestContext) create_workflow_is_handled() {
	tc.t.Helper()
	tc.result, tc.err = HandleCreateWorkflow(context.Background(), tc.cmd, tc.mockStore)
}

func (tc *workflowHandlerTestContext) update_workflow_is_handled() {
	tc.t.Helper()
	tc.err = HandleUpdateWorkflow(context.Background(), tc.upd, tc.mockStore)
}

func (tc *workflowHandlerTestContext) delete_workflow_is_handled() {
	tc.t.Helper()
	tc.err = HandleDeleteWorkflow(context.Background(), tc.del, tc.mockStore)
}

// --- Then ---

func (tc *workflowHandlerTestContext) workflow_state_does_not_exist() {
	tc.t.Helper()
	assert.False(tc.t, tc.state.Exists)
}

func (tc *workflowHandlerTestContext) workflow_state_exists() {
	tc.t.Helper()
	assert.True(tc.t, tc.state.Exists)
}

func (tc *workflowHandlerTestContext) workflow_state_has_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.WorkflowID)
}

func (tc *workflowHandlerTestContext) workflow_state_has_name(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.Name)
}

func (tc *workflowHandlerTestContext) workflow_state_has_content(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.Content)
}

func (tc *workflowHandlerTestContext) workflow_state_is_deleted() {
	tc.t.Helper()
	assert.True(tc.t, tc.state.Deleted)
}

func (tc *workflowHandlerTestContext) workflow_is_created() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *workflowHandlerTestContext) result_has_workflow_id() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.NotEmpty(tc.t, tc.result.WorkflowID)
}

func (tc *workflowHandlerTestContext) workflow_id_has_prefix(prefix string) {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, len(tc.result.WorkflowID) > len(prefix))
	assert.Equal(tc.t, prefix, tc.result.WorkflowID[:len(prefix)])
}

func (tc *workflowHandlerTestContext) event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *workflowHandlerTestContext) workflow_updated_event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *workflowHandlerTestContext) workflow_deleted_event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *workflowHandlerTestContext) not_found_error_is_returned() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	var nfe *core.NotFoundError
	require.ErrorAs(tc.t, tc.err, &nfe)
}

func (tc *workflowHandlerTestContext) workflow_deleted_error_is_returned() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), "deleted")
}

func (tc *workflowHandlerTestContext) no_error_is_returned() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

// --- Mock ---

type mockWorkflowEventStore struct {
	events   []core.Event
	appended bool
	lastData []core.EventData
}

func newMockWorkflowEventStore() *mockWorkflowEventStore {
	return &mockWorkflowEventStore{
		events: make([]core.Event, 0),
	}
}

func (m *mockWorkflowEventStore) Append(ctx context.Context, realmID, streamID string, expectedVersion int, events []core.EventData) ([]core.Event, error) {
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

func (m *mockWorkflowEventStore) ReadStream(ctx context.Context, realmID, streamID string, version int) ([]core.Event, error) {
	return m.events, nil
}

func (m *mockWorkflowEventStore) ReadStreamBackwards(ctx context.Context, realmID, streamID string, count int) ([]core.Event, error) {
	return m.events, nil
}

func (m *mockWorkflowEventStore) ReadAll(ctx context.Context, realmID string, fromGlobalPosition int64) ([]core.Event, error) {
	return m.events, nil
}

func (m *mockWorkflowEventStore) ListRealmIDs(ctx context.Context) ([]string, error) {
	return []string{AdminRealmID}, nil
}
