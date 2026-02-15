package cli

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestLoadConfig(t *testing.T) {
	t.Run("resolves token from credential store", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.local_config_file_with("url: https://example.com\nrealm: test")
		tc.credential_store_has("https://example.com", "cred-store-token")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.api_key_is("cred-store-token")
		tc.no_warnings()
	})

	t.Run("falls back to api_key in yaml with deprecation warning", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.local_config_file_with("url: https://example.com\napi_key: yaml-key\nrealm: test")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.api_key_is("yaml-key")
		tc.warning_contains("api_key in .bifrost.yaml is deprecated")
	})

	t.Run("falls back to BIFROST_API_KEY env var with deprecation warning", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.local_config_file_with("url: https://example.com\nrealm: test")
		tc.env_var("BIFROST_API_KEY", "env-key")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.api_key_is("env-key")
		tc.warning_contains("api_key in .bifrost.yaml is deprecated")
	})

	t.Run("credential store takes priority over api_key in yaml", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.local_config_file_with("url: https://example.com\napi_key: yaml-key\nrealm: test")
		tc.credential_store_has("https://example.com", "cred-store-token")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.api_key_is("cred-store-token")
		tc.no_warnings()
	})

	t.Run("credential store takes priority over BIFROST_API_KEY env var", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.local_config_file_with("url: https://example.com\nrealm: test")
		tc.credential_store_has("https://example.com", "cred-store-token")
		tc.env_var("BIFROST_API_KEY", "env-key")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.api_key_is("cred-store-token")
		tc.no_warnings()
	})

	t.Run("returns error when no credentials found from any source", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.local_config_file_with("url: https://example.com\nrealm: test")

		// When
		tc.load_config()

		// Then
		tc.config_has_error_containing("no credentials found")
		tc.config_has_error_containing("bf login")
	})

	t.Run("returns error when realm is missing", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.local_config_file_with("url: https://example.com")
		tc.credential_store_has("https://example.com", "my-token")

		// When
		tc.load_config()

		// Then
		tc.config_has_error_containing("realm is required in .bifrost.yaml")
	})

	t.Run("loads realm from config file", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.local_config_file_with("url: https://example.com\nrealm: my-realm")
		tc.credential_store_has("https://example.com", "my-token")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.realm_is("my-realm")
	})

	t.Run("defaults URL to http://localhost:8080 when not set", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.local_config_file_with("realm: test")
		tc.credential_store_has("http://localhost:8080", "my-token")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.url_is("http://localhost:8080")
	})

	t.Run("BIFROST_URL env var overrides config file url", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.local_config_file_with("url: https://from-file.com\nrealm: test")
		tc.credential_store_has("https://from-env.com", "my-token")
		tc.env_var("BIFROST_URL", "https://from-env.com")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.url_is("https://from-env.com")
	})

	t.Run("loads config from home dir yaml file", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.home_config_file_with("url: https://from-file.com\nrealm: test")
		tc.credential_store_has("https://from-file.com", "file-token")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.url_is("https://from-file.com")
		tc.api_key_is("file-token")
	})

	t.Run("local config overrides global config", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.home_config_file_with("url: https://global.com\nrealm: global")
		tc.local_config_file_with("url: https://local.com\nrealm: local")
		tc.credential_store_has("https://local.com", "local-token")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.url_is("https://local.com")
		tc.api_key_is("local-token")
		tc.realm_is("local")
	})

	t.Run("walks up from workDir to find config in parent", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.config_file_in_parent_of_work_dir("url: https://parent.com\nrealm: test")
		tc.credential_store_has("https://parent.com", "parent-token")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.url_is("https://parent.com")
		tc.api_key_is("parent-token")
	})

	t.Run("walk-up stops at .git boundary", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.git_boundary_between_work_and_config()
		tc.home_config_file_with("url: https://home.com\nrealm: test")
		tc.credential_store_has("https://home.com", "home-token")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.url_is("https://home.com")
		tc.api_key_is("home-token")
	})

	t.Run("falls back to home dir when no local config found", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.home_config_file_with("url: https://home.com\nrealm: test")
		tc.credential_store_has("https://home.com", "home-token")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.url_is("https://home.com")
		tc.api_key_is("home-token")
	})

	t.Run("env vars override local config url", func(t *testing.T) {
		tc := newConfigTestContext(t)

		// Given
		tc.local_config_file_with("url: https://local.com\nrealm: test")
		tc.credential_store_has("https://from-env.com", "env-token")
		tc.env_var("BIFROST_URL", "https://from-env.com")

		// When
		tc.load_config()

		// Then
		tc.config_has_no_error()
		tc.url_is("https://from-env.com")
		tc.api_key_is("env-token")
	})
}

