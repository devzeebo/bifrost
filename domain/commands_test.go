package domain

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// --- Tests ---

func TestCreateRuneCommand(t *testing.T) {
	t.Run("serializes and deserializes with all fields", func(t *testing.T) {
		tc := newCmdTestContext(t)

		// Given
		tc.create_rune_command()

		// When
		tc.marshal_and_unmarshal_create_rune()

		// Then
		tc.create_rune_fields_match()
		tc.cmd_json_has_key("title")
		tc.cmd_json_has_key("priority")
	})

	t.Run("omits empty optional fields", func(t *testing.T) {
		tc := newCmdTestContext(t)

		// Given
		tc.create_rune_command_without_optional_fields()

		// When
		tc.marshal_create_rune()

		// Then
		tc.cmd_json_omits_key("description")
		tc.cmd_json_omits_key("parent_id")
		tc.cmd_json_omits_key("branch")
	})
}

func TestUpdateRuneCommand(t *testing.T) {
	t.Run("serializes with all pointer fields set", func(t *testing.T) {
		tc := newCmdTestContext(t)

		// Given
		tc.update_rune_command_with_all_fields()

		// When
		tc.marshal_and_unmarshal_update_rune()

		// Then
		tc.update_rune_fields_match()
	})

	t.Run("omits nil pointer fields", func(t *testing.T) {
		tc := newCmdTestContext(t)

		// Given
		tc.update_rune_command_with_only_id()

		// When
		tc.marshal_update_rune()

		// Then
		tc.cmd_json_omits_key("title")
		tc.cmd_json_omits_key("description")
		tc.cmd_json_omits_key("priority")
		tc.cmd_json_omits_key("branch")
	})
}

func TestClaimRuneCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newCmdTestContext(t)

		// Given
		tc.claim_rune_command()

		// When
		tc.marshal_and_unmarshal_claim_rune()

		// Then
		tc.claim_rune_fields_match()
	})
}

func TestFulfillRuneCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newCmdTestContext(t)

		// Given
		tc.fulfill_rune_command()

		// When
		tc.marshal_and_unmarshal_fulfill_rune()

		// Then
		tc.fulfill_rune_fields_match()
	})
}

func TestSealRuneCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newCmdTestContext(t)

		// Given
		tc.seal_rune_command()

		// When
		tc.marshal_and_unmarshal_seal_rune()

		// Then
		tc.seal_rune_fields_match()
	})

	t.Run("omits empty reason", func(t *testing.T) {
		tc := newCmdTestContext(t)

		// Given
		tc.seal_rune_command_without_reason()

		// When
		tc.marshal_seal_rune()

		// Then
		tc.cmd_json_omits_key("reason")
	})
}

func TestAddDependencyCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newCmdTestContext(t)

		// Given
		tc.add_dependency_command()

		// When
		tc.marshal_and_unmarshal_add_dependency()

		// Then
		tc.add_dependency_fields_match()
	})
}

func TestRemoveDependencyCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newCmdTestContext(t)

		// Given
		tc.remove_dependency_command()

		// When
		tc.marshal_and_unmarshal_remove_dependency()

		// Then
		tc.remove_dependency_fields_match()
	})
}

func TestUnclaimRuneCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newCmdTestContext(t)

		// Given
		tc.unclaim_rune_command()

		// When
		tc.marshal_and_unmarshal_unclaim_rune()

		// Then
		tc.unclaim_rune_fields_match()
	})
}

func TestAddNoteCommand(t *testing.T) {
	t.Run("serializes and deserializes correctly", func(t *testing.T) {
		tc := newCmdTestContext(t)

		// Given
		tc.add_note_command()

		// When
		tc.marshal_and_unmarshal_add_note()

		// Then
		tc.add_note_fields_match()
	})
}

// --- Test Context ---

