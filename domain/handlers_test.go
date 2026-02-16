package domain

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/devzeebo/bifrost/core"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestRebuildRuneState(t *testing.T) {
	t.Run("returns empty state for no events", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.no_events()

		// When
		tc.state_is_rebuilt()

		// Then
		tc.state_does_not_exist()
	})

	t.Run("rebuilds state from RuneCreated event", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.events_from_created_rune()

		// When
		tc.state_is_rebuilt()

		// Then
		tc.state_exists()
		tc.state_has_id("bf-a1b2")
		tc.state_has_title("Fix the bridge")
		tc.state_has_description("Needs repair")
		tc.state_has_priority(1)
		tc.state_has_status("draft")
	})

	t.Run("applies RuneUpdated on top of RuneCreated", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.events_from_created_and_updated_rune()

		// When
		tc.state_is_rebuilt()

		// Then
		tc.state_has_title("Updated title")
		tc.state_has_priority(3)
	})

	t.Run("applies RuneClaimed", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.events_from_created_and_claimed_rune()

		// When
		tc.state_is_rebuilt()

		// Then
		tc.state_has_status("claimed")
		tc.state_has_claimant("odin")
	})

	t.Run("applies RuneFulfilled", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.events_from_created_claimed_and_fulfilled_rune()

		// When
		tc.state_is_rebuilt()

		// Then
		tc.state_has_status("fulfilled")
	})

	t.Run("applies RuneSealed", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.events_from_created_and_sealed_rune()

		// When
		tc.state_is_rebuilt()

		// Then
		tc.state_has_status("sealed")
	})

	t.Run("tracks branch from RuneCreated", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.events_from_created_rune_with_branch("feature/xyz")

		// When
		tc.state_is_rebuilt()

		// Then
		tc.state_has_branch("feature/xyz")
	})

	t.Run("applies branch update from RuneUpdated", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.events_from_created_rune_with_branch_then_updated("feature/xyz", "feature/abc")

		// When
		tc.state_is_rebuilt()

		// Then
		tc.state_has_branch("feature/abc")
	})

	t.Run("tracks parent ID from RuneCreated", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.events_from_created_child_rune()

		// When
		tc.state_is_rebuilt()

		// Then
		tc.state_has_parent_id("bf-a1b2")
	})
}

func TestHandleCreateRune(t *testing.T) {
	t.Run("creates a top-level rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.a_create_rune_command("Fix the bridge", "Needs repair", 1, "")
		tc.with_branch_on_create_command("main")

		// When
		tc.handle_create_rune()

		// Then
		tc.no_error()
		tc.created_event_was_returned()
		tc.created_event_has_title("Fix the bridge")
		tc.created_event_has_description("Needs repair")
		tc.created_event_has_priority(1)
		tc.created_event_id_matches_hex_pattern()
		tc.event_was_appended_to_stream_with_prefix("rune-")
		tc.event_was_appended_with_expected_version(0)
	})

	t.Run("creates a child rune under existing parent", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.projection_returns_child_count("bf-a1b2", 0)
		tc.a_create_rune_command("Child task", "", 2, "bf-a1b2")

		// When
		tc.handle_create_rune()

		// Then
		tc.no_error()
		tc.created_event_has_id("bf-a1b2.1")
		tc.created_event_has_parent_id("bf-a1b2")
	})

	t.Run("creates second child rune with sequential ID", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.projection_returns_child_count("bf-a1b2", 1)
		tc.a_create_rune_command("Second child", "", 2, "bf-a1b2")

		// When
		tc.handle_create_rune()

		// Then
		tc.no_error()
		tc.created_event_has_id("bf-a1b2.2")
	})

	t.Run("returns error when parent does not exist", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.empty_stream("bf-missing")
		tc.a_create_rune_command("Child task", "", 2, "bf-missing")

		// When
		tc.handle_create_rune()

		// Then
		tc.error_is_not_found("rune", "bf-missing")
	})

	t.Run("returns error when parent is sealed", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_in_stream("bf-a1b2", "sealed")
		tc.a_create_rune_command("Child task", "", 2, "bf-a1b2")

		// When
		tc.handle_create_rune()

		// Then
		tc.error_contains("sealed")
	})

	t.Run("returns error when branch is nil and no parent", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.a_create_rune_command("Fix the bridge", "Needs repair", 1, "")

		// When
		tc.handle_create_rune()

		// Then
		tc.error_contains("branch is required")
	})

	t.Run("inherits branch from parent when branch is nil", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_with_branch_in_stream("bf-a1b2", "open", "feature/xyz")
		tc.projection_returns_child_count("bf-a1b2", 0)
		tc.a_create_rune_command("Child task", "", 2, "bf-a1b2")

		// When
		tc.handle_create_rune()

		// Then
		tc.no_error()
		tc.created_event_has_branch("feature/xyz")
	})

	t.Run("overrides branch on child when branch is provided", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_with_branch_in_stream("bf-a1b2", "open", "feature/xyz")
		tc.projection_returns_child_count("bf-a1b2", 0)
		tc.a_create_rune_command("Child task", "", 2, "bf-a1b2")
		tc.with_branch_on_create_command("feature/override")

		// When
		tc.handle_create_rune()

		// Then
		tc.no_error()
		tc.created_event_has_branch("feature/override")
	})

	t.Run("allows explicit empty branch on top-level rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.a_create_rune_command("Fix the bridge", "Needs repair", 1, "")
		tc.with_branch_on_create_command("")

		// When
		tc.handle_create_rune()

		// Then
		tc.no_error()
		tc.created_event_has_branch("")
	})
}

