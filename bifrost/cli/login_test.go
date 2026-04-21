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

func TestLoginCommand(t *testing.T) {
	t.Run("stores credential and prints confirmation", func(t *testing.T) {
		tc := newLoginTestContext(t)

		// When
		tc.execute_login("--token", "my-token")

		// Then
		tc.no_error_occurred()
		tc.credential_is_stored("http://localhost:8080", "my-token")
		tc.output_contains("Logged in to http://localhost:8080")
	})

	t.Run("uses custom url when --url is provided", func(t *testing.T) {
		tc := newLoginTestContext(t)

		// When
		tc.execute_login("--url", "https://bifrost.example.com", "--token", "my-token")

		// Then
		tc.no_error_occurred()
		tc.credential_is_stored("https://bifrost.example.com", "my-token")
		tc.output_contains("Logged in to https://bifrost.example.com")
	})

	t.Run("errors when --token is not provided", func(t *testing.T) {
		tc := newLoginTestContext(t)

		// When
		tc.execute_login()

		// Then
		tc.error_occurred()
		tc.error_contains("token")
	})

	t.Run("defaults url from .bifrost.yaml when available", func(t *testing.T) {
		tc := newLoginTestContext(t)

		// Given
		tc.bifrost_yaml_with_url("https://from-config.example.com")

		// When
		tc.execute_login("--token", "my-token")

		// Then
		tc.no_error_occurred()
		tc.credential_is_stored("https://from-config.example.com", "my-token")
		tc.output_contains("Logged in to https://from-config.example.com")
	})

	t.Run("--url flag overrides .bifrost.yaml url", func(t *testing.T) {
		tc := newLoginTestContext(t)

		// Given
		tc.bifrost_yaml_with_url("https://from-config.example.com")

		// When
		tc.execute_login("--url", "https://override.example.com", "--token", "my-token")

		// Then
		tc.no_error_occurred()
		tc.credential_is_stored("https://override.example.com", "my-token")
		tc.output_contains("Logged in to https://override.example.com")
	})
}

// --- Test Context ---

type loginTestContext struct {
	t       *testing.T
	homeDir string
	workDir string
	output  string
	err     error
}

func newLoginTestContext(t *testing.T) *loginTestContext {
	t.Helper()
	homeDir := t.TempDir()
	workDir := t.TempDir()
	t.Setenv("XDG_CONFIG_HOME", "")
	return &loginTestContext{
		t:       t,
		homeDir: homeDir,
		workDir: workDir,
	}
}

// --- Given ---

func (tc *loginTestContext) bifrost_yaml_with_url(url string) {
	tc.t.Helper()
	content := "url: " + url + "\napi_key: dummy\n"
	err := os.WriteFile(filepath.Join(tc.workDir, ".bifrost.yaml"), []byte(content), 0644)
	require.NoError(tc.t, err)
}

// --- When ---

func (tc *loginTestContext) execute_login(args ...string) {
	tc.t.Helper()
	cmd := NewLoginCmd()
	cmd.SetArgs(append(args, "--home-dir", tc.homeDir, "--work-dir", tc.workDir))
	buf := &bytes.Buffer{}
	cmd.SetOut(buf)
	tc.err = cmd.Execute()
	tc.output = buf.String()
}

// --- Then ---

func (tc *loginTestContext) no_error_occurred() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *loginTestContext) error_occurred() {
	tc.t.Helper()
	assert.Error(tc.t, tc.err)
}

func (tc *loginTestContext) error_contains(substr string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), substr)
}

func (tc *loginTestContext) output_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.output, substr)
}

func (tc *loginTestContext) credential_is_stored(url, token string) {
	tc.t.Helper()
	creds, err := LoadCredentials(tc.homeDir)
	require.NoError(tc.t, err)
	cred, ok := creds[url]
	assert.True(tc.t, ok, "expected credential for %q", url)
	if ok {
		assert.Equal(tc.t, token, cred.Token)
	}
}
