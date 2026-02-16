package integration

import (
	"context"
	"testing"

	"github.com/devzeebo/bifrost/domain"
	"github.com/devzeebo/bifrost/domain/projectors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Command Handler Integration Tests ---

func TestCreateRune_TopLevel(t *testing.T) {
	t.Run("creates rune with bf-xxxx ID and emits RuneCreated event", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")

		// When
		tc.create_top_level_rune("Fix the bridge", "Needs repair", 1)

		// Then
		tc.no_error()
		tc.created_event_id_matches_hex_pattern()
		tc.created_event_has_title("Fix the bridge")
		tc.created_event_has_description("Needs repair")
		tc.created_event_has_priority(1)
		tc.stream_has_event_count(1)
		tc.stream_has_event_type(0, domain.EventRuneCreated)
	})
}

func TestCreateRune_Child(t *testing.T) {
	t.Run("creates child rune with parent.N ID format", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_existing_top_level_rune("Parent task", 1)

		// When
		tc.create_child_rune("Child task", "", 2)

		// Then
		tc.no_error()
		tc.created_event_has_id(tc.parentID + ".1")
		tc.created_event_has_parent_id(tc.parentID)
	})
}

func TestCreateRune_ChildOfSealed(t *testing.T) {
	t.Run("returns error when creating child of sealed rune", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_existing_sealed_rune("Sealed parent", 1)

		// When
		tc.create_child_rune("Child of sealed", "", 2)

		// Then
		tc.error_contains("sealed")
	})
}

func TestUpdateRune(t *testing.T) {
	t.Run("updates title and priority, emits RuneUpdated event", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_existing_top_level_rune("Old title", 1)

		// When
		tc.update_rune(strPtr("New title"), nil, intPtr(5))

		// Then
		tc.no_error()
		tc.stream_has_event_count(2)
		tc.stream_has_event_type(1, domain.EventRuneUpdated)
		tc.rebuilt_state_has_title("New title")
		tc.rebuilt_state_has_priority(5)
	})
}

func TestUpdateRune_Sealed(t *testing.T) {
	t.Run("returns error when updating sealed rune", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_existing_sealed_rune("Sealed rune", 1)

		// When
		tc.update_rune(strPtr("New title"), nil, nil)

		// Then
		tc.error_contains("sealed")
	})
}

func TestClaimRune(t *testing.T) {
	t.Run("claims open rune, emits RuneClaimed event", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_existing_top_level_rune("Claimable task", 1)

		// When
		tc.claim_rune("odin")

		// Then
		tc.no_error()
		tc.stream_has_event_count(2)
		tc.stream_has_event_type(1, domain.EventRuneClaimed)
		tc.rebuilt_state_has_status("claimed")
		tc.rebuilt_state_has_claimant("odin")
	})
}

func TestClaimRune_AlreadyClaimed(t *testing.T) {
	t.Run("returns error when rune is already claimed", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_existing_claimed_rune("Claimed task", 1, "odin")

		// When
		tc.claim_rune("thor")

		// Then
		tc.error_contains("claimed")
	})
}

func TestClaimRune_Sealed(t *testing.T) {
	t.Run("returns error when claiming sealed rune", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_existing_sealed_rune("Sealed task", 1)

		// When
		tc.claim_rune("odin")

		// Then
		tc.error_contains("sealed")
	})
}

func TestFulfillRune(t *testing.T) {
	t.Run("fulfills claimed rune, emits RuneFulfilled event", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_existing_claimed_rune("Claimed task", 1, "odin")

		// When
		tc.fulfill_rune()

		// Then
		tc.no_error()
		tc.stream_has_event_type(2, domain.EventRuneFulfilled)
		tc.rebuilt_state_has_status("fulfilled")
	})
}

func TestFulfillRune_Unclaimed(t *testing.T) {
	t.Run("returns error when fulfilling unclaimed rune", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_existing_top_level_rune("Open task", 1)

		// When
		tc.fulfill_rune()

		// Then
		tc.error_contains("claimed")
	})
}

func TestSealRune(t *testing.T) {
	t.Run("seals open rune, emits RuneSealed event", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_existing_top_level_rune("Open task", 1)

		// When
		tc.seal_rune("no longer needed")

		// Then
		tc.no_error()
		tc.stream_has_event_count(2)
		tc.stream_has_event_type(1, domain.EventRuneSealed)
		tc.rebuilt_state_has_status("sealed")
	})
}

func TestSealRune_AlreadySealed(t *testing.T) {
	t.Run("returns error when sealing already sealed rune", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_existing_sealed_rune("Sealed task", 1)

		// When
		tc.seal_rune("duplicate")

		// Then
		tc.error_contains("sealed")
	})
}