func TestHandleUpdateRune(t *testing.T) {
	t.Run("updates rune with changed fields", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.an_update_rune_command("bf-a1b2", strPtr("New title"), nil, intPtr(5))

		// When
		tc.handle_update_rune()

		// Then
		tc.no_error()
		tc.event_was_appended_to_stream("rune-bf-a1b2")
		tc.appended_event_has_type(EventRuneUpdated)
	})

	t.Run("returns error when rune does not exist", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.empty_stream("bf-missing")
		tc.an_update_rune_command("bf-missing", strPtr("New title"), nil, nil)

		// When
		tc.handle_update_rune()

		// Then
		tc.error_is_not_found("rune", "bf-missing")
	})

	t.Run("returns error when rune is sealed", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "sealed")
		tc.an_update_rune_command("bf-a1b2", strPtr("New title"), nil, nil)

		// When
		tc.handle_update_rune()

		// Then
		tc.error_contains("sealed")
	})

	t.Run("updates branch", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.an_update_rune_command("bf-a1b2", nil, nil, nil)
		tc.with_branch_on_update_command("feature/new-branch")

		// When
		tc.handle_update_rune()

		// Then
		tc.no_error()
		tc.event_was_appended_to_stream("rune-bf-a1b2")
		tc.appended_event_has_type(EventRuneUpdated)
	})
}

func TestHandleClaimRune(t *testing.T) {
	t.Run("claims an open rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.a_claim_rune_command("bf-a1b2", "odin")

		// When
		tc.handle_claim_rune()

		// Then
		tc.no_error()
		tc.event_was_appended_to_stream("rune-bf-a1b2")
		tc.appended_event_has_type(EventRuneClaimed)
	})

	t.Run("returns error when rune is already claimed", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "claimed")
		tc.a_claim_rune_command("bf-a1b2", "thor")

		// When
		tc.handle_claim_rune()

		// Then
		tc.error_contains("claimed")
	})

	t.Run("returns error when rune is sealed", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "sealed")
		tc.a_claim_rune_command("bf-a1b2", "odin")

		// When
		tc.handle_claim_rune()

		// Then
		tc.error_contains("sealed")
	})

	t.Run("returns error when rune is fulfilled", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "fulfilled")
		tc.a_claim_rune_command("bf-a1b2", "odin")

		// When
		tc.handle_claim_rune()

		// Then
		tc.error_contains("fulfilled")
	})
}

func TestHandleFulfillRune(t *testing.T) {
	t.Run("fulfills a claimed rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "claimed")
		tc.a_fulfill_rune_command("bf-a1b2")

		// When
		tc.handle_fulfill_rune()

		// Then
		tc.no_error()
		tc.event_was_appended_to_stream("rune-bf-a1b2")
		tc.appended_event_has_type(EventRuneFulfilled)
	})

	t.Run("returns error when rune is not claimed", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.a_fulfill_rune_command("bf-a1b2")

		// When
		tc.handle_fulfill_rune()

		// Then
		tc.error_contains("claimed")
	})

	t.Run("returns error when rune is sealed", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "sealed")
		tc.a_fulfill_rune_command("bf-a1b2")

		// When
		tc.handle_fulfill_rune()

		// Then
		tc.error_contains("sealed")
	})

	t.Run("returns error when rune is already fulfilled", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "fulfilled")
		tc.a_fulfill_rune_command("bf-a1b2")

		// When
		tc.handle_fulfill_rune()

		// Then
		tc.error_contains("fulfilled")
	})

	t.Run("returns error when rune does not exist", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.empty_stream("bf-missing")
		tc.a_fulfill_rune_command("bf-missing")

		// When
		tc.handle_fulfill_rune()

		// Then
		tc.error_is_not_found("rune", "bf-missing")
	})
}

func TestHandleSealRune(t *testing.T) {
	t.Run("seals an open rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.a_seal_rune_command("bf-a1b2", "no longer needed")

		// When
		tc.handle_seal_rune()

		// Then
		tc.no_error()
		tc.event_was_appended_to_stream("rune-bf-a1b2")
		tc.appended_event_has_type(EventRuneSealed)
	})

	t.Run("returns error when rune is already sealed", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "sealed")
		tc.a_seal_rune_command("bf-a1b2", "duplicate")

		// When
		tc.handle_seal_rune()

		// Then
		tc.error_contains("sealed")
	})

	t.Run("returns error when rune does not exist", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.empty_stream("bf-missing")
		tc.a_seal_rune_command("bf-missing", "reason")

		// When
		tc.handle_seal_rune()

		// Then
		tc.error_is_not_found("rune", "bf-missing")
	})
}

