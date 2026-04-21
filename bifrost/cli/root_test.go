package cli

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/spf13/cobra"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestRootCommand(t *testing.T) {
	t.Run("has Use set to bf", func(t *testing.T) {
		tc := newRootTestContext(t)

		// When
		tc.get_root_command()

		// Then
		tc.use_is("bf")
		tc.short_description_is("Bifrost CLI - event-sourced rune management")
	})

	t.Run("has human flag", func(t *testing.T) {
		tc := newRootTestContext(t)

		// When
		tc.get_root_command()

		// Then
		tc.has_persistent_bool_flag("human")
	})

	t.Run("has json flag", func(t *testing.T) {
		tc := newRootTestContext(t)

		// When
		tc.get_root_command()

		// Then
		tc.has_persistent_bool_flag("json")
	})

	t.Run("registers init subcommand", func(t *testing.T) {
		tc := newRootTestContext(t)

		// When
		tc.get_root_command()

		// Then
		tc.has_subcommand("init")
	})

	t.Run("registers login subcommand", func(t *testing.T) {
		tc := newRootTestContext(t)

		// When
		tc.get_root_command()

		// Then
		tc.has_subcommand("login")
	})

	t.Run("registers logout subcommand", func(t *testing.T) {
		tc := newRootTestContext(t)

		// When
		tc.get_root_command()

		// Then
		tc.has_subcommand("logout")
	})

	t.Run("PersistentPreRunE skips config loading for init command", func(t *testing.T) {
		tc := newRootTestContext(t)

		// Given
		tc.get_root_command()
		tc.command_is("init")

		// When
		tc.persistent_pre_run_is_executed()

		// Then
		tc.no_error_occurred()
		tc.config_is_nil()
		tc.client_is_nil()
	})

	t.Run("PersistentPreRunE skips config loading for login command", func(t *testing.T) {
		tc := newRootTestContext(t)

		// Given
		tc.get_root_command()
		tc.command_is("login")

		// When
		tc.persistent_pre_run_is_executed()

		// Then
		tc.no_error_occurred()
		tc.config_is_nil()
		tc.client_is_nil()
	})

	t.Run("PersistentPreRunE skips config loading for logout command", func(t *testing.T) {
		tc := newRootTestContext(t)

		// Given
		tc.get_root_command()
		tc.command_is("logout")

		// When
		tc.persistent_pre_run_is_executed()

		// Then
		tc.no_error_occurred()
		tc.config_is_nil()
		tc.client_is_nil()
	})

	t.Run("PersistentPreRunE loads config for non-init command", func(t *testing.T) {
		tc := newRootTestContext(t)

		// Given
		tc.get_root_command()
		tc.command_is("other")
		tc.dirs_resolve_to_empty_temp()

		// When
		tc.persistent_pre_run_is_executed()

		// Then
		tc.error_occurred()
	})
}

// --- Test Context ---

type rootTestContext struct {
	t      *testing.T
	cmd    *RootCmd
	subCmd *cobra.Command
	err    error
}

func newRootTestContext(t *testing.T) *rootTestContext {
	t.Helper()
	return &rootTestContext{t: t}
}

// --- Given ---

func (tc *rootTestContext) get_root_command() {
	tc.t.Helper()
	tc.cmd = NewRootCmd()
}

func (tc *rootTestContext) command_is(name string) {
	tc.t.Helper()
	tc.subCmd = &cobra.Command{Use: name}
	tc.cmd.Command.AddCommand(tc.subCmd)
}

// --- When ---

func (tc *rootTestContext) persistent_pre_run_is_executed() {
	tc.t.Helper()
	require.NotNil(tc.t, tc.cmd.Command.PersistentPreRunE, "PersistentPreRunE must be set")
	tc.err = tc.cmd.Command.PersistentPreRunE(tc.subCmd, []string{})
}

// --- Then ---

func (tc *rootTestContext) use_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.cmd.Command.Use)
}

func (tc *rootTestContext) short_description_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.cmd.Command.Short)
}

func (tc *rootTestContext) has_persistent_bool_flag(name string) {
	tc.t.Helper()
	flag := tc.cmd.Command.PersistentFlags().Lookup(name)
	assert.NotNil(tc.t, flag, "expected persistent flag %q to exist", name)
}

func (tc *rootTestContext) no_error_occurred() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *rootTestContext) error_occurred() {
	tc.t.Helper()
	assert.Error(tc.t, tc.err)
}

func (tc *rootTestContext) config_is_nil() {
	tc.t.Helper()
	assert.Nil(tc.t, tc.cmd.Cfg)
}

func (tc *rootTestContext) client_is_nil() {
	tc.t.Helper()
	assert.Nil(tc.t, tc.cmd.Client)
}

func (tc *rootTestContext) dirs_resolve_to_empty_temp() {
	tc.t.Helper()
	base := tc.t.TempDir()
	homeDir := filepath.Join(base, "home")
	workDir := filepath.Join(base, "work")
	require.NoError(tc.t, os.MkdirAll(homeDir, 0755))
	require.NoError(tc.t, os.MkdirAll(workDir, 0755))
	tc.cmd.HomeDirFn = func() (string, error) { return homeDir, nil }
	tc.cmd.WorkDirFn = func() (string, error) { return workDir, nil }
}

func (tc *rootTestContext) has_subcommand(name string) {
	tc.t.Helper()
	for _, sub := range tc.cmd.Command.Commands() {
		if sub.Name() == name {
			return
		}
	}
	assert.Fail(tc.t, "expected subcommand %q to be registered", name)
}
