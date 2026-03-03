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

func TestRebuildSkillState(t *testing.T) {
	t.Run("returns empty state for no events", func(t *testing.T) {
		tc := newSkillHandlerTestContext(t)

		// Given
		tc.no_skill_events()

		// When
		tc.skill_state_is_rebuilt()

		// Then
		tc.skill_state_does_not_exist()
	})

	t.Run("rebuilds state from SkillCreated event", func(t *testing.T) {
		tc := newSkillHandlerTestContext(t)

		// Given
		tc.events_from_created_skill()

		// When
		tc.skill_state_is_rebuilt()

		// Then
		tc.skill_state_exists()
		tc.skill_state_has_id("skill-a1b2")
		tc.skill_state_has_name("test-skill")
		tc.skill_state_has_content("# Test Skill\nContent here")
	})

	t.Run("applies SkillUpdated", func(t *testing.T) {
		tc := newSkillHandlerTestContext(t)

		// Given
		tc.events_from_created_and_updated_skill()

		// When
		tc.skill_state_is_rebuilt()

		// Then
		tc.skill_state_has_name("updated-skill")
		tc.skill_state_has_content("# Updated Content")
	})

	t.Run("applies SkillDeleted", func(t *testing.T) {
		tc := newSkillHandlerTestContext(t)

		// Given
		tc.events_from_created_and_deleted_skill()

		// When
		tc.skill_state_is_rebuilt()

		// Then
		tc.skill_state_is_deleted()
	})
}

func TestHandleCreateSkill(t *testing.T) {
	t.Run("creates skill with valid data", func(t *testing.T) {
		tc := newSkillHandlerTestContext(t)

		// Given
		tc.create_skill_command("test-skill", "# Test Skill")

		// When
		tc.create_skill_is_handled()

		// Then
		tc.skill_is_created()
		tc.result_has_skill_id()
		tc.event_is_appended()
	})

	t.Run("generates unique skill id", func(t *testing.T) {
		tc := newSkillHandlerTestContext(t)

		// Given
		tc.create_skill_command("test-skill", "# Test Skill")

		// When
		tc.create_skill_is_handled()

		// Then
		tc.skill_id_has_prefix("skill-")
	})
}

func TestHandleUpdateSkill(t *testing.T) {
	t.Run("updates existing skill", func(t *testing.T) {
		tc := newSkillHandlerTestContext(t)
		tc.given_skill_exists("skill-a1b2", "original-name", "# Original")

		// Given
		tc.update_skill_command("skill-a1b2", "updated-name", "# Updated")

		// When
		tc.update_skill_is_handled()

		// Then
		tc.skill_updated_event_is_appended()
	})

	t.Run("returns error for non-existent skill", func(t *testing.T) {
		tc := newSkillHandlerTestContext(t)

		// Given
		tc.update_skill_command("skill-nonexistent", "updated-name", "# Updated")

		// When
		tc.update_skill_is_handled()

		// Then
		tc.not_found_error_is_returned()
	})

	t.Run("returns error for deleted skill", func(t *testing.T) {
		tc := newSkillHandlerTestContext(t)
		tc.given_skill_is_deleted("skill-a1b2", "test-skill", "# Test")

		// Given
		tc.update_skill_command("skill-a1b2", "updated-name", "# Updated")

		// When
		tc.update_skill_is_handled()

		// Then
		tc.skill_deleted_error_is_returned()
	})
}

func TestHandleDeleteSkill(t *testing.T) {
	t.Run("deletes existing skill", func(t *testing.T) {
		tc := newSkillHandlerTestContext(t)
		tc.given_skill_exists("skill-a1b2", "test-skill", "# Test")

		// Given
		tc.delete_skill_command("skill-a1b2")

		// When
		tc.delete_skill_is_handled()

		// Then
		tc.skill_deleted_event_is_appended()
	})

	t.Run("returns error for non-existent skill", func(t *testing.T) {
		tc := newSkillHandlerTestContext(t)

		// Given
		tc.delete_skill_command("skill-nonexistent")

		// When
		tc.delete_skill_is_handled()

		// Then
		tc.not_found_error_is_returned()
	})

	t.Run("is idempotent for already deleted skill", func(t *testing.T) {
		tc := newSkillHandlerTestContext(t)
		tc.given_skill_is_deleted("skill-a1b2", "test-skill", "# Test")

		// Given
		tc.delete_skill_command("skill-a1b2")

		// When
		tc.delete_skill_is_handled()

		// Then
		tc.no_error_is_returned()
	})
}