func TestHandleAddDependency(t *testing.T) {
	t.Run("adds a relates_to dependency", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.existing_rune_in_stream("bf-c3d4", "open")
		tc.an_add_dependency_command("bf-a1b2", "bf-c3d4", RelRelatesTo)

		// When
		tc.handle_add_dependency()

		// Then
		tc.no_error()
		tc.event_was_appended_to_stream("rune-bf-a1b2")
		tc.appended_event_has_type(EventDependencyAdded)
	})

	t.Run("adds a blocks dependency with no cycle", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.existing_rune_in_stream("bf-c3d4", "open")
		tc.dependency_graph_has_no_cycle("bf-a1b2", "bf-c3d4")
		tc.an_add_dependency_command("bf-a1b2", "bf-c3d4", RelBlocks)

		// When
		tc.handle_add_dependency()

		// Then
		tc.no_error()
		tc.forward_dep_added_event_on_stream("rune-bf-a1b2", "bf-a1b2", "bf-c3d4", RelBlocks)
		tc.inverse_dep_added_event_on_stream("rune-bf-c3d4", "bf-c3d4", "bf-a1b2", RelBlockedBy)
	})

	t.Run("returns error for blocks dependency with cycle", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.existing_rune_in_stream("bf-c3d4", "open")
		tc.dependency_graph_has_cycle("bf-a1b2", "bf-c3d4")
		tc.an_add_dependency_command("bf-a1b2", "bf-c3d4", RelBlocks)

		// When
		tc.handle_add_dependency()

		// Then
		tc.error_contains("cycle")
	})

	t.Run("supersedes auto-seals target rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.existing_rune_in_stream("bf-c3d4", "open")
		tc.an_add_dependency_command("bf-a1b2", "bf-c3d4", RelSupersedes)

		// When
		tc.handle_add_dependency()

		// Then
		tc.no_error()
		tc.forward_dep_added_event_on_stream("rune-bf-a1b2", "bf-a1b2", "bf-c3d4", RelSupersedes)
		tc.seal_event_was_appended_to_stream("rune-bf-c3d4")
		tc.inverse_dep_added_event_on_stream("rune-bf-c3d4", "bf-c3d4", "bf-a1b2", RelSupersededBy)
	})

	t.Run("normalizes inverse relationship input", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.existing_rune_in_stream("bf-c3d4", "open")
		tc.dependency_graph_has_no_cycle("bf-a1b2", "bf-c3d4")
		tc.an_add_dependency_command("bf-c3d4", "bf-a1b2", RelBlockedBy)

		// When
		tc.handle_add_dependency()

		// Then
		tc.no_error()
		tc.forward_dep_added_event_on_stream("rune-bf-a1b2", "bf-a1b2", "bf-c3d4", RelBlocks)
		tc.inverse_dep_added_event_on_stream("rune-bf-c3d4", "bf-c3d4", "bf-a1b2", RelBlockedBy)
	})

	t.Run("emits inverse relates_to with IsInverse true", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.existing_rune_in_stream("bf-c3d4", "open")
		tc.an_add_dependency_command("bf-a1b2", "bf-c3d4", RelRelatesTo)

		// When
		tc.handle_add_dependency()

		// Then
		tc.no_error()
		tc.forward_dep_added_event_on_stream("rune-bf-a1b2", "bf-a1b2", "bf-c3d4", RelRelatesTo)
		tc.inverse_dep_added_event_on_stream("rune-bf-c3d4", "bf-c3d4", "bf-a1b2", RelRelatesTo)
	})

	t.Run("returns error when source rune does not exist", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.empty_stream("bf-missing")
		tc.existing_rune_in_stream("bf-c3d4", "open")
		tc.an_add_dependency_command("bf-missing", "bf-c3d4", RelRelatesTo)

		// When
		tc.handle_add_dependency()

		// Then
		tc.error_is_not_found("rune", "bf-missing")
	})

	t.Run("returns error when target rune does not exist", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.empty_stream("bf-missing")
		tc.an_add_dependency_command("bf-a1b2", "bf-missing", RelRelatesTo)

		// When
		tc.handle_add_dependency()

		// Then
		tc.error_is_not_found("rune", "bf-missing")
	})

	t.Run("returns error for unknown relationship type", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.existing_rune_in_stream("bf-c3d4", "open")
		tc.an_add_dependency_command("bf-a1b2", "bf-c3d4", "unknown_rel")

		// When
		tc.handle_add_dependency()

		// Then
		tc.error_contains("unknown relationship")
	})
}

