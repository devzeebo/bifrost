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

func TestWorkflowListProjector(t *testing.T) {
	t.Run("Name returns workflow_list", func(t *testing.T) {
		tc := newWorkflowListTestContext(t)

		// Given
		tc.a_workflow_list_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("workflow_list")
	})

	t.Run("TableName returns workflow_list", func(t *testing.T) {
		tc := newWorkflowListTestContext(t)

		// Given
		tc.a_workflow_list_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("workflow_list")
	})

	t.Run("handles WorkflowCreated by putting entry with id and name", func(t *testing.T) {
		tc := newWorkflowListTestContext(t)

		// Given
		tc.a_workflow_list_projector()
		tc.a_store()
		tc.a_workflow_created_event("workflow-1", "TestWorkflow")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.workflow_entry_exists("workflow-1")
		tc.workflow_entry_has_name("workflow-1", "TestWorkflow")
	})

	t.Run("handles WorkflowUpdated with name change", func(t *testing.T) {
		tc := newWorkflowListTestContext(t)

		// Given
		tc.a_workflow_list_projector()
		tc.a_store()
		tc.existing_workflow_entry("workflow-1", "OldName")
		tc.a_workflow_updated_event_with_name("workflow-1", "NewName")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.workflow_entry_has_name("workflow-1", "NewName")
	})

	t.Run("handles WorkflowDeleted by removing entry", func(t *testing.T) {
		tc := newWorkflowListTestContext(t)

		// Given
		tc.a_workflow_list_projector()
		tc.a_store()
		tc.existing_workflow_entry("workflow-1", "TestWorkflow")
		tc.a_workflow_deleted_event("workflow-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.workflow_entry_does_not_exist("workflow-1")
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newWorkflowListTestContext(t)

		// Given
		tc.a_workflow_list_projector()
		tc.a_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("WorkflowCreated is idempotent for duplicate workflow", func(t *testing.T) {
		tc := newWorkflowListTestContext(t)

		// Given
		tc.a_workflow_list_projector()
		tc.a_store()
		tc.existing_workflow_entry("workflow-1", "TestWorkflow")
		tc.a_workflow_created_event("workflow-1", "TestWorkflow")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.workflow_entry_has_name("workflow-1", "TestWorkflow")
	})
}

// --- Test Context ---

type workflowListTestContext struct {
	t *testing.T

	projector      *WorkflowListProjector
	store          *mockProjectionStore
	event          core.Event
	ctx            context.Context
	nameResult     string
	tableNameResult string
	err            error
}

func newWorkflowListTestContext(t *testing.T) *workflowListTestContext {
	t.Helper()
	return &workflowListTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *workflowListTestContext) a_workflow_list_projector() {
	tc.t.Helper()
	tc.projector = NewWorkflowListProjector()
}

func (tc *workflowListTestContext) a_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *workflowListTestContext) a_workflow_created_event(workflowID, name string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventWorkflowCreated, domain.WorkflowCreated{
		WorkflowID: workflowID,
		Name:       name,
		Content:    "test content",
	})
}

func (tc *workflowListTestContext) a_workflow_updated_event_with_name(workflowID, name string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventWorkflowUpdated, domain.WorkflowUpdated{
		WorkflowID: workflowID,
		Name:       strPtr(name),
	})
}

func (tc *workflowListTestContext) a_workflow_deleted_event(workflowID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventWorkflowDeleted, domain.WorkflowDeleted{
		WorkflowID: workflowID,
	})
}

func (tc *workflowListTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *workflowListTestContext) existing_workflow_entry(workflowID, name string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := WorkflowListEntry{
		ID:   workflowID,
		Name: name,
	}
	tc.store.put("realm-1", "workflow_list", workflowID, entry)
}

// --- When ---

func (tc *workflowListTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *workflowListTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameResult = tc.projector.TableName()
}

func (tc *workflowListTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *workflowListTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *workflowListTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameResult)
}

func (tc *workflowListTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *workflowListTestContext) workflow_entry_exists(workflowID string) {
	tc.t.Helper()
	var entry WorkflowListEntry
	err := tc.store.Get(tc.ctx, "realm-1", "workflow_list", workflowID, &entry)
	require.NoError(tc.t, err, "expected workflow list entry for %s", workflowID)
}

func (tc *workflowListTestContext) workflow_entry_does_not_exist(workflowID string) {
	tc.t.Helper()
	var entry WorkflowListEntry
	err := tc.store.Get(tc.ctx, "realm-1", "workflow_list", workflowID, &entry)
	require.Error(tc.t, err, "expected workflow list entry for %s to not exist", workflowID)
}

func (tc *workflowListTestContext) workflow_entry_has_name(workflowID, expected string) {
	tc.t.Helper()
	var entry WorkflowListEntry
	err := tc.store.Get(tc.ctx, "realm-1", "workflow_list", workflowID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Name)
}
