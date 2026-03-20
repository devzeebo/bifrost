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

func TestRunnerSettingsProjector(t *testing.T) {
	t.Run("Name returns runner_settings", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.a_runner_settings_projector()

		// When
		tc.name_is_called()

		// Then
		tc.name_is("runner_settings")
	})

	t.Run("TableName returns runner_settings", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.a_runner_settings_projector()

		// When
		tc.table_name_is_called()

		// Then
		tc.table_name_is("runner_settings")
	})

	t.Run("handles RunnerSettingsCreated by putting entry with id, runner_type, and name", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.a_runner_settings_projector()
		tc.a_store()
		tc.a_runner_settings_created_event("rs-1", "github", "GitHub Actions")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.runner_settings_entry_exists("rs-1")
		tc.runner_settings_entry_has_runner_type("rs-1", "github")
		tc.runner_settings_entry_has_name("rs-1", "GitHub Actions")
		tc.runner_settings_entry_has_empty_fields("rs-1")
	})

	t.Run("handles RunnerSettingsFieldSet by adding field to map", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.a_runner_settings_projector()
		tc.a_store()
		tc.existing_runner_settings_entry("rs-1", "github", "GitHub Actions")
		tc.a_runner_settings_field_set_event("rs-1", "token", "secret-value")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.runner_settings_entry_has_field("rs-1", "token", "secret-value")
	})

	t.Run("handles RunnerSettingsFieldDeleted by removing field from map", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.a_runner_settings_projector()
		tc.a_store()
		tc.existing_runner_settings_entry_with_fields("rs-1", "github", "GitHub Actions", map[string]string{"token": "secret", "repo": "myrepo"})
		tc.a_runner_settings_field_deleted_event("rs-1", "token")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.runner_settings_entry_has_field("rs-1", "repo", "myrepo")
		tc.runner_settings_entry_does_not_have_field("rs-1", "token")
	})

	t.Run("handles RunnerSettingsDeleted by removing entry", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.a_runner_settings_projector()
		tc.a_store()
		tc.existing_runner_settings_entry("rs-1", "github", "GitHub Actions")
		tc.a_runner_settings_deleted_event("rs-1")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.runner_settings_entry_does_not_exist("rs-1")
	})

	t.Run("ignores unknown event types", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.a_runner_settings_projector()
		tc.a_store()
		tc.an_unknown_event()

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
	})

	t.Run("RunnerSettingsCreated is idempotent for duplicate settings", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.a_runner_settings_projector()
		tc.a_store()
		tc.existing_runner_settings_entry("rs-1", "github", "GitHub Actions")
		tc.a_runner_settings_created_event("rs-1", "github", "GitHub Actions")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.runner_settings_entry_has_runner_type("rs-1", "github")
		tc.runner_settings_entry_has_name("rs-1", "GitHub Actions")
	})

	t.Run("RunnerSettingsFieldSet updates existing field value", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.a_runner_settings_projector()
		tc.a_store()
		tc.existing_runner_settings_entry_with_fields("rs-1", "github", "GitHub Actions", map[string]string{"token": "old-value"})
		tc.a_runner_settings_field_set_event("rs-1", "token", "new-value")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.runner_settings_entry_has_field("rs-1", "token", "new-value")
	})
}

// --- Test Context ---

type runnerSettingsTestContext struct {
	t *testing.T

	projector      *RunnerSettingsProjector
	store          *mockProjectionStore
	event          core.Event
	ctx            context.Context
	nameResult     string
	tableNameResult string
	err            error
}

func newRunnerSettingsTestContext(t *testing.T) *runnerSettingsTestContext {
	t.Helper()
	return &runnerSettingsTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *runnerSettingsTestContext) a_runner_settings_projector() {
	tc.t.Helper()
	tc.projector = NewRunnerSettingsProjector()
}

func (tc *runnerSettingsTestContext) a_store() {
	tc.t.Helper()
	tc.store = newMockProjectionStore()
}

func (tc *runnerSettingsTestContext) a_runner_settings_created_event(runnerSettingsID, runnerType, name string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRunnerSettingsCreated, domain.RunnerSettingsCreated{
		RunnerSettingsID: runnerSettingsID,
		RunnerType:       runnerType,
		Name:             name,
	})
}

func (tc *runnerSettingsTestContext) a_runner_settings_field_set_event(runnerSettingsID, key, value string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRunnerSettingsFieldSet, domain.RunnerSettingsFieldSet{
		RunnerSettingsID: runnerSettingsID,
		Key:              key,
		Value:            value,
	})
}

func (tc *runnerSettingsTestContext) a_runner_settings_field_deleted_event(runnerSettingsID, key string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRunnerSettingsFieldDeleted, domain.RunnerSettingsFieldDeleted{
		RunnerSettingsID: runnerSettingsID,
		Key:              key,
	})
}