func TestHandleRemoveDependency(t *testing.T) {
	t.Run("removes an existing dependency and emits inverse removal", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.existing_rune_in_stream("bf-c3d4", "open")
		tc.dependency_exists_in_graph("bf-a1b2", "bf-c3d4", RelBlocks)
		tc.a_remove_dependency_command("bf-a1b2", "bf-c3d4", RelBlocks)

		// When
		tc.handle_remove_dependency()

		// Then
		tc.no_error()
		tc.forward_dep_removed_event_on_stream("rune-bf-a1b2", "bf-a1b2", "bf-c3d4", RelBlocks)
		tc.inverse_dep_removed_event_on_stream("rune-bf-c3d4", "bf-c3d4", "bf-a1b2", RelBlockedBy)
	})

	t.Run("normalizes inverse relationship on remove", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.existing_rune_in_stream("bf-c3d4", "open")
		tc.dependency_exists_in_graph("bf-a1b2", "bf-c3d4", RelBlocks)
		tc.a_remove_dependency_command("bf-c3d4", "bf-a1b2", RelBlockedBy)

		// When
		tc.handle_remove_dependency()

		// Then
		tc.no_error()
		tc.forward_dep_removed_event_on_stream("rune-bf-a1b2", "bf-a1b2", "bf-c3d4", RelBlocks)
		tc.inverse_dep_removed_event_on_stream("rune-bf-c3d4", "bf-c3d4", "bf-a1b2", RelBlockedBy)
	})

	t.Run("returns error when source rune does not exist", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.empty_stream("bf-missing")
		tc.a_remove_dependency_command("bf-missing", "bf-c3d4", RelBlocks)

		// When
		tc.handle_remove_dependency()

		// Then
		tc.error_is_not_found("rune", "bf-missing")
	})

	t.Run("returns error when dependency does not exist in graph", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.a_projection_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.dependency_not_in_graph("bf-a1b2", "bf-c3d4", RelBlocks)
		tc.a_remove_dependency_command("bf-a1b2", "bf-c3d4", RelBlocks)

		// When
		tc.handle_remove_dependency()

		// Then
		tc.error_is_not_found("dependency", "bf-a1b2")
	})
}

func TestHandleAddNote(t *testing.T) {
	t.Run("adds a note to an existing rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.an_add_note_command("bf-a1b2", "This is a note")

		// When
		tc.handle_add_note()

		// Then
		tc.no_error()
		tc.event_was_appended_to_stream("rune-bf-a1b2")
		tc.appended_event_has_type(EventRuneNoted)
	})

	t.Run("returns error when rune does not exist", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.empty_stream("bf-missing")
		tc.an_add_note_command("bf-missing", "A note")

		// When
		tc.handle_add_note()

		// Then
		tc.error_is_not_found("rune", "bf-missing")
	})
}

// --- Test Context ---

type handlerTestContext struct {
	t *testing.T

	realmID         string
	eventStore      *mockEventStore
	projectionStore *mockProjectionStore
	ctx             context.Context

	createCmd CreateRune
	updateCmd UpdateRune
	claimCmd  ClaimRune
	fulfillCmd FulfillRune
	sealCmd   SealRune
	addDepCmd AddDependency
	removeDepCmd RemoveDependency
	addNoteCmd AddNote

	createdEvent RuneCreated
	state        RuneState
	events       []core.Event
	err          error
}

func newHandlerTestContext(t *testing.T) *handlerTestContext {
	t.Helper()
	return &handlerTestContext{
		t:   t,
		ctx: context.Background(),
	}
}

// --- Given ---

func (tc *handlerTestContext) a_realm(realmID string) {
	tc.t.Helper()
	tc.realmID = realmID
}

func (tc *handlerTestContext) an_event_store() {
	tc.t.Helper()
	if tc.eventStore == nil {
		tc.eventStore = newMockEventStore()
	}
}

func (tc *handlerTestContext) a_projection_store() {
	tc.t.Helper()
	if tc.projectionStore == nil {
		tc.projectionStore = newMockProjectionStore()
	}
}

func (tc *handlerTestContext) no_events() {
	tc.t.Helper()
	tc.events = []core.Event{}
}

func (tc *handlerTestContext) events_from_created_rune() {
	tc.t.Helper()
	tc.events = []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{
			ID: "bf-a1b2", Title: "Fix the bridge", Description: "Needs repair", Priority: 1,
		}),
	}
}

func (tc *handlerTestContext) events_from_created_child_rune() {
	tc.t.Helper()
	tc.events = []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{
			ID: "bf-a1b2.1", Title: "Child task", Priority: 2, ParentID: "bf-a1b2",
		}),
	}
}

func (tc *handlerTestContext) events_from_created_rune_with_branch(branch string) {
	tc.t.Helper()
	tc.events = []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{
			ID: "bf-a1b2", Title: "Fix the bridge", Description: "Needs repair", Priority: 1, Branch: branch,
		}),
	}
}