// --- Test Context ---

type skillHandlerTestContext struct {
	t       *testing.T
	events  []core.Event
	state   SkillState
	result  CreateSkillResult
	err     error

	cmd CreateSkill
	upd UpdateSkill
	del DeleteSkill

	mockStore *mockSkillEventStore
}

func newSkillHandlerTestContext(t *testing.T) *skillHandlerTestContext {
	t.Helper()
	return &skillHandlerTestContext{
		t:         t,
		mockStore: newMockSkillEventStore(),
	}
}

// --- Given ---

func (tc *skillHandlerTestContext) no_skill_events() {
	tc.t.Helper()
	tc.events = nil
}

func (tc *skillHandlerTestContext) events_from_created_skill() {
	tc.t.Helper()
	created := SkillCreated{
		SkillID: "skill-a1b2",
		Name:    "test-skill",
		Content: "# Test Skill\nContent here",
	}
	data, _ := json.Marshal(created)
	tc.events = []core.Event{
		{EventType: EventSkillCreated, Data: data},
	}
}

func (tc *skillHandlerTestContext) events_from_created_and_updated_skill() {
	tc.t.Helper()
	created := SkillCreated{
		SkillID: "skill-a1b2",
		Name:    "test-skill",
		Content: "# Test Skill",
	}
	createdData, _ := json.Marshal(created)
	
	name := "updated-skill"
	content := "# Updated Content"
	updated := SkillUpdated{
		SkillID: "skill-a1b2",
		Name:    &name,
		Content: &content,
	}
	updatedData, _ := json.Marshal(updated)
	
	tc.events = []core.Event{
		{EventType: EventSkillCreated, Data: createdData},
		{EventType: EventSkillUpdated, Data: updatedData},
	}
}

func (tc *skillHandlerTestContext) events_from_created_and_deleted_skill() {
	tc.t.Helper()
	created := SkillCreated{
		SkillID: "skill-a1b2",
		Name:    "test-skill",
		Content: "# Test Skill",
	}
	createdData, _ := json.Marshal(created)
	
	deleted := SkillDeleted{
		SkillID: "skill-a1b2",
	}
	deletedData, _ := json.Marshal(deleted)
	
	tc.events = []core.Event{
		{EventType: EventSkillCreated, Data: createdData},
		{EventType: EventSkillDeleted, Data: deletedData},
	}
}

func (tc *skillHandlerTestContext) create_skill_command(name, content string) {
	tc.t.Helper()
	tc.cmd = CreateSkill{Name: name, Content: content}
}

func (tc *skillHandlerTestContext) update_skill_command(skillID, name, content string) {
	tc.t.Helper()
	tc.upd = UpdateSkill{
		SkillID: skillID,
	}
	if name != "" {
		tc.upd.Name = &name
	}
	if content != "" {
		tc.upd.Content = &content
	}
}

func (tc *skillHandlerTestContext) delete_skill_command(skillID string) {
	tc.t.Helper()
	tc.del = DeleteSkill{SkillID: skillID}
}

func (tc *skillHandlerTestContext) given_skill_exists(skillID, name, content string) {
	tc.t.Helper()
	created := SkillCreated{
		SkillID: skillID,
		Name:    name,
		Content: content,
	}
	createdData, _ := json.Marshal(created)
	tc.mockStore.events = []core.Event{
		{EventType: EventSkillCreated, Data: createdData},
	}
}