func TestAddDependency_Blocks(t *testing.T) {
	t.Run("adds blocks dependency, emits DependencyAdded event and reflects in rune_detail", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.two_existing_runes("Task A", "Task B")

		// When
		tc.add_dependency(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlocks)

		// Then
		tc.no_error()
		tc.rune_stream_has_event_type(tc.runeIDs[0], domain.EventDependencyAdded)

		// When: project all events
		tc.project_all_events()

		// Then: source rune_detail has forward dependency
		tc.rune_detail_has_dependency(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlocks)
		// Then: target rune_detail has inverse dependency
		tc.rune_detail_has_dependency(tc.runeIDs[1], tc.runeIDs[0], domain.RelBlockedBy)
	})
}

func TestAddDependency_CycleDetection(t *testing.T) {
	t.Run("returns error when adding blocks dependency would create cycle", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.two_existing_runes("Task A", "Task B")
		tc.add_dependency(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlocks)
		tc.no_error()
		tc.project_all_events()
		tc.store_cycle_detection_entry(tc.runeIDs[1], tc.runeIDs[0])

		// When
		tc.add_dependency(tc.runeIDs[1], tc.runeIDs[0], domain.RelBlocks)

		// Then
		tc.error_contains("cycle")
	})
}

func TestAddDependency_Supersedes(t *testing.T) {
	t.Run("supersedes auto-seals target rune", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.two_existing_runes("New task", "Old task")

		// When
		tc.add_dependency(tc.runeIDs[0], tc.runeIDs[1], domain.RelSupersedes)

		// Then
		tc.no_error()
		tc.rune_stream_has_event_type(tc.runeIDs[0], domain.EventDependencyAdded)
		tc.rune_is_sealed(tc.runeIDs[1])
	})
}

func TestAddDependency_InvalidRelationship(t *testing.T) {
	t.Run("returns error for unknown relationship type", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.two_existing_runes("Task A", "Task B")

		// When
		tc.add_dependency(tc.runeIDs[0], tc.runeIDs[1], "unknown_rel")

		// Then
		tc.error_contains("unknown relationship")
	})
}

func TestRemoveDependency(t *testing.T) {
	t.Run("removes existing dependency, emits DependencyRemoved event", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.two_existing_runes("Task A", "Task B")
		tc.add_dependency(tc.runeIDs[0], tc.runeIDs[1], domain.RelRelatesTo)
		tc.no_error()
		tc.project_all_events()
		tc.seed_handler_dep_lookup(tc.runeIDs[0], tc.runeIDs[1], domain.RelRelatesTo)

		// When
		tc.remove_dependency(tc.runeIDs[0], tc.runeIDs[1], domain.RelRelatesTo)

		// Then
		tc.no_error()
		tc.rune_stream_has_event_type(tc.runeIDs[0], domain.EventDependencyRemoved)
	})
}

func TestAddDependency_InverseInput(t *testing.T) {
	t.Run("normalizes inverse input and reflects correctly in rune_detail", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.two_existing_runes("Task A", "Task B")
		tc.project_all_events()

		// When: add dependency with inverse relationship (A blocked_by B)
		// This normalizes to: B blocks A
		tc.add_dependency(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlockedBy)

		// Then
		tc.no_error()

		// When: project all events
		tc.project_all_events()

		// Then: rune B's detail has forward entry {target_id: A, relationship: blocks}
		tc.rune_detail_has_dependency(tc.runeIDs[1], tc.runeIDs[0], domain.RelBlocks)
		// Then: rune A's detail has inverse entry {target_id: B, relationship: blocked_by}
		tc.rune_detail_has_dependency(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlockedBy)
	})
}

func TestRemoveDependency_InverseCleanup(t *testing.T) {
	t.Run("removes blocks dependency and cleans up both rune_detail projections", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.two_existing_runes("Task A", "Task B")
		tc.add_dependency(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlocks)
		tc.no_error()
		tc.project_all_events()
		tc.seed_handler_dep_lookup(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlocks)

		// Verify deps exist before removal
		tc.rune_detail_has_dependency(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlocks)
		tc.rune_detail_has_dependency(tc.runeIDs[1], tc.runeIDs[0], domain.RelBlockedBy)

		// When: remove the dependency
		tc.remove_dependency(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlocks)

		// Then
		tc.no_error()

		// When: project all events
		tc.project_all_events()

		// Then: both runes' rune_detail projections have empty dependencies
		tc.rune_detail_has_no_dependencies(tc.runeIDs[0])
		tc.rune_detail_has_no_dependencies(tc.runeIDs[1])
	})
}

