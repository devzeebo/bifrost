package server

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestAddACItem_E2E(t *testing.T) {
	t.Run("US1-AC01: POST /add-ac creates AC on rune with ID AC-01", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("AC Realm")
		tc.a_rune_exists("Fix the bridge", 1)

		// When
		body, _ := json.Marshal(map[string]any{
			"rune_id":     tc.lastRuneID,
			"scenario":    "happy path",
			"description": "User logs in successfully",
		})
		tc.post("/api/add-ac", string(body), tc.realmPATToken)

		// Then
		tc.status_is(http.StatusNoContent)
	})

	t.Run("US1-AC03: second POST /add-ac assigns ID AC-02 (sequential)", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("AC Seq Realm")
		tc.a_rune_exists("Sequential task", 1)
		tc.an_ac_exists_on_rune(tc.lastRuneID, "first scenario", "first desc")

		// When
		body, _ := json.Marshal(map[string]any{
			"rune_id":     tc.lastRuneID,
			"scenario":    "second scenario",
			"description": "second desc",
		})
		tc.post("/api/add-ac", string(body), tc.realmPATToken)

		// Then
		tc.status_is(http.StatusNoContent)
		tc.get("/api/rune?id="+tc.lastRuneID, tc.realmPATToken)
		tc.status_is(http.StatusOK)
		tc.response_has_ac_count(2)
		tc.response_ac_has_id(0, "AC-01")
		tc.response_ac_has_id(1, "AC-02")
	})

	t.Run("US1-AC04: GET /rune shows acceptance_criteria with id, scenario, description", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("AC Show Realm")
		tc.a_rune_exists("Detailed task", 1)
		tc.an_ac_exists_on_rune(tc.lastRuneID, "happy path", "User logs in successfully")

		// When
		tc.get("/api/rune?id="+tc.lastRuneID, tc.realmPATToken)

		// Then
		tc.status_is(http.StatusOK)
		tc.response_has_ac_count(1)
		tc.response_ac_has_id(0, "AC-01")
		tc.response_ac_has_scenario(0, "happy path")
		tc.response_ac_has_description(0, "User logs in successfully")
	})

	t.Run("state-gating: POST /add-ac on sealed rune returns error", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("Sealed AC Realm")
		tc.a_rune_exists("Sealed task", 1)
		tc.post("/api/seal-rune", fmt.Sprintf(`{"id":%q}`, tc.lastRuneID), tc.realmPATToken)
		require.Equal(t, http.StatusNoContent, tc.resp.StatusCode)

		// When
		body, _ := json.Marshal(map[string]any{
			"rune_id":     tc.lastRuneID,
			"scenario":    "some path",
			"description": "some desc",
		})
		tc.post("/api/add-ac", string(body), tc.realmPATToken)

		// Then
		tc.status_is(http.StatusUnprocessableEntity)
	})

	t.Run("POST /add-ac requires authentication", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("Auth Realm")
		tc.a_rune_exists("Auth task", 1)

		// When
		tc.request_with_realm("POST", "/api/add-ac",
			fmt.Sprintf(`{"rune_id":%q,"scenario":"s","description":"d"}`, tc.lastRuneID),
			"", tc.realmID)

		// Then
		tc.status_is(http.StatusUnauthorized)
	})
}

func TestUpdateACItem_E2E(t *testing.T) {
	t.Run("US3-AC01: POST /update-ac replaces scenario and description", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("Update AC Realm")
		tc.a_rune_exists("Task with AC", 1)
		tc.an_ac_exists_on_rune(tc.lastRuneID, "old scenario", "old desc")

		// When
		body, _ := json.Marshal(map[string]any{
			"rune_id":     tc.lastRuneID,
			"id":          "AC-01",
			"scenario":    "new scenario",
			"description": "new desc",
		})
		tc.post("/api/update-ac", string(body), tc.realmPATToken)

		// Then
		tc.status_is(http.StatusNoContent)
		tc.get("/api/rune?id="+tc.lastRuneID, tc.realmPATToken)
		tc.status_is(http.StatusOK)
		tc.response_ac_has_scenario(0, "new scenario")
		tc.response_ac_has_description(0, "new desc")
	})

	t.Run("US3-AC02: POST /update-ac with non-existent AC ID returns error", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("Update AC Err Realm")
		tc.a_rune_exists("Task", 1)

		// When
		body, _ := json.Marshal(map[string]any{
			"rune_id":     tc.lastRuneID,
			"id":          "AC-99",
			"scenario":    "s",
			"description": "d",
		})
		tc.post("/api/update-ac", string(body), tc.realmPATToken)

		// Then
		tc.status_is(http.StatusUnprocessableEntity)
	})

	t.Run("state-gating: POST /update-ac on sealed rune returns error", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("Sealed Update AC Realm")
		tc.a_rune_exists("Sealed task", 1)
		tc.an_ac_exists_on_rune(tc.lastRuneID, "some scenario", "some desc")
		tc.post("/api/seal-rune", fmt.Sprintf(`{"id":%q}`, tc.lastRuneID), tc.realmPATToken)
		require.Equal(t, http.StatusNoContent, tc.resp.StatusCode)

		// When
		body, _ := json.Marshal(map[string]any{
			"rune_id":     tc.lastRuneID,
			"id":          "AC-01",
			"scenario":    "new",
			"description": "new",
		})
		tc.post("/api/update-ac", string(body), tc.realmPATToken)

		// Then
		tc.status_is(http.StatusUnprocessableEntity)
	})
}

