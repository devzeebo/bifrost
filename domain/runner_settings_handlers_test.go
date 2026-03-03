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

func TestRebuildRunnerSettingsState(t *testing.T) {
	t.Run("returns empty state for no events", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)

		// Given
		tc.no_runner_settings_events()

		// When
		tc.runner_settings_state_is_rebuilt()

		// Then
		tc.runner_settings_state_does_not_exist()
	})

	t.Run("rebuilds state from RunnerSettingsCreated event", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)

		// Given
		tc.events_from_created_runner_settings()

		// When
		tc.runner_settings_state_is_rebuilt()

		// Then
		tc.runner_settings_state_exists()
		tc.runner_settings_state_has_id("rs-a1b2")
		tc.runner_settings_state_has_runner_type("docker")
		tc.runner_settings_state_has_name("test-runner")
	})

	t.Run("applies RunnerSettingsFieldSet", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)

		// Given
		tc.events_from_created_runner_settings_with_field_set()

		// When
		tc.runner_settings_state_is_rebuilt()

		// Then
		tc.runner_settings_state_has_field("image", "ubuntu:latest")
		tc.runner_settings_state_has_field("memory", "512m")
	})

	t.Run("applies RunnerSettingsFieldDeleted", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)

		// Given
		tc.events_from_created_runner_settings_with_field_set_and_deleted()

		// When
		tc.runner_settings_state_is_rebuilt()

		// Then
		tc.runner_settings_state_does_not_have_field("image")
		tc.runner_settings_state_has_field("memory", "512m")
	})

	t.Run("applies RunnerSettingsDeleted", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)

		// Given
		tc.events_from_created_and_deleted_runner_settings()

		// When
		tc.runner_settings_state_is_rebuilt()

		// Then
		tc.runner_settings_state_is_deleted()
	})
}

func TestHandleCreateRunnerSettings(t *testing.T) {
	t.Run("creates runner settings with valid data", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)

		// Given
		tc.create_runner_settings_command("docker", "test-runner")

		// When
		tc.create_runner_settings_is_handled()

		// Then
		tc.runner_settings_is_created()
		tc.result_has_runner_settings_id()
		tc.event_is_appended()
	})

	t.Run("generates unique runner settings id", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)

		// Given
		tc.create_runner_settings_command("docker", "test-runner")

		// When
		tc.create_runner_settings_is_handled()

		// Then
		tc.runner_settings_id_has_prefix("rs-")
	})
}

func TestHandleSetRunnerSettingsField(t *testing.T) {
	t.Run("sets field on existing runner settings", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)
		tc.given_runner_settings_exists("rs-a1b2", "docker", "test-runner")

		// Given
		tc.set_runner_settings_field_command("rs-a1b2", "image", "ubuntu:latest")

		// When
		tc.set_runner_settings_field_is_handled()

		// Then
		tc.runner_settings_field_set_event_is_appended()
	})

	t.Run("updates existing field", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)
		tc.given_runner_settings_exists_with_field("rs-a1b2", "docker", "test-runner", "image", "ubuntu:20.04")

		// Given
		tc.set_runner_settings_field_command("rs-a1b2", "image", "ubuntu:latest")

		// When
		tc.set_runner_settings_field_is_handled()

		// Then
		tc.runner_settings_field_set_event_is_appended()
	})

	t.Run("returns error for non-existent runner settings", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)

		// Given
		tc.set_runner_settings_field_command("rs-nonexistent", "image", "ubuntu:latest")

		// When
		tc.set_runner_settings_field_is_handled()

		// Then
		tc.not_found_error_is_returned()
	})

	t.Run("returns error for deleted runner settings", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)
		tc.given_runner_settings_is_deleted("rs-a1b2", "docker", "test-runner")

		// Given
		tc.set_runner_settings_field_command("rs-a1b2", "image", "ubuntu:latest")

		// When
		tc.set_runner_settings_field_is_handled()

		// Then
		tc.runner_settings_deleted_error_is_returned()
	})
}

func TestHandleDeleteRunnerSettingsField(t *testing.T) {
	t.Run("deletes field from runner settings", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)
		tc.given_runner_settings_exists_with_field("rs-a1b2", "docker", "test-runner", "image", "ubuntu:latest")

		// Given
		tc.delete_runner_settings_field_command("rs-a1b2", "image")

		// When
		tc.delete_runner_settings_field_is_handled()

		// Then
		tc.runner_settings_field_deleted_event_is_appended()
	})

	t.Run("returns error if field does not exist", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)
		tc.given_runner_settings_exists("rs-a1b2", "docker", "test-runner")

		// Given
		tc.delete_runner_settings_field_command("rs-a1b2", "nonexistent")

		// When
		tc.delete_runner_settings_field_is_handled()

		// Then
		tc.field_not_found_error_is_returned()
	})

	t.Run("returns error for non-existent runner settings", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)

		// Given
		tc.delete_runner_settings_field_command("rs-nonexistent", "image")

		// When
		tc.delete_runner_settings_field_is_handled()

		// Then
		tc.not_found_error_is_returned()
	})
}