func TestAddNote(t *testing.T) {
	t.Run("adds note to existing rune, emits RuneNoted event", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_existing_top_level_rune("Task with notes", 1)

		// When
		tc.add_note("This is a note")

		// Then
		tc.no_error()
		tc.stream_has_event_type(1, domain.EventRuneNoted)
	})
}

// --- Projector Integration Tests ---

func TestRuneListProjector_FullLifecycle(t *testing.T) {
	t.Run("create, update, claim rune and verify projection state at each step", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")

		// When: create rune
		tc.create_top_level_rune("Fix the bridge", "Needs repair", 1)
		tc.no_error()
		tc.project_all_events()

		// Then: rune_list has open summary
		tc.rune_list_has_entry(tc.createdEvent.ID)
		tc.rune_list_entry_has_title(tc.createdEvent.ID, "Fix the bridge")
		tc.rune_list_entry_has_status(tc.createdEvent.ID, "open")
		tc.rune_list_entry_has_priority(tc.createdEvent.ID, 1)

		// When: update rune
		tc.update_rune(strPtr("Repaired bridge"), nil, intPtr(3))
		tc.no_error()
		tc.project_all_events()

		// Then: rune_list reflects update
		tc.rune_list_entry_has_title(tc.createdEvent.ID, "Repaired bridge")
		tc.rune_list_entry_has_priority(tc.createdEvent.ID, 3)
		tc.rune_list_entry_has_status(tc.createdEvent.ID, "open")

		// When: claim rune
		tc.claim_rune("odin")
		tc.no_error()
		tc.project_all_events()

		// Then: rune_list reflects claim
		tc.rune_list_entry_has_status(tc.createdEvent.ID, "claimed")
		tc.rune_list_entry_has_claimant(tc.createdEvent.ID, "odin")
	})
}

func TestRuneDetailProjector_FullLifecycle(t *testing.T) {
	t.Run("full lifecycle: create, update, claim, fulfill, add dep, add note", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")

		// When: create rune
		tc.create_top_level_rune("Fix the bridge", "Needs repair", 1)
		tc.no_error()
		tc.project_all_events()
		runeID := tc.createdEvent.ID

		// Then: detail has initial fields
		tc.rune_detail_has_entry(runeID)
		tc.rune_detail_entry_has_title(runeID, "Fix the bridge")
		tc.rune_detail_entry_has_description(runeID, "Needs repair")
		tc.rune_detail_entry_has_status(runeID, "open")
		tc.rune_detail_entry_has_priority(runeID, 1)
		tc.rune_detail_entry_has_empty_dependencies(runeID)
		tc.rune_detail_entry_has_empty_notes(runeID)

		// When: update
		tc.update_rune(strPtr("Repaired bridge"), strPtr("All fixed"), intPtr(3))
		tc.no_error()
		tc.project_all_events()

		// Then: detail reflects update
		tc.rune_detail_entry_has_title(runeID, "Repaired bridge")
		tc.rune_detail_entry_has_description(runeID, "All fixed")
		tc.rune_detail_entry_has_priority(runeID, 3)

		// When: claim
		tc.claim_rune("odin")
		tc.no_error()
		tc.project_all_events()

		// Then: detail reflects claim
		tc.rune_detail_entry_has_status(runeID, "claimed")
		tc.rune_detail_entry_has_claimant(runeID, "odin")

		// When: add note
		tc.add_note("Progress update")
		tc.no_error()
		tc.project_all_events()

		// Then: detail has note
		tc.rune_detail_entry_has_note_count(runeID, 1)
		tc.rune_detail_entry_has_note_text(runeID, 0, "Progress update")

		// When: fulfill
		tc.fulfill_rune()
		tc.no_error()
		tc.project_all_events()

		// Then: detail reflects fulfillment
		tc.rune_detail_entry_has_status(runeID, "fulfilled")
	})
}

func TestDependencyGraphProjector_FullLifecycle(t *testing.T) {
	t.Run("add and remove deps, verify bidirectional references maintained", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.two_existing_runes("Task A", "Task B")
		tc.project_all_events()

		// When: add dependency A blocks B
		tc.add_dependency(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlocks)
		tc.no_error()
		tc.project_all_events()

		// Then: source has dependency, target has dependent (forward only)
		tc.graph_source_has_dependency(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlocks)
		tc.graph_target_has_dependent(tc.runeIDs[1], tc.runeIDs[0], domain.RelBlocks)
		tc.graph_dep_lookup_exists(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlocks)

		// Then: graph does NOT contain blocked_by entries
		tc.graph_has_no_inverse_relationships(tc.runeIDs[0])
		tc.graph_has_no_inverse_relationships(tc.runeIDs[1])

		tc.seed_handler_dep_lookup(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlocks)

		// When: remove dependency
		tc.remove_dependency(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlocks)
		tc.no_error()
		tc.project_all_events()

		// Then: both sides cleaned up
		tc.graph_source_has_no_dependencies(tc.runeIDs[0])
		tc.graph_target_has_no_dependents(tc.runeIDs[1])
		tc.graph_dep_lookup_does_not_exist(tc.runeIDs[0], tc.runeIDs[1], domain.RelBlocks)
	})
}

