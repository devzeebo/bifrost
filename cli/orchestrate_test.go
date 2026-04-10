package cli

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRunOrchestrator(t *testing.T) {
	t.Run("polls ready runes with correct parameters", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		tc.ready_runes([]map[string]any{})
		dispatcher := &stubDispatcher{}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		tc.assert_request_made("GET", "/api/runes")
		tc.assert_query_param("status", "open")
		tc.assert_query_param("blocked", "false")
		tc.assert_query_param("is_saga", "false")
	})

	t.Run("filters by saga when provided", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		tc.ready_runes([]map[string]any{})
		dispatcher := &stubDispatcher{}

		// When
		tc.run_once_with_saga(dispatcher, "bf-saga-1")

		// Then
		tc.assert_query_param("saga", "bf-saga-1")
	})

	t.Run("skips already-claimed runes", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		tc.ready_runes([]map[string]any{
			{"id": "bf-1", "title": "Already Claimed", "claimant": "someone"},
		})
		dispatcher := &stubDispatcher{result: &DispatchResult{Command: "echo", Args: []string{"hi"}}}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		assert.Equal(t, 0, dispatcher.callCount, "dispatcher should not be called for claimed runes")
	})

	t.Run("claims rune before dispatching", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-abc", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &stubDispatcher{result: &DispatchResult{Command: "true"}}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		tc.assert_request_made("POST", "/api/claim-rune")
		tc.assert_claim_body("bf-abc", "orchestrator")
	})

	t.Run("unclaims rune when dispatcher returns error", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-abc", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &failingDispatcher{}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		tc.assert_request_made("POST", "/api/unclaim-rune")
	})

	t.Run("unclaims rune when dispatcher returns empty command", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-abc", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &stubDispatcher{result: &DispatchResult{Command: ""}}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		tc.assert_request_made("POST", "/api/unclaim-rune")
	})

	t.Run("fulfills rune on successful agent execution", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-abc", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &stubDispatcher{result: &DispatchResult{Command: "true"}}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		tc.assert_request_made("POST", "/api/fulfill-rune")
	})

	t.Run("leaves rune claimed on failure by default", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-abc", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &stubDispatcher{result: &DispatchResult{Command: "sh", Args: []string{"-c", "exit 1"}}}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		tc.assert_no_request("POST", "/api/unclaim-rune")
		tc.assert_no_request("POST", "/api/fulfill-rune")
	})

	t.Run("unclaims rune on failure when --unclaim-on-failure set", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-abc", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &stubDispatcher{result: &DispatchResult{Command: "sh", Args: []string{"-c", "exit 1"}}}

		// When
		tc.run_once(dispatcher, "", false, true)

		// Then
		tc.assert_request_made("POST", "/api/unclaim-rune")
		tc.assert_no_request("POST", "/api/fulfill-rune")
	})

	t.Run("dry-run: resolves dispatch but does not execute or fulfill", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-abc", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &stubDispatcher{result: &DispatchResult{Command: "echo", Args: []string{"hi"}}}

		// When
		tc.run_once(dispatcher, "", true, false)

		// Then
		assert.Equal(t, 1, dispatcher.callCount, "dispatcher should still be called in dry-run")
		tc.assert_request_made("POST", "/api/claim-rune")
		tc.assert_request_made("POST", "/api/unclaim-rune")
		tc.assert_no_request("POST", "/api/fulfill-rune")
	})
}

// --- Stub helpers ---

type stubDispatcher struct {
	result    *DispatchResult
	callCount int
	mu        sync.Mutex
}

func (s *stubDispatcher) Dispatch(rune DispatchInput) (*DispatchResult, error) {
	s.mu.Lock()
	s.callCount++
	s.mu.Unlock()
	return s.result, nil
}

type failingDispatcher struct{}

func (f *failingDispatcher) Dispatch(rune DispatchInput) (*DispatchResult, error) {
	return nil, assert.AnError
}

// --- Test context ---

type orchestratorTestContext struct {
	t          *testing.T
	server     *httptest.Server
	requests   []recordedRequest
	mu         sync.Mutex
	claimBodies []map[string]any
}

type recordedRequest struct {
	method string
	path   string
	query  map[string]string
	body   map[string]any
}

func newOrchestratorTestContext(t *testing.T) *orchestratorTestContext {
	t.Helper()
	tc := &orchestratorTestContext{t: t}

	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := recordedRequest{
			method: r.Method,
			path:   r.URL.Path,
			query:  make(map[string]string),
		}
		for k, v := range r.URL.Query() {
			if len(v) > 0 {
				rec.query[k] = v[0]
			}
		}
		if r.Method == "POST" {
			body, _ := io.ReadAll(r.Body)
			_ = json.Unmarshal(body, &rec.body)
		}

		tc.mu.Lock()
		tc.requests = append(tc.requests, rec)
		if r.URL.Path == "/api/claim-rune" {
			tc.claimBodies = append(tc.claimBodies, rec.body)
		}
		tc.mu.Unlock()

		// Route responses.
		switch {
		case r.Method == "GET" && r.URL.Path == "/api/runes":
			// Served by handler set in test setup; default empty.
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode([]map[string]any{})
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	}))
	t.Cleanup(tc.server.Close)

	return tc
}

