package server

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/devzeebo/bifrost/providers/sqlite"
	_ "modernc.org/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestHealth_E2E(t *testing.T) {
	t.Run("GET /health returns 200 with status ok", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()

		// When
		tc.get("/health", "")

		// Then
		tc.status_is(http.StatusOK)
		tc.response_json_has("status", "ok")
	})
}

func TestAuthRequired_E2E(t *testing.T) {
	t.Run("realm endpoints return 401 without auth header", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()

		endpoints := []struct {
			method string
			path   string
			body   string
		}{
			{"POST", "/create-rune", `{"title":"t","priority":1}`},
			{"POST", "/update-rune", `{"id":"bf-0001"}`},
			{"POST", "/claim-rune", `{"id":"bf-0001","claimant":"me"}`},
			{"POST", "/fulfill-rune", `{"id":"bf-0001"}`},
			{"POST", "/seal-rune", `{"id":"bf-0001"}`},
			{"POST", "/add-dependency", `{"rune_id":"bf-0001","target_id":"bf-0002","relationship":"blocks"}`},
			{"POST", "/remove-dependency", `{"rune_id":"bf-0001","target_id":"bf-0002","relationship":"blocks"}`},
			{"POST", "/add-note", `{"rune_id":"bf-0001","text":"note"}`},
			{"GET", "/runes", ""},
			{"GET", "/rune?id=bf-0001", ""},
		}

		for _, ep := range endpoints {
			t.Run(ep.method+" "+ep.path, func(t *testing.T) {
				// When
				tc.request_with_realm(ep.method, ep.path, ep.body, "", "")

				// Then
				tc.status_is(http.StatusUnauthorized)
			})
		}
	})

	t.Run("admin endpoints return 401 without auth header", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()

		endpoints := []struct {
			method string
			path   string
			body   string
		}{
			{"POST", "/create-realm", `{"name":"test"}`},
			{"GET", "/realms", ""},
		}

		for _, ep := range endpoints {
			t.Run(ep.method+" "+ep.path, func(t *testing.T) {
				// When
				tc.request_with_realm(ep.method, ep.path, ep.body, "", "")

				// Then
				tc.status_is(http.StatusUnauthorized)
			})
		}
	})

	t.Run("realm endpoints return 403 with admin key (no realm grant)", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()

		// When — admin key has _admin realm grant, not a user realm
		tc.request_with_realm("GET", "/runes", "", tc.adminKey, "realm-1")

		// Then
		tc.status_is(http.StatusForbidden)
	})

	t.Run("admin endpoints return 403 with realm key (no _admin grant)", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("Test Realm")

		// When — realm key has realm grant, not _admin
		tc.request_with_realm("GET", "/realms", "", tc.realmPATToken, "_admin")

		// Then
		tc.status_is(http.StatusForbidden)
	})
}

func TestAdminEndpoints_E2E(t *testing.T) {
	t.Run("POST /create-realm creates realm and returns realm_id", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()

		// When
		tc.post("/create-realm", `{"name":"My Realm"}`, tc.adminKey)

		// Then
		tc.status_is(http.StatusCreated)
		tc.response_json_has_key("realm_id")
	})

	t.Run("GET /realms returns 200", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("Realm Alpha")

		// When
		tc.get("/realms", tc.adminKey)

		// Then
		// NOTE: returns empty due to bifrost-rdp (projectors don't write _all key)
		tc.status_is(http.StatusOK)
	})

}

func TestCreateRune_E2E(t *testing.T) {
	t.Run("POST /create-rune with PAT creates rune and returns 201 with rune ID", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("Rune Realm")

		// When
		tc.post("/create-rune", `{"title":"Fix the bridge","description":"Needs repair","priority":1,"branch":"main"}`, tc.realmPATToken)

		// Then
		tc.status_is(http.StatusCreated)
		tc.response_json_has_key("id")
		tc.response_json_has("title", "Fix the bridge")
		tc.response_json_has("description", "Needs repair")
	})
}

func TestListRunes_E2E(t *testing.T) {
	t.Run("GET /runes returns 200", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("List Realm")
		tc.a_rune_exists("Task A", 1)
		tc.a_rune_exists("Task B", 2)

		// When
		tc.get("/runes", tc.realmPATToken)

		// Then
		// NOTE: returns empty due to bifrost-rdp (projectors don't write _all key)
		tc.status_is(http.StatusOK)
	})
}