func TestReadyRunesQuery(t *testing.T) {
	t.Run("runes with fulfilled blockers become ready", func(t *testing.T) {
		tc := newIntegrationTestContext(t)

		// Given: three runes where C blocks A, and B is independent
		tc.a_realm("realm-1")
		tc.create_top_level_rune("Task A (blocked)", "", 1)
		tc.no_error()
		runeA := tc.createdEvent.ID

		tc.create_top_level_rune("Task B (independent)", "", 1)
		tc.no_error()
		runeB := tc.createdEvent.ID

		tc.create_top_level_rune("Task C (blocker)", "", 1)
		tc.no_error()
		runeC := tc.createdEvent.ID

		tc.project_all_events()

		// When: C blocks A
		tc.add_dependency(runeC, runeA, domain.RelBlocks)
		tc.no_error()
		tc.project_all_events()

		// Then: A is blocked (has blockers), B and C are ready (no blockers)
		tc.rune_has_blockers(runeA)
		tc.rune_has_no_blockers(runeB)
		tc.rune_has_no_blockers(runeC)

		// When: claim and fulfill blocker C
		tc.claim_specific_rune(runeC, "odin")
		tc.no_error()
		tc.fulfill_specific_rune(runeC)
		tc.no_error()
		tc.project_all_events()

		// Then: A's blocker is fulfilled, rune_list shows C as fulfilled
		tc.rune_list_entry_has_status(runeC, "fulfilled")
		tc.rune_list_entry_has_status(runeA, "open")
		tc.rune_list_entry_has_status(runeB, "open")
	})
}

// --- Test Context ---

type integrationTestContext struct {
	t *testing.T

	stack   *testStack
	ctx     context.Context
	realmID string

	parentID     string
	createdEvent domain.RuneCreated
	runeIDs      []string
	err          error

	lastProjectedPosition int
}

func newIntegrationTestContext(t *testing.T) *integrationTestContext {
	t.Helper()
	return &integrationTestContext{
		t:     t,
		ctx:   context.Background(),
		stack: newTestStack(t),
	}
}

// --- Given ---

func (tc *integrationTestContext) a_realm(realmID string) {
	tc.t.Helper()
	tc.realmID = realmID
}

func (tc *integrationTestContext) an_existing_top_level_rune(title string, priority int) {
	tc.t.Helper()
	branch := "test-branch"
	tc.createdEvent, tc.err = domain.HandleCreateRune(tc.ctx, tc.realmID, domain.CreateRune{
		Title:    title,
		Priority: priority,
		Branch:   &branch,
	}, tc.stack.EventStore, tc.stack.ProjectionStore)
	require.NoError(tc.t, tc.err)
	tc.parentID = tc.createdEvent.ID
}

func (tc *integrationTestContext) an_existing_sealed_rune(title string, priority int) {
	tc.t.Helper()
	tc.an_existing_top_level_rune(title, priority)
	tc.err = domain.HandleSealRune(tc.ctx, tc.realmID, domain.SealRune{
		ID: tc.createdEvent.ID, Reason: "sealed for test",
	}, tc.stack.EventStore)
	require.NoError(tc.t, tc.err)
}

func (tc *integrationTestContext) an_existing_claimed_rune(title string, priority int, claimant string) {
	tc.t.Helper()
	tc.an_existing_top_level_rune(title, priority)
	tc.err = domain.HandleClaimRune(tc.ctx, tc.realmID, domain.ClaimRune{
		ID: tc.createdEvent.ID, Claimant: claimant,
	}, tc.stack.EventStore)
	require.NoError(tc.t, tc.err)
}

