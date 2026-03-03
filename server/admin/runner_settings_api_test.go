package admin

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestRunnerSettingsAPI_CreateRunnerSettings(t *testing.T) {
	t.Run("creates runner settings with valid data", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.valid_create_runner_settings_request()
		tc.admin_auth_configured()

		// When
		tc.create_runner_settings_request_is_made()

		// Then
		tc.status_is_created()
		tc.response_contains_runner_settings_id()
	})

	t.Run("returns bad request for empty runner type", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.create_runner_settings_request_with_empty_runner_type()
		tc.admin_auth_configured()

		// When
		tc.create_runner_settings_request_is_made()

		// Then
		tc.status_is_bad_request()
	})

	t.Run("returns bad request for empty name", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.create_runner_settings_request_with_empty_name()
		tc.admin_auth_configured()

		// When
		tc.create_runner_settings_request_is_made()

		// Then
		tc.status_is_bad_request()
	})
}

func TestRunnerSettingsAPI_ListRunnerSettings(t *testing.T) {
	t.Run("returns empty list when no runner settings exist", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.admin_auth_configured()

		// When
		tc.list_runner_settings_request_is_made()

		// Then
		tc.status_is_ok()
		tc.response_is_empty_list()
	})

	t.Run("returns list of runner settings", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.runner_settings_exists_in_store("rs-001", "github", "GitHub Settings")

		// When
		tc.list_runner_settings_request_is_made()

		// Then
		tc.status_is_ok()
		tc.response_contains_runner_settings()
	})
}

func TestRunnerSettingsAPI_GetRunnerSettings(t *testing.T) {
	t.Run("returns runner settings details", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.runner_settings_exists_in_store("rs-001", "github", "GitHub Settings")

		// When
		tc.get_runner_settings_request_is_made("rs-001")

		// Then
		tc.status_is_ok()
		tc.response_contains_runner_settings_details()
	})

	t.Run("returns not found for non-existent runner settings", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.admin_auth_configured()

		// When
		tc.get_runner_settings_request_is_made("rs-nonexistent")

		// Then
		tc.status_is_not_found()
	})
}

func TestRunnerSettingsAPI_SetField(t *testing.T) {
	t.Run("sets field value as plain text", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.runner_settings_exists_in_store("rs-001", "github", "GitHub Settings")
		tc.set_field_request("rs-001", "api_key", "plain-value")

		// When
		tc.set_field_request_is_made()

		// Then
		tc.status_is_no_content()
	})

	t.Run("encrypts field value with encrypted: prefix", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.runner_settings_exists_in_store("rs-001", "github", "GitHub Settings")
		tc.set_field_request("rs-001", "secret_key", "encrypted:secret-value")

		// When
		tc.set_field_request_is_made()

		// Then
		tc.status_is_no_content()
		tc.field_is_encrypted_in_store()
	})

	t.Run("returns not found for non-existent runner settings", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.set_field_request("rs-nonexistent", "api_key", "value")

		// When
		tc.set_field_request_is_made()

		// Then
		tc.status_is_not_found()
	})

	t.Run("returns bad request for empty key", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.runner_settings_exists_in_store("rs-001", "github", "GitHub Settings")
		tc.set_field_request("rs-001", "", "value")

		// When
		tc.set_field_request_is_made()

		// Then
		tc.status_is_bad_request()
	})
}

func TestRunnerSettingsAPI_DeleteRunnerSettings(t *testing.T) {
	t.Run("deletes existing runner settings", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.admin_auth_configured()
		tc.runner_settings_exists_in_store("rs-001", "github", "GitHub Settings")

		// When
		tc.delete_runner_settings_request_is_made("rs-001")

		// Then
		tc.status_is_no_content()
	})

	t.Run("returns not found for non-existent runner settings", func(t *testing.T) {
		tc := newRunnerSettingsTestContext(t)

		// Given
		tc.admin_auth_configured()

		// When
		tc.delete_runner_settings_request_is_made("rs-nonexistent")

		// Then
		tc.status_is_not_found()
	})
}