type cmdTestContext struct {
	t *testing.T

	createRune      CreateRune
	updateRune      UpdateRune
	claimRune       ClaimRune
	fulfillRune     FulfillRune
	sealRune        SealRune
	addDependency   AddDependency
	removeDependency RemoveDependency
	addNote         AddNote
	unclaimRune     UnclaimRune

	jsonBytes []byte
	jsonMap   map[string]any

	roundTrippedCreateRune      CreateRune
	roundTrippedUpdateRune      UpdateRune
	roundTrippedClaimRune       ClaimRune
	roundTrippedFulfillRune     FulfillRune
	roundTrippedSealRune        SealRune
	roundTrippedAddDependency   AddDependency
	roundTrippedRemoveDependency RemoveDependency
	roundTrippedAddNote         AddNote
	roundTrippedUnclaimRune     UnclaimRune
}

func newCmdTestContext(t *testing.T) *cmdTestContext {
	t.Helper()
	return &cmdTestContext{t: t}
}

// --- Given ---

func (tc *cmdTestContext) create_rune_command() {
	tc.t.Helper()
	branch := "feature/fix-bridge"
	tc.createRune = CreateRune{
		Title:       "Fix the bridge",
		Description: "The rainbow bridge needs repair",
		Priority:    1,
		ParentID:    "epic-1",
		Branch:      &branch,
	}
}

func (tc *cmdTestContext) create_rune_command_without_optional_fields() {
	tc.t.Helper()
	tc.createRune = CreateRune{
		Title:    "Fix the bridge",
		Priority: 1,
	}
}

func (tc *cmdTestContext) update_rune_command_with_all_fields() {
	tc.t.Helper()
	title := "Updated title"
	desc := "Updated description"
	prio := 2
	branch := "feature/updated"
	tc.updateRune = UpdateRune{
		ID:          "rune-1",
		Title:       &title,
		Description: &desc,
		Priority:    &prio,
		Branch:      &branch,
	}
}

func (tc *cmdTestContext) update_rune_command_with_only_id() {
	tc.t.Helper()
	tc.updateRune = UpdateRune{
		ID: "rune-1",
	}
}

func (tc *cmdTestContext) claim_rune_command() {
	tc.t.Helper()
	tc.claimRune = ClaimRune{
		ID:       "rune-1",
		Claimant: "odin",
	}
}

func (tc *cmdTestContext) fulfill_rune_command() {
	tc.t.Helper()
	tc.fulfillRune = FulfillRune{
		ID: "rune-1",
	}
}

func (tc *cmdTestContext) seal_rune_command() {
	tc.t.Helper()
	tc.sealRune = SealRune{
		ID:     "rune-1",
		Reason: "completed",
	}
}

func (tc *cmdTestContext) seal_rune_command_without_reason() {
	tc.t.Helper()
	tc.sealRune = SealRune{
		ID: "rune-1",
	}
}

func (tc *cmdTestContext) add_dependency_command() {
	tc.t.Helper()
	tc.addDependency = AddDependency{
		RuneID:       "rune-1",
		TargetID:     "rune-2",
		Relationship: RelBlocks,
	}
}

func (tc *cmdTestContext) remove_dependency_command() {
	tc.t.Helper()
	tc.removeDependency = RemoveDependency{
		RuneID:       "rune-1",
		TargetID:     "rune-2",
		Relationship: RelBlocks,
	}
}

func (tc *cmdTestContext) unclaim_rune_command() {
	tc.t.Helper()
	tc.unclaimRune = UnclaimRune{
		ID: "rune-1",
	}
}

func (tc *cmdTestContext) add_note_command() {
	tc.t.Helper()
	tc.addNote = AddNote{
		RuneID: "rune-1",
		Text:   "This is a note",
	}
}

// --- When ---

func (tc *cmdTestContext) marshal_create_rune() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.createRune)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
}

func (tc *cmdTestContext) marshal_and_unmarshal_create_rune() {
	tc.t.Helper()
	tc.marshal_create_rune()
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedCreateRune))
}

func (tc *cmdTestContext) marshal_update_rune() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.updateRune)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
}