func (tc *integrationTestContext) two_existing_runes(titleA, titleB string) {
	tc.t.Helper()
	tc.runeIDs = nil

	branch := "test-branch"
	evtA, err := domain.HandleCreateRune(tc.ctx, tc.realmID, domain.CreateRune{
		Title: titleA, Priority: 1, Branch: &branch,
	}, tc.stack.EventStore, tc.stack.ProjectionStore)
	require.NoError(tc.t, err)
	tc.runeIDs = append(tc.runeIDs, evtA.ID)

	evtB, err := domain.HandleCreateRune(tc.ctx, tc.realmID, domain.CreateRune{
		Title: titleB, Priority: 1, Branch: &branch,
	}, tc.stack.EventStore, tc.stack.ProjectionStore)
	require.NoError(tc.t, err)
	tc.runeIDs = append(tc.runeIDs, evtB.ID)
}

func (tc *integrationTestContext) store_cycle_detection_entry(sourceID, targetID string) {
	tc.t.Helper()
	cycleKey := "cycle:" + sourceID + ":" + targetID
	err := tc.stack.ProjectionStore.Put(tc.ctx, tc.realmID, "dependency_graph", cycleKey, true)
	require.NoError(tc.t, err)
}

// seed_handler_dep_lookup seeds the dep lookup key that the DependencyGraphProjector
// would normally create, so the handler can find it without replaying all events.
func (tc *integrationTestContext) seed_handler_dep_lookup(sourceID, targetID, relationship string) {
	tc.t.Helper()
	depKey := "dep:" + sourceID + ":" + targetID + ":" + relationship
	err := tc.stack.ProjectionStore.Put(tc.ctx, tc.realmID, "dependency_graph", depKey, true)
	require.NoError(tc.t, err)
}

// --- When ---

func (tc *integrationTestContext) create_top_level_rune(title, description string, priority int) {
	tc.t.Helper()
	branch := "test-branch"
	tc.createdEvent, tc.err = domain.HandleCreateRune(tc.ctx, tc.realmID, domain.CreateRune{
		Title: title, Description: description, Priority: priority, Branch: &branch,
	}, tc.stack.EventStore, tc.stack.ProjectionStore)
	if tc.err == nil {
		tc.parentID = tc.createdEvent.ID
	}
}

func (tc *integrationTestContext) create_child_rune(title, description string, priority int) {
	tc.t.Helper()
	tc.createdEvent, tc.err = domain.HandleCreateRune(tc.ctx, tc.realmID, domain.CreateRune{
		Title: title, Description: description, Priority: priority, ParentID: tc.parentID,
	}, tc.stack.EventStore, tc.stack.ProjectionStore)
}

func (tc *integrationTestContext) update_rune(title, description *string, priority *int) {
	tc.t.Helper()
	tc.err = domain.HandleUpdateRune(tc.ctx, tc.realmID, domain.UpdateRune{
		ID: tc.createdEvent.ID, Title: title, Description: description, Priority: priority,
	}, tc.stack.EventStore)
}

func (tc *integrationTestContext) claim_rune(claimant string) {
	tc.t.Helper()
	tc.err = domain.HandleClaimRune(tc.ctx, tc.realmID, domain.ClaimRune{
		ID: tc.createdEvent.ID, Claimant: claimant,
	}, tc.stack.EventStore)
}

func (tc *integrationTestContext) claim_specific_rune(runeID, claimant string) {
	tc.t.Helper()
	tc.err = domain.HandleClaimRune(tc.ctx, tc.realmID, domain.ClaimRune{
		ID: runeID, Claimant: claimant,
	}, tc.stack.EventStore)
}

func (tc *integrationTestContext) fulfill_rune() {
	tc.t.Helper()
	tc.err = domain.HandleFulfillRune(tc.ctx, tc.realmID, domain.FulfillRune{
		ID: tc.createdEvent.ID,
	}, tc.stack.EventStore)
}

func (tc *integrationTestContext) fulfill_specific_rune(runeID string) {
	tc.t.Helper()
	tc.err = domain.HandleFulfillRune(tc.ctx, tc.realmID, domain.FulfillRune{
		ID: runeID,
	}, tc.stack.EventStore)
}

func (tc *integrationTestContext) seal_rune(reason string) {
	tc.t.Helper()
	tc.err = domain.HandleSealRune(tc.ctx, tc.realmID, domain.SealRune{
		ID: tc.createdEvent.ID, Reason: reason,
	}, tc.stack.EventStore)
}

func (tc *integrationTestContext) add_dependency(sourceID, targetID, relationship string) {
	tc.t.Helper()
	tc.err = domain.HandleAddDependency(tc.ctx, tc.realmID, domain.AddDependency{
		RuneID: sourceID, TargetID: targetID, Relationship: relationship,
	}, tc.stack.EventStore, tc.stack.ProjectionStore)
}

