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

func TestSkillListProjector(t *testing.T) {
	t.Run("Name returns skill_list", func(t *testing.T) {
		tc := newSkillListTestContext(t)

		// Given
		tc.a_skill_list_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("skill_list")
	})

	t.Run("TableName returns projection_skill_list", func(t *testing.T) {
		tc := newSkillListTestContext(t)

		// Given
		tc.a_skill_list_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("projection_skill_list")
	})

	t.Run("handles SkillCreated by putting entry with id and name", func(t *testing.T) {
		tc := newSkillListTestContext(t)

		// Given
		tc.a_skill_list_projector()
		tc.a_projection_store()
		tc.a_skill_created_event("skill-1", "TestSkill")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.skill_entry_exists("skill-1")
		tc.skill_entry_has_name("skill-1", "TestSkill")
	})

	t.Run("handles SkillUpdated with name change", func(t *testing.T) {
		tc := newSkillListTestContext(t)

		// Given
		tc.a_skill_list_projector()
		tc.a_projection_store()
		tc.existing_skill_entry("skill-1", "OldName")
		tc.a_skill_updated_event_with_name("skill-1", "NewName")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.skill_entry_has_name("skill-1", "NewName")
	})

	t.Run("handles SkillDeleted by removing entry", func(t *testing.T) {
		tc := newSkillListTestContext(t)

		// Given
		tc.a_skill_list_projector()
		tc.a_projection_store()
		tc.existing_skill_entry("skill-1", "TestSkill")
		tc.a_skill_deleted_event("skill-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.skill_entry_does_not_exist("skill-1")
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newSkillListTestContext(t)

		// Given
		tc.a_skill_list_projector()
		tc.a_projection_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("SkillCreated is idempotent for duplicate skill", func(t *testing.T) {
		tc := newSkillListTestContext(t)

		// Given
		tc.a_skill_list_projector()
		tc.a_projection_store()
		tc.existing_skill_entry("skill-1", "TestSkill")
		tc.a_skill_created_event("skill-1", "TestSkill")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.skill_entry_has_name("skill-1", "TestSkill")
	})
}

// --- Test Context ---

type skillListTestContext struct {
	t *testing.T

	projector       *SkillListProjector
	store           *mockProjectionStore
	event           core.Event
	ctx             context.Context
	nameResult      string
	tableNameResult string
	err             error
}

func newSkillListTestContext(t *testing.T) *skillListTestContext {
	t.Helper()
	return &skillListTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *skillListTestContext) a_skill_list_projector() {
	tc.t.Helper()
	tc.projector = NewSkillListProjector()
}

func (tc *skillListTestContext) a_projection_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *skillListTestContext) a_skill_created_event(skillID, name string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventSkillCreated, domain.SkillCreated{
		SkillID: skillID,
		Name:    name,
		Content: "test content",
	})
}

func (tc *skillListTestContext) a_skill_updated_event_with_name(skillID, name string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventSkillUpdated, domain.SkillUpdated{
		SkillID: skillID,
		Name:    strPtr(name),
	})
}

func (tc *skillListTestContext) a_skill_deleted_event(skillID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventSkillDeleted, domain.SkillDeleted{
		SkillID: skillID,
	})
}

func (tc *skillListTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *skillListTestContext) existing_skill_entry(skillID, name string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := SkillListEntry{
		ID:   skillID,
		Name: name,
	}
	tc.store.put("realm-1", "projection_skill_list", skillID, entry)
}

// --- When ---

func (tc *skillListTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *skillListTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *skillListTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *skillListTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameResult = tc.projector.TableName()
}

func (tc *skillListTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameResult)
}

func (tc *skillListTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *skillListTestContext) skill_entry_exists(skillID string) {
	tc.t.Helper()
	var entry SkillListEntry
	err := tc.store.Get(tc.ctx, "realm-1", "projection_skill_list", skillID, &entry)
	require.NoError(tc.t, err, "expected skill list entry for %s", skillID)
}

func (tc *skillListTestContext) skill_entry_does_not_exist(skillID string) {
	tc.t.Helper()
	var entry SkillListEntry
	err := tc.store.Get(tc.ctx, "realm-1", "projection_skill_list", skillID, &entry)
	require.Error(tc.t, err, "expected skill list entry for %s to not exist", skillID)
}

func (tc *skillListTestContext) skill_entry_has_name(skillID, expected string) {
	tc.t.Helper()
	var entry SkillListEntry
	err := tc.store.Get(tc.ctx, "realm-1", "projection_skill_list", skillID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Name)
}
