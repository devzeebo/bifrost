package domain

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestEventTypeConstants(t *testing.T) {
	t.Run("all event type constants have correct values", func(t *testing.T) {
		tc := newTestContext(t)

		// Then
		tc.event_type_constants_are_correct()
	})
}

func TestRelationshipConstants(t *testing.T) {
	t.Run("all relationship constants have correct values", func(t *testing.T) {
		tc := newTestContext(t)

		// Then
		tc.relationship_constants_are_correct()
	})
}

func TestRuneCreated(t *testing.T) {
	t.Run("serializes and deserializes with all fields", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.rune_created_event()

		// When
		tc.marshal_and_unmarshal_rune_created()

		// Then
		tc.rune_created_fields_match()
		tc.rune_created_json_has_expected_keys()
	})

	t.Run("omits empty optional fields", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.rune_created_event_without_optional_fields()

		// When
		tc.marshal_rune_created()

		// Then
		tc.json_omits_key("description")
		tc.json_omits_key("parent_id")
	})
}

func TestRuneUpdated(t *testing.T) {
	t.Run("serializes with all pointer fields set", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.rune_updated_event_with_all_fields()

		// When
		tc.marshal_and_unmarshal_rune_updated()

		// Then
		tc.rune_updated_fields_match()
	})

	t.Run("omits nil pointer fields", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.rune_updated_event_with_only_id()

		// When
		tc.marshal_rune_updated()

		// Then
		tc.json_omits_key("title")
		tc.json_omits_key("description")
		tc.json_omits_key("priority")
	})
}

func TestRuneClaimed(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.rune_claimed_event()

		// When
		tc.marshal_and_unmarshal_rune_claimed()

		// Then
		tc.rune_claimed_fields_match()
	})
}

func TestRuneFulfilled(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.rune_fulfilled_event()

		// When
		tc.marshal_and_unmarshal_rune_fulfilled()

		// Then
		tc.rune_fulfilled_fields_match()
	})
}

func TestRuneSealed(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.rune_sealed_event()

		// When
		tc.marshal_and_unmarshal_rune_sealed()

		// Then
		tc.rune_sealed_fields_match()
	})

	t.Run("omits empty reason", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.rune_sealed_event_without_reason()

		// When
		tc.marshal_rune_sealed()

		// Then
		tc.json_omits_key("reason")
	})
}

func TestDependencyAdded(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.dependency_added_event()

		// When
		tc.marshal_and_unmarshal_dependency_added()

		// Then
		tc.dependency_added_fields_match()
	})
}

func TestDependencyRemoved(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.dependency_removed_event()

		// When
		tc.marshal_and_unmarshal_dependency_removed()

		// Then
		tc.dependency_removed_fields_match()
	})
}

func TestRuneNoted(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newTestContext(t)

		// Given
		tc.rune_noted_event()

		// When
		tc.marshal_and_unmarshal_rune_noted()

		// Then
		tc.rune_noted_fields_match()
	})
}

// --- Test Context ---

type testContext struct {
	t *testing.T

	runeCreated      RuneCreated
	runeUpdated      RuneUpdated
	runeClaimed      RuneClaimed
	runeFulfilled    RuneFulfilled
	runeSealed       RuneSealed
	dependencyAdded  DependencyAdded
	dependencyRemoved DependencyRemoved
	runeNoted        RuneNoted

	jsonBytes        []byte
	jsonMap          map[string]any

	roundTrippedCreated   RuneCreated
	roundTrippedUpdated   RuneUpdated
	roundTrippedClaimed   RuneClaimed
	roundTrippedFulfilled RuneFulfilled
	roundTrippedSealed    RuneSealed
	roundTrippedDepAdded  DependencyAdded
	roundTrippedDepRemoved DependencyRemoved
	roundTrippedNoted     RuneNoted
}

func newTestContext(t *testing.T) *testContext {
	t.Helper()
	return &testContext{t: t}
}

// --- Given ---

func (tc *testContext) rune_created_event() {
	tc.t.Helper()
	tc.runeCreated = RuneCreated{
		ID:          "rune-1",
		Title:       "Fix the bridge",
		Description: "The rainbow bridge needs repair",
		Priority:    1,
		ParentID:    "epic-1",
	}
}

func (tc *testContext) rune_created_event_without_optional_fields() {
	tc.t.Helper()
	tc.runeCreated = RuneCreated{
		ID:       "rune-1",
		Title:    "Fix the bridge",
		Priority: 1,
	}
}

func (tc *testContext) rune_updated_event_with_all_fields() {
	tc.t.Helper()
	title := "Updated title"
	desc := "Updated description"
	prio := 2
	tc.runeUpdated = RuneUpdated{
		ID:          "rune-1",
		Title:       &title,
		Description: &desc,
		Priority:    &prio,
	}
}

func (tc *testContext) rune_updated_event_with_only_id() {
	tc.t.Helper()
	tc.runeUpdated = RuneUpdated{
		ID: "rune-1",
	}
}

func (tc *testContext) rune_claimed_event() {
	tc.t.Helper()
	tc.runeClaimed = RuneClaimed{
		ID:       "rune-1",
		Claimant: "odin",
	}
}

func (tc *testContext) rune_fulfilled_event() {
	tc.t.Helper()
	tc.runeFulfilled = RuneFulfilled{
		ID: "rune-1",
	}
}

func (tc *testContext) rune_sealed_event() {
	tc.t.Helper()
	tc.runeSealed = RuneSealed{
		ID:     "rune-1",
		Reason: "completed",
	}
}

