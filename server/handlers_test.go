package server

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/devzeebo/bifrost/domain"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests: writeJSON ---

func TestWriteJSON(t *testing.T) {
	t.Run("writes JSON response with status code", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// When
		tc.write_json(http.StatusOK, map[string]string{"key": "value"})

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_body_contains(`"key":"value"`)
	})

	t.Run("writes JSON response with 201 status", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// When
		tc.write_json(http.StatusCreated, map[string]string{"id": "bf-1234"})

		// Then
		tc.status_is(http.StatusCreated)
		tc.content_type_is_json()
		tc.response_body_contains(`"id":"bf-1234"`)
	})
}

// --- Tests: writeError ---

func TestWriteError(t *testing.T) {
	t.Run("writes JSON error response", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// When
		tc.write_error(http.StatusBadRequest, "invalid request body")

		// Then
		tc.status_is(http.StatusBadRequest)
		tc.content_type_is_json()
		tc.response_body_equals(`{"error":"invalid request body"}`)
	})
}

// --- Tests: handleDomainError ---

func TestHandleDomainError(t *testing.T) {
	t.Run("maps ConcurrencyError to 409", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.domain_error_is(&core.ConcurrencyError{StreamID: "s1", ExpectedVersion: 1, ActualVersion: 2})

		// When
		tc.handle_domain_error()

		// Then
		tc.status_is(http.StatusConflict)
		tc.content_type_is_json()
		tc.response_body_has_error_field()
	})

	t.Run("maps NotFoundError to 404", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.domain_error_is(&core.NotFoundError{Entity: "rune", ID: "bf-1234"})

		// When
		tc.handle_domain_error()

		// Then
		tc.status_is(http.StatusNotFound)
		tc.content_type_is_json()
		tc.response_body_has_error_field()
	})

	t.Run("maps generic error to 500", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.domain_error_is(fmt.Errorf("something went wrong"))

		// When
		tc.handle_domain_error()

		// Then
		tc.status_is(http.StatusInternalServerError)
		tc.content_type_is_json()
		tc.response_body_has_error_field()
	})

	t.Run("maps validation-style error to 400", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.domain_error_is(fmt.Errorf("cannot update sealed rune %q", "bf-1234"))

		// When
		tc.handle_domain_error()

		// Then
		tc.status_is(http.StatusBadRequest)
		tc.content_type_is_json()
		tc.response_body_has_error_field()
	})
}

// --- Tests: Health ---

func TestHealthHandler(t *testing.T) {
	t.Run("returns 200 with ok status", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()

		// When
		tc.get("/health")

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_body_equals(`{"status":"ok"}`)
	})
}

// --- Tests: CreateRune ---

func TestCreateRuneHandler(t *testing.T) {
	t.Run("creates rune and returns 201", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.event_store_appends_successfully()

		// When
		tc.post("/create-rune", domain.CreateRune{
			Title:    "Fix bug",
			Priority: 1,
			Branch:   strPtr("main"),
		})

		// Then
		tc.status_is(http.StatusCreated)
		tc.content_type_is_json()
		tc.response_body_has_field("id")
	})

	t.Run("returns 400 for invalid JSON body", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")

		// When
		tc.post_raw("/create-rune", []byte(`{invalid`))

		// Then
		tc.status_is(http.StatusBadRequest)
		tc.response_body_has_error_field()
	})
}

// --- Tests: UpdateRune ---