func (tc *handlerTestContext) events_from_created_rune_with_branch_then_updated(initialBranch, updatedBranch string) {
	tc.t.Helper()
	tc.events = []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{
			ID: "bf-a1b2", Title: "Fix the bridge", Priority: 1, Branch: initialBranch,
		}),
		makeEvent(EventRuneUpdated, RuneUpdated{
			ID: "bf-a1b2", Branch: &updatedBranch,
		}),
	}
}

func (tc *handlerTestContext) events_from_created_and_updated_rune() {
	tc.t.Helper()
	title := "Updated title"
	prio := 3
	tc.events = []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{
			ID: "bf-a1b2", Title: "Fix the bridge", Priority: 1,
		}),
		makeEvent(EventRuneUpdated, RuneUpdated{
			ID: "bf-a1b2", Title: &title, Priority: &prio,
		}),
	}
}

func (tc *handlerTestContext) events_from_created_and_claimed_rune() {
	tc.t.Helper()
	tc.events = []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{
			ID: "bf-a1b2", Title: "Fix the bridge", Priority: 1,
		}),
		makeEvent(EventRuneForged, RuneForged{
			ID: "bf-a1b2",
		}),
		makeEvent(EventRuneClaimed, RuneClaimed{
			ID: "bf-a1b2", Claimant: "odin",
		}),
	}
}

func (tc *handlerTestContext) events_from_created_claimed_and_fulfilled_rune() {
	tc.t.Helper()
	tc.events = []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{
			ID: "bf-a1b2", Title: "Fix the bridge", Priority: 1,
		}),
		makeEvent(EventRuneForged, RuneForged{
			ID: "bf-a1b2",
		}),
		makeEvent(EventRuneClaimed, RuneClaimed{
			ID: "bf-a1b2", Claimant: "odin",
		}),
		makeEvent(EventRuneFulfilled, RuneFulfilled{
			ID: "bf-a1b2",
		}),
	}
}

func (tc *handlerTestContext) events_from_created_and_sealed_rune() {
	tc.t.Helper()
	tc.events = []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{
			ID: "bf-a1b2", Title: "Fix the bridge", Priority: 1,
		}),
		makeEvent(EventRuneSealed, RuneSealed{
			ID: "bf-a1b2", Reason: "done",
		}),
	}
}

func (tc *handlerTestContext) existing_rune_with_branch_in_stream(runeID string, status string, branch string) {
	tc.t.Helper()
	tc.an_event_store()
	events := []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{
			ID: runeID, Title: "Existing rune", Priority: 1, Branch: branch,
		}),
	}
	switch status {
	case "open":
		events = append(events, makeEvent(EventRuneForged, RuneForged{
			ID: runeID,
		}))
	case "claimed":
		events = append(events, makeEvent(EventRuneForged, RuneForged{
			ID: runeID,
		}))
		events = append(events, makeEvent(EventRuneClaimed, RuneClaimed{
			ID: runeID, Claimant: "someone",
		}))
	case "fulfilled":
		events = append(events, makeEvent(EventRuneForged, RuneForged{
			ID: runeID,
		}))
		events = append(events, makeEvent(EventRuneClaimed, RuneClaimed{
			ID: runeID, Claimant: "someone",
		}))
		events = append(events, makeEvent(EventRuneFulfilled, RuneFulfilled{
			ID: runeID,
		}))
	case "sealed":
		events = append(events, makeEvent(EventRuneSealed, RuneSealed{
			ID: runeID, Reason: "sealed",
		}))
	}
	tc.eventStore.streams["rune-"+runeID] = events
}

func (tc *handlerTestContext) existing_rune_in_stream(runeID string, status string) {
	tc.t.Helper()
	tc.an_event_store()
	events := []core.Event{
		makeEvent(EventRuneCreated, RuneCreated{
			ID: runeID, Title: "Existing rune", Priority: 1,
		}),
	}
	switch status {
	case "open":
		events = append(events, makeEvent(EventRuneForged, RuneForged{
			ID: runeID,
		}))
	case "claimed":
		events = append(events, makeEvent(EventRuneForged, RuneForged{
			ID: runeID,
		}))
		events = append(events, makeEvent(EventRuneClaimed, RuneClaimed{
			ID: runeID, Claimant: "someone",
		}))
	case "fulfilled":
		events = append(events, makeEvent(EventRuneForged, RuneForged{
			ID: runeID,
		}))
		events = append(events, makeEvent(EventRuneClaimed, RuneClaimed{
			ID: runeID, Claimant: "someone",
		}))
		events = append(events, makeEvent(EventRuneFulfilled, RuneFulfilled{
			ID: runeID,
		}))
	case "sealed":
		events = append(events, makeEvent(EventRuneSealed, RuneSealed{
			ID: runeID, Reason: "sealed",
		}))
	}
	tc.eventStore.streams["rune-"+runeID] = events
}

func (tc *handlerTestContext) empty_stream(runeID string) {
	tc.t.Helper()
	tc.an_event_store()
	tc.eventStore.streams["rune-"+runeID] = []core.Event{}
}