// --- Test Context ---

type runnerSettingsTestContext struct {
	t         *testing.T
	mux       *http.ServeMux
	recorder  *httptest.ResponseRecorder
	store     *mockEventStore
	cfg       *RouteConfig
	encryptor *mockEncryptionService
	validJWT  string

	// Request data
	requestBody      []byte
	runnerSettingsID string
	fieldKey         string
	fieldValue       string
}

func newRunnerSettingsTestContext(t *testing.T) *runnerSettingsTestContext {
	t.Helper()

	store := newMockEventStore()
	encryptor := newMockEncryptionService()
	projStore := newMockProjectionStore()
	cfg := &RouteConfig{
		AuthConfig:        DefaultAuthConfig(),
		ProjectionStore:   projStore,
		EventStore:        store,
		EncryptionService: encryptor,
	}

	// Generate signing key
	cfg.AuthConfig.SigningKey = make([]byte, 32)
	_, err := rand.Read(cfg.AuthConfig.SigningKey)
	require.NoError(t, err, "failed to generate signing key")

	// Create a valid JWT for authenticated requests
	projStore.data[compositeKey("_admin", "account_lookup", "pat:pat-test-123")] = "keyhash-test"
	projStore.data[compositeKey("_admin", "account_lookup", "keyhash-test")] = projectors.AccountLookupEntry{
		AccountID: "account-test-123",
		Username:  "testuser",
		Status:    "active",
		Roles:     map[string]string{"_admin": "admin"},
	}

	validJWT, err := GenerateJWT(cfg.AuthConfig, "account-test-123", "pat-test-123")
	require.NoError(t, err, "failed to generate JWT")

	mux := http.NewServeMux()
	RegisterRunnerSettingsAPIRoutes(mux, cfg)

	return &runnerSettingsTestContext{
		t:         t,
		mux:       mux,
		recorder:  httptest.NewRecorder(),
		store:     store,
		cfg:       cfg,
		encryptor: encryptor,
		validJWT:  validJWT,
	}
}

// --- Given ---

func (tc *runnerSettingsTestContext) admin_auth_configured() {
	tc.t.Helper()
	// Already configured in newRunnerSettingsTestContext
}

func (tc *runnerSettingsTestContext) valid_create_runner_settings_request() {
	tc.t.Helper()
	req := map[string]interface{}{
		"runner_type": "github",
		"name":        "GitHub Settings",
	}
	tc.requestBody, _ = json.Marshal(req)
}

func (tc *runnerSettingsTestContext) create_runner_settings_request_with_empty_runner_type() {
	tc.t.Helper()
	req := map[string]interface{}{
		"runner_type": "",
		"name":        "GitHub Settings",
	}
	tc.requestBody, _ = json.Marshal(req)
}

func (tc *runnerSettingsTestContext) create_runner_settings_request_with_empty_name() {
	tc.t.Helper()
	req := map[string]interface{}{
		"runner_type": "github",
		"name":        "",
	}
	tc.requestBody, _ = json.Marshal(req)
}

func (tc *runnerSettingsTestContext) set_field_request(runnerSettingsID, key, value string) {
	tc.t.Helper()
	tc.runnerSettingsID = runnerSettingsID
	tc.fieldKey = key
	tc.fieldValue = value
	req := map[string]interface{}{
		"key":   key,
		"value": value,
	}
	tc.requestBody, _ = json.Marshal(req)
}

func (tc *runnerSettingsTestContext) runner_settings_exists_in_store(runnerSettingsID, runnerType, name string) {
	tc.t.Helper()
	data := map[string]interface{}{
		"runner_settings_id": runnerSettingsID,
		"runner_type":        runnerType,
		"name":               name,
	}
	dataBytes, _ := json.Marshal(data)
	tc.store.streams["_admin|rs-"+runnerSettingsID] = []core.Event{
		{
			RealmID:   "_admin",
			StreamID:  "rs-" + runnerSettingsID,
			Version:   0,
			EventType: "RunnerSettingsCreated",
			Data:      dataBytes,
		},
	}
}