func (tc *skillHandlerTestContext) given_skill_is_deleted(skillID, name, content string) {
	tc.t.Helper()
	created := SkillCreated{
		SkillID: skillID,
		Name:    name,
		Content: content,
	}
	createdData, _ := json.Marshal(created)
	
	deleted := SkillDeleted{SkillID: skillID}
	deletedData, _ := json.Marshal(deleted)
	
	tc.mockStore.events = []core.Event{
		{EventType: EventSkillCreated, Data: createdData},
		{EventType: EventSkillDeleted, Data: deletedData},
	}
}

// --- When ---

func (tc *skillHandlerTestContext) skill_state_is_rebuilt() {
	tc.t.Helper()
	tc.state = RebuildSkillState(tc.events)
}

func (tc *skillHandlerTestContext) create_skill_is_handled() {
	tc.t.Helper()
	tc.result, tc.err = HandleCreateSkill(context.Background(), tc.cmd, tc.mockStore)
}

func (tc *skillHandlerTestContext) update_skill_is_handled() {
	tc.t.Helper()
	tc.err = HandleUpdateSkill(context.Background(), tc.upd, tc.mockStore)
}

func (tc *skillHandlerTestContext) delete_skill_is_handled() {
	tc.t.Helper()
	tc.err = HandleDeleteSkill(context.Background(), tc.del, tc.mockStore)
}

// --- Then ---

func (tc *skillHandlerTestContext) skill_state_does_not_exist() {
	tc.t.Helper()
	assert.False(tc.t, tc.state.Exists)
}

func (tc *skillHandlerTestContext) skill_state_exists() {
	tc.t.Helper()
	assert.True(tc.t, tc.state.Exists)
}

func (tc *skillHandlerTestContext) skill_state_has_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.SkillID)
}

func (tc *skillHandlerTestContext) skill_state_has_name(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.Name)
}

func (tc *skillHandlerTestContext) skill_state_has_content(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.Content)
}

func (tc *skillHandlerTestContext) skill_state_is_deleted() {
	tc.t.Helper()
	assert.True(tc.t, tc.state.Deleted)
}

func (tc *skillHandlerTestContext) skill_is_created() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *skillHandlerTestContext) result_has_skill_id() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.NotEmpty(tc.t, tc.result.SkillID)
}

func (tc *skillHandlerTestContext) skill_id_has_prefix(prefix string) {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, len(tc.result.SkillID) > len(prefix))
	assert.Equal(tc.t, prefix, tc.result.SkillID[:len(prefix)])
}

func (tc *skillHandlerTestContext) event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *skillHandlerTestContext) skill_updated_event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *skillHandlerTestContext) skill_deleted_event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *skillHandlerTestContext) not_found_error_is_returned() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	var nfe *core.NotFoundError
	require.ErrorAs(tc.t, tc.err, &nfe)
}

func (tc *skillHandlerTestContext) skill_deleted_error_is_returned() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), "deleted")
}

func (tc *skillHandlerTestContext) no_error_is_returned() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

// --- Mock ---

type mockSkillEventStore struct {
	events   []core.Event
	appended bool
	lastData []core.EventData
}

func newMockSkillEventStore() *mockSkillEventStore {
	return &mockSkillEventStore{
		events: make([]core.Event, 0),
	}
}

func (m *mockSkillEventStore) Append(ctx context.Context, realmID, streamID string, expectedVersion int, events []core.EventData) ([]core.Event, error) {
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

func (m *mockSkillEventStore) ReadStream(ctx context.Context, realmID, streamID string, version int) ([]core.Event, error) {
	return m.events, nil
}

func (m *mockSkillEventStore) ReadStreamBackwards(ctx context.Context, realmID, streamID string, count int) ([]core.Event, error) {
	return m.events, nil
}

func (m *mockSkillEventStore) ReadAll(ctx context.Context, realmID string, fromGlobalPosition int64) ([]core.Event, error) {
	return m.events, nil
}

func (m *mockSkillEventStore) ListRealmIDs(ctx context.Context) ([]string, error) {
	return []string{AdminRealmID}, nil
}
