package cli

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
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

	// US-1: Completion Note Appended Automatically
	t.Run("appends completion note with stats after successful agent execution", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-abc", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		// Agent outputs stats on stdout
		dispatcher := &stubDispatcher{
			result: &DispatchResult{
				Command: "echo",
				Args:    []string{`{"duration_ms":42000,"input_tokens":1200,"output_tokens":800,"cache_read_input_tokens":400,"cache_creation_input_tokens":0,"total_cost_usd":0.0031,"num_turns":7}`},
			},
		}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		// Should append a note with the stats
		tc.assert_request_made("POST", "/api/add-note")
		tc.assert_note_contains_text(t, "duration")
		tc.assert_note_contains_text(t, "42")
		tc.assert_note_contains_text(t, "turn")
		tc.assert_note_contains_text(t, "token")
	})

	t.Run("note includes token counts in human-readable format", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-token-test", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &stubDispatcher{
			result: &DispatchResult{
				Command: "sh",
				Args: []string{"-c", "echo '{\"duration_ms\":42000,\"input_tokens\":1200,\"output_tokens\":800,\"cache_read_input_tokens\":0,\"cache_creation_input_tokens\":0,\"total_cost_usd\":0.0031,\"num_turns\":7}'"},
			},
		}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		// Note should contain formatted tokens (with commas)
		tc.assert_request_made("POST", "/api/add-note")
		tc.assert_note_contains_text(t, "1200")  // Could be "1,200" or "1200"
		tc.assert_note_contains_text(t, "800")
	})

	t.Run("note includes cost in USD with 4 decimal places", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-cost-test", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &stubDispatcher{
			result: &DispatchResult{
				Command: "sh",
				Args: []string{"-c", "echo '{\"duration_ms\":42000,\"input_tokens\":1200,\"output_tokens\":800,\"cache_read_input_tokens\":0,\"cache_creation_input_tokens\":0,\"total_cost_usd\":0.0031,\"num_turns\":7}'"},
			},
		}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		// Note should include cost formatted as $X.XXXX
		tc.assert_request_made("POST", "/api/add-note")
		tc.assert_note_contains_text(t, "0.0031")
		tc.assert_note_contains_text(t, "$")
	})

	// US-3: Note Is Traceable as Orchestrator-Authored
	t.Run("note includes [orchestrator] marker for attribution", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-author-test", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &stubDispatcher{
			result: &DispatchResult{
				Command: "echo",
				Args:    []string{`{"duration_ms":42000,"input_tokens":1200,"output_tokens":800,"cache_read_input_tokens":0,"cache_creation_input_tokens":0,"total_cost_usd":0.0031,"num_turns":7}`},
			},
		}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		tc.assert_request_made("POST", "/api/add-note")
		tc.assert_note_contains_text(t, "orchestrator")
	})

	// US-6: No Note Written on Agent Failure
	t.Run("does not append note when agent exits with non-zero code", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-fail", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &stubDispatcher{result: &DispatchResult{Command: "sh", Args: []string{"-c", "exit 1"}}}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		tc.assert_no_request("POST", "/api/add-note")
		tc.assert_no_request("POST", "/api/fulfill-rune")
	})

	t.Run("rune remains claimed when agent fails", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-fail-claimed", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &stubDispatcher{result: &DispatchResult{Command: "sh", Args: []string{"-c", "exit 1"}}}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		tc.assert_no_request("POST", "/api/unclaim-rune")
		tc.assert_no_request("POST", "/api/add-note")
	})

	// US-7: Token Cache Stats Are Visible in Note
	t.Run("note includes cache read tokens when present", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-cache-read", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &stubDispatcher{
			result: &DispatchResult{
				Command: "echo",
				Args:    []string{`{"duration_ms":42000,"input_tokens":1200,"output_tokens":800,"cache_read_input_tokens":400,"cache_creation_input_tokens":0,"total_cost_usd":0.0031,"num_turns":7}`},
			},
		}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		tc.assert_request_made("POST", "/api/add-note")
		tc.assert_note_contains_text(t, "400")  // Cache read tokens
		tc.assert_note_contains_text(t, "cache")
	})

	t.Run("note includes cache creation tokens when present", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-cache-write", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &stubDispatcher{
			result: &DispatchResult{
				Command: "echo",
				Args:    []string{`{"duration_ms":42000,"input_tokens":1200,"output_tokens":800,"cache_read_input_tokens":0,"cache_creation_input_tokens":200,"total_cost_usd":0.0031,"num_turns":7}`},
			},
		}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		tc.assert_request_made("POST", "/api/add-note")
		tc.assert_note_contains_text(t, "200")  // Cache creation tokens
	})

	t.Run("note appended before rune is fulfilled", func(t *testing.T) {
		tc := newOrchestratorTestContext(t)

		// Given
		rune := map[string]any{"id": "bf-order", "title": "Test", "claimant": ""}
		tc.ready_runes_then_detail([]map[string]any{rune}, rune)
		dispatcher := &stubDispatcher{
			result: &DispatchResult{
				Command: "echo",
				Args:    []string{`{"duration_ms":42000,"input_tokens":1200,"output_tokens":800,"cache_read_input_tokens":0,"cache_creation_input_tokens":0,"total_cost_usd":0.0031,"num_turns":7}`},
			},
		}

		// When
		tc.run_once(dispatcher, "", false, false)

		// Then
		// Verify order: add-note must come before fulfill-rune
		tc.assert_request_made("POST", "/api/add-note")
		tc.assert_request_made("POST", "/api/fulfill-rune")
		tc.assert_request_order(t, "/api/add-note", "/api/fulfill-rune")
	})
}