// --- When ---

func (tc *runnerSettingsTestContext) create_runner_settings_request_is_made() {
	tc.t.Helper()
	req := httptest.NewRequest("POST", "/admin/runner-settings", bytes.NewReader(tc.requestBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *runnerSettingsTestContext) list_runner_settings_request_is_made() {
	tc.t.Helper()
	req := httptest.NewRequest("GET", "/admin/runner-settings", nil)
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *runnerSettingsTestContext) get_runner_settings_request_is_made(runnerSettingsID string) {
	tc.t.Helper()
	req := httptest.NewRequest("GET", "/admin/runner-settings/"+runnerSettingsID, nil)
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *runnerSettingsTestContext) set_field_request_is_made() {
	tc.t.Helper()
	req := httptest.NewRequest("POST", "/admin/runner-settings/"+tc.runnerSettingsID+"/fields", bytes.NewReader(tc.requestBody))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *runnerSettingsTestContext) delete_runner_settings_request_is_made(runnerSettingsID string) {
	tc.t.Helper()
	req := httptest.NewRequest("DELETE", "/admin/runner-settings/"+runnerSettingsID, nil)
	req.AddCookie(&http.Cookie{Name: tc.cfg.AuthConfig.CookieName, Value: tc.validJWT})
	tc.recorder = httptest.NewRecorder()
	tc.mux.ServeHTTP(tc.recorder, req)
}

// --- Then ---

func (tc *runnerSettingsTestContext) status_is_created() {
	tc.t.Helper()
	assert.Equal(tc.t, http.StatusCreated, tc.recorder.Code)
}

func (tc *runnerSettingsTestContext) status_is_ok() {
	tc.t.Helper()
	assert.Equal(tc.t, http.StatusOK, tc.recorder.Code)
}

func (tc *runnerSettingsTestContext) status_is_no_content() {
	tc.t.Helper()
	assert.Equal(tc.t, http.StatusNoContent, tc.recorder.Code)
}

func (tc *runnerSettingsTestContext) status_is_bad_request() {
	tc.t.Helper()
	assert.Equal(tc.t, http.StatusBadRequest, tc.recorder.Code)
}

func (tc *runnerSettingsTestContext) status_is_not_found() {
	tc.t.Helper()
	assert.Equal(tc.t, http.StatusNotFound, tc.recorder.Code)
}

func (tc *runnerSettingsTestContext) response_contains_runner_settings_id() {
	tc.t.Helper()
	var resp map[string]interface{}
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err)
	assert.NotEmpty(tc.t, resp["runner_settings_id"])
}

func (tc *runnerSettingsTestContext) response_is_empty_list() {
	tc.t.Helper()
	var resp []interface{}
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err)
	assert.Empty(tc.t, resp)
}

func (tc *runnerSettingsTestContext) response_contains_runner_settings() {
	tc.t.Helper()
	var resp []map[string]interface{}
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err)
	assert.NotEmpty(tc.t, resp)
}

func (tc *runnerSettingsTestContext) response_contains_runner_settings_details() {
	tc.t.Helper()
	var resp map[string]interface{}
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err)
	assert.NotEmpty(tc.t, resp["runner_settings_id"])
	assert.NotEmpty(tc.t, resp["runner_type"])
	assert.NotEmpty(tc.t, resp["name"])
}

func (tc *runnerSettingsTestContext) field_is_encrypted_in_store() {
	tc.t.Helper()
	// Verify that the encryption service was called
	assert.True(tc.t, tc.encryptor.encryptCalled)
}

// --- Mocks ---

type mockEncryptionService struct {
	encryptCalled bool
	lastPlaintext string
}

func newMockEncryptionService() *mockEncryptionService {
	return &mockEncryptionService{}
}

func (m *mockEncryptionService) Encrypt(plaintext string) (string, error) {
	m.encryptCalled = true
	m.lastPlaintext = plaintext
	return "encrypted:" + plaintext, nil
}

func (m *mockEncryptionService) Decrypt(ciphertext string) (string, error) {
	return ciphertext, nil
}