func (tc *testContext) rune_sealed_event_without_reason() {
	tc.t.Helper()
	tc.runeSealed = RuneSealed{
		ID: "rune-1",
	}
}

func (tc *testContext) dependency_added_event() {
	tc.t.Helper()
	tc.dependencyAdded = DependencyAdded{
		RuneID:       "rune-1",
		TargetID:     "rune-2",
		Relationship: RelBlocks,
	}
}

func (tc *testContext) dependency_removed_event() {
	tc.t.Helper()
	tc.dependencyRemoved = DependencyRemoved{
		RuneID:       "rune-1",
		TargetID:     "rune-2",
		Relationship: RelBlocks,
	}
}

func (tc *testContext) rune_noted_event() {
	tc.t.Helper()
	tc.runeNoted = RuneNoted{
		RuneID: "rune-1",
		Text:   "This is a note",
	}
}

// --- When ---

func (tc *testContext) marshal_rune_created() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.runeCreated)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
}

func (tc *testContext) marshal_and_unmarshal_rune_created() {
	tc.t.Helper()
	tc.marshal_rune_created()
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedCreated))
}

func (tc *testContext) marshal_rune_updated() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.runeUpdated)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
}

func (tc *testContext) marshal_and_unmarshal_rune_updated() {
	tc.t.Helper()
	tc.marshal_rune_updated()
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedUpdated))
}

func (tc *testContext) marshal_and_unmarshal_rune_claimed() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.runeClaimed)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedClaimed))
}

func (tc *testContext) marshal_and_unmarshal_rune_fulfilled() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.runeFulfilled)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedFulfilled))
}

func (tc *testContext) marshal_rune_sealed() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.runeSealed)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
}

func (tc *testContext) marshal_and_unmarshal_rune_sealed() {
	tc.t.Helper()
	tc.marshal_rune_sealed()
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedSealed))
}

func (tc *testContext) marshal_and_unmarshal_dependency_added() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.dependencyAdded)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedDepAdded))
}

func (tc *testContext) marshal_and_unmarshal_dependency_removed() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.dependencyRemoved)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedDepRemoved))
}

func (tc *testContext) marshal_and_unmarshal_rune_noted() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.runeNoted)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedNoted))
}

// --- Then ---

func (tc *testContext) event_type_constants_are_correct() {
	tc.t.Helper()
	assert.Equal(tc.t, "RuneCreated", EventRuneCreated)
	assert.Equal(tc.t, "RuneUpdated", EventRuneUpdated)
	assert.Equal(tc.t, "RuneClaimed", EventRuneClaimed)
	assert.Equal(tc.t, "RuneFulfilled", EventRuneFulfilled)
	assert.Equal(tc.t, "RuneSealed", EventRuneSealed)
	assert.Equal(tc.t, "DependencyAdded", EventDependencyAdded)
	assert.Equal(tc.t, "DependencyRemoved", EventDependencyRemoved)
	assert.Equal(tc.t, "RuneNoted", EventRuneNoted)
}

func (tc *testContext) relationship_constants_are_correct() {
	tc.t.Helper()
	assert.Equal(tc.t, "blocks", RelBlocks)
	assert.Equal(tc.t, "relates_to", RelRelatesTo)
	assert.Equal(tc.t, "duplicates", RelDuplicates)
	assert.Equal(tc.t, "supersedes", RelSupersedes)
	assert.Equal(tc.t, "replies_to", RelRepliesTo)
}

func (tc *testContext) rune_created_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.runeCreated, tc.roundTrippedCreated)
}

func (tc *testContext) rune_created_json_has_expected_keys() {
	tc.t.Helper()
	assert.Contains(tc.t, tc.jsonMap, "id")
	assert.Contains(tc.t, tc.jsonMap, "title")
	assert.Contains(tc.t, tc.jsonMap, "priority")
}

func (tc *testContext) rune_updated_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.runeUpdated.ID, tc.roundTrippedUpdated.ID)
	require.NotNil(tc.t, tc.roundTrippedUpdated.Title)
	assert.Equal(tc.t, *tc.runeUpdated.Title, *tc.roundTrippedUpdated.Title)
	require.NotNil(tc.t, tc.roundTrippedUpdated.Description)
	assert.Equal(tc.t, *tc.runeUpdated.Description, *tc.roundTrippedUpdated.Description)
	require.NotNil(tc.t, tc.roundTrippedUpdated.Priority)
	assert.Equal(tc.t, *tc.runeUpdated.Priority, *tc.roundTrippedUpdated.Priority)
}

func (tc *testContext) rune_claimed_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.runeClaimed, tc.roundTrippedClaimed)
}

func (tc *testContext) rune_fulfilled_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.runeFulfilled, tc.roundTrippedFulfilled)
}

func (tc *testContext) rune_sealed_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.runeSealed, tc.roundTrippedSealed)
}

func (tc *testContext) dependency_added_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.dependencyAdded, tc.roundTrippedDepAdded)
}

func (tc *testContext) dependency_removed_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.dependencyRemoved, tc.roundTrippedDepRemoved)
}

func (tc *testContext) rune_noted_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.runeNoted, tc.roundTrippedNoted)
}

func (tc *testContext) json_omits_key(key string) {
	tc.t.Helper()
	_, exists := tc.jsonMap[key]
	assert.False(tc.t, exists, "expected JSON to omit key %q", key)
}
