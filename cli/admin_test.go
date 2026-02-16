package cli

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestNewAdminCmd(t *testing.T) {
	t.Run("has Use set to admin", func(t *testing.T) {
		tc := newAdminTestContext(t)

		// When
		tc.admin_cmd_is_created()

		// Then
		tc.use_is("admin")
		tc.short_description_is("Direct database administration commands")
	})

	t.Run("has db flag", func(t *testing.T) {
		tc := newAdminTestContext(t)

		// When
		tc.admin_cmd_is_created()

		// Then
		tc.has_persistent_string_flag("db")
	})

	t.Run("registers realm subcommands", func(t *testing.T) {
		tc := newAdminTestContext(t)

		// When
		tc.admin_cmd_is_created()

		// Then
		tc.has_subcommand("create-realm")
		tc.has_subcommand("list-realms")
		tc.has_subcommand("suspend-realm")
	})

	t.Run("registers account subcommands", func(t *testing.T) {
		tc := newAdminTestContext(t)

		// When
		tc.admin_cmd_is_created()

		// Then
		tc.has_subcommand("create-account")
		tc.has_subcommand("list-accounts")
		tc.has_subcommand("suspend-account")
		tc.has_subcommand("grant")
		tc.has_subcommand("revoke")
		tc.has_subcommand("assign-role")
		tc.has_subcommand("revoke-role")
	})

	t.Run("registers PAT subcommands", func(t *testing.T) {
		tc := newAdminTestContext(t)

		// When
		tc.admin_cmd_is_created()

		// Then
		tc.has_subcommand("create-pat")
		tc.has_subcommand("list-pats")
		tc.has_subcommand("revoke-pat")
	})
}

func TestResolveUsername(t *testing.T) {
	t.Run("returns account ID for existing username", func(t *testing.T) {
		tc := newAdminTestContext(t)

		// Given
		tc.projection_store_has_username("alice", "acct-1234")

		// When
		tc.resolve_username("alice")

		// Then
		tc.no_error_occurred()
		tc.resolved_account_id_is("acct-1234")
	})

	t.Run("returns error for unknown username", func(t *testing.T) {
		tc := newAdminTestContext(t)

		// Given
		tc.projection_store_has_no_username("bob")

		// When
		tc.resolve_username("bob")

		// Then
		tc.error_contains("not found")
	})
}

func TestAdminRegisteredInRoot(t *testing.T) {
	t.Run("root command has admin subcommand", func(t *testing.T) {
		tc := newAdminTestContext(t)

		// When
		tc.root_cmd_is_created()

		// Then
		tc.root_has_subcommand("admin")
	})

	t.Run("PersistentPreRunE skips config loading for admin command", func(t *testing.T) {
		tc := newAdminTestContext(t)

		// Given
		tc.root_cmd_is_created()
		tc.sub_command_is("admin")

		// When
		tc.root_persistent_pre_run_is_executed()

		// Then
		tc.no_error_occurred()
		tc.root_config_is_nil()
		tc.root_client_is_nil()
	})
}

// --- Test Context ---

type adminTestContext struct {
	t *testing.T

	adminCmd        *AdminCmd
	rootCmd         *RootCmd
	subCmd          *cobra.Command
	projectionStore *mockProjectionStore
	resolvedID      string
	err             error
}

func newAdminTestContext(t *testing.T) *adminTestContext {
	t.Helper()
	return &adminTestContext{t: t}
}

// --- Given ---

func (tc *adminTestContext) projection_store_has_username(username, accountID string) {
	tc.t.Helper()
	tc.projectionStore = &mockProjectionStore{
		data: map[string]any{
			"_admin|account_lookup|username:" + username: accountID,
		},
	}
}

func (tc *adminTestContext) projection_store_has_no_username(username string) {
	tc.t.Helper()
	tc.projectionStore = &mockProjectionStore{
		data: map[string]any{},
	}
}

func (tc *adminTestContext) sub_command_is(name string) {
	tc.t.Helper()
	tc.subCmd = &cobra.Command{Use: name}
	tc.rootCmd.Command.AddCommand(tc.subCmd)
}

// --- When ---

func (tc *adminTestContext) admin_cmd_is_created() {
	tc.t.Helper()
	tc.adminCmd = NewAdminCmd()
}

func (tc *adminTestContext) root_cmd_is_created() {
	tc.t.Helper()
	tc.rootCmd = NewRootCmd()
}

func (tc *adminTestContext) resolve_username(username string) {
	tc.t.Helper()
	tc.resolvedID, tc.err = resolveUsername(context.Background(), tc.projectionStore, username)
}

func (tc *adminTestContext) root_persistent_pre_run_is_executed() {
	tc.t.Helper()
	require.NotNil(tc.t, tc.rootCmd.Command.PersistentPreRunE)
	tc.err = tc.rootCmd.Command.PersistentPreRunE(tc.subCmd, []string{})
}

// --- Then ---

func (tc *adminTestContext) use_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.adminCmd.Command.Use)
}

func (tc *adminTestContext) short_description_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.adminCmd.Command.Short)
}

func (tc *adminTestContext) has_persistent_string_flag(name string) {
	tc.t.Helper()
	flag := tc.adminCmd.Command.PersistentFlags().Lookup(name)
	assert.NotNil(tc.t, flag, "expected persistent flag %q to exist", name)
}

func (tc *adminTestContext) has_subcommand(name string) {
	tc.t.Helper()
	for _, sub := range tc.adminCmd.Command.Commands() {
		if sub.Name() == name {
			return
		}
	}
	tc.t.Errorf("expected subcommand %q to be registered", name)
}