func TestRemoveACItem_E2E(t *testing.T) {
	t.Run("US4-AC01: POST /remove-ac removes the AC item", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("Remove AC Realm")
		tc.a_rune_exists("Task with AC", 1)
		tc.an_ac_exists_on_rune(tc.lastRuneID, "old scenario", "old desc")

		// When
		body, _ := json.Marshal(map[string]any{
			"rune_id": tc.lastRuneID,
			"id":      "AC-01",
		})
		tc.post("/api/remove-ac", string(body), tc.realmPATToken)

		// Then
		tc.status_is(http.StatusNoContent)
		tc.get("/api/rune?id="+tc.lastRuneID, tc.realmPATToken)
		tc.status_is(http.StatusOK)
		tc.response_has_ac_count(0)
	})

	t.Run("US4-AC02: POST /remove-ac with non-existent AC ID returns error", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("Remove AC Err Realm")
		tc.a_rune_exists("Task", 1)

		// When
		body, _ := json.Marshal(map[string]any{
			"rune_id": tc.lastRuneID,
			"id":      "AC-99",
		})
		tc.post("/api/remove-ac", string(body), tc.realmPATToken)

		// Then
		tc.status_is(http.StatusUnprocessableEntity)
	})

	t.Run("US4-AC03: POST /remove-ac keeps remaining ACs with original IDs", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("Remaining AC Realm")
		tc.a_rune_exists("Task with multiple ACs", 1)
		tc.an_ac_exists_on_rune(tc.lastRuneID, "first scenario", "first desc")
		tc.an_ac_exists_on_rune(tc.lastRuneID, "second scenario", "second desc")
		tc.an_ac_exists_on_rune(tc.lastRuneID, "third scenario", "third desc")

		// When — remove the middle one
		body, _ := json.Marshal(map[string]any{
			"rune_id": tc.lastRuneID,
			"id":      "AC-02",
		})
		tc.post("/api/remove-ac", string(body), tc.realmPATToken)

		// Then — remaining ACs keep their original IDs
		tc.status_is(http.StatusNoContent)
		tc.get("/api/rune?id="+tc.lastRuneID, tc.realmPATToken)
		tc.status_is(http.StatusOK)
		tc.response_has_ac_count(2)
		tc.response_ac_has_id(0, "AC-01")
		tc.response_ac_has_id(1, "AC-03")
	})

	t.Run("US4-AC04: after remove, next added AC gets next counter ID (no reuse)", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("No Reuse Realm")
		tc.a_rune_exists("Task", 1)
		tc.an_ac_exists_on_rune(tc.lastRuneID, "first scenario", "first desc")
		// Remove AC-01
		body, _ := json.Marshal(map[string]any{"rune_id": tc.lastRuneID, "id": "AC-01"})
		tc.post("/api/remove-ac", string(body), tc.realmPATToken)
		require.Equal(t, http.StatusNoContent, tc.resp.StatusCode)

		// When — add a new AC
		addBody, _ := json.Marshal(map[string]any{
			"rune_id":     tc.lastRuneID,
			"scenario":    "new scenario",
			"description": "new desc",
		})
		tc.post("/api/add-ac", string(addBody), tc.realmPATToken)

		// Then — new AC gets AC-02, not AC-01
		tc.status_is(http.StatusNoContent)
		tc.get("/api/rune?id="+tc.lastRuneID, tc.realmPATToken)
		tc.status_is(http.StatusOK)
		tc.response_has_ac_count(1)
		tc.response_ac_has_id(0, "AC-02")
	})

	t.Run("state-gating: POST /remove-ac on sealed rune returns error", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()
		tc.a_realm_exists("Sealed Remove AC Realm")
		tc.a_rune_exists("Sealed task", 1)
		tc.an_ac_exists_on_rune(tc.lastRuneID, "some scenario", "some desc")
		tc.post("/api/seal-rune", fmt.Sprintf(`{"id":%q}`, tc.lastRuneID), tc.realmPATToken)
		require.Equal(t, http.StatusNoContent, tc.resp.StatusCode)

		// When
		body, _ := json.Marshal(map[string]any{
			"rune_id": tc.lastRuneID,
			"id":      "AC-01",
		})
		tc.post("/api/remove-ac", string(body), tc.realmPATToken)

		// Then
		tc.status_is(http.StatusUnprocessableEntity)
	})
}