func (tc *handlerTestContext) with_branch_on_create_command(branch string) {
	tc.t.Helper()
	tc.createCmd.Branch = &branch
}

func (tc *handlerTestContext) with_branch_on_update_command(branch string) {
	tc.t.Helper()
	tc.updateCmd.Branch = &branch
}

func (tc *handlerTestContext) projection_returns_child_count(parentID string, count int) {
	tc.t.Helper()
	tc.a_projection_store()
	tc.projectionStore.data["RuneChildCount:"+parentID] = count
}

func (tc *handlerTestContext) dependency_graph_has_no_cycle(sourceID, targetID string) {
	tc.t.Helper()
	tc.a_projection_store()
	// No cycle entry means no cycle detected
}

func (tc *handlerTestContext) dependency_graph_has_cycle(sourceID, targetID string) {
	tc.t.Helper()
	tc.a_projection_store()
	key := "dependency_graph:cycle:" + sourceID + ":" + targetID
	tc.projectionStore.data[key] = true
}

func (tc *handlerTestContext) dependency_exists_in_graph(sourceID, targetID, rel string) {
	tc.t.Helper()
	tc.a_projection_store()
	key := "dependency_graph:dep:" + sourceID + ":" + targetID + ":" + rel
	tc.projectionStore.data[key] = true
}

func (tc *handlerTestContext) dependency_not_in_graph(sourceID, targetID, rel string) {
	tc.t.Helper()
	tc.a_projection_store()
	// No entry means dependency doesn't exist
}

func (tc *handlerTestContext) a_create_rune_command(title, description string, priority int, parentID string) {
	tc.t.Helper()
	tc.createCmd = CreateRune{
		Title:       title,
		Description: description,
		Priority:    priority,
		ParentID:    parentID,
	}
}

func (tc *handlerTestContext) an_update_rune_command(id string, title *string, description *string, priority *int) {
	tc.t.Helper()
	tc.updateCmd = UpdateRune{
		ID:          id,
		Title:       title,
		Description: description,
		Priority:    priority,
	}
}

func (tc *handlerTestContext) a_claim_rune_command(id, claimant string) {
	tc.t.Helper()
	tc.claimCmd = ClaimRune{
		ID:       id,
		Claimant: claimant,
	}
}

func (tc *handlerTestContext) a_fulfill_rune_command(id string) {
	tc.t.Helper()
	tc.fulfillCmd = FulfillRune{
		ID: id,
	}
}

func (tc *handlerTestContext) a_seal_rune_command(id, reason string) {
	tc.t.Helper()
	tc.sealCmd = SealRune{
		ID:     id,
		Reason: reason,
	}
}

func (tc *handlerTestContext) an_add_dependency_command(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.addDepCmd = AddDependency{
		RuneID:       runeID,
		TargetID:     targetID,
		Relationship: relationship,
	}
}

func (tc *handlerTestContext) a_remove_dependency_command(runeID, targetID, relationship string) {
	tc.t.Helper()
	tc.removeDepCmd = RemoveDependency{
		RuneID:       runeID,
		TargetID:     targetID,
		Relationship: relationship,
	}
}

func (tc *handlerTestContext) an_add_note_command(runeID, text string) {
	tc.t.Helper()
	tc.addNoteCmd = AddNote{
		RuneID: runeID,
		Text:   text,
	}
}

// --- When ---

func (tc *handlerTestContext) state_is_rebuilt() {
	tc.t.Helper()
	tc.state = RebuildRuneState(tc.events)
}

func (tc *handlerTestContext) handle_create_rune() {
	tc.t.Helper()
	tc.createdEvent, tc.err = HandleCreateRune(tc.ctx, tc.realmID, tc.createCmd, tc.eventStore, tc.projectionStore)
}

func (tc *handlerTestContext) handle_update_rune() {
	tc.t.Helper()
	tc.err = HandleUpdateRune(tc.ctx, tc.realmID, tc.updateCmd, tc.eventStore)
}

func (tc *handlerTestContext) handle_claim_rune() {
	tc.t.Helper()
	tc.err = HandleClaimRune(tc.ctx, tc.realmID, tc.claimCmd, tc.eventStore)
}

func (tc *handlerTestContext) handle_fulfill_rune() {
	tc.t.Helper()
	tc.err = HandleFulfillRune(tc.ctx, tc.realmID, tc.fulfillCmd, tc.eventStore)
}

func (tc *handlerTestContext) handle_seal_rune() {
	tc.t.Helper()
	tc.err = HandleSealRune(tc.ctx, tc.realmID, tc.sealCmd, tc.eventStore)
}

func (tc *handlerTestContext) handle_add_dependency() {
	tc.t.Helper()
	tc.err = HandleAddDependency(tc.ctx, tc.realmID, tc.addDepCmd, tc.eventStore, tc.projectionStore)
}