func TestUpdateRuneHandler(t *testing.T) {
	t.Run("updates rune and returns 204", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_exists_in_event_store("realm-1", "bf-0001")

		// When
		title := "Updated title"
		tc.post("/update-rune", domain.UpdateRune{
			ID:    "bf-0001",
			Title: &title,
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
		title := "Updated title"
		tc.post("/update-rune", domain.UpdateRune{
			ID:    "bf-9999",
			Title: &title,
		})

		// Then
		tc.status_is(http.StatusNotFound)
		tc.response_body_has_error_field()
	})
}

// --- Tests: ClaimRune ---

func TestClaimRuneHandler(t *testing.T) {
	t.Run("claims rune and returns 204", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_exists_in_event_store("realm-1", "bf-0001")

		// When
		tc.post("/claim-rune", domain.ClaimRune{
			ID:       "bf-0001",
			Claimant: "alice",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})
}

// --- Tests: UnclaimRune ---

func TestUnclaimRuneHandler(t *testing.T) {
	t.Run("unclaims rune and returns 204", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_is_claimed_in_event_store("realm-1", "bf-0001", "alice")

		// When
		tc.post("/unclaim-rune", domain.UnclaimRune{
			ID: "bf-0001",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})
}

// --- Tests: FulfillRune ---

func TestFulfillRuneHandler(t *testing.T) {
	t.Run("fulfills rune and returns 204", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_is_claimed_in_event_store("realm-1", "bf-0001", "alice")

		// When
		tc.post("/fulfill-rune", domain.FulfillRune{
			ID: "bf-0001",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})
}

// --- Tests: SealRune ---

func TestSealRuneHandler(t *testing.T) {
	t.Run("seals rune and returns 204", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_exists_in_event_store("realm-1", "bf-0001")

		// When
		tc.post("/seal-rune", domain.SealRune{
			ID:     "bf-0001",
			Reason: "done",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})
}

// --- Tests: ForgeRune ---

func TestForgeRuneHandler(t *testing.T) {
	t.Run("forges rune and returns 204", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_exists_as_draft_in_event_store("realm-1", "bf-0001")

		// When
		tc.post("/forge-rune", domain.ForgeRune{
			ID: "bf-0001",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})

	t.Run("returns 400 for invalid JSON body", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")

		// When
		tc.post_raw("/forge-rune", []byte(`{invalid`))

		// Then
		tc.status_is(http.StatusBadRequest)
		tc.response_body_has_error_field()
	})
}

// --- Tests: AddDependency ---

func TestAddDependencyHandler(t *testing.T) {
	t.Run("adds dependency and returns 204", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_exists_in_event_store("realm-1", "bf-0001")
		tc.rune_exists_in_event_store("realm-1", "bf-0002")

		// When
		tc.post("/add-dependency", domain.AddDependency{
			RuneID:       "bf-0001",
			TargetID:     "bf-0002",
			Relationship: "relates_to",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})
}

// --- Tests: RemoveDependency ---

func TestRemoveDependencyHandler(t *testing.T) {
	t.Run("removes dependency and returns 204", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_with_dependency("realm-1", "bf-0001", "bf-0002", "relates_to")

		// When
		tc.post("/remove-dependency", domain.RemoveDependency{
			RuneID:       "bf-0001",
			TargetID:     "bf-0002",
			Relationship: "relates_to",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})
}

// --- Tests: AddNote ---

func TestAddNoteHandler(t *testing.T) {
	t.Run("adds note and returns 204", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_exists_in_event_store("realm-1", "bf-0001")

		// When
		tc.post("/add-note", domain.AddNote{
			RuneID: "bf-0001",
			Text:   "some note",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})
}

// --- Tests: CreateRealm ---

func TestCreateRealmHandler(t *testing.T) {
	t.Run("creates realm and returns 201", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.event_store_appends_successfully()

		// When
		tc.post("/create-realm", domain.CreateRealm{
			Name: "My Realm",
		})

		// Then
		tc.status_is(http.StatusCreated)
		tc.content_type_is_json()
		tc.response_body_has_field("realm_id")
	})
}

// --- Tests: ListRealms ---

func TestListRealmsHandler(t *testing.T) {
	t.Run("returns list of realms", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.projection_has_realm_list()

		// When
		tc.get("/realms")

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_is_non_empty_json_array()
	})

	t.Run("returns empty array when no realms exist", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()

		// When
		tc.get("/realms")

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_is_empty_json_array()
	})
}

// --- Tests: ListRunes ---

func TestListRunesHandler(t *testing.T) {
	t.Run("returns list of runes for realm", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_rune_list("realm-1")

		// When
		tc.get("/runes")

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_is_non_empty_json_array()
	})

	t.Run("returns empty array when no runes exist", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")

		// When
		tc.get("/runes")

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_is_empty_json_array()
	})

	t.Run("filters runes by status query parameter", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_mixed_runes("realm-1")

		// When
		tc.get("/runes?status=open")

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_array_has_length(1)
		tc.response_array_all_have_field_value("status", "open")
	})

	t.Run("filters runes by priority query parameter", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_mixed_runes("realm-1")

		// When
		tc.get("/runes?priority=1")

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_array_has_length(1)
		tc.response_array_all_have_field_value("id", "bf-0002")
	})

	t.Run("filters runes by assignee query parameter", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_mixed_runes("realm-1")

		// When
		tc.get("/runes?assignee=alice")

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_array_has_length(1)
		tc.response_array_all_have_field_value("assignee", "alice")
	})

	t.Run("returns empty array when no runes match filter", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_mixed_runes("realm-1")

		// When
		tc.get("/runes?status=fulfilled")

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_is_empty_json_array()
	})

	t.Run("filters runes by multiple query parameters", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_mixed_runes("realm-1")

		// When
		tc.get("/runes?status=open&priority=0")

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_array_has_length(1)
		tc.response_array_all_have_field_value("id", "bf-0001")
	})

	t.Run("filters runes by branch query parameter", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_runes_with_branches("realm-1")

		// When
		tc.get("/runes?branch=main")

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_array_has_length(2)
		tc.response_array_all_have_field_value("branch", "main")
	})

	t.Run("returns all runes when no filters are provided", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_mixed_runes("realm-1")

		// When
		tc.get("/runes")

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_array_has_length(3)
	})

	t.Run("excludes runes with open blockers when blocked=false", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_rune_summary("realm-1", "bf-0001", "open")
		tc.projection_has_rune_summary("realm-1", "bf-0002", "open")
		tc.projection_has_rune_summary("realm-1", "bf-0003", "open")
		tc.projection_has_rune_detail_with_dependencies("realm-1", "bf-0001", []projectors.DependencyRef{
			{TargetID: "bf-0003", Relationship: "blocked_by"},
		})

		// When
		tc.get("/runes?status=open&blocked=false")

		// Then
		tc.status_is(http.StatusOK)
		tc.response_array_has_length(2)
		tc.response_array_contains_rune_id("bf-0002")
		tc.response_array_contains_rune_id("bf-0003")
		tc.response_array_does_not_contain_rune_id("bf-0001")
	})

	t.Run("excludes runes with sealed blockers when blocked=false", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_rune_summary("realm-1", "bf-0001", "open")
		tc.projection_has_rune_summary("realm-1", "bf-0002", "open")
		tc.projection_has_rune_summary("realm-1", "bf-0003", "sealed")
		tc.projection_has_rune_detail_with_dependencies("realm-1", "bf-0001", []projectors.DependencyRef{
			{TargetID: "bf-0003", Relationship: "blocked_by"},
		})

		// When
		tc.get("/runes?status=open&blocked=false")

		// Then
		tc.status_is(http.StatusOK)
		tc.response_array_has_length(1)
		tc.response_array_contains_rune_id("bf-0002")
	})

	t.Run("includes runes whose blockers are all fulfilled when blocked=false", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_rune_summary("realm-1", "bf-0001", "open")
		tc.projection_has_rune_summary("realm-1", "bf-0002", "open")
		tc.projection_has_rune_summary("realm-1", "bf-0003", "fulfilled")
		tc.projection_has_rune_detail_with_dependencies("realm-1", "bf-0001", []projectors.DependencyRef{
			{TargetID: "bf-0003", Relationship: "blocked_by"},
		})

		// When
		tc.get("/runes?status=open&blocked=false")

		// Then
		tc.status_is(http.StatusOK)
		tc.response_array_has_length(2)
		tc.response_array_contains_rune_id("bf-0001")
		tc.response_array_contains_rune_id("bf-0002")
	})

	t.Run("returns all matching runes when blocked=false and no runes are blocked", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_rune_summary("realm-1", "bf-0001", "open")
		tc.projection_has_rune_summary("realm-1", "bf-0002", "open")

		// When
		tc.get("/runes?status=open&blocked=false")

		// Then
		tc.status_is(http.StatusOK)
		tc.response_array_has_length(2)
	})

	t.Run("blocked filter is ignored when not provided", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_rune_summary("realm-1", "bf-0001", "open")
		tc.projection_has_rune_summary("realm-1", "bf-0002", "open")
		tc.projection_has_rune_summary("realm-1", "bf-0003", "open")
		tc.projection_has_rune_detail_with_dependencies("realm-1", "bf-0001", []projectors.DependencyRef{
			{TargetID: "bf-0003", Relationship: "blocked_by"},
		})

		// When
		tc.get("/runes?status=open")

		// Then
		tc.status_is(http.StatusOK)
		tc.response_array_has_length(3)
	})

	t.Run("excludes sagas when is_saga=false", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_rune_summary("realm-1", "bf-0001", "open")
		tc.projection_has_rune_summary("realm-1", "bf-0002", "open")
		tc.projection_has_child_count("realm-1", "bf-0001", 2)

		// When
		tc.get("/runes?is_saga=false")

		// Then
		tc.status_is(http.StatusOK)
		tc.response_array_has_length(1)
		tc.response_array_contains_rune_id("bf-0002")
		tc.response_array_does_not_contain_rune_id("bf-0001")
	})

	t.Run("returns only sagas when is_saga=true", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_rune_summary("realm-1", "bf-0001", "open")
		tc.projection_has_rune_summary("realm-1", "bf-0002", "open")
		tc.projection_has_child_count("realm-1", "bf-0001", 2)

		// When
		tc.get("/runes?is_saga=true")

		// Then
		tc.status_is(http.StatusOK)
		tc.response_array_has_length(1)
		tc.response_array_contains_rune_id("bf-0001")
	})

	t.Run("includes rune with no RuneChildCount entry when is_saga=false", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_rune_summary("realm-1", "bf-0001", "open")
		tc.projection_has_rune_summary("realm-1", "bf-0002", "open")

		// When
		tc.get("/runes?is_saga=false")

		// Then
		tc.status_is(http.StatusOK)
		tc.response_array_has_length(2)
	})

	t.Run("is_saga filter is ignored when not provided", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_rune_summary("realm-1", "bf-0001", "open")
		tc.projection_has_rune_summary("realm-1", "bf-0002", "open")
		tc.projection_has_child_count("realm-1", "bf-0001", 2)

		// When
		tc.get("/runes")

		// Then
		tc.status_is(http.StatusOK)
		tc.response_array_has_length(2)
	})
}

