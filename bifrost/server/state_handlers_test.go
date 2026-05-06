package server

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/devzeebo/bifrost/domain"
)

// --- Tests: UpdateRuneState ---

func TestUpdateRuneStateHandler(t *testing.T) {
	t.Run("updates rune state and returns 204", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_exists_in_event_store("realm-1", "bf-0001")

		// When
		tc.post("/update-rune-state", domain.UpdateRuneState{
			RuneID: "bf-0001",
			Patch:  `{"coverage": 85}`,
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})

	t.Run("merges state with existing state", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_exists_in_event_store("realm-1", "bf-0001")
		tc.rune_has_state_in_event_store("realm-1", "bf-0001", `{"coverage": 50}`)

		// When
		tc.post("/update-rune-state", domain.UpdateRuneState{
			RuneID: "bf-0001",
			Patch:  `{"coverage": 75}`,
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})

	t.Run("returns 404 when rune not found", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")

		// When
		tc.post("/update-rune-state", domain.UpdateRuneState{
			RuneID: "bf-9999",
			Patch:  `{"foo": "bar"}`,
		})

		// Then
		tc.status_is(http.StatusNotFound)
		tc.response_body_has_error_field()
	})

	t.Run("returns 422 for invalid JSON patch", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_exists_in_event_store("realm-1", "bf-0001")

		// When
		tc.post("/update-rune-state", domain.UpdateRuneState{
			RuneID: "bf-0001",
			Patch:  `{invalid json}`,
		})

		// Then
		tc.status_is(http.StatusUnprocessableEntity)
		tc.response_body_has_error_field()
	})

	t.Run("returns 422 when patch is not an object (null)", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_exists_in_event_store("realm-1", "bf-0001")

		// When
		tc.post("/update-rune-state", domain.UpdateRuneState{
			RuneID: "bf-0001",
			Patch:  `null`,
		})

		// Then
		tc.status_is(http.StatusUnprocessableEntity)
		tc.response_body_has_error_field()
	})

	t.Run("returns 422 when patch is not an object (array)", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_exists_in_event_store("realm-1", "bf-0001")

		// When
		tc.post("/update-rune-state", domain.UpdateRuneState{
			RuneID: "bf-0001",
			Patch:  `["array", "values"]`,
		})

		// Then
		tc.status_is(http.StatusUnprocessableEntity)
		tc.response_body_has_error_field()
	})

	t.Run("returns 400 when rune is shattered", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_is_shattered_in_event_store("realm-1", "bf-0001")

		// When
		tc.post("/update-rune-state", domain.UpdateRuneState{
			RuneID: "bf-0001",
			Patch:  `{"foo": "bar"}`,
		})

		// Then
		tc.status_is(http.StatusBadRequest)
		tc.response_body_has_error_field()
	})
}

// --- Tests: ClearRuneState ---

func TestClearRuneStateHandler(t *testing.T) {
	t.Run("clears rune state and returns 204", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_exists_in_event_store("realm-1", "bf-0001")
		tc.rune_has_state_in_event_store("realm-1", "bf-0001", `{"foo": "bar"}`)

		// When
		tc.post("/clear-rune-state", domain.ClearRuneState{
			RuneID: "bf-0001",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})

	t.Run("returns 404 when rune not found", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")

		// When
		tc.post("/clear-rune-state", domain.ClearRuneState{
			RuneID: "bf-9999",
		})

		// Then
		tc.status_is(http.StatusNotFound)
		tc.response_body_has_error_field()
	})

	t.Run("returns 400 when rune is shattered", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_is_shattered_in_event_store("realm-1", "bf-0001")

		// When
		tc.post("/clear-rune-state", domain.ClearRuneState{
			RuneID: "bf-0001",
		})

		// Then
		tc.status_is(http.StatusBadRequest)
		tc.response_body_has_error_field()
	})
}

// --- Helper Functions ---

func (tc *handlerTestContext) rune_has_state_in_event_store(realmID, runeID, stateJSON string) {
	tc.t.Helper()
	// Parse the state JSON
	var state map[string]any
	if err := json.Unmarshal([]byte(stateJSON), &state); err != nil {
		tc.t.Fatalf("invalid state JSON: %v", err)
	}
	stateUpdated := domain.RuneStateUpdated{
		RuneID: runeID,
		Patch:  state,
	}
	tc.eventStore.appendToStream(realmID, "rune-"+runeID, domain.EventRuneStateUpdated, stateUpdated)
}

func (tc *handlerTestContext) rune_is_shattered_in_event_store(realmID, runeID string) {
	tc.t.Helper()
	tc.rune_exists_in_event_store(realmID, runeID)
	sealed := domain.RuneSealed{ID: runeID, Reason: "done"}
	tc.eventStore.appendToStream(realmID, "rune-"+runeID, domain.EventRuneSealed, sealed)
	shattered := domain.RuneShattered{ID: runeID}
	tc.eventStore.appendToStream(realmID, "rune-"+runeID, domain.EventRuneShattered, shattered)
}