func (tc *runnerSettingsTestContext) a_runner_settings_deleted_event(runnerSettingsID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRunnerSettingsDeleted, domain.RunnerSettingsDeleted{
		RunnerSettingsID: runnerSettingsID,
	})
}

func (tc *runnerSettingsTestContext) an_unknown_event() {
	tc.t.Helper()
	tc.event = core.Event{EventType: "UnknownEvent", Data: []byte(`{}`)}
}

func (tc *runnerSettingsTestContext) existing_runner_settings_entry(runnerSettingsID, runnerType, name string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := RunnerSettingsEntry{
		ID:         runnerSettingsID,
		RunnerType: runnerType,
		Name:       name,
		Fields:     map[string]string{},
	}
	tc.store.put("realm-1", "runner_settings", runnerSettingsID, entry)
}

func (tc *runnerSettingsTestContext) existing_runner_settings_entry_with_fields(runnerSettingsID, runnerType, name string, fields map[string]string) {
	tc.t.Helper()
	if tc.store == nil {
		tc.store = newMockProjectionStore()
	}
	entry := RunnerSettingsEntry{
		ID:         runnerSettingsID,
		RunnerType: runnerType,
		Name:       name,
		Fields:     fields,
	}
	tc.store.put("realm-1", "runner_settings", runnerSettingsID, entry)
}

// --- When ---

func (tc *runnerSettingsTestContext) name_is_called() {
	tc.t.Helper()
	tc.nameResult = tc.projector.Name()
}

func (tc *runnerSettingsTestContext) table_name_is_called() {
	tc.t.Helper()
	tc.tableNameResult = tc.projector.TableName()
}

func (tc *runnerSettingsTestContext) handle_is_called() {
	tc.t.Helper()
	tc.err = tc.projector.Handle(tc.ctx, tc.event, tc.store)
}

// --- Then ---

func (tc *runnerSettingsTestContext) name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.nameResult)
}

func (tc *runnerSettingsTestContext) table_name_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.tableNameResult)
}

func (tc *runnerSettingsTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *runnerSettingsTestContext) runner_settings_entry_exists(runnerSettingsID string) {
	tc.t.Helper()
	var entry RunnerSettingsEntry
	err := tc.store.Get(tc.ctx, "realm-1", "runner_settings", runnerSettingsID, &entry)
	require.NoError(tc.t, err, "expected runner settings entry for %s", runnerSettingsID)
}

func (tc *runnerSettingsTestContext) runner_settings_entry_does_not_exist(runnerSettingsID string) {
	tc.t.Helper()
	var entry RunnerSettingsEntry
	err := tc.store.Get(tc.ctx, "realm-1", "runner_settings", runnerSettingsID, &entry)
	require.Error(tc.t, err, "expected runner settings entry for %s to not exist", runnerSettingsID)
}

func (tc *runnerSettingsTestContext) runner_settings_entry_has_runner_type(runnerSettingsID, expected string) {
	tc.t.Helper()
	var entry RunnerSettingsEntry
	err := tc.store.Get(tc.ctx, "realm-1", "runner_settings", runnerSettingsID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.RunnerType)
}

func (tc *runnerSettingsTestContext) runner_settings_entry_has_name(runnerSettingsID, expected string) {
	tc.t.Helper()
	var entry RunnerSettingsEntry
	err := tc.store.Get(tc.ctx, "realm-1", "runner_settings", runnerSettingsID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, entry.Name)
}

func (tc *runnerSettingsTestContext) runner_settings_entry_has_empty_fields(runnerSettingsID string) {
	tc.t.Helper()
	var entry RunnerSettingsEntry
	err := tc.store.Get(tc.ctx, "realm-1", "runner_settings", runnerSettingsID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, map[string]string{}, entry.Fields)
}

func (tc *runnerSettingsTestContext) runner_settings_entry_has_field(runnerSettingsID, key, expectedValue string) {
	tc.t.Helper()
	var entry RunnerSettingsEntry
	err := tc.store.Get(tc.ctx, "realm-1", "runner_settings", runnerSettingsID, &entry)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expectedValue, entry.Fields[key])
}

func (tc *runnerSettingsTestContext) runner_settings_entry_does_not_have_field(runnerSettingsID, key string) {
	tc.t.Helper()
	var entry RunnerSettingsEntry
	err := tc.store.Get(tc.ctx, "realm-1", "runner_settings", runnerSettingsID, &entry)
	require.NoError(tc.t, err)
	_, exists := entry.Fields[key]
	assert.False(tc.t, exists, "expected field %s to not exist", key)
}