func (tc *integrationTestContext) remove_dependency(sourceID, targetID, relationship string) {
	tc.t.Helper()
	tc.err = domain.HandleRemoveDependency(tc.ctx, tc.realmID, domain.RemoveDependency{
		RuneID: sourceID, TargetID: targetID, Relationship: relationship,
	}, tc.stack.EventStore, tc.stack.ProjectionStore)
}

func (tc *integrationTestContext) add_note(text string) {
	tc.t.Helper()
	tc.err = domain.HandleAddNote(tc.ctx, tc.realmID, domain.AddNote{
		RuneID: tc.createdEvent.ID, Text: text,
	}, tc.stack.EventStore)
}

func (tc *integrationTestContext) project_all_events() {
	tc.t.Helper()
	events, err := tc.stack.EventStore.ReadAll(tc.ctx, tc.realmID, int64(tc.lastProjectedPosition))
	require.NoError(tc.t, err)
	tc.stack.projectEvents(tc.t, events)
	if len(events) > 0 {
		tc.lastProjectedPosition = int(events[len(events)-1].GlobalPosition)
	}
}

// --- Then ---

func (tc *integrationTestContext) no_error() {
	tc.t.Helper()
	assert.NoError(tc.t, tc.err)
}

func (tc *integrationTestContext) error_contains(substring string) {
	tc.t.Helper()
	require.Error(tc.t, tc.err)
	assert.Contains(tc.t, tc.err.Error(), substring)
}

func (tc *integrationTestContext) created_event_id_matches_hex_pattern() {
	tc.t.Helper()
	assert.Regexp(tc.t, `^bf-[0-9a-f]{4}$`, tc.createdEvent.ID)
}

func (tc *integrationTestContext) created_event_has_title(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.createdEvent.Title)
}

func (tc *integrationTestContext) created_event_has_description(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.createdEvent.Description)
}

func (tc *integrationTestContext) created_event_has_priority(expected int) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.createdEvent.Priority)
}

func (tc *integrationTestContext) created_event_has_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.createdEvent.ID)
}

func (tc *integrationTestContext) created_event_has_parent_id(expected string) {
	tc.t.Helper()
	assert.Equal(tc.t, expected, tc.createdEvent.ParentID)
}

func (tc *integrationTestContext) stream_has_event_count(expected int) {
	tc.t.Helper()
	events, err := tc.stack.EventStore.ReadStream(tc.ctx, tc.realmID, "rune-"+tc.createdEvent.ID, 0)
	require.NoError(tc.t, err)
	assert.Len(tc.t, events, expected)
}

func (tc *integrationTestContext) stream_has_event_type(index int, eventType string) {
	tc.t.Helper()
	events, err := tc.stack.EventStore.ReadStream(tc.ctx, tc.realmID, "rune-"+tc.createdEvent.ID, 0)
	require.NoError(tc.t, err)
	require.Greater(tc.t, len(events), index, "stream has fewer events than expected index %d", index)
	assert.Equal(tc.t, eventType, events[index].EventType)
}