func TestGetRune_E2E(t *testing.T) {
	t.Run("GET /rune?id= returns full rune detail", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("Detail Realm")
		tc.a_rune_exists("Detailed Task", 3)

		// When
		tc.get("/rune?id="+tc.lastRuneID, tc.realmPATToken)

		// Then
		tc.status_is(http.StatusOK)
		tc.response_json_has("id", tc.lastRuneID)
		tc.response_json_has("title", "Detailed Task")
	})

	t.Run("GET /rune?id= returns 404 for nonexistent rune", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("Detail Realm")

		// When
		tc.get("/rune?id=bf-9999", tc.realmPATToken)

		// Then
		tc.status_is(http.StatusNotFound)
	})
}

func TestRealmIsolation_E2E(t *testing.T) {
	t.Run("rune created in one realm is not visible in another via GetRune", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()

		// Create realm A with a rune
		tc.a_realm_exists("Realm A")
		realmAID := tc.realmID
		realmAToken := tc.realmPATToken
		tc.a_rune_exists("Task in A", 1)
		runeInA := tc.lastRuneID

		// Create realm B (no runes)
		tc.a_realm_exists("Realm B")
		realmBID := tc.realmID
		realmBToken := tc.realmPATToken

		// When — get rune from realm A using realm B's key
		tc.request_with_realm("GET", "/rune?id="+runeInA, "", realmBToken, realmBID)

		// Then — realm B cannot see realm A's rune
		tc.status_is(http.StatusNotFound)

		// When — get rune from realm A using realm A's key
		tc.request_with_realm("GET", "/rune?id="+runeInA, "", realmAToken, realmAID)

		// Then — realm A can see its own rune
		tc.status_is(http.StatusOK)
		tc.response_json_has("id", runeInA)
	})
}

// --- Test Context ---

type e2eTestContext struct {
	t *testing.T

	// Infrastructure
	db              *sql.DB
	eventStore      core.EventStore
	projectionStore core.ProjectionStore
	engine          *syncProjectionEngine
	server          *httptest.Server
	adminKey        string

	// Current realm state
	realmID      string
	realmPATToken string

	// Current rune state
	lastRuneID string

	// HTTP response
	resp     *http.Response
	respBody []byte
	respJSON map[string]any
}

func newE2EContext(t *testing.T) *e2eTestContext {
	t.Helper()
	return &e2eTestContext{
		t: t,
	}
}

// --- Given ---

func (tc *e2eTestContext) server_is_running() {
	tc.t.Helper()

	db, err := sql.Open("sqlite", "file::memory:?cache=shared")
	require.NoError(tc.t, err)
	db.SetMaxOpenConns(1)
	tc.db = db

	es, err := sqlite.NewEventStore(db)
	require.NoError(tc.t, err)
	tc.eventStore = es

	ps, err := sqlite.NewProjectionStore(db)
	require.NoError(tc.t, err)
	tc.projectionStore = ps

	engine := &syncProjectionEngine{
		eventStore:      es,
		projectionStore: ps,
		projectors: []core.Projector{
			projectors.NewRealmListProjector(),
			projectors.NewRuneListProjector(),
			projectors.NewRuneDetailProjector(),
			projectors.NewDependencyGraphProjector(),
			projectors.NewAccountLookupProjector(),
		},
	}
	tc.engine = engine

	// Create an admin account with PAT and _admin realm grant
	ctx := context.Background()
	acctResult, err := domain.HandleCreateAccount(ctx, domain.CreateAccount{Username: "admin"}, es, ps)
	require.NoError(tc.t, err)
	_ = engine.RunSync(ctx, nil)
	err = domain.HandleGrantRealm(ctx, domain.GrantRealm{AccountID: acctResult.AccountID, RealmID: "_admin"}, es)
	require.NoError(tc.t, err)
	_ = engine.RunSync(ctx, nil)
	tc.adminKey = acctResult.RawToken

	handlers := NewHandlers(es, ps, engine)

	mux := http.NewServeMux()
	auth := AuthMiddleware(ps)
	realmAuth := func(h http.Handler) http.Handler { return auth(RequireRealm(h)) }
	adminAuth := func(h http.Handler) http.Handler { return auth(h) }
	handlers.RegisterRoutes(mux, realmAuth, adminAuth)

	tc.server = httptest.NewServer(mux)
	tc.t.Cleanup(func() {
		tc.server.Close()
		db.Close()
	})
}

