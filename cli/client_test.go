package cli

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestDoRequest(t *testing.T) {
	t.Run("sets authorization bearer header", func(t *testing.T) {
		tc := newClientTestContext(t)

		// Given
		tc.server_that_echoes_headers()
		tc.client_with_api_key("my-secret-key")

		// When
		tc.do_get("/test", nil)

		// Then
		tc.request_has_no_error()
		tc.request_header_was("Authorization", "Bearer my-secret-key")
	})

	t.Run("sets content-type json for POST requests", func(t *testing.T) {
		tc := newClientTestContext(t)

		// Given
		tc.server_that_echoes_headers()
		tc.client_with_api_key("key")

		// When
		tc.do_post("/test", []byte(`{"foo":"bar"}`))

		// Then
		tc.request_has_no_error()
		tc.request_header_was("Content-Type", "application/json")
	})

	t.Run("prepends base URL to path", func(t *testing.T) {
		tc := newClientTestContext(t)

		// Given
		tc.server_that_echoes_path()
		tc.client_with_api_key("key")

		// When
		tc.do_get("/api/runes", nil)

		// Then
		tc.request_has_no_error()
		tc.response_body_contains("/api/runes")
	})

	t.Run("doGet appends query parameters", func(t *testing.T) {
		tc := newClientTestContext(t)

		// Given
		tc.server_that_echoes_path()
		tc.client_with_api_key("key")

		// When
		tc.do_get("/search", map[string]string{"q": "hello", "limit": "10"})

		// Then
		tc.request_has_no_error()
		tc.response_body_contains("q=hello")
		tc.response_body_contains("limit=10")
	})

	t.Run("doPost sends request body", func(t *testing.T) {
		tc := newClientTestContext(t)

		// Given
		tc.server_that_echoes_body()
		tc.client_with_api_key("key")

		// When
		tc.do_post("/create", []byte(`{"name":"test"}`))

		// Then
		tc.request_has_no_error()
		tc.response_body_contains(`{"name":"test"}`)
	})

	t.Run("sends X-Bifrost-Realm header on every request", func(t *testing.T) {
		tc := newClientTestContext(t)

		// Given
		tc.server_that_echoes_headers()
		tc.client_with_config("key", "my-realm")

		// When
		tc.do_get("/test", nil)

		// Then
		tc.request_has_no_error()
		tc.request_header_was("X-Bifrost-Realm", "my-realm")
	})

	t.Run("sends X-Bifrost-Realm header on POST requests", func(t *testing.T) {
		tc := newClientTestContext(t)

		// Given
		tc.server_that_echoes_headers()
		tc.client_with_config("key", "post-realm")

		// When
		tc.do_post("/test", []byte(`{}`))

		// Then
		tc.request_has_no_error()
		tc.request_header_was("X-Bifrost-Realm", "post-realm")
	})
}

// --- Test Context ---

type clientTestContext struct {
	t *testing.T

	server         *httptest.Server
	client         *Client
	receivedHeader http.Header

	resp     *http.Response
	respBody string
	err      error
}

func newClientTestContext(t *testing.T) *clientTestContext {
	t.Helper()
	return &clientTestContext{
		t: t,
	}
}

// --- Given ---

func (tc *clientTestContext) server_that_echoes_headers() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tc.receivedHeader = r.Header
		w.WriteHeader(http.StatusOK)
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *clientTestContext) server_that_echoes_path() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(r.URL.RequestURI()))
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *clientTestContext) server_that_echoes_body() {
	tc.t.Helper()
	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(body)
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *clientTestContext) client_with_api_key(apiKey string) {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: apiKey,
	})
}

func (tc *clientTestContext) client_with_config(apiKey, realm string) {
	tc.t.Helper()
	tc.client = NewClient(&Config{
		URL:    tc.server.URL,
		APIKey: apiKey,
		Realm:  realm,
	})
}

// --- When ---

func (tc *clientTestContext) do_get(path string, params map[string]string) {
	tc.t.Helper()
	tc.resp, tc.err = tc.client.DoGet(path, params)
	if tc.resp != nil {
		body, _ := io.ReadAll(tc.resp.Body)
		tc.resp.Body.Close()
		tc.respBody = string(body)
	}
}

func (tc *clientTestContext) do_post(path string, body []byte) {
	tc.t.Helper()
	tc.resp, tc.err = tc.client.DoPost(path, body)
	if tc.resp != nil {
		respBody, _ := io.ReadAll(tc.resp.Body)
		tc.resp.Body.Close()
		tc.respBody = string(respBody)
	}
}

// --- Then ---

func (tc *clientTestContext) request_has_no_error() {
	tc.t.Helper()
	require.NoError(tc.t, tc.err)
	require.NotNil(tc.t, tc.resp)
}

func (tc *clientTestContext) request_header_was(key, expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.receivedHeader.Get(key))
}

func (tc *clientTestContext) response_body_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.respBody, substr)
}