// --- Tests: GetRune ---

func TestGetRuneHandler(t *testing.T) {
	t.Run("returns rune detail", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.projection_has_rune_detail("realm-1", "bf-0001")

		// When
		tc.get("/rune?id=bf-0001")

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_body_has_field("id")
	})

	t.Run("returns 400 when id query param is missing", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")

		// When
		tc.get("/rune")

		// Then
		tc.status_is(http.StatusBadRequest)
		tc.response_body_has_error_field()
	})

	t.Run("returns 404 when rune not found in projection", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")

		// When
		tc.get("/rune?id=bf-9999")

		// Then
		tc.status_is(http.StatusNotFound)
		tc.response_body_has_error_field()
	})
}

// --- Tests: AssignRole ---

func TestAssignRoleHandler(t *testing.T) {
	t.Run("assigns role and returns 204 with admin caller", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("admin")
		tc.account_exists_in_event_store("acct-target")

		// When
		tc.post("/assign-role", domain.AssignRole{
			AccountID: "acct-target",
			RealmID:   "realm-1",
			Role:      "member",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})

	t.Run("returns 403 when caller is member", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("member")
		tc.routes_are_registered()

		// When
		tc.post_to_mux("/assign-role", domain.AssignRole{
			AccountID: "acct-target",
			RealmID:   "realm-1",
			Role:      "member",
		})

		// Then
		tc.status_is(http.StatusForbidden)
	})

	t.Run("returns 403 when non-owner assigns owner role", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("admin")
		tc.account_exists_in_event_store("acct-target")

		// When
		tc.post("/assign-role", domain.AssignRole{
			AccountID: "acct-target",
			RealmID:   "realm-1",
			Role:      "owner",
		})

		// Then
		tc.status_is(http.StatusForbidden)
	})

	t.Run("owner can assign owner role", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("owner")
		tc.account_exists_in_event_store("acct-target")

		// When
		tc.post("/assign-role", domain.AssignRole{
			AccountID: "acct-target",
			RealmID:   "realm-1",
			Role:      "owner",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})

	t.Run("returns 400 for invalid JSON body", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("admin")

		// When
		tc.post_raw("/assign-role", []byte(`{invalid`))

		// Then
		tc.status_is(http.StatusBadRequest)
		tc.response_body_has_error_field()
	})
}

