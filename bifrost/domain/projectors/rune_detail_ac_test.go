package projectors

import (
	"testing"
	"time"

	"github.com/devzeebo/bifrost/domain"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestRuneDetailProjector_AcceptanceCriteria(t *testing.T) {
	t.Run("US1-AC01: handles RuneCreated with empty acceptance_criteria slice", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_store()
		tc.a_rune_created_event("bf-a1b2", "Fix the bridge", "Needs repair", 1, "")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_empty_acceptance_criteria()
	})

	t.Run("US1-AC01: handles RuneACAdded by appending an AC entry", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_store()
		tc.existing_detail("bf-a1b2", "Fix the bridge", "", "open", 1, "", "")
		tc.a_rune_ac_added_event("bf-a1b2", "AC-01", "happy path", "User logs in successfully")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_ac_count(1)
		tc.stored_detail_has_ac_entry(0, "AC-01", "happy path", "User logs in successfully")
	})

	t.Run("US2-AC01: handles RuneACAdded appends to existing ACs", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_store()
		tc.existing_detail_with_ac("bf-a1b2", "AC-01", "first scenario", "first desc")
		tc.a_rune_ac_added_event("bf-a1b2", "AC-02", "second scenario", "second desc")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_ac_count(2)
		tc.stored_detail_has_ac_entry(0, "AC-01", "first scenario", "first desc")
		tc.stored_detail_has_ac_entry(1, "AC-02", "second scenario", "second desc")
	})

	t.Run("US3-AC01: handles RuneACUpdated by replacing scenario and description", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_store()
		tc.existing_detail_with_ac("bf-a1b2", "AC-01", "old scenario", "old desc")
		tc.a_rune_ac_updated_event("bf-a1b2", "AC-01", "new scenario", "new desc")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_ac_count(1)
		tc.stored_detail_has_ac_entry(0, "AC-01", "new scenario", "new desc")
	})

	t.Run("US4-AC01: handles RuneACRemoved by removing the AC entry", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_store()
		tc.existing_detail_with_ac("bf-a1b2", "AC-01", "happy path", "desc")
		tc.a_rune_ac_removed_event("bf-a1b2", "AC-01")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_ac_count(0)
	})

	t.Run("US4-AC03: handles RuneACRemoved keeps remaining ACs with their original IDs", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_store()
		tc.existing_detail_with_multiple_acs("bf-a1b2",
			ACEntry{ID: "AC-01", Scenario: "first", Description: "first desc"},
			ACEntry{ID: "AC-02", Scenario: "second", Description: "second desc"},
			ACEntry{ID: "AC-03", Scenario: "third", Description: "third desc"},
		)
		tc.a_rune_ac_removed_event("bf-a1b2", "AC-02")

		// When
		tc.handle_is_called()

		// Then
		tc.no_error()
		tc.stored_detail_has_ac_count(2)
		tc.stored_detail_ac_has_id(0, "AC-01")
		tc.stored_detail_ac_has_id(1, "AC-03")
	})

	t.Run("US5-AC03: RuneACAdded is idempotent — duplicate events skip re-append", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_store()
		ts := time.Date(2026, 1, 15, 10, 0, 0, 0, time.UTC)
		tc.existing_detail_with_ac("bf-a1b2", "AC-01", "happy path", "desc")
		tc.a_rune_ac_added_event_with_timestamp("bf-a1b2", "AC-01", "happy path", "desc", ts)

		// When
		tc.handle_is_called()

		// Then — idempotent: still only 1 AC
		tc.no_error()
		tc.stored_detail_has_ac_count(1)
	})

	t.Run("US5-AC02: JSON response includes acceptance_criteria array field", func(t *testing.T) {
		tc := newRuneDetailTestContext(t)

		// Given
		tc.a_rune_detail_projector()
		tc.a_store()
		tc.existing_detail_with_ac("bf-a1b2", "AC-01", "happy path", "User logs in successfully")

		// When — detail is loaded
		tc.load_detail_for_assertions("bf-a1b2")

		// Then
		tc.stored_detail_has_ac_count(1)
		tc.stored_detail_has_ac_id_field(0, "AC-01")
		tc.stored_detail_has_ac_scenario_field(0, "happy path")
		tc.stored_detail_has_ac_description_field(0, "User logs in successfully")
	})
}

// ---------------------------------------------------------------------------
// Additional Given helpers (extend existing test context)
// ---------------------------------------------------------------------------

func (tc *runeDetailTestContext) a_rune_ac_added_event(runeID, acID, scenario, desc string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneACAdded, domain.RuneACAdded{
		RuneID: runeID, ID: acID, Scenario: scenario, Description: desc,
	})
}

