package cli

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestConfigDir(t *testing.T) {
	t.Run("uses XDG_CONFIG_HOME when set", func(t *testing.T) {
		tc := newCredTestContext(t)

		// Given
		tc.xdg_config_home_is("/tmp/custom-config")

		// When
		tc.config_dir_is_resolved()

		// Then
		tc.config_dir_is("/tmp/custom-config/bifrost")
	})

	t.Run("falls back to ~/.config/bifrost when XDG_CONFIG_HOME is not set", func(t *testing.T) {
		tc := newCredTestContext(t)

		// Given
		tc.xdg_config_home_is("")

		// When
		tc.config_dir_is_resolved()

		// Then
		tc.config_dir_is(filepath.Join(tc.homeDir, ".config", "bifrost"))
	})
}

func TestSaveCredential(t *testing.T) {
	t.Run("creates directory and file with correct permissions", func(t *testing.T) {
		tc := newCredTestContext(t)

		// When
		tc.save_credential("http://localhost:8080", "my-token")

		// Then
		tc.no_error_occurred()
		tc.credentials_dir_has_permissions(0700)
		tc.credentials_file_has_permissions(0600)
	})

	t.Run("stores credential keyed by URL", func(t *testing.T) {
		tc := newCredTestContext(t)

		// When
		tc.save_credential("http://localhost:8080", "my-token")

		// Then
		tc.no_error_occurred()
		tc.credential_exists_for("http://localhost:8080", "my-token")
	})

	t.Run("upserts credential for existing URL", func(t *testing.T) {
		tc := newCredTestContext(t)

		// Given
		tc.existing_credential("http://localhost:8080", "old-token")

		// When
		tc.save_credential("http://localhost:8080", "new-token")

		// Then
		tc.no_error_occurred()
		tc.credential_exists_for("http://localhost:8080", "new-token")
	})

	t.Run("preserves other credentials when upserting", func(t *testing.T) {
		tc := newCredTestContext(t)

		// Given
		tc.existing_credential("http://localhost:8080", "token-a")
		tc.existing_credential("https://bifrost.example.com", "token-b")

		// When
		tc.save_credential("http://localhost:8080", "token-a-new")

		// Then
		tc.no_error_occurred()
		tc.credential_exists_for("http://localhost:8080", "token-a-new")
		tc.credential_exists_for("https://bifrost.example.com", "token-b")
	})

	t.Run("normalizes URL by stripping trailing slash", func(t *testing.T) {
		tc := newCredTestContext(t)

		// When
		tc.save_credential("http://localhost:8080/", "my-token")

		// Then
		tc.no_error_occurred()
		tc.credential_exists_for("http://localhost:8080", "my-token")
	})
}

func TestLoadCredentials(t *testing.T) {
	t.Run("returns all stored credentials", func(t *testing.T) {
		tc := newCredTestContext(t)

		// Given
		tc.existing_credential("http://localhost:8080", "token-a")
		tc.existing_credential("https://bifrost.example.com", "token-b")

		// When
		tc.load_credentials()

		// Then
		tc.no_error_occurred()
		tc.loaded_credentials_count_is(2)
		tc.loaded_credential_has("http://localhost:8080", "token-a")
		tc.loaded_credential_has("https://bifrost.example.com", "token-b")
	})

	t.Run("returns empty map when no credentials file exists", func(t *testing.T) {
		tc := newCredTestContext(t)

		// When
		tc.load_credentials()

		// Then
		tc.no_error_occurred()
		tc.loaded_credentials_count_is(0)
	})
}

func TestGetCredential(t *testing.T) {
	t.Run("returns token for stored URL", func(t *testing.T) {
		tc := newCredTestContext(t)

		// Given
		tc.existing_credential("http://localhost:8080", "my-token")

		// When
		tc.get_credential("http://localhost:8080")

		// Then
		tc.no_error_occurred()
		tc.returned_token_is("my-token")
	})

	t.Run("normalizes URL by stripping trailing slash for lookup", func(t *testing.T) {
		tc := newCredTestContext(t)

		// Given
		tc.existing_credential("http://localhost:8080", "my-token")

		// When
		tc.get_credential("http://localhost:8080/")

		// Then
		tc.no_error_occurred()
		tc.returned_token_is("my-token")
	})

	t.Run("returns error for non-existent URL", func(t *testing.T) {
		tc := newCredTestContext(t)

		// When
		tc.get_credential("http://unknown:9999")

		// Then
		tc.error_occurred()
		tc.error_contains("no credential")
	})
}

