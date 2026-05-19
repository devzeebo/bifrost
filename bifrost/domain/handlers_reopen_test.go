package domain

import (
	"testing"
)

func TestHandleReopenRune(t *testing.T) {
	t.Run("reopens failed rune to open status", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_failed_rune_in_stream("bf-a1b2", "odin")
		tc.a_reopen_rune_command("bf-a1b2", false)

		// When
		tc.handle_reopen_rune()

		// Then
		tc.no_error()
		tc.event_was_appended_to_stream("rune-bf-a1b2")
		tc.appended_event_has_type(EventRuneReopened)
	})

	t.Run("reopens failed rune to claimed status with as_claimed=true", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_failed_rune_in_stream("bf-a1b2", "odin")
		tc.a_reopen_rune_command("bf-a1b2", true)

		// When
		tc.handle_reopen_rune()

		// Then
		tc.no_error()
		tc.event_was_appended_to_stream("rune-bf-a1b2")
		tc.appended_event_has_type(EventRuneReopened)
	})

	t.Run("rejects non-failed rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_rune_in_stream("bf-a1b2", "open")
		tc.a_reopen_rune_command("bf-a1b2", false)

		// When
		tc.handle_reopen_rune()

		// Then
		tc.error_contains("can only reopen failed runes")
	})

	t.Run("rejects reopen as claimed when rune has no prior claimant", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.existing_failed_rune_in_stream("bf-a1b2", "")
		tc.a_reopen_rune_command("bf-a1b2", true)

		// When
		tc.handle_reopen_rune()

		// Then
		tc.error_contains("cannot reopen as claimed")
	})

	t.Run("rejects not found rune", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.a_realm("realm-1")
		tc.an_event_store()
		tc.empty_stream("bf-missing")
		tc.a_reopen_rune_command("bf-missing", false)

		// When
		tc.handle_reopen_rune()

		// Then
		tc.error_is_not_found("rune", "bf-missing")
	})
}

func TestRebuildRuneState_RuneReopened(t *testing.T) {
	t.Run("applies RuneReopened with claimant", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.events_from_created_and_claimed_rune()
		events := append(tc.events, makeEvent(EventRuneFailed, RuneFailed{
			ID: "bf-a1b2", Reason: "failed",
		}))
		events = append(events, makeEvent(EventRuneReopened, RuneReopened{
			ID: "bf-a1b2", Claimant: "odin",
		}))
		tc.events = events

		// When
		tc.state_is_rebuilt()

		// Then
		tc.state_has_status("claimed")
		tc.state_has_claimant("odin")
	})

	t.Run("applies RuneReopened without claimant", func(t *testing.T) {
		tc := newHandlerTestContext(t)

		// Given
		tc.events_from_created_and_claimed_rune()
		events := append(tc.events, makeEvent(EventRuneFailed, RuneFailed{
			ID: "bf-a1b2", Reason: "failed",
		}))
		events = append(events, makeEvent(EventRuneReopened, RuneReopened{
			ID: "bf-a1b2",
		}))
		tc.events = events

		// When
		tc.state_is_rebuilt()

		// Then
		tc.state_has_status("open")
	})
}