func (tc *runeDetailTestContext) a_rune_ac_added_event_with_timestamp(runeID, acID, scenario, desc string, ts time.Time) {
	tc.t.Helper()
	tc.event = makeEventWithTimestamp(domain.EventRuneACAdded, domain.RuneACAdded{
		RuneID: runeID, ID: acID, Scenario: scenario, Description: desc,
	}, ts)
}

func (tc *runeDetailTestContext) a_rune_ac_updated_event(runeID, acID, scenario, desc string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneACUpdated, domain.RuneACUpdated{
		RuneID: runeID, ID: acID, Scenario: scenario, Description: desc,
	})
}

func (tc *runeDetailTestContext) a_rune_ac_removed_event(runeID, acID string) {
	tc.t.Helper()
	tc.event = makeEvent(domain.EventRuneACRemoved, domain.RuneACRemoved{
		RuneID: runeID, ID: acID,
	})
}

func (tc *runeDetailTestContext) existing_detail_with_ac(id, acID, scenario, desc string) {
	tc.t.Helper()
	tc.a_store()
	detail := RuneDetail{
		ID:     id,
		Title:  "Existing rune",
		Status: "open",
		Priority: 1,
		Dependencies: []DependencyRef{},
		Notes:        []NoteEntry{},
		AcceptanceCriteria: []ACEntry{
			{ID: acID, Scenario: scenario, Description: desc},
		},
	}
	tc.store.put(tc.realmID, "rune_detail", id, detail)
}

func (tc *runeDetailTestContext) existing_detail_with_multiple_acs(id string, acs ...ACEntry) {
	tc.t.Helper()
	tc.a_store()
	detail := RuneDetail{
		ID:                 id,
		Title:              "Existing rune",
		Status:             "open",
		Priority:           1,
		Dependencies:       []DependencyRef{},
		Notes:              []NoteEntry{},
		AcceptanceCriteria: acs,
	}
	tc.store.put(tc.realmID, "rune_detail", id, detail)
}

func (tc *runeDetailTestContext) load_detail_for_assertions(id string) {
	tc.t.Helper()
	if tc.store == nil {
		return
	}
	var detail RuneDetail
	err := tc.store.Get(tc.ctx, tc.realmID, "rune_detail", id, &detail)
	require.NoError(tc.t, err, "expected detail to exist for %s", id)
	tc.storedDetail = &detail
}

// ---------------------------------------------------------------------------
// Then helpers for AC assertions
// ---------------------------------------------------------------------------

func (tc *runeDetailTestContext) stored_detail_has_empty_acceptance_criteria() {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	assert.Empty(tc.t, tc.storedDetail.AcceptanceCriteria)
}

func (tc *runeDetailTestContext) stored_detail_has_ac_count(expected int) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	assert.Len(tc.t, tc.storedDetail.AcceptanceCriteria, expected)
}

func (tc *runeDetailTestContext) stored_detail_has_ac_entry(index int, acID, scenario, desc string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	require.Greater(tc.t, len(tc.storedDetail.AcceptanceCriteria), index,
		"expected at least %d AC entries, got %d", index+1, len(tc.storedDetail.AcceptanceCriteria))
	entry := tc.storedDetail.AcceptanceCriteria[index]
	assert.Equal(tc.t, acID, entry.ID, "AC[%d].ID", index)
	assert.Equal(tc.t, scenario, entry.Scenario, "AC[%d].Scenario", index)
	assert.Equal(tc.t, desc, entry.Description, "AC[%d].Description", index)
}

func (tc *runeDetailTestContext) stored_detail_ac_has_id(index int, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	require.Greater(tc.t, len(tc.storedDetail.AcceptanceCriteria), index)
	assert.Equal(tc.t, expected, tc.storedDetail.AcceptanceCriteria[index].ID)
}

func (tc *runeDetailTestContext) stored_detail_has_ac_id_field(index int, expected string) {
	tc.t.Helper()
	tc.stored_detail_ac_has_id(index, expected)
}

func (tc *runeDetailTestContext) stored_detail_has_ac_scenario_field(index int, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	require.Greater(tc.t, len(tc.storedDetail.AcceptanceCriteria), index)
	assert.Equal(tc.t, expected, tc.storedDetail.AcceptanceCriteria[index].Scenario)
}

func (tc *runeDetailTestContext) stored_detail_has_ac_description_field(index int, expected string) {
	tc.t.Helper()
	require.NotNil(tc.t, tc.storedDetail)
	require.Greater(tc.t, len(tc.storedDetail.AcceptanceCriteria), index)
	assert.Equal(tc.t, expected, tc.storedDetail.AcceptanceCriteria[index].Description)
}