// ready_runes configures the server to return these runes from GET /api/runes.
func (tc *orchestratorTestContext) ready_runes(runes []map[string]any) {
	tc.t.Helper()
	tc.server.Close()

	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := recordedRequest{
			method: r.Method,
			path:   r.URL.Path,
			query:  make(map[string]string),
		}
		for k, v := range r.URL.Query() {
			if len(v) > 0 {
				rec.query[k] = v[0]
			}
		}
		if r.Method == "POST" {
			body, _ := io.ReadAll(r.Body)
			_ = json.Unmarshal(body, &rec.body)
		}

		tc.mu.Lock()
		tc.requests = append(tc.requests, rec)
		if r.URL.Path == "/api/claim-rune" {
			tc.claimBodies = append(tc.claimBodies, rec.body)
		}
		tc.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		if r.Method == "GET" && r.URL.Path == "/api/runes" {
			_ = json.NewEncoder(w).Encode(runes)
		} else {
			w.WriteHeader(http.StatusNoContent)
		}
	}))
	tc.t.Cleanup(tc.server.Close)
}

// ready_runes_then_detail configures the server to return list runes and one detail rune.
func (tc *orchestratorTestContext) ready_runes_then_detail(runes []map[string]any, detail map[string]any) {
	tc.t.Helper()
	tc.server.Close()

	tc.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := recordedRequest{
			method: r.Method,
			path:   r.URL.Path,
			query:  make(map[string]string),
		}
		for k, v := range r.URL.Query() {
			if len(v) > 0 {
				rec.query[k] = v[0]
			}
		}
		if r.Method == "POST" {
			body, _ := io.ReadAll(r.Body)
			_ = json.Unmarshal(body, &rec.body)
		}

		tc.mu.Lock()
		tc.requests = append(tc.requests, rec)
		if r.URL.Path == "/api/claim-rune" {
			tc.claimBodies = append(tc.claimBodies, rec.body)
		}
		tc.mu.Unlock()

		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == "GET" && r.URL.Path == "/api/runes":
			_ = json.NewEncoder(w).Encode(runes)
		case r.Method == "GET" && r.URL.Path == "/api/rune":
			_ = json.NewEncoder(w).Encode(detail)
		default:
			w.WriteHeader(http.StatusNoContent)
		}
	}))
	tc.t.Cleanup(tc.server.Close)
}

func (tc *orchestratorTestContext) client() *Client {
	return NewClient(tc.server.URL, "test-key", "test-realm")
}

func (tc *orchestratorTestContext) run_once(d Dispatcher, saga string, dryRun, unclaimOnFailure bool) {
	tc.t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	cfg := OrchestrateConfig{
		Claimant:    "orchestrator",
		Concurrency: 1,
	}
	err := runOrchestrator(ctx, tc.client(), cfg, d, saga, dryRun, true, unclaimOnFailure)
	require.NoError(tc.t, err)

	// Small wait for goroutines to finish after queue drains.
	time.Sleep(50 * time.Millisecond)
}

func (tc *orchestratorTestContext) run_once_with_saga(d Dispatcher, saga string) {
	tc.t.Helper()
	tc.run_once(d, saga, false, false)
}

func (tc *orchestratorTestContext) assert_request_made(method, path string) {
	tc.t.Helper()
	tc.mu.Lock()
	defer tc.mu.Unlock()
	for _, r := range tc.requests {
		if r.method == method && r.path == path {
			return
		}
	}
	tc.t.Errorf("expected request %s %s but it was not made; requests: %v", method, path, tc.requests)
}

func (tc *orchestratorTestContext) assert_no_request(method, path string) {
	tc.t.Helper()
	tc.mu.Lock()
	defer tc.mu.Unlock()
	for _, r := range tc.requests {
		if r.method == method && r.path == path {
			tc.t.Errorf("expected NO request %s %s but it was made", method, path)
			return
		}
	}
}

func (tc *orchestratorTestContext) assert_query_param(key, value string) {
	tc.t.Helper()
	tc.mu.Lock()
	defer tc.mu.Unlock()
	for _, r := range tc.requests {
		if r.method == "GET" && r.path == "/api/runes" {
			assert.Equal(tc.t, value, r.query[key], "expected query param %s=%s", key, value)
			return
		}
	}
	tc.t.Errorf("no GET /api/runes request found")
}

func (tc *orchestratorTestContext) assert_claim_body(id, claimant string) {
	tc.t.Helper()
	tc.mu.Lock()
	defer tc.mu.Unlock()
	require.NotEmpty(tc.t, tc.claimBodies, "no claim requests made")
	body := tc.claimBodies[0]
	assert.Equal(tc.t, id, body["id"])
	assert.Equal(tc.t, claimant, body["claimant"])
}