// --- Tests: RevokeRole ---

func TestRevokeRoleHandler(t *testing.T) {
	t.Run("revokes role and returns 204 with admin caller", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("admin")
		tc.account_has_role_in_event_store("acct-target", "realm-1", "member")

		// When
		tc.post("/revoke-role", domain.RevokeRole{
			AccountID: "acct-target",
			RealmID:   "realm-1",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})

	t.Run("returns 403 when non-owner revokes owner role", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("admin")
		tc.account_has_role_in_event_store("acct-target", "realm-1", "owner")

		// When
		tc.post("/revoke-role", domain.RevokeRole{
			AccountID: "acct-target",
			RealmID:   "realm-1",
		})

		// Then
		tc.status_is(http.StatusForbidden)
	})

	t.Run("owner can revoke owner role", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("owner")
		tc.account_has_role_in_event_store("acct-target", "realm-1", "owner")

		// When
		tc.post("/revoke-role", domain.RevokeRole{
			AccountID: "acct-target",
			RealmID:   "realm-1",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})
}

// --- Tests: ShatterRune ---

func TestShatterRuneHandler(t *testing.T) {
	t.Run("shatters sealed rune and returns 204", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_is_sealed_in_event_store("realm-1", "bf-0001")

		// When
		tc.post("/shatter-rune", domain.ShatterRune{
			ID: "bf-0001",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})

	t.Run("returns 404 for non-existent rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")

		// When
		tc.post("/shatter-rune", domain.ShatterRune{
			ID: "bf-9999",
		})

		// Then
		tc.status_is(http.StatusNotFound)
		tc.response_body_has_error_field()
	})

	t.Run("returns 400 for open rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_exists_in_event_store("realm-1", "bf-0001")

		// When
		tc.post("/shatter-rune", domain.ShatterRune{
			ID: "bf-0001",
		})

		// Then
		tc.status_is(http.StatusBadRequest)
		tc.response_body_has_error_field()
	})
}

// --- Tests: SweepRunes ---

func TestSweepRunesHandler(t *testing.T) {
	t.Run("returns 200 with shattered rune IDs", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.rune_is_sealed_in_event_store("realm-1", "bf-0001")
		tc.projection_has_rune_summary("realm-1", "bf-0001", "sealed")

		// When
		tc.post("/sweep-runes", nil)

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_body_has_field("shattered")
		tc.response_shattered_contains("bf-0001")
	})

	t.Run("returns 200 with empty shattered list when no candidates", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")

		// When
		tc.post("/sweep-runes", nil)

		// Then
		tc.status_is(http.StatusOK)
		tc.content_type_is_json()
		tc.response_body_equals(`{"shattered":[]}`)
	})
}

// --- Tests: RegisterRoutes ---