func TestACAuthRequired_E2E(t *testing.T) {
	t.Run("AC endpoints return 401 without auth header", func(t *testing.T) {
		tc := newE2EContext(t)

		// Given
		tc.server_is_running()

		endpoints := []struct {
			method string
			path   string
			body   string
		}{
			{"POST", "/api/add-ac", `{"rune_id":"bf-0001","scenario":"s","description":"d"}`},
			{"POST", "/api/update-ac", `{"rune_id":"bf-0001","id":"AC-01","scenario":"s","description":"d"}`},
			{"POST", "/api/remove-ac", `{"rune_id":"bf-0001","id":"AC-01"}`},
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
}

// ---------------------------------------------------------------------------
// Additional Given/Then helpers on e2eTestContext
// ---------------------------------------------------------------------------

func (tc *e2eTestContext) an_ac_exists_on_rune(runeID, scenario, desc string) {
	tc.t.Helper()
	body, _ := json.Marshal(map[string]any{
		"rune_id":     runeID,
		"scenario":    scenario,
		"description": desc,
	})
	tc.post("/api/add-ac", string(body), tc.realmPATToken)
	require.Equal(tc.t, http.StatusNoContent, tc.resp.StatusCode,
		"failed to add AC to rune %s: %s", runeID, string(tc.respBody))
}

func (tc *e2eTestContext) response_has_ac_count(expected int) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.respJSON, "response is not a JSON object")
	acs, ok := tc.respJSON["acceptance_criteria"]
	require.True(tc.t, ok, "expected 'acceptance_criteria' key in response: %s", string(tc.respBody))
	acSlice, ok := acs.([]any)
	require.True(tc.t, ok, "expected 'acceptance_criteria' to be an array")
	assert.Len(tc.t, acSlice, expected, "expected %d AC items, got %d", expected, len(acSlice))
}

func (tc *e2eTestContext) response_ac_has_id(index int, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.respJSON, "response is not a JSON object")
	acs, ok := tc.respJSON["acceptance_criteria"].([]any)
	require.True(tc.t, ok, "expected 'acceptance_criteria' to be an array")
	require.Greater(tc.t, len(acs), index, "expected at least %d AC items", index+1)
	entry, ok := acs[index].(map[string]any)
	require.True(tc.t, ok, "expected AC[%d] to be an object", index)
	assert.Equal(tc.t, expected, entry["id"], "AC[%d].id", index)
}

func (tc *e2eTestContext) response_ac_has_scenario(index int, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.respJSON, "response is not a JSON object")
	acs, ok := tc.respJSON["acceptance_criteria"].([]any)
	require.True(tc.t, ok, "expected 'acceptance_criteria' to be an array")
	require.Greater(tc.t, len(acs), index, "expected at least %d AC items", index+1)
	entry, ok := acs[index].(map[string]any)
	require.True(tc.t, ok, "expected AC[%d] to be an object", index)
	assert.Equal(tc.t, expected, entry["scenario"], "AC[%d].scenario", index)
}

func (tc *e2eTestContext) response_ac_has_description(index int, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.respJSON, "response is not a JSON object")
	acs, ok := tc.respJSON["acceptance_criteria"].([]any)
	require.True(tc.t, ok, "expected 'acceptance_criteria' to be an array")
	require.Greater(tc.t, len(acs), index, "expected at least %d AC items", index+1)
	entry, ok := acs[index].(map[string]any)
	require.True(tc.t, ok, "expected AC[%d] to be an object", index)
	assert.Equal(tc.t, expected, entry["description"], "AC[%d].description", index)
}
