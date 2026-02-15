package server

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadConfig(t *testing.T) {
	t.Run("returns config with all values from env vars", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.env_var("BIFROST_DB_DRIVER", "sqlite")
		tc.env_var("BIFROST_DB_PATH", "/tmp/test.db")
		tc.env_var("BIFROST_PORT", "9090")
		tc.env_var("BIFROST_CATCHUP_INTERVAL", "500ms")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.db_driver_is("sqlite")
		tc.db_path_is("/tmp/test.db")
		tc.port_is(9090)
		tc.catchup_interval_is(500 * time.Millisecond)
	})

	t.Run("applies defaults when no env vars are set", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		// no env vars set

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.db_driver_is("sqlite")
		tc.db_path_is("./bifrost.db")
		tc.port_is(8080)
		tc.catchup_interval_is(1 * time.Second)
	})

	t.Run("returns error when BIFROST_PORT is not a number", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.env_var("BIFROST_PORT", "abc")

		// When
		tc.load_config()

		// Then
		tc.config_has_error_containing("BIFROST_PORT")
	})

	t.Run("returns error when BIFROST_PORT is zero", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.env_var("BIFROST_PORT", "0")

		// When
		tc.load_config()

		// Then
		tc.config_has_error_containing("BIFROST_PORT")
	})

	t.Run("returns error when BIFROST_PORT exceeds 65535", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.env_var("BIFROST_PORT", "65536")

		// When
		tc.load_config()

		// Then
		tc.config_has_error_containing("BIFROST_PORT")
	})

	t.Run("returns error when BIFROST_CATCHUP_INTERVAL is invalid", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.env_var("BIFROST_CATCHUP_INTERVAL", "bad")

		// When
		tc.load_config()

		// Then
		tc.config_has_error_containing("BIFROST_CATCHUP_INTERVAL")
	})

	t.Run("parses BIFROST_CATCHUP_INTERVAL as duration", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.env_var("BIFROST_CATCHUP_INTERVAL", "2s")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.catchup_interval_is(2 * time.Second)
	})
}

// --- Test Context ---

type configTestContext struct {
	t      *testing.T
	envSet map[string]string

	cfg *Config
	err error
}

func newConfigTestContext(t *testing.T) *configTestContext {
	t.Helper()
	return &configTestContext{
		t:      t,
		envSet: make(map[string]string),
	}
}

// --- Given ---

func (tc *configTestContext) env_var(key, value string) {
	tc.t.Helper()
	tc.envSet[key] = value
	tc.t.Setenv(key, value)
}

// --- When ---

func (tc *configTestContext) load_config() {
	tc.t.Helper()
	tc.cfg, tc.err = LoadConfig()
}

// --- Then ---

func (tc *configTestContext) config_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	require.NotNil(tc.t, tc.cfg)
}

func (tc *configTestContext) config_has_error_containing(substr string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), substr)
}

func (tc *configTestContext) db_driver_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.cfg.DBDriver)
}

func (tc *configTestContext) db_path_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.cfg.DBPath)
}

func (tc *configTestContext) port_is(expected int) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.cfg.Port)
}

func (tc *configTestContext) catchup_interval_is(expected time.Duration) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.cfg.CatchUpInterval)
}