func (tc *cmdTestContext) marshal_and_unmarshal_update_rune() {
	tc.t.Helper()
	tc.marshal_update_rune()
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedUpdateRune))
}

func (tc *cmdTestContext) marshal_and_unmarshal_claim_rune() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.claimRune)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedClaimRune))
}

func (tc *cmdTestContext) marshal_and_unmarshal_fulfill_rune() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.fulfillRune)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedFulfillRune))
}

func (tc *cmdTestContext) marshal_seal_rune() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.sealRune)
	require.NoError(tc.t, err)
	tc.jsonMap = make(map[string]any)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.jsonMap))
}

func (tc *cmdTestContext) marshal_and_unmarshal_seal_rune() {
	tc.t.Helper()
	tc.marshal_seal_rune()
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedSealRune))
}

func (tc *cmdTestContext) marshal_and_unmarshal_add_dependency() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.addDependency)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedAddDependency))
}

func (tc *cmdTestContext) marshal_and_unmarshal_remove_dependency() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.removeDependency)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedRemoveDependency))
}

func (tc *cmdTestContext) marshal_and_unmarshal_unclaim_rune() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.unclaimRune)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedUnclaimRune))
}

func (tc *cmdTestContext) marshal_and_unmarshal_add_note() {
	tc.t.Helper()
	var err error
	tc.jsonBytes, err = json.Marshal(tc.addNote)
	require.NoError(tc.t, err)
	require.NoError(tc.t, json.Unmarshal(tc.jsonBytes, &tc.roundTrippedAddNote))
}

// --- Then ---

func (tc *cmdTestContext) create_rune_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.createRune, tc.roundTrippedCreateRune)
}

func (tc *cmdTestContext) update_rune_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.updateRune.ID, tc.roundTrippedUpdateRune.ID)
	require.NotNil(tc.t, tc.roundTrippedUpdateRune.Title)
	assert.Equal(tc.t, *tc.updateRune.Title, *tc.roundTrippedUpdateRune.Title)
	require.NotNil(tc.t, tc.roundTrippedUpdateRune.Description)
	assert.Equal(tc.t, *tc.updateRune.Description, *tc.roundTrippedUpdateRune.Description)
	require.NotNil(tc.t, tc.roundTrippedUpdateRune.Priority)
	assert.Equal(tc.t, *tc.updateRune.Priority, *tc.roundTrippedUpdateRune.Priority)
	require.NotNil(tc.t, tc.roundTrippedUpdateRune.Branch)
	assert.Equal(tc.t, *tc.updateRune.Branch, *tc.roundTrippedUpdateRune.Branch)
}

func (tc *cmdTestContext) claim_rune_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.claimRune, tc.roundTrippedClaimRune)
}

func (tc *cmdTestContext) fulfill_rune_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.fulfillRune, tc.roundTrippedFulfillRune)
}

func (tc *cmdTestContext) seal_rune_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.sealRune, tc.roundTrippedSealRune)
}

func (tc *cmdTestContext) add_dependency_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.addDependency, tc.roundTrippedAddDependency)
}

func (tc *cmdTestContext) remove_dependency_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.removeDependency, tc.roundTrippedRemoveDependency)
}

func (tc *cmdTestContext) unclaim_rune_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.unclaimRune, tc.roundTrippedUnclaimRune)
}

func (tc *cmdTestContext) add_note_fields_match() {
	tc.t.Helper()
	assert.Equal(tc.t, tc.addNote, tc.roundTrippedAddNote)
}

func (tc *cmdTestContext) cmd_json_has_key(key string) {
	tc.t.Helper()
	_, exists := tc.jsonMap[key]
	assert.True(tc.t, exists, "expected JSON to contain key %q", key)
}

func (tc *cmdTestContext) cmd_json_omits_key(key string) {
	tc.t.Helper()
	_, exists := tc.jsonMap[key]
	assert.False(tc.t, exists, "expected JSON to omit key %q", key)
}