func TestRegisterRoutes(t *testing.T) {
	t.Run("registers all expected routes on mux", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()

		// When
		tc.routes_are_registered()

		// Then
		tc.route_exists("GET", "/health")
		tc.route_exists("POST", "/create-rune")
		tc.route_exists("POST", "/update-rune")
		tc.route_exists("POST", "/claim-rune")
		tc.route_exists("POST", "/fulfill-rune")
		tc.route_exists("POST", "/forge-rune")
		tc.route_exists("POST", "/seal-rune")
		tc.route_exists("POST", "/shatter-rune")
		tc.route_exists("POST", "/sweep-runes")
		tc.route_exists("POST", "/add-dependency")
		tc.route_exists("POST", "/remove-dependency")
		tc.route_exists("POST", "/add-note")
		tc.route_exists("GET", "/runes")
		tc.route_exists("GET", "/rune")
		tc.route_exists("POST", "/create-realm")
		tc.route_exists("GET", "/realms")
		tc.route_exists("POST", "/assign-role")
		tc.route_exists("POST", "/revoke-role")
	})
}

// --- Tests: Role-based routing ---

func TestRoleBasedRouting(t *testing.T) {
	t.Run("viewer can GET /runes", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("viewer")
		tc.routes_are_registered()

		// When
		tc.get_from_mux("/runes")

		// Then
		tc.status_is(http.StatusOK)
	})

	t.Run("viewer cannot POST /create-rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("viewer")
		tc.routes_are_registered()

		// When
		tc.post_to_mux("/create-rune", domain.CreateRune{
			Title:    "Test",
			Priority: 1,
			Branch:   strPtr("main"),
		})

		// Then
		tc.status_is(http.StatusForbidden)
	})

	t.Run("member can POST /create-rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("member")
		tc.event_store_appends_successfully()
		tc.routes_are_registered()

		// When
		tc.post_to_mux("/create-rune", domain.CreateRune{
			Title:    "Test",
			Priority: 1,
			Branch:   strPtr("main"),
		})

		// Then
		tc.status_is(http.StatusCreated)
	})

	t.Run("member cannot POST /assign-role", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("member")
		tc.routes_are_registered()

		// When
		tc.post_to_mux("/assign-role", domain.AssignRole{
			AccountID: "acct-target",
			RealmID:   "realm-1",
			Role:      "member",
		})

		// Then
		tc.status_is(http.StatusForbidden)
	})

	t.Run("viewer cannot POST /forge-rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("viewer")
		tc.routes_are_registered()

		// When
		tc.post_to_mux("/forge-rune", domain.ForgeRune{
			ID: "bf-0001",
		})

		// Then
		tc.status_is(http.StatusForbidden)
	})

	t.Run("member can POST /forge-rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("member")
		tc.rune_exists_as_draft_in_event_store("realm-1", "bf-0001")
		tc.routes_are_registered()

		// When
		tc.post_to_mux("/forge-rune", domain.ForgeRune{
			ID: "bf-0001",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})

	t.Run("admin can POST /assign-role", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.handlers_configured()
		tc.request_has_realm_id("realm-1")
		tc.request_has_role("admin")
		tc.account_exists_in_event_store("acct-target")
		tc.routes_are_registered()

		// When
		tc.post_to_mux("/assign-role", domain.AssignRole{
			AccountID: "acct-target",
			RealmID:   "realm-1",
			Role:      "member",
		})

		// Then
		tc.status_is(http.StatusNoContent)
	})
}

// --- Test Context ---

type handlerTestContext struct {
	t *testing.T

	// Dependencies
	eventStore      *mockEventStore
	projectionStore *mockProjectionStore
	engine          *mockProjectionEngine
	handlers        *Handlers

	// HTTP
	recorder *httptest.ResponseRecorder
	realmID  string
	role     string

	// Error for handleDomainError tests
	domainErr error

	// Route testing
	mux *http.ServeMux
}

func newHandlerTestContext(t *testing.T) *handlerTestContext {
	t.Helper()
	return &handlerTestContext{
		t:               t,
		eventStore:      newMockEventStore(),
		projectionStore: newMockProjectionStore(),
		engine:          &mockProjectionEngine{},
		recorder:        httptest.NewRecorder(),
	}
}

// --- Given ---

func (tc *handlerTestContext) handlers_configured() {
	tc.t.Helper()
	tc.handlers = NewHandlers(tc.eventStore, tc.projectionStore, tc.engine)
}

func (tc *handlerTestContext) request_has_realm_id(realmID string) {
	tc.t.Helper()
	tc.realmID = realmID
}

func (tc *handlerTestContext) request_has_role(role string) {
	tc.t.Helper()
	tc.role = role
}

func (tc *handlerTestContext) domain_error_is(err error) {
	tc.t.Helper()
	tc.domainErr = err
}

func (tc *handlerTestContext) event_store_appends_successfully() {
	tc.t.Helper()
	// Default mock behavior is to succeed
}