// --- Test Context ---

type configTestContext struct {
	t       *testing.T
	workDir string
	homeDir string
	cfg     *Config
	err     error
}

func newConfigTestContext(t *testing.T) *configTestContext {
	t.Helper()
	base := t.TempDir()
	workDir := filepath.Join(base, "work", "sub")
	homeDir := filepath.Join(base, "home")
	require.NoError(t, os.MkdirAll(workDir, 0755))
	require.NoError(t, os.MkdirAll(homeDir, 0755))
	t.Setenv("XDG_CONFIG_HOME", "")
	return &configTestContext{
		t:       t,
		workDir: workDir,
		homeDir: homeDir,
	}
}

// --- Given ---

func (tc *configTestContext) env_var(key, value string) {
	tc.t.Helper()
	tc.t.Setenv(key, value)
}

func (tc *configTestContext) home_config_file_with(content string) {
	tc.t.Helper()
	path := filepath.Join(tc.homeDir, ".bifrost.yaml")
	err := writeFile(path, []byte(content))
	require.NoError(tc.t, err)
}

func (tc *configTestContext) local_config_file_with(content string) {
	tc.t.Helper()
	path := filepath.Join(tc.workDir, ".bifrost.yaml")
	err := writeFile(path, []byte(content))
	require.NoError(tc.t, err)
}

func (tc *configTestContext) config_file_in_parent_of_work_dir(content string) {
	tc.t.Helper()
	parentDir := filepath.Dir(tc.workDir)
	path := filepath.Join(parentDir, ".bifrost.yaml")
	err := writeFile(path, []byte(content))
	require.NoError(tc.t, err)
}

func (tc *configTestContext) credential_store_has(url, token string) {
	tc.t.Helper()
	err := SaveCredential(tc.homeDir, url, token)
	require.NoError(tc.t, err)
}

func (tc *configTestContext) git_boundary_between_work_and_config() {
	tc.t.Helper()
	// Place .git in workDir so walk-up stops here and never reaches parent
	gitDir := filepath.Join(tc.workDir, ".git")
	require.NoError(tc.t, os.MkdirAll(gitDir, 0755))
	// Place a config above the .git boundary (in parent) — should NOT be found
	parentDir := filepath.Dir(tc.workDir)
	path := filepath.Join(parentDir, ".bifrost.yaml")
	err := writeFile(path, []byte("url: https://unreachable.com\napi_key: unreachable-key"))
	require.NoError(tc.t, err)
}

// --- When ---

func (tc *configTestContext) load_config() {
	tc.t.Helper()
	tc.cfg, tc.err = LoadConfig(tc.workDir, tc.homeDir)
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

func (tc *configTestContext) url_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.cfg.URL)
}

func (tc *configTestContext) api_key_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.cfg.APIKey)
}

func (tc *configTestContext) realm_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.cfg.Realm)
}

func (tc *configTestContext) no_warnings() {
	tc.t.Helper()
	assert.Empty(tc.t, tc.cfg.Warnings)
}

func (tc *configTestContext) warning_contains(substr string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.cfg.Warnings, "expected at least one warning")
	found := false
	for _, w := range tc.cfg.Warnings {
		if strings.Contains(w, substr) {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected warning containing %q, got %v", substr, tc.cfg.Warnings)
}

func writeFile(path string, content []byte) error {
	return os.WriteFile(path, content, 0644)
}