// --- Stub helpers ---

type stubDispatcher struct {
	result    *DispatchResult
	callCount int
	mu        sync.Mutex
}

func (s *stubDispatcher) Dispatch(ctx context.Context, rune DispatchInput) (*DispatchResult, error) {
	s.mu.Lock()
	s.callCount++
	s.mu.Unlock()
	return s.result, nil
}

type failingDispatcher struct{}

func (f *failingDispatcher) Dispatch(ctx context.Context, rune DispatchInput) (*DispatchResult, error) {
	return nil, assert.AnError
}

// --- Test context ---

type orchestratorTestContext struct {
	t           *testing.T
	server      *httptest.Server
	requests    []recordedRequest
	mu          sync.Mutex
	claimBodies []map[string]any
}

type recordedRequest struct {
	method string
	path   string
	query  map[string]string
	body   map[string]any
}

// recordRequestHandler captures HTTP requests and routes responses based on handlerFn.
// handlerFn should encode the response body and write to w; recordRequestHandler handles
// request capture, query parsing, POST body unmarshaling, and cleanup.
type recordRequestHandler struct {
	tc        *orchestratorTestContext
	handlerFn func(w http.ResponseWriter, r *http.Request, rec recordedRequest)
}

func (h *recordRequestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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

	h.tc.mu.Lock()
	h.tc.requests = append(h.tc.requests, rec)
	if r.URL.Path == "/api/claim-rune" {
		h.tc.claimBodies = append(h.tc.claimBodies, rec.body)
	}
	h.tc.mu.Unlock()

	h.handlerFn(w, r, rec)
}

func newOrchestratorTestContext(t *testing.T) *orchestratorTestContext {
	t.Helper()
	tc := &orchestratorTestContext{t: t}

	tc.server = httptest.NewServer(&recordRequestHandler{
		tc: tc,
		handlerFn: func(w http.ResponseWriter, r *http.Request, rec recordedRequest) {
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
		},
	})
	t.Cleanup(tc.server.Close)

	return tc
}

// ready_runes configures the server to return these runes from GET /api/runes.
func (tc *orchestratorTestContext) ready_runes(runes []map[string]any) {
	tc.t.Helper()
	tc.server.Close()

	tc.server = httptest.NewServer(&recordRequestHandler{
		tc: tc,
		handlerFn: func(w http.ResponseWriter, r *http.Request, rec recordedRequest) {
			w.Header().Set("Content-Type", "application/json")
			if r.Method == "GET" && r.URL.Path == "/api/runes" {
				_ = json.NewEncoder(w).Encode(runes)
			} else {
				w.WriteHeader(http.StatusNoContent)
			}
		},
	})
	tc.t.Cleanup(tc.server.Close)
}

// ready_runes_then_detail configures the server to return list runes and one detail rune.
func (tc *orchestratorTestContext) ready_runes_then_detail(runes []map[string]any, detail map[string]any) {
	tc.t.Helper()
	tc.server.Close()

	tc.server = httptest.NewServer(&recordRequestHandler{
		tc: tc,
		handlerFn: func(w http.ResponseWriter, r *http.Request, rec recordedRequest) {
			w.Header().Set("Content-Type", "application/json")
			switch {
			case r.Method == "GET" && r.URL.Path == "/api/runes":
				_ = json.NewEncoder(w).Encode(runes)
			case r.Method == "GET" && r.URL.Path == "/api/rune":
				_ = json.NewEncoder(w).Encode(detail)
			default:
				w.WriteHeader(http.StatusNoContent)
			}
		},
	})
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
	// runOrchestrator returns synchronously after all workers finish in --once mode,
	// so no additional wait is needed — all requests have been made.
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

func (tc *orchestratorTestContext) assert_note_contains_text(t *testing.T, text string) {
	t.Helper()
	tc.mu.Lock()
	defer tc.mu.Unlock()
	for _, r := range tc.requests {
		if r.method == "POST" && r.path == "/api/add-note" {
			noteText, ok := r.body["text"].(string)
			if ok && strings.Contains(noteText, text) {
				return
			}
		}
	}
	t.Errorf("expected note to contain %q but it did not", text)
}

func (tc *orchestratorTestContext) assert_request_order(t *testing.T, firstPath, secondPath string) {
	t.Helper()
	tc.mu.Lock()
	defer tc.mu.Unlock()
	firstIdx := -1
	secondIdx := -1
	for i, r := range tc.requests {
		if r.path == firstPath {
			firstIdx = i
		}
		if r.path == secondPath {
			secondIdx = i
		}
	}
	if firstIdx == -1 {
		t.Errorf("first request %q not found", firstPath)
		return
	}
	if secondIdx == -1 {
		t.Errorf("second request %q not found", secondPath)
		return
	}
	if firstIdx >= secondIdx {
		t.Errorf("expected %q before %q, but got %d >= %d", firstPath, secondPath, firstIdx, secondIdx)
	}
}