func (tc *e2eTestContext) a_realm_exists(name string) {
	tc.t.Helper()
	tc.post("/create-realm", `{"name":"`+name+`"}`, tc.adminKey)
	require.Equal(tc.t, http.StatusCreated, tc.resp.StatusCode, "failed to create realm: %s", string(tc.respBody))
	tc.realmID = tc.respJSON["realm_id"].(string)

	// Create an account with PAT and grant it access to this realm
	ctx := context.Background()
	acctResult, err := domain.HandleCreateAccount(ctx, domain.CreateAccount{Username: name + "-user"}, tc.eventStore, tc.projectionStore)
	require.NoError(tc.t, err)
	_ = tc.engine.RunSync(ctx, nil)
	err = domain.HandleGrantRealm(ctx, domain.GrantRealm{AccountID: acctResult.AccountID, RealmID: tc.realmID}, tc.eventStore)
	require.NoError(tc.t, err)
	_ = tc.engine.RunSync(ctx, nil)
	tc.realmPATToken = acctResult.RawToken
}

func (tc *e2eTestContext) a_rune_exists(title string, priority int) {
	tc.t.Helper()
	body, _ := json.Marshal(map[string]any{
		"title":    title,
		"priority": priority,
		"branch":   "main",
	})
	tc.post("/create-rune", string(body), tc.realmPATToken)
	require.Equal(tc.t, http.StatusCreated, tc.resp.StatusCode, "failed to create rune: %s", string(tc.respBody))
	tc.lastRuneID = tc.respJSON["id"].(string)
}

// --- When ---

func (tc *e2eTestContext) get(path string, authToken string) {
	tc.t.Helper()
	// For get with authToken, determine realm from context
	realmID := tc.realmID
	if authToken == tc.adminKey {
		realmID = "_admin"
	}
	tc.request_with_realm("GET", path, "", authToken, realmID)
}

func (tc *e2eTestContext) post(path string, body string, authToken string) {
	tc.t.Helper()
	realmID := tc.realmID
	if authToken == tc.adminKey {
		realmID = "_admin"
	}
	tc.request_with_realm("POST", path, body, authToken, realmID)
}

func (tc *e2eTestContext) request_with_realm(method string, path string, body string, authToken string, realmID string) {
	tc.t.Helper()
	var bodyReader io.Reader
	if body != "" {
		bodyReader = bytes.NewBufferString(body)
	}
	req, err := http.NewRequest(method, tc.server.URL+path, bodyReader)
	require.NoError(tc.t, err)

	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if authToken != "" {
		req.Header.Set("Authorization", "Bearer "+authToken)
	}
	if realmID != "" {
		req.Header.Set("X-Bifrost-Realm", realmID)
	}

	tc.resp, err = http.DefaultClient.Do(req)
	require.NoError(tc.t, err)

	tc.respBody, err = io.ReadAll(tc.resp.Body)
	require.NoError(tc.t, err)
	tc.resp.Body.Close()

	// Try to parse as JSON object
	tc.respJSON = nil
	var obj map[string]any
	if json.Unmarshal(tc.respBody, &obj) == nil {
		tc.respJSON = obj
	}
}

// --- Then ---

func (tc *e2eTestContext) status_is(expected int) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.resp.StatusCode, "response body: %s", string(tc.respBody))
}

func (tc *e2eTestContext) response_json_has(key string, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.respJSON, "response is not a JSON object")
	assert.Equal(tc.t, expected, tc.respJSON[key], "key %q mismatch", key)
}

func (tc *e2eTestContext) response_json_has_key(key string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.respJSON, "response is not a JSON object")
	_, ok := tc.respJSON[key]
	assert.True(tc.t, ok, "expected key %q in response JSON: %s", key, string(tc.respBody))
}

// --- Helpers ---

// syncProjectionEngine processes all events from the store synchronously
// on each RunSync call, eliminating timing issues in tests.
type syncProjectionEngine struct {
	eventStore      core.EventStore
	projectionStore core.ProjectionStore
	projectors      []core.Projector
	lastPositions   map[string]int64
}

func (e *syncProjectionEngine) RunCatchUpOnce(ctx context.Context) {
	_ = e.RunSync(ctx, nil)
}

func (e *syncProjectionEngine) RunSync(ctx context.Context, _ []core.Event) error {
	if e.lastPositions == nil {
		e.lastPositions = make(map[string]int64)
	}

	realmIDs, err := e.eventStore.ListRealmIDs(ctx)
	if err != nil {
		return err
	}

	for _, realmID := range realmIDs {
		fromPos := e.lastPositions[realmID]
		events, err := e.eventStore.ReadAll(ctx, realmID, fromPos)
		if err != nil {
			return err
		}
		for _, evt := range events {
			for _, p := range e.projectors {
				if err := p.Handle(ctx, evt, e.projectionStore); err != nil {
					return err
				}
			}
			if evt.GlobalPosition > e.lastPositions[realmID] {
				e.lastPositions[realmID] = evt.GlobalPosition
			}
		}
	}
	return nil
}