func (tc *handlerTestContext) handle_remove_dependency() {
	tc.t.Helper()
	tc.err = HandleRemoveDependency(tc.ctx, tc.realmID, tc.removeDepCmd, tc.eventStore, tc.projectionStore)
}

func (tc *handlerTestContext) handle_add_note() {
	tc.t.Helper()
	tc.err = HandleAddNote(tc.ctx, tc.realmID, tc.addNoteCmd, tc.eventStore)
}

// --- Then ---

func (tc *handlerTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *handlerTestContext) error_contains(substring string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), substring)
}

func (tc *handlerTestContext) error_is_not_found(entity, id string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	var nfe *core.NotFoundError
	require.True(tc.t, errors.As(tc.err, &nfe), "expected NotFoundError, got %T: %v", tc.err, tc.err)
	assert.Equal(tc.t, entity, nfe.Entity)
	assert.Equal(tc.t, id, nfe.ID)
}

func (tc *handlerTestContext) state_does_not_exist() {
	tc.t.Helper()
	assert.False(tc.t, tc.state.Exists)
}

func (tc *handlerTestContext) state_exists() {
	tc.t.Helper()
	assert.True(tc.t, tc.state.Exists)
}

func (tc *handlerTestContext) state_has_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.ID)
}

func (tc *handlerTestContext) state_has_title(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.Title)
}

func (tc *handlerTestContext) state_has_description(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.Description)
}

func (tc *handlerTestContext) state_has_priority(expected int) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.Priority)
}

func (tc *handlerTestContext) state_has_status(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.Status)
}

func (tc *handlerTestContext) state_has_claimant(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.Claimant)
}

func (tc *handlerTestContext) state_has_parent_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.ParentID)
}

func (tc *handlerTestContext) state_has_branch(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.state.Branch)
}

func (tc *handlerTestContext) created_event_was_returned() {
	tc.t.Helper()
	assert.NotEmpty(tc.t, tc.createdEvent.ID)
	assert.NotEmpty(tc.t, tc.createdEvent.Title)
}

func (tc *handlerTestContext) created_event_has_title(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.createdEvent.Title)
}

func (tc *handlerTestContext) created_event_has_description(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.createdEvent.Description)
}

func (tc *handlerTestContext) created_event_has_priority(expected int) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.createdEvent.Priority)
}

func (tc *handlerTestContext) created_event_has_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.createdEvent.ID)
}

func (tc *handlerTestContext) created_event_has_parent_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.createdEvent.ParentID)
}

func (tc *handlerTestContext) created_event_has_branch(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.createdEvent.Branch)
}

func (tc *handlerTestContext) created_event_id_matches_hex_pattern() {
	tc.t.Helper()
	assert.Regexp(tc.t, `^bf-[0-9a-f]{4}$`, tc.createdEvent.ID)
}

func (tc *handlerTestContext) event_was_appended_to_stream_with_prefix(prefix string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	assert.Contains(tc.t, lastCall.streamID, prefix)
}

func (tc *handlerTestContext) event_was_appended_with_expected_version(version int) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	assert.Equal(tc.t, version, lastCall.expectedVersion)
}