func (tc *adminTestContext) root_has_subcommand(name string) {
	tc.t.Helper()
	for _, sub := range tc.rootCmd.Command.Commands() {
		if sub.Name() == name {
			return
		}
	}
	tc.t.Errorf("expected subcommand %q to be registered on root", name)
}

func (tc *adminTestContext) no_error_occurred() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *adminTestContext) error_contains(substr string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), substr)
}

func (tc *adminTestContext) resolved_account_id_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.resolvedID)
}

func (tc *adminTestContext) root_config_is_nil() {
	tc.t.Helper()
	assert.Nil(tc.t, tc.rootCmd.Cfg)
}

func (tc *adminTestContext) root_client_is_nil() {
	tc.t.Helper()
	assert.Nil(tc.t, tc.rootCmd.Client)
}

// --- Mock Stores ---

type mockProjectionStore struct {
	data     map[string]any
	listData map[string][]json.RawMessage
}

func (m *mockProjectionStore) Get(ctx context.Context, realmID string, projectionName string, key string, dest any) error {
	compositeKey := realmID + "|" + projectionName + "|" + key
	val, ok := m.data[compositeKey]
	if !ok {
		return &core.NotFoundError{Entity: projectionName, ID: key}
	}
	b, err := json.Marshal(val)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, dest)
}

func (m *mockProjectionStore) List(ctx context.Context, realmID string, projectionName string) ([]json.RawMessage, error) {
	compositeKey := realmID + "|" + projectionName
	if m.listData != nil {
		if rows, ok := m.listData[compositeKey]; ok {
			return rows, nil
		}
	}
	return []json.RawMessage{}, nil
}

func (m *mockProjectionStore) Put(ctx context.Context, realmID string, projectionName string, key string, value any) error {
	compositeKey := realmID + "|" + projectionName + "|" + key
	m.data[compositeKey] = value
	return nil
}

func (m *mockProjectionStore) Delete(ctx context.Context, realmID string, projectionName string, key string) error {
	compositeKey := realmID + "|" + projectionName + "|" + key
	delete(m.data, compositeKey)
	return nil
}

type mockEventStore struct {
	streams map[string][]core.Event
	nextPos int64
}

func newMockEventStore() *mockEventStore {
	return &mockEventStore{
		streams: make(map[string][]core.Event),
		nextPos: 1,
	}
}

func (m *mockEventStore) Append(ctx context.Context, realmID string, streamID string, expectedVersion int, events []core.EventData) ([]core.Event, error) {
	key := realmID + "|" + streamID
	existing := m.streams[key]
	if len(existing) != expectedVersion {
		return nil, &core.ConcurrencyError{
			StreamID:        streamID,
			ExpectedVersion: expectedVersion,
			ActualVersion:   len(existing),
		}
	}

	var result []core.Event
	for _, ed := range events {
		data, _ := json.Marshal(ed.Data)
		evt := core.Event{
			RealmID:        realmID,
			StreamID:       streamID,
			Version:        len(existing) + len(result),
			EventType:      ed.EventType,
			Data:           data,
			GlobalPosition: m.nextPos,
		}
		m.nextPos++
		result = append(result, evt)
	}

	m.streams[key] = append(existing, result...)
	return result, nil
}

func (m *mockEventStore) ReadStream(ctx context.Context, realmID string, streamID string, fromVersion int) ([]core.Event, error) {
	key := realmID + "|" + streamID
	events := m.streams[key]
	if fromVersion >= len(events) {
		return []core.Event{}, nil
	}
	return events[fromVersion:], nil
}

func (m *mockEventStore) ReadAll(ctx context.Context, realmID string, fromGlobalPosition int64) ([]core.Event, error) {
	var result []core.Event
	for k, events := range m.streams {
		if len(k) > len(realmID)+1 && k[:len(realmID)] == realmID {
			for _, e := range events {
				if e.GlobalPosition > fromGlobalPosition {
					result = append(result, e)
				}
			}
		}
	}
	return result, nil
}

func (m *mockEventStore) ListRealmIDs(ctx context.Context) ([]string, error) {
	seen := make(map[string]bool)
	for k := range m.streams {
		for i, c := range k {
			if c == '|' {
				seen[k[:i]] = true
				break
			}
		}
	}
	var ids []string
	for id := range seen {
		ids = append(ids, id)
	}
	return ids, nil
}

type mockEngine struct{}

func (m *mockEngine) Register(projector core.Projector)                     {}
func (m *mockEngine) RunSync(ctx context.Context, events []core.Event) error { return nil }
func (m *mockEngine) RunCatchUpOnce(ctx context.Context)                     {}
func (m *mockEngine) StartCatchUp(ctx context.Context) error                 { return nil }
func (m *mockEngine) Stop() error                                            { return nil }

// --- Helpers ---

func newAdminCmdForTest(eventStore core.EventStore, projectionStore core.ProjectionStore) *cobra.Command {
	admin := &AdminCmd{
		Ctx: &AdminContext{
			EventStore:      eventStore,
			ProjectionStore: projectionStore,
			Engine:          &mockEngine{},
		},
	}

	cmd := &cobra.Command{
		Use:   "admin",
		Short: "Direct database administration commands",
	}

	cmd.PersistentFlags().Bool("json", false, "force JSON output")
	cmd.PersistentFlags().Bool("human", false, "formatted table/text output")
	cmd.PersistentFlags().String("db", "", "path to SQLite database")

	admin.Command = cmd

	addAdminRealmCommands(admin)
	addAdminAccountCommands(admin)
	addAdminPATCommands(admin)

	return cmd
}

func executeAdminCmd(cmd *cobra.Command, args ...string) (string, error) {
	buf := new(bytes.Buffer)
	cmd.SetOut(buf)
	cmd.SetErr(buf)
	cmd.SetArgs(args)
	err := cmd.Execute()
	return buf.String(), err
}