func (tc *handlerTestContext) rune_exists_in_event_store(realmID, runeID string) {
	tc.t.Helper()
	created := domain.RuneCreated{
		ID:       runeID,
		Title:    "Test Rune",
		Priority: 1,
	}
	tc.eventStore.appendToStream(realmID, "rune-"+runeID, domain.EventRuneCreated, created)
	forged := domain.RuneForged{ID: runeID}
	tc.eventStore.appendToStream(realmID, "rune-"+runeID, domain.EventRuneForged, forged)
}

func (tc *handlerTestContext) rune_exists_as_draft_in_event_store(realmID, runeID string) {
	tc.t.Helper()
	created := domain.RuneCreated{
		ID:       runeID,
		Title:    "Test Rune",
		Priority: 1,
	}
	tc.eventStore.appendToStream(realmID, "rune-"+runeID, domain.EventRuneCreated, created)
}

func (tc *handlerTestContext) rune_is_claimed_in_event_store(realmID, runeID, claimant string) {
	tc.t.Helper()
	tc.rune_exists_in_event_store(realmID, runeID)
	claimed := domain.RuneClaimed{
		ID:       runeID,
		Claimant: claimant,
	}
	tc.eventStore.appendToStream(realmID, "rune-"+runeID, domain.EventRuneClaimed, claimed)
}

func (tc *handlerTestContext) rune_with_dependency(realmID, runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.rune_exists_in_event_store(realmID, runeID)
	tc.rune_exists_in_event_store(realmID, targetID)
	// Put dependency in projection store for RemoveDependency lookup
	depKey := "dep:" + runeID + ":" + targetID + ":" + relationship
	_ = tc.projectionStore.Put(context.Background(), realmID, "dependency_graph", depKey, true)
}

func (tc *handlerTestContext) rune_is_sealed_in_event_store(realmID, runeID string) {
	tc.t.Helper()
	tc.rune_exists_in_event_store(realmID, runeID)
	sealed := domain.RuneSealed{ID: runeID, Reason: "done"}
	tc.eventStore.appendToStream(realmID, "rune-"+runeID, domain.EventRuneSealed, sealed)
}

func (tc *handlerTestContext) account_exists_in_event_store(accountID string) {
	tc.t.Helper()
	created := domain.AccountCreated{
		AccountID: accountID,
		Username:  "testuser",
	}
	tc.eventStore.appendToStream("_admin", "account-"+accountID, domain.EventAccountCreated, created)
}

func (tc *handlerTestContext) account_has_role_in_event_store(accountID, realmID, role string) {
	tc.t.Helper()
	tc.account_exists_in_event_store(accountID)
	assigned := domain.RoleAssigned{
		AccountID: accountID,
		RealmID:   realmID,
		Role:      role,
	}
	tc.eventStore.appendToStream("_admin", "account-"+accountID, domain.EventRoleAssigned, assigned)
}


func (tc *handlerTestContext) projection_has_rune_summary(realmID, runeID, status string) {
	tc.t.Helper()
	summary := projectors.RuneSummary{ID: runeID, Status: status}
	_ = tc.projectionStore.Put(context.Background(), realmID, "rune_list", runeID, summary)
}


func (tc *handlerTestContext) projection_has_child_count(realmID, runeID string, count int) {
	tc.t.Helper()
	_ = tc.projectionStore.Put(context.Background(), realmID, "RuneChildCount", runeID, count)
}

func (tc *handlerTestContext) projection_has_rune_detail_with_dependencies(realmID, runeID string, deps []projectors.DependencyRef) {
	tc.t.Helper()
	detail := projectors.RuneDetail{ID: runeID, Dependencies: deps}
	_ = tc.projectionStore.Put(context.Background(), realmID, "rune_detail", runeID, detail)
}

func (tc *handlerTestContext) projection_has_realm_list() {
	tc.t.Helper()
	_ = tc.projectionStore.Put(context.Background(), "_admin", "realm_list", "realm-1", map[string]string{
		"realm_id": "realm-1", "name": "Test Realm", "status": "active",
	})
}

func (tc *handlerTestContext) projection_has_rune_list(realmID string) {
	tc.t.Helper()
	_ = tc.projectionStore.Put(context.Background(), realmID, "rune_list", "bf-0001", map[string]string{
		"id": "bf-0001", "title": "Test Rune", "status": "open",
	})
}

func (tc *handlerTestContext) projection_has_mixed_runes(realmID string) {
	tc.t.Helper()
	_ = tc.projectionStore.Put(context.Background(), realmID, "rune_list", "bf-0001", map[string]any{
		"id": "bf-0001", "title": "Open Rune", "status": "open", "priority": float64(0), "assignee": "",
	})
	_ = tc.projectionStore.Put(context.Background(), realmID, "rune_list", "bf-0002", map[string]any{
		"id": "bf-0002", "title": "Sealed Rune", "status": "sealed", "priority": float64(1), "assignee": "alice",
	})
	_ = tc.projectionStore.Put(context.Background(), realmID, "rune_list", "bf-0003", map[string]any{
		"id": "bf-0003", "title": "Claimed Rune", "status": "claimed", "priority": float64(0), "assignee": "bob",
	})
}