func TestDeleteCredential(t *testing.T) {
	t.Run("removes credential for URL", func(t *testing.T) {
		tc := newCredTestContext(t)

		// Given
		tc.existing_credential("http://localhost:8080", "my-token")

		// When
		tc.delete_credential("http://localhost:8080")

		// Then
		tc.no_error_occurred()
		tc.credential_does_not_exist_for("http://localhost:8080")
	})

	t.Run("preserves other credentials when deleting", func(t *testing.T) {
		tc := newCredTestContext(t)

		// Given
		tc.existing_credential("http://localhost:8080", "token-a")
		tc.existing_credential("https://bifrost.example.com", "token-b")

		// When
		tc.delete_credential("http://localhost:8080")

		// Then
		tc.no_error_occurred()
		tc.credential_does_not_exist_for("http://localhost:8080")
		tc.credential_exists_for("https://bifrost.example.com", "token-b")
	})

	t.Run("normalizes URL by stripping trailing slash", func(t *testing.T) {
		tc := newCredTestContext(t)

		// Given
		tc.existing_credential("http://localhost:8080", "my-token")

		// When
		tc.delete_credential("http://localhost:8080/")

		// Then
		tc.no_error_occurred()
		tc.credential_does_not_exist_for("http://localhost:8080")
	})

	t.Run("does not error when credentials file does not exist", func(t *testing.T) {
		tc := newCredTestContext(t)

		// When
		tc.delete_credential("http://localhost:8080")

		// Then
		tc.no_error_occurred()
	})
}

// --- Test Context ---

type credTestContext struct {
	t          *testing.T
	homeDir    string
	configDirResult string
	loadedCreds map[string]Credential
	token      string
	err        error
}

func newCredTestContext(t *testing.T) *credTestContext {
	t.Helper()
	homeDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", "")
	return &credTestContext{
		t:       t,
		homeDir: homeDir,
	}
}

// --- Given ---

func (tc *credTestContext) xdg_config_home_is(value string) {
	tc.t.Helper()
	tc.t.Setenv("XDG_CONFIG_HOME", value)
}

func (tc *credTestContext) existing_credential(url, token string) {
	tc.t.Helper()
	err := SaveCredential(tc.homeDir, url, token)
	require.NoError(tc.t, err)
}

// --- When ---

func (tc *credTestContext) config_dir_is_resolved() {
	tc.t.Helper()
	tc.configDirResult = configDir(tc.homeDir)
}

func (tc *credTestContext) save_credential(url, token string) {
	tc.t.Helper()
	tc.err = SaveCredential(tc.homeDir, url, token)
}

func (tc *credTestContext) load_credentials() {
	tc.t.Helper()
	tc.loadedCreds, tc.err = LoadCredentials(tc.homeDir)
}

func (tc *credTestContext) get_credential(url string) {
	tc.t.Helper()
	tc.token, tc.err = GetCredential(tc.homeDir, url)
}

func (tc *credTestContext) delete_credential(url string) {
	tc.t.Helper()
	tc.err = DeleteCredential(tc.homeDir, url)
}

// --- Then ---

func (tc *credTestContext) no_error_occurred() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *credTestContext) error_occurred() {
	tc.t.Helper()
	assert.Error(tc.t, tc.err)
}

func (tc *credTestContext) error_contains(substr string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), substr)
}

func (tc *credTestContext) config_dir_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.configDirResult)
}

func (tc *credTestContext) credentials_dir_has_permissions(perm os.FileMode) {
	tc.t.Helper()
	dir := configDir(tc.homeDir)
	info, err := os.Stat(dir)
	require.NoError(tc.t, err, "credentials directory should exist")
	assert.Equal(tc.t, perm, info.Mode().Perm())
}

func (tc *credTestContext) credentials_file_has_permissions(perm os.FileMode) {
	tc.t.Helper()
	path := filepath.Join(configDir(tc.homeDir), "credentials.yaml")
	info, err := os.Stat(path)
	require.NoError(tc.t, err, "credentials file should exist")
	assert.Equal(tc.t, perm, info.Mode().Perm())
}

func (tc *credTestContext) credential_exists_for(url, token string) {
	tc.t.Helper()
	creds, err := LoadCredentials(tc.homeDir)
	require.NoError(tc.t, err)
	cred, ok := creds[url]
	assert.True(tc.t, ok, "expected credential for %q", url)
	if ok {
		assert.Equal(tc.t, token, cred.Token)
	}
}

func (tc *credTestContext) credential_does_not_exist_for(url string) {
	tc.t.Helper()
	creds, err := LoadCredentials(tc.homeDir)
	require.NoError(tc.t, err)
	_, ok := creds[url]
	assert.False(tc.t, ok, "expected no credential for %q", url)
}

func (tc *credTestContext) loaded_credentials_count_is(count int) {
	tc.t.Helper()
	assert.Len(tc.t, tc.loadedCreds, count)
}

func (tc *credTestContext) loaded_credential_has(url, token string) {
	tc.t.Helper()
	cred, ok := tc.loadedCreds[url]
	assert.True(tc.t, ok, "expected credential for %q", url)
	if ok {
		assert.Equal(tc.t, token, cred.Token)
	}
}

func (tc *credTestContext) returned_token_is(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.token)
}