func TestHandleDeleteRunnerSettings(t *testing.T) {
	t.Run("deletes existing runner settings", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)
		tc.given_runner_settings_exists("rs-a1b2", "docker", "test-runner")

		// Given
		tc.delete_runner_settings_command("rs-a1b2")

		// When
		tc.delete_runner_settings_is_handled()

		// Then
		tc.runner_settings_deleted_event_is_appended()
	})

	t.Run("returns error for non-existent runner settings", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)

		// Given
		tc.delete_runner_settings_command("rs-nonexistent")

		// When
		tc.delete_runner_settings_is_handled()

		// Then
		tc.not_found_error_is_returned()
	})

	t.Run("is idempotent for already deleted runner settings", func(t *testing.T) {
		tc := newRunnerSettingsHandlerTestContext(t)
		tc.given_runner_settings_is_deleted("rs-a1b2", "docker", "test-runner")

		// Given
		tc.delete_runner_settings_command("rs-a1b2")

		// When
		tc.delete_runner_settings_is_handled()

		// Then
		tc.no_error_is_returned()
	})
}

// --- Test Context ---

type runnerSettingsHandlerTestContext struct {
	t       *testing.T
	events  []core.Event
	state   RunnerSettingsState
	result  CreateRunnerSettingsResult
	err     error

	cmd    CreateRunnerSettings
	setFld SetRunnerSettingsField
	delFld DeleteRunnerSettingsField
	del    DeleteRunnerSettings

	mockStore *mockRunnerSettingsEventStore
}

func newRunnerSettingsHandlerTestContext(t *testing.T) *runnerSettingsHandlerTestContext {
	t.Helper()
	return &runnerSettingsHandlerTestContext{
		t:         t,
		mockStore: newMockRunnerSettingsEventStore(),
	}
}

// --- Given ---

func (tc *runnerSettingsHandlerTestContext) no_runner_settings_events() {
	tc.t.Helper()
	tc.events = nil
}

func (tc *runnerSettingsHandlerTestContext) events_from_created_runner_settings() {
	tc.t.Helper()
	created := RunnerSettingsCreated{
		RunnerSettingsID: "rs-a1b2",
		RunnerType:       "docker",
		Name:             "test-runner",
	}
	data, _ := json.Marshal(created)
	tc.events = []core.Event{
		{EventType: EventRunnerSettingsCreated, Data: data},
	}
}

func (tc *runnerSettingsHandlerTestContext) events_from_created_runner_settings_with_field_set() {
	tc.t.Helper()
	created := RunnerSettingsCreated{
		RunnerSettingsID: "rs-a1b2",
		RunnerType:       "docker",
		Name:             "test-runner",
	}
	createdData, _ := json.Marshal(created)
	
	fieldSet1 := RunnerSettingsFieldSet{
		RunnerSettingsID: "rs-a1b2",
		Key:             "image",
		Value:           "ubuntu:latest",
	}
	fieldSet1Data, _ := json.Marshal(fieldSet1)
	
	fieldSet2 := RunnerSettingsFieldSet{
		RunnerSettingsID: "rs-a1b2",
		Key:             "memory",
		Value:           "512m",
	}
	fieldSet2Data, _ := json.Marshal(fieldSet2)
	
	tc.events = []core.Event{
		{EventType: EventRunnerSettingsCreated, Data: createdData},
		{EventType: EventRunnerSettingsFieldSet, Data: fieldSet1Data},
		{EventType: EventRunnerSettingsFieldSet, Data: fieldSet2Data},
	}
}

func (tc *runnerSettingsHandlerTestContext) events_from_created_runner_settings_with_field_set_and_deleted() {
	tc.t.Helper()
	created := RunnerSettingsCreated{
		RunnerSettingsID: "rs-a1b2",
		RunnerType:       "docker",
		Name:             "test-runner",
	}
	createdData, _ := json.Marshal(created)
	
	fieldSet1 := RunnerSettingsFieldSet{
		RunnerSettingsID: "rs-a1b2",
		Key:             "image",
		Value:           "ubuntu:latest",
	}
	fieldSet1Data, _ := json.Marshal(fieldSet1)
	
	fieldSet2 := RunnerSettingsFieldSet{
		RunnerSettingsID: "rs-a1b2",
		Key:             "memory",
		Value:           "512m",
	}
	fieldSet2Data, _ := json.Marshal(fieldSet2)
	
	fieldDel := RunnerSettingsFieldDeleted{
		RunnerSettingsID: "rs-a1b2",
		Key:             "image",
	}
	fieldDelData, _ := json.Marshal(fieldDel)
	
	tc.events = []core.Event{
		{EventType: EventRunnerSettingsCreated, Data: createdData},
		{EventType: EventRunnerSettingsFieldSet, Data: fieldSet1Data},
		{EventType: EventRunnerSettingsFieldSet, Data: fieldSet2Data},
		{EventType: EventRunnerSettingsFieldDeleted, Data: fieldDelData},
	}
}