func (tc *integrationTestContext) rune_stream_has_event_type(runeID, eventType string) {
	tc.t.Helper()
	events, err := tc.stack.EventStore.ReadStream(tc.ctx, tc.realmID, "rune-"+runeID, 0)
	require.NoError(tc.t, err)
	found := false
	for _, evt := range events {
		if evt.EventType == eventType {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected event type %q in stream rune-%s", eventType, runeID)
}

func (tc *integrationTestContext) rune_is_sealed(runeID string) {
	tc.t.Helper()
	tc.rune_stream_has_event_type(runeID, domain.EventRuneSealed)
}

func (tc *integrationTestContext) rebuilt_state_has_title(expected string) {
	tc.t.Helper()
	state := tc.rebuild_state(tc.createdEvent.ID)
	assert.Equal(tc.t, expected, state.Title)
}

func (tc *integrationTestContext) rebuilt_state_has_priority(expected int) {
	tc.t.Helper()
	state := tc.rebuild_state(tc.createdEvent.ID)
	assert.Equal(tc.t, expected, state.Priority)
}

func (tc *integrationTestContext) rebuilt_state_has_status(expected string) {
	tc.t.Helper()
	state := tc.rebuild_state(tc.createdEvent.ID)
	assert.Equal(tc.t, expected, state.Status)
}

func (tc *integrationTestContext) rebuilt_state_has_claimant(expected string) {
	tc.t.Helper()
	state := tc.rebuild_state(tc.createdEvent.ID)
	assert.Equal(tc.t, expected, state.Claimant)
}

// --- Projector Assertions ---

func (tc *integrationTestContext) rune_list_has_entry(runeID string) {
	tc.t.Helper()
	var summary projectors.RuneSummary
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_list", runeID, &summary)
	require.NoError(tc.t, err, "expected rune_list entry for %s", runeID)
	assert.Equal(tc.t, runeID, summary.ID)
}

func (tc *integrationTestContext) rune_list_entry_has_title(runeID, expected string) {
	tc.t.Helper()
	var summary projectors.RuneSummary
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_list", runeID, &summary)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, summary.Title)
}

func (tc *integrationTestContext) rune_list_entry_has_status(runeID, expected string) {
	tc.t.Helper()
	var summary projectors.RuneSummary
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_list", runeID, &summary)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, summary.Status)
}

func (tc *integrationTestContext) rune_list_entry_has_priority(runeID string, expected int) {
	tc.t.Helper()
	var summary projectors.RuneSummary
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_list", runeID, &summary)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, summary.Priority)
}

func (tc *integrationTestContext) rune_list_entry_has_claimant(runeID, expected string) {
	tc.t.Helper()
	var summary projectors.RuneSummary
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_list", runeID, &summary)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, summary.Claimant)
}

func (tc *integrationTestContext) rune_detail_has_entry(runeID string) {
	tc.t.Helper()
	var detail projectors.RuneDetail
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_detail", runeID, &detail)
	require.NoError(tc.t, err, "expected rune_detail entry for %s", runeID)
	assert.Equal(tc.t, runeID, detail.ID)
}

func (tc *integrationTestContext) rune_detail_entry_has_title(runeID, expected string) {
	tc.t.Helper()
	var detail projectors.RuneDetail
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_detail", runeID, &detail)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, detail.Title)
}

func (tc *integrationTestContext) rune_detail_entry_has_description(runeID, expected string) {
	tc.t.Helper()
	var detail projectors.RuneDetail
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_detail", runeID, &detail)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, detail.Description)
}

func (tc *integrationTestContext) rune_detail_entry_has_status(runeID, expected string) {
	tc.t.Helper()
	var detail projectors.RuneDetail
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_detail", runeID, &detail)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, detail.Status)
}

func (tc *integrationTestContext) rune_detail_entry_has_priority(runeID string, expected int) {
	tc.t.Helper()
	var detail projectors.RuneDetail
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_detail", runeID, &detail)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, detail.Priority)
}

func (tc *integrationTestContext) rune_detail_entry_has_claimant(runeID, expected string) {
	tc.t.Helper()
	var detail projectors.RuneDetail
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_detail", runeID, &detail)
	require.NoError(tc.t, err)
	assert.Equal(tc.t, expected, detail.Claimant)
}

func (tc *integrationTestContext) rune_detail_entry_has_empty_dependencies(runeID string) {
	tc.t.Helper()
	var detail projectors.RuneDetail
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_detail", runeID, &detail)
	require.NoError(tc.t, err)
	assert.Empty(tc.t, detail.Dependencies)
}

func (tc *integrationTestContext) rune_detail_entry_has_empty_notes(runeID string) {
	tc.t.Helper()
	var detail projectors.RuneDetail
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_detail", runeID, &detail)
	require.NoError(tc.t, err)
	assert.Empty(tc.t, detail.Notes)
}

func (tc *integrationTestContext) rune_detail_entry_has_note_count(runeID string, expected int) {
	tc.t.Helper()
	var detail projectors.RuneDetail
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_detail", runeID, &detail)
	require.NoError(tc.t, err)
	assert.Len(tc.t, detail.Notes, expected)
}

func (tc *integrationTestContext) rune_detail_entry_has_note_text(runeID string, index int, expected string) {
	tc.t.Helper()
	var detail projectors.RuneDetail
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_detail", runeID, &detail)
	require.NoError(tc.t, err)
	require.Greater(tc.t, len(detail.Notes), index)
	assert.Equal(tc.t, expected, detail.Notes[index].Text)
}

func (tc *integrationTestContext) graph_source_has_dependency(sourceID, targetID, relationship string) {
	tc.t.Helper()
	var entry projectors.GraphEntry
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "dependency_graph", sourceID, &entry)
	require.NoError(tc.t, err)
	found := false
	for _, dep := range entry.Dependencies {
		if dep.TargetID == targetID && dep.Relationship == relationship {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected dependency {%s, %s} in source %s", targetID, relationship, sourceID)
}

func (tc *integrationTestContext) graph_target_has_dependent(targetID, sourceID, relationship string) {
	tc.t.Helper()
	var entry projectors.GraphEntry
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "dependency_graph", targetID, &entry)
	require.NoError(tc.t, err)
	found := false
	for _, dep := range entry.Dependents {
		if dep.SourceID == sourceID && dep.Relationship == relationship {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected dependent {%s, %s} in target %s", sourceID, relationship, targetID)
}

func (tc *integrationTestContext) graph_source_has_no_dependencies(sourceID string) {
	tc.t.Helper()
	var entry projectors.GraphEntry
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "dependency_graph", sourceID, &entry)
	require.NoError(tc.t, err)
	assert.Empty(tc.t, entry.Dependencies)
}

func (tc *integrationTestContext) graph_target_has_no_dependents(targetID string) {
	tc.t.Helper()
	var entry projectors.GraphEntry
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "dependency_graph", targetID, &entry)
	require.NoError(tc.t, err)
	assert.Empty(tc.t, entry.Dependents)
}

func (tc *integrationTestContext) graph_dep_lookup_exists(sourceID, targetID, relationship string) {
	tc.t.Helper()
	key := "dep:" + sourceID + ":" + targetID + ":" + relationship
	var exists bool
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "dependency_graph", key, &exists)
	assert.NoError(tc.t, err, "expected dep lookup key to exist")
	assert.True(tc.t, exists)
}

func (tc *integrationTestContext) graph_dep_lookup_does_not_exist(sourceID, targetID, relationship string) {
	tc.t.Helper()
	key := "dep:" + sourceID + ":" + targetID + ":" + relationship
	var exists bool
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "dependency_graph", key, &exists)
	if err == nil {
		assert.False(tc.t, exists, "expected dep lookup key to not exist")
	}
}