func (tc *handlerTestContext) event_was_appended_to_stream(streamID string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	found := false
	for _, call := range tc.eventStore.appendedCalls {
		if call.streamID == streamID {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected Append to stream %q, got calls: %v", streamID, tc.eventStore.appendedCalls)
}

func (tc *handlerTestContext) appended_event_has_type(eventType string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	lastCall := tc.eventStore.appendedCalls[len(tc.eventStore.appendedCalls)-1]
	require.NotEmpty(tc.t, lastCall.events, "expected at least one event in Append call")
	found := false
	for _, evt := range lastCall.events {
		if evt.EventType == eventType {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected event type %q in appended events", eventType)
}

func (tc *handlerTestContext) seal_event_was_appended_to_stream(streamID string) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	found := false
	for _, call := range tc.eventStore.appendedCalls {
		if call.streamID == streamID {
			for _, evt := range call.events {
				if evt.EventType == EventRuneSealed {
					found = true
					break
				}
			}
		}
	}
	assert.True(tc.t, found, "expected RuneSealed event appended to stream %q", streamID)
}

func (tc *handlerTestContext) forward_dep_added_event_on_stream(streamID, runeID, targetID, rel string) {
	tc.t.Helper()
	tc.dep_event_on_stream(streamID, EventDependencyAdded, runeID, targetID, rel, false)
}

func (tc *handlerTestContext) inverse_dep_added_event_on_stream(streamID, runeID, targetID, rel string) {
	tc.t.Helper()
	tc.dep_event_on_stream(streamID, EventDependencyAdded, runeID, targetID, rel, true)
}

func (tc *handlerTestContext) forward_dep_removed_event_on_stream(streamID, runeID, targetID, rel string) {
	tc.t.Helper()
	tc.dep_event_on_stream(streamID, EventDependencyRemoved, runeID, targetID, rel, false)
}

func (tc *handlerTestContext) inverse_dep_removed_event_on_stream(streamID, runeID, targetID, rel string) {
	tc.t.Helper()
	tc.dep_event_on_stream(streamID, EventDependencyRemoved, runeID, targetID, rel, true)
}

func (tc *handlerTestContext) dep_event_on_stream(streamID, eventType, runeID, targetID, rel string, isInverse bool) {
	tc.t.Helper()
	require.NotEmpty(tc.t, tc.eventStore.appendedCalls, "expected at least one Append call")
	found := false
	for _, call := range tc.eventStore.appendedCalls {
		if call.streamID != streamID {
			continue
		}
		for _, evt := range call.events {
			if evt.EventType != eventType {
				continue
			}
			dataBytes, err := json.Marshal(evt.Data)
			require.NoError(tc.t, err)

			if eventType == EventDependencyAdded {
				var dep DependencyAdded
				require.NoError(tc.t, json.Unmarshal(dataBytes, &dep))
				if dep.RuneID == runeID && dep.TargetID == targetID && dep.Relationship == rel && dep.IsInverse == isInverse {
					found = true
					break
				}
			} else if eventType == EventDependencyRemoved {
				var dep DependencyRemoved
				require.NoError(tc.t, json.Unmarshal(dataBytes, &dep))
				if dep.RuneID == runeID && dep.TargetID == targetID && dep.Relationship == rel && dep.IsInverse == isInverse {
					found = true
					break
				}
			}
		}
		if found {
			break
		}
	}
	assert.True(tc.t, found, "expected %s event on stream %q with runeID=%q targetID=%q rel=%q isInverse=%v",
		eventType, streamID, runeID, targetID, rel, isInverse)
}

// --- Helpers ---

func strPtr(s string) *string { return &s }
func intPtr(i int) *int       { return &i }

func makeEvent(eventType string, data any) core.Event {
	dataBytes, _ := json.Marshal(data)
	return core.Event{
		EventType: eventType,
		Data:      dataBytes,
	}
}

// --- Mock Event Store ---

type appendCall struct {
	realmID         string
	streamID        string
	expectedVersion int
	events          []core.EventData
}

type mockEventStore struct {
	streams       map[string][]core.Event
	appendedCalls []appendCall
	appendErr     error
}

func newMockEventStore() *mockEventStore {
	return &mockEventStore{
		streams: make(map[string][]core.Event),
	}
}

func (m *mockEventStore) Append(ctx context.Context, realmID string, streamID string, expectedVersion int, events []core.EventData) ([]core.Event, error) {
	m.appendedCalls = append(m.appendedCalls, appendCall{
		realmID:         realmID,
		streamID:        streamID,
		expectedVersion: expectedVersion,
		events:          events,
	})
	if m.appendErr != nil {
		return nil, m.appendErr
	}
	var result []core.Event
	for i, ed := range events {
		dataBytes, _ := json.Marshal(ed.Data)
		result = append(result, core.Event{
			RealmID:   realmID,
			StreamID:  streamID,
			Version:   expectedVersion + i + 1,
			EventType: ed.EventType,
			Data:      dataBytes,
		})
	}
	return result, nil
}

func (m *mockEventStore) ReadStream(ctx context.Context, realmID string, streamID string, fromVersion int) ([]core.Event, error) {
	events, ok := m.streams[streamID]
	if !ok {
		return []core.Event{}, nil
	}
	return events, nil
}

func (m *mockEventStore) ReadAll(ctx context.Context, realmID string, fromGlobalPosition int64) ([]core.Event, error) {
	return nil, nil
}

func (m *mockEventStore) ListRealmIDs(ctx context.Context) ([]string, error) {
	return []string{}, nil
}

// --- Mock Projection Store ---

type mockProjectionStore struct {
	data map[string]any
}

func newMockProjectionStore() *mockProjectionStore {
	return &mockProjectionStore{
		data: make(map[string]any),
	}
}

func (m *mockProjectionStore) Get(ctx context.Context, realmID string, projectionName string, key string, dest any) error {
	compositeKey := projectionName + ":" + key
	val, ok := m.data[compositeKey]
	if !ok {
		return &core.NotFoundError{Entity: projectionName, ID: key}
	}
	dataBytes, err := json.Marshal(val)
	if err != nil {
		return err
	}
	return json.Unmarshal(dataBytes, dest)
}

func (m *mockProjectionStore) Put(ctx context.Context, realmID string, projectionName string, key string, value any) error {
	compositeKey := projectionName + ":" + key
	m.data[compositeKey] = value
	return nil
}

func (m *mockProjectionStore) List(_ context.Context, _ string, _ string) ([]json.RawMessage, error) {
	return nil, nil
}

func (m *mockProjectionStore) Delete(ctx context.Context, realmID string, projectionName string, key string) error {
	compositeKey := projectionName + ":" + key
	delete(m.data, compositeKey)
	return nil
}
