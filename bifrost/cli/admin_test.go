package cli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"

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
		tc.short_description_is("Server administration commands via HTTP API")
	})

	t.Run("has url flag", func(t *testing.T) {
		tc := newAdminTestContext(t)

		// When
		tc.admin_cmd_is_created()

		// Then
		tc.has_persistent_string_flag("url")
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

	t.Run("registers bootstrap subcommand", func(t *testing.T) {
		tc := newAdminTestContext(t)

		// When
		tc.admin_cmd_is_created()

		// Then
		tc.has_subcommand("bootstrap")
	})

	t.Run("registers rebuild-projections subcommand", func(t *testing.T) {
		tc := newAdminTestContext(t)

		// When
		tc.admin_cmd_is_created()

		// Then
		tc.has_subcommand("rebuild-projections")
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

	adminCmd *AdminCmd
	rootCmd  *RootCmd
	subCmd   *cobra.Command
	err      error
}

func newAdminTestContext(t *testing.T) *adminTestContext {
	t.Helper()
	return &adminTestContext{t: t}
}

// --- Given ---

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

func (tc *adminTestContext) root_config_is_nil() {
	tc.t.Helper()
	assert.Nil(tc.t, tc.rootCmd.Cfg)
}

func (tc *adminTestContext) root_client_is_nil() {
	tc.t.Helper()
	assert.Nil(tc.t, tc.rootCmd.Client)
}

// --- Mock Client ---

type mockClient struct {
	getResponses [][]byte
	getIndex     int
	postResponse []byte
	getError     error
	postError    error
}

func (m *mockClient) DoGet(path string) ([]byte, error) {
	if m.getError != nil {
		return nil, m.getError
	}
	if m.getIndex < len(m.getResponses) {
		resp := m.getResponses[m.getIndex]
		m.getIndex++
		return resp, nil
	}
	return nil, fmt.Errorf("no more mock responses")
}

func (m *mockClient) DoPost(path string, reqBody interface{}) ([]byte, error) {
	return m.postResponse, m.postError
}

func (m *mockClient) DoGetWithParams(path string, params map[string]string) ([]byte, error) {
	return m.DoGet(path)
}

// --- Helpers ---

func newAdminCmdWithMockClient(mock *mockClient) *cobra.Command {
	// Create a real Client but override its httpClient with a mock transport
	client := &Client{
		baseURL: "http://test",
		apiKey:  "test-key",
		realm:   "_admin",
		httpClient: &http.Client{
			Transport: &mockTransport{mock: mock},
		},
	}

	admin := &AdminCmd{
		Client: client,
	}

	cmd := &cobra.Command{
		Use:   "admin",
		Short: "Server administration commands via HTTP API",
	}

	cmd.PersistentFlags().Bool("json", false, "force JSON output")
	cmd.PersistentFlags().Bool("human", false, "formatted table/text output")
	cmd.PersistentFlags().String("url", "", "Bifrost server URL")
	cmd.PersistentFlags().String("work-dir", "", "Working directory")
	cmd.PersistentFlags().String("home-dir", "", "Home directory")

	admin.Command = cmd

	addAdminRealmCommands(admin)
	addAdminAccountCommands(admin)
	addAdminPATCommands(admin)
	addAdminRebuildCommands(admin)
	addAdminBootstrapCommands(admin)

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

// --- JSON Helpers ---

func mustMarshal(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return b
}

// mockTransport is an http.RoundTripper that returns mock responses
type mockTransport struct {
	mock *mockClient
}

func (t *mockTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if t.mock.getError != nil {
		return nil, t.mock.getError
	}

	var body []byte
	if req.Method == http.MethodGet {
		if t.mock.getIndex < len(t.mock.getResponses) {
			body = t.mock.getResponses[t.mock.getIndex]
			t.mock.getIndex++
		} else {
			body = []byte("{}")
		}
	} else {
		body = t.mock.postResponse
	}

	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader(body)),
		Request:    req,
	}, nil
}