func (tc *handlerTestContext) projection_has_runes_with_branches(realmID string) {
	tc.t.Helper()
	_ = tc.projectionStore.Put(context.Background(), realmID, "rune_list", "bf-0001", map[string]any{
		"id": "bf-0001", "title": "Main Rune", "status": "open", "priority": float64(0), "assignee": "", "branch": "main",
	})
	_ = tc.projectionStore.Put(context.Background(), realmID, "rune_list", "bf-0002", map[string]any{
		"id": "bf-0002", "title": "Feature Rune", "status": "open", "priority": float64(1), "assignee": "alice", "branch": "feature/xyz",
	})
	_ = tc.projectionStore.Put(context.Background(), realmID, "rune_list", "bf-0003", map[string]any{
		"id": "bf-0003", "title": "Another Main Rune", "status": "claimed", "priority": float64(0), "assignee": "bob", "branch": "main",
	})
}

func (tc *handlerTestContext) projection_has_rune_detail(realmID, runeID string) {
	tc.t.Helper()
	_ = tc.projectionStore.Put(context.Background(), realmID, "rune_detail", runeID, map[string]any{
		"id":     runeID,
		"title":  "Test Rune",
		"status": "open",
	})
}

// --- When ---

func (tc *handlerTestContext) write_json(status int, data any) {
	tc.t.Helper()
	writeJSON(tc.recorder, status, data)
}

func (tc *handlerTestContext) write_error(status int, msg string) {
	tc.t.Helper()
	writeError(tc.recorder, status, msg)
}

func (tc *handlerTestContext) handle_domain_error() {
	tc.t.Helper()
	handleDomainError(tc.recorder, tc.domainErr)
}

func (tc *handlerTestContext) build_context(ctx context.Context) context.Context {
	tc.t.Helper()
	if tc.realmID != "" {
		ctx = context.WithValue(ctx, realmIDKey, tc.realmID)
	}
	if tc.role != "" {
		ctx = context.WithValue(ctx, roleKey, tc.role)
	}
	return ctx
}

func (tc *handlerTestContext) get(path string) {
	tc.t.Helper()
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req = req.WithContext(tc.build_context(req.Context()))
	tc.handlers.ServeHTTP(tc.recorder, req)
}

func (tc *handlerTestContext) post(path string, body any) {
	tc.t.Helper()
	data, err := json.Marshal(body)
	require.NoError(tc.t, err)
	tc.post_raw(path, data)
}

func (tc *handlerTestContext) post_raw(path string, body []byte) {
	tc.t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(tc.build_context(req.Context()))
	tc.handlers.ServeHTTP(tc.recorder, req)
}

func (tc *handlerTestContext) get_from_mux(path string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.mux, "routes must be registered before calling get_from_mux")
	req := httptest.NewRequest(http.MethodGet, path, nil)
	req = req.WithContext(tc.build_context(req.Context()))
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *handlerTestContext) post_to_mux(path string, body any) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.mux, "routes must be registered before calling post_to_mux")
	data, err := json.Marshal(body)
	require.NoError(tc.t, err)
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(tc.build_context(req.Context()))
	tc.mux.ServeHTTP(tc.recorder, req)
}

func (tc *handlerTestContext) routes_are_registered() {
	tc.t.Helper()
	tc.mux = http.NewServeMux()
	realmMW := func(h http.Handler) http.Handler { return h }
	adminMW := func(h http.Handler) http.Handler { return h }
	tc.handlers.RegisterRoutes(tc.mux, realmMW, adminMW)
}

// --- Then ---

func (tc *handlerTestContext) status_is(code int) {
	tc.t.Helper()
	assert.Equal(tc.t, code, tc.recorder.Code)
}

func (tc *handlerTestContext) content_type_is_json() {
	tc.t.Helper()
	assert.Equal(tc.t, "application/json", tc.recorder.Header().Get("Content-Type"))
}

func (tc *handlerTestContext) response_body_contains(substr string) {
	tc.t.Helper()
	assert.Contains(tc.t, tc.recorder.Body.String(), substr)
}

func (tc *handlerTestContext) response_body_equals(expected string) {
	tc.t.Helper()
	actual := tc.recorder.Body.String()
	assert.JSONEq(tc.t, expected, actual)
}

func (tc *handlerTestContext) response_body_has_error_field() {
	tc.t.Helper()
	var resp map[string]any
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err, "response body should be valid JSON")
	assert.Contains(tc.t, resp, "error")
}

func (tc *handlerTestContext) response_body_has_field(field string) {
	tc.t.Helper()
	var resp map[string]any
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err, "response body should be valid JSON")
	assert.Contains(tc.t, resp, field)
}

func (tc *handlerTestContext) response_is_non_empty_json_array() {
	tc.t.Helper()
	var resp []any
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err, "response body should be a JSON array")
	assert.NotEmpty(tc.t, resp, "response array should not be empty")
}

