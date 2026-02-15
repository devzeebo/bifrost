package cli

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestLogoutCommand(t *testing.T) {
	t.Run("removes credential and prints confirmation", func(t *testing.T) {
		tc := newLogoutTestContext(t)

		// Given
		tc.credential_exists("http://localhost:8080", "my-token")

		// When
		tc.execute_logout()

		// Then
		tc.no_error_occurred()
		tc.credential_is_removed("http://localhost:8080")
		tc.output_contains("Logged out from http://localhost:8080")
	})

	t.Run("removes credential for custom url", func(t *testing.T) {
		tc := newLogoutTestContext(t)

		// Given
		tc.credential_exists("https://bifrost.example.com", "my-token")

		// When
		tc.execute_logout("--url", "https://bifrost.example.com")

		// Then
		tc.no_error_occurred()
		tc.credential_is_removed("https://bifrost.example.com")
		tc.output_contains("Logged out from https://bifrost.example.com")
	})

	t.Run("defaults url from .bifrost.yaml when available", func(t *testing.T) {
		tc := newLogoutTestContext(t)

		// Given
		tc.bifrost_yaml_with_url("https://from-config.example.com")
		tc.credential_exists("https://from-config.example.com", "my-token")

		// When
		tc.execute_logout()

		// Then
		tc.no_error_occurred()
		tc.credential_is_removed("https://from-config.example.com")
		tc.output_contains("Logged out from https://from-config.example.com")
	})

	t.Run("--url flag overrides .bifrost.yaml url", func(t *testing.T) {
		tc := newLogoutTestContext(t)

		// Given
		tc.bifrost_yaml_with_url("https://from-config.example.com")
		tc.credential_exists("https://override.example.com", "my-token")

		// When
		tc.execute_logout("--url", "https://override.example.com")

		// Then
		tc.no_error_occurred()
		tc.credential_is_removed("https://override.example.com")
		tc.output_contains("Logged out from https://override.example.com")
	})

	t.Run("does not error when no credential exists", func(t *testing.T) {
		tc := newLogoutTestContext(t)

		// When
		tc.execute_logout()

		// Then
		tc.no_error_occurred()
		tc.output_contains("Logged out from http://localhost:8080")
	})
}

// --- Test Context ---

type logoutTestContext struct {
	t       *testing.T
	homeDir string
	workDir string
	output  string
	err     error
}

func newLogoutTestContext(t *testing.T) *logoutTestContext {
	t.Helper()
	homeDir := t.TempDir()
	workDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", "")
	return &logoutTestContext{
		t:       t,
		homeDir: homeDir,
		workDir: workDir,
	}
}

// --- Given ---

func (tc *logoutTestContext) credential_exists(url, token string) {
	tc.t.Helper()
	err := SaveCredential(tc.homeDir, url, token)
	require.NoError(tc.t, err)
}

func (tc *logoutTestContext) bifrost_yaml_with_url(url string) {
	tc.t.Helper()
	content := "url: " + url + "\napi_key: dummy\n"
	err := os.WriteFile(filepath.Join(tc.workDir, ".bifrost.yaml"), []byte(content), 0644)
	require.NoError(tc.t, err)
}

// --- When ---

func (tc *logoutTestContext) execute_logout(args ...string) {
	tc.t.Helper()
	cmd := NewLogoutCmd()
	cmd.SetArgs(append(args, "--home-dir", tc.homeDir, "--work-dir", tc.workDir))
	buf := &bytes.Buffer{}
	cmd.SetOut(buf)
	tc.err = cmd.Execute()
	tc.output = buf.String()
}

// --- Then ---

func (tc *logoutTestContext) no_error_occurred() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *logoutTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.output, substr)
}

func (tc *logoutTestContext) credential_is_removed(url string) {
	tc.t.Helper()
	creds, err := LoadCredentials(tc.homeDir)
	require.NoError(tc.t, err)
	_, ok := creds[url]
	assert.False(tc.t, ok, "expected no credential for %q", url)
}