func (tc *runnerSettingsHandlerTestContext) events_from_created_and_deleted_runner_settings() {
	tc.t.Helper()
	created := RunnerSettingsCreated{
		RunnerSettingsID: "rs-a1b2",
		RunnerType:       "docker",
		Name:             "test-runner",
	}
	createdData, _ := json.Marshal(created)
	
	deleted := RunnerSettingsDeleted{
		RunnerSettingsID: "rs-a1b2",
	}
	deletedData, _ := json.Marshal(deleted)
	
	tc.events = []core.Event{
		{EventType: EventRunnerSettingsCreated, Data: createdData},
		{EventType: EventRunnerSettingsDeleted, Data: deletedData},
	}
}

func (tc *runnerSettingsHandlerTestContext) create_runner_settings_command(runnerType, name string) {
	tc.t.Helper()
	tc.cmd = CreateRunnerSettings{RunnerType: runnerType, Name: name}
}

func (tc *runnerSettingsHandlerTestContext) set_runner_settings_field_command(runnerSettingsID, key, value string) {
	tc.t.Helper()
	tc.setFld = SetRunnerSettingsField{
		RunnerSettingsID: runnerSettingsID,
		Key:             key,
		Value:           value,
	}
}

func (tc *runnerSettingsHandlerTestContext) delete_runner_settings_field_command(runnerSettingsID, key string) {
	tc.t.Helper()
	tc.delFld = DeleteRunnerSettingsField{
		RunnerSettingsID: runnerSettingsID,
		Key:             key,
	}
}

func (tc *runnerSettingsHandlerTestContext) delete_runner_settings_command(runnerSettingsID string) {
	tc.t.Helper()
	tc.del = DeleteRunnerSettings{RunnerSettingsID: runnerSettingsID}
}

func (tc *runnerSettingsHandlerTestContext) given_runner_settings_exists(runnerSettingsID, runnerType, name string) {
	tc.t.Helper()
	created := RunnerSettingsCreated{
		RunnerSettingsID: runnerSettingsID,
		RunnerType:       runnerType,
		Name:             name,
	}
	createdData, _ := json.Marshal(created)
	tc.mockStore.events = []core.Event{
		{EventType: EventRunnerSettingsCreated, Data: createdData},
	}
}

func (tc *runnerSettingsHandlerTestContext) given_runner_settings_exists_with_field(runnerSettingsID, runnerType, name, key, value string) {
	tc.t.Helper()
	created := RunnerSettingsCreated{
		RunnerSettingsID: runnerSettingsID,
		RunnerType:       runnerType,
		Name:             name,
	}
	createdData, _ := json.Marshal(created)
	
	fieldSet := RunnerSettingsFieldSet{
		RunnerSettingsID: runnerSettingsID,
		Key:             key,
		Value:           value,
	}
	fieldSetData, _ := json.Marshal(fieldSet)
	
	tc.mockStore.events = []core.Event{
		{EventType: EventRunnerSettingsCreated, Data: createdData},
		{EventType: EventRunnerSettingsFieldSet, Data: fieldSetData},
	}
}

func (tc *runnerSettingsHandlerTestContext) given_runner_settings_is_deleted(runnerSettingsID, runnerType, name string) {
	tc.t.Helper()
	created := RunnerSettingsCreated{
		RunnerSettingsID: runnerSettingsID,
		RunnerType:       runnerType,
		Name:             name,
	}
	createdData, _ := json.Marshal(created)
	
	deleted := RunnerSettingsDeleted{RunnerSettingsID: runnerSettingsID}
	deletedData, _ := json.Marshal(deleted)
	
	tc.mockStore.events = []core.Event{
		{EventType: EventRunnerSettingsCreated, Data: createdData},
		{EventType: EventRunnerSettingsDeleted, Data: deletedData},
	}
}

// --- When ---

func (tc *runnerSettingsHandlerTestContext) runner_settings_state_is_rebuilt() {
	tc.t.Helper()
	tc.state = RebuildRunnerSettingsState(tc.events)
}

func (tc *runnerSettingsHandlerTestContext) create_runner_settings_is_handled() {
	tc.t.Helper()
	tc.result, tc.err = HandleCreateRunnerSettings(context.Background(), tc.cmd, tc.mockStore)
}