func (tc *handlerTestContext) response_is_empty_json_array() {
	tc.t.Helper()
	var resp []any
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err, "response body should be a JSON array")
	assert.Empty(tc.t, resp, "response array should be empty")
}

func (tc *handlerTestContext) response_array_has_length(expected int) {
	tc.t.Helper()
	var resp []any
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err, "response body should be a JSON array")
	assert.Len(tc.t, resp, expected)
}

func (tc *handlerTestContext) response_array_contains_rune_id(runeID string) {
	tc.t.Helper()
	var resp []map[string]any
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err, "response body should be a JSON array of objects")
	for _, item := range resp {
		if fmt.Sprintf("%v", item["id"]) == runeID {
			return
		}
	}
	tc.t.Errorf("expected response array to contain rune %q, but it did not", runeID)
}

func (tc *handlerTestContext) response_array_does_not_contain_rune_id(runeID string) {
	tc.t.Helper()
	var resp []map[string]any
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err, "response body should be a JSON array of objects")
	for _, item := range resp {
		if fmt.Sprintf("%v", item["id"]) == runeID {
			tc.t.Errorf("expected response array NOT to contain rune %q, but it did", runeID)
			return
		}
	}
}

func (tc *handlerTestContext) response_array_all_have_field_value(field, expected string) {
	tc.t.Helper()
	var resp []map[string]any
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err, "response body should be a JSON array of objects")
	for _, item := range resp {
		val := fmt.Sprintf("%v", item[field])
		assert.Equal(tc.t, expected, val, "field %q should be %q", field, expected)
	}
}

func (tc *handlerTestContext) route_exists(method, path string) {
	tc.t.Helper()
	req := httptest.NewRequest(method, path, nil)
	rec := httptest.NewRecorder()
	tc.mux.ServeHTTP(rec, req)
	// A registered route should not return 404 from the default mux handler
	assert.NotEqual(tc.t, http.StatusNotFound, rec.Code, "route %s %s should be registered", method, path)
}

func (tc *handlerTestContext) response_shattered_contains(runeID string) {
	tc.t.Helper()
	var resp map[string][]string
	err := json.Unmarshal(tc.recorder.Body.Bytes(), &resp)
	require.NoError(tc.t, err, "response body should be valid JSON")
	assert.Contains(tc.t, resp["shattered"], runeID)
}

// --- Mock Event Store ---

type mockEventStore struct {
	streams map[string][]core.Event
}

func newMockEventStore() *mockEventStore {
	return &mockEventStore{
		streams: make(map[string][]core.Event),
	}
}

func (m *mockEventStore) streamKey(realmID, streamID string) string {
	return realmID + ":" + streamID
}

func (m *mockEventStore) appendToStream(realmID, streamID, eventType string, data any) {
	key := m.streamKey(realmID, streamID)
	dataBytes, _ := json.Marshal(data)
	evt := core.Event{
		RealmID:   realmID,
		StreamID:  streamID,
		Version:   len(m.streams[key]),
		EventType: eventType,
		Data:      dataBytes,
	}
	m.streams[key] = append(m.streams[key], evt)
}

func (m *mockEventStore) Append(_ context.Context, realmID string, streamID string, expectedVersion int, events []core.EventData) ([]core.Event, error) {
	key := m.streamKey(realmID, streamID)
	existing := m.streams[key]
	if expectedVersion != len(existing) {
		return nil, &core.ConcurrencyError{
			StreamID:        streamID,
			ExpectedVersion: expectedVersion,
			ActualVersion:   len(existing),
		}
	}
	var appended []core.Event
	for _, ed := range events {
		dataBytes, _ := json.Marshal(ed.Data)
		evt := core.Event{
			RealmID:   realmID,
			StreamID:  streamID,
			Version:   len(m.streams[key]),
			EventType: ed.EventType,
			Data:      dataBytes,
		}
		m.streams[key] = append(m.streams[key], evt)
		appended = append(appended, evt)
	}
	return appended, nil
}

func (m *mockEventStore) ReadStream(_ context.Context, realmID string, streamID string, fromVersion int) ([]core.Event, error) {
	key := m.streamKey(realmID, streamID)
	events := m.streams[key]
	if fromVersion >= len(events) {
		return nil, nil
	}
	return events[fromVersion:], nil
}

func (m *mockEventStore) ReadAll(_ context.Context, realmID string, fromGlobalPosition int64) ([]core.Event, error) {
	return nil, nil
}

func (m *mockEventStore) ListRealmIDs(_ context.Context) ([]string, error) {
	return nil, nil
}

// --- Mock Projection Engine ---

type mockProjectionEngine struct {
	runSyncCalled bool
}

func (m *mockProjectionEngine) RunSync(ctx context.Context, events []core.Event) error {
	m.runSyncCalled = true
	return nil
}

func (m *mockProjectionEngine) RunCatchUpOnce(ctx context.Context) {}

func strPtr(s string) *string { return &s }