func (tc *integrationTestContext) rune_has_blockers(runeID string) {
	tc.t.Helper()
	var entry projectors.GraphEntry
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "dependency_graph", runeID, &entry)
	require.NoError(tc.t, err)
	found := false
	for _, dep := range entry.Dependents {
		if dep.Relationship == domain.RelBlocks {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected rune %s to have blockers", runeID)
}

func (tc *integrationTestContext) rune_has_no_blockers(runeID string) {
	tc.t.Helper()
	var entry projectors.GraphEntry
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "dependency_graph", runeID, &entry)
	if err != nil {
		return
	}
	for _, dep := range entry.Dependents {
		if dep.Relationship == domain.RelBlocks {
			tc.t.Errorf("expected rune %s to have no blockers, but found blocker from %s", runeID, dep.SourceID)
			return
		}
	}
}

func (tc *integrationTestContext) rune_detail_has_dependency(runeID, targetID, relationship string) {
	tc.t.Helper()
	var detail projectors.RuneDetail
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_detail", runeID, &detail)
	require.NoError(tc.t, err, "expected rune_detail entry for %s", runeID)
	found := false
	for _, dep := range detail.Dependencies {
		if dep.TargetID == targetID && dep.Relationship == relationship {
			found = true
			break
		}
	}
	assert.True(tc.t, found, "expected rune_detail for %s to have dependency {target_id: %s, relationship: %s}", runeID, targetID, relationship)
}

func (tc *integrationTestContext) rune_detail_has_no_dependencies(runeID string) {
	tc.t.Helper()
	var detail projectors.RuneDetail
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "rune_detail", runeID, &detail)
	require.NoError(tc.t, err, "expected rune_detail entry for %s", runeID)
	assert.Empty(tc.t, detail.Dependencies, "expected rune_detail for %s to have no dependencies", runeID)
}

func (tc *integrationTestContext) graph_has_no_inverse_relationships(runeID string) {
	tc.t.Helper()
	var entry projectors.GraphEntry
	err := tc.stack.ProjectionStore.Get(tc.ctx, tc.realmID, "dependency_graph", runeID, &entry)
	if err != nil {
		return
	}
	for _, dep := range entry.Dependencies {
		assert.False(tc.t, domain.IsInverseRelationship(dep.Relationship),
			"expected graph entry for %s to have no inverse dependency relationships, but found %s", runeID, dep.Relationship)
	}
	for _, dep := range entry.Dependents {
		assert.False(tc.t, domain.IsInverseRelationship(dep.Relationship),
			"expected graph entry for %s to have no inverse dependent relationships, but found %s", runeID, dep.Relationship)
	}
}

// --- Helpers ---

func (tc *integrationTestContext) rebuild_state(runeID string) domain.RuneState {
	tc.t.Helper()
	events, err := tc.stack.EventStore.ReadStream(tc.ctx, tc.realmID, "rune-"+runeID, 0)
	require.NoError(tc.t, err)
	return domain.RebuildRuneState(events)
}

func strPtr(s string) *string { return &s }
func intPtr(i int) *int       { return &i }