func (tc *runnerSettingsHandlerTestContext) set_runner_settings_field_is_handled() {
	tc.t.Helper()
	tc.err = HandleSetRunnerSettingsField(context.Background(), tc.setFld, tc.mockStore)
}

func (tc *runnerSettingsHandlerTestContext) delete_runner_settings_field_is_handled() {
	tc.t.Helper()
	tc.err = HandleDeleteRunnerSettingsField(context.Background(), tc.delFld, tc.mockStore)
}

func (tc *runnerSettingsHandlerTestContext) delete_runner_settings_is_handled() {
	tc.t.Helper()
	tc.err = HandleDeleteRunnerSettings(context.Background(), tc.del, tc.mockStore)
}

// --- Then ---

func (tc *runnerSettingsHandlerTestContext) runner_settings_state_does_not_exist() {
	tc.t.Helper()
	assert.False(tc.t, tc.state.Exists)
}

func (tc *runnerSettingsHandlerTestContext) runner_settings_state_exists() {
	tc.t.Helper()
	assert.True(tc.t, tc.state.Exists)
}

func (tc *runnerSettingsHandlerTestContext) runner_settings_state_has_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.RunnerSettingsID)
}

func (tc *runnerSettingsHandlerTestContext) runner_settings_state_has_runner_type(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.RunnerType)
}

func (tc *runnerSettingsHandlerTestContext) runner_settings_state_has_name(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.Name)
}

func (tc *runnerSettingsHandlerTestContext) runner_settings_state_has_field(key, expectedValue string) {
	tc.t.Helper()
	assert.Equal(tc.t, expectedValue, tc.state.Fields[key])
}

func (tc *runnerSettingsHandlerTestContext) runner_settings_state_does_not_have_field(key string) {
	tc.t.Helper()
	_, exists := tc.state.Fields[key]
	assert.False(tc.t, exists)
}

func (tc *runnerSettingsHandlerTestContext) runner_settings_state_is_deleted() {
	tc.t.Helper()
	assert.True(tc.t, tc.state.Deleted)
}

func (tc *runnerSettingsHandlerTestContext) runner_settings_is_created() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *runnerSettingsHandlerTestContext) result_has_runner_settings_id() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.NotEmpty(tc.t, tc.result.RunnerSettingsID)
}

func (tc *runnerSettingsHandlerTestContext) runner_settings_id_has_prefix(prefix string) {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, len(tc.result.RunnerSettingsID) > len(prefix))
	assert.Equal(tc.t, prefix, tc.result.RunnerSettingsID[:len(prefix)])
}

func (tc *runnerSettingsHandlerTestContext) event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *runnerSettingsHandlerTestContext) runner_settings_field_set_event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *runnerSettingsHandlerTestContext) runner_settings_field_deleted_event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *runnerSettingsHandlerTestContext) runner_settings_deleted_event_is_appended() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	assert.True(tc.t, tc.mockStore.appended)
}

func (tc *runnerSettingsHandlerTestContext) not_found_error_is_returned() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	var nfe *core.NotFoundError
	require.ErrorAs(tc.t, tc.err, &nfe)
}

func (tc *runnerSettingsHandlerTestContext) runner_settings_deleted_error_is_returned() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), "deleted")
}

func (tc *runnerSettingsHandlerTestContext) field_not_found_error_is_returned() {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), "not found")
}

func (tc *runnerSettingsHandlerTestContext) no_error_is_returned() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
}

// --- Mock ---

type mockRunnerSettingsEventStore struct {
	events   []core.Event
	appended bool
	lastData []core.EventData
}

func newMockRunnerSettingsEventStore() *mockRunnerSettingsEventStore {
	return &mockRunnerSettingsEventStore{
		events: make([]core.Event, 0),
	}
}

func (m *mockRunnerSettingsEventStore) Append(ctx context.Context, realmID, streamID string, expectedVersion int, events []core.EventData) ([]core.Event, error) {
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

func (m *mockRunnerSettingsEventStore) ReadStream(ctx context.Context, realmID, streamID string, version int) ([]core.Event, error) {
	return m.events, nil
}

func (m *mockRunnerSettingsEventStore) ReadStreamBackwards(ctx context.Context, realmID, streamID string, count int) ([]core.Event, error) {
	return m.events, nil
}

func (m *mockRunnerSettingsEventStore) ReadAll(ctx context.Context, realmID string, fromGlobalPosition int64) ([]core.Event, error) {
	return m.events, nil
}

func (m *mockRunnerSettingsEventStore) ListRealmIDs(ctx context.Context) ([]string, error) {
	return []string{AdminRealmID}, nil
}
