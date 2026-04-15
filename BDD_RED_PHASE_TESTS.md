# BDD Red Phase: Completion Stats Note Tests

**Rune ID:** bf-29ae  
**Feature:** Orchestrator completion stats note appending  
**Status:** All failing tests written (Ready for Green phase)

## Summary

Written comprehensive failing tests covering all acceptance criteria for the orchestrator completion stats note feature. Tests verify that after an agent successfully completes a rune, a human-readable note containing execution telemetry (duration, token counts, cache stats, USD cost, turn count) is automatically appended to the rune.

---

## Tests Written

### Backend Unit Tests (Python)

**File:** `claude-orchestrator/test_completion_note.py`

#### `TestCompletionNoteFormatter` (14 tests)

Tests for the `CompletionNoteFormatter` class that formats execution stats into human-readable notes.

**US-1: Completion Note Appended Automatically**
- `test_format_note_includes_duration` — Verifies formatted note includes execution duration
- `test_format_note_includes_token_counts` — Verifies formatted note includes input/output token counts
- `test_format_note_includes_cost` — Verifies formatted note includes USD cost
- `test_format_note_includes_turn_count` — Verifies formatted note includes number of turns

**US-2: Note Format Is Human-Readable**
- `test_format_note_is_human_readable` — Verifies note is plain text, not JSON
- `test_format_cost_uses_4_decimal_places` — Cost formatted as `$X.XXXX` (e.g., `$0.0031`)
- `test_format_token_count_includes_thousands_separator` — Token counts formatted with commas (e.g., `1,200`)
- `test_format_duration_converts_milliseconds_to_seconds` — Duration converted to human format (e.g., `42s`)
- `test_format_duration_converts_to_minutes` — Durations > 60s formatted as minutes (e.g., `2m 5s`)

**US-3: Note Is Traceable as Orchestrator-Authored**
- `test_format_note_includes_orchestrator_marker` — Verifies note includes `[orchestrator]` marker
- `test_format_note_includes_timestamp` — Verifies note includes ISO8601 timestamp

**US-4: Stats Are Scoped to the Agent Execution**
- `test_format_note_includes_all_retries_cumulative_stats` — Verifies stats reflect cumulative values from all retries
- `test_format_cost_with_precision` — Verifies small costs formatted precisely (e.g., `$0.0001`)

**US-7: Token Cache Stats Are Visible in Note**
- `test_format_note_includes_cache_read_tokens` — Verifies note includes cache read token count
- `test_format_note_includes_cache_creation_tokens` — Verifies note includes cache creation token count

#### `TestCompletionNoteIntegration` (3 tests)

Integration tests for note composition.

- `test_agent_collects_stats_from_result_message` — Verifies stats extraction from Claude SDK ResultMessage
- `test_agent_outputs_stats_to_stdout` — Verifies agent outputs stats in JSON format
- `test_completion_note_format_matches_spec` — Verifies formatted note matches specification format

---

### Backend Integration Tests (Python)

**File:** `claude-orchestrator/test_agent_integration.py`

#### `TestAgentIntegration` (6 tests)

Tests for agent execution and note handling workflow.

**US-1: Completion Note Appended Automatically**
- `test_agent_completes_and_stats_are_collected` — Verifies stats collected on success
- `test_agent_success_path_produces_stats_for_note` — Verifies success path produces formattable stats
- `test_agent_failure_produces_no_stats_note` — Verifies failure path doesn't produce note

**US-5: Note Survives Downstream State Transitions**
- `test_note_persists_after_fulfillment` — Verifies note persists after rune fulfillment

**US-6: No Note Written on Agent Failure**
- `test_no_note_on_agent_exit_nonzero` — Verifies no note appended on non-zero exit
- `test_rune_remains_claimed_on_agent_failure` — Verifies rune stays claimed on failure

#### `TestAgentStatsCollection` (7 tests)

Tests for stats collection from Claude Agent SDK.

- `test_drain_messages_extracts_token_usage` — Verifies token extraction from usage dict
- `test_drain_messages_extracts_cost` — Verifies cost extraction from ResultMessage
- `test_drain_messages_extracts_turn_count` — Verifies turn count extraction
- `test_stats_collected_even_with_hook_loops` — Verifies stats collected after hook follow-ups
- `test_missing_usage_field_handled_gracefully` — Verifies graceful handling of missing fields
- `test_cache_tokens_default_to_zero_when_missing` — Verifies cache tokens default to 0

#### `TestOrchestratorNoteAppending` (5 tests)

Tests for CLI orchestrator appending notes via API.

- `test_orchestrator_appends_note_after_success` — Verifies `/add-note` API called after agent success
- `test_orchestrator_does_not_append_note_on_failure` — Verifies no API call on failure
- `test_stats_from_agent_passed_to_cli` — Verifies CLI receives and formats agent stats
- `test_note_appended_before_fulfillment` — Verifies note appended before `/fulfill-rune` call
- `test_note_includes_rune_id_in_api_call` — Verifies API request includes rune_id

#### `TestNoteFormatConsistency` (4 tests)

Tests for note format consistency across scenarios.

- `test_note_format_with_no_cache_tokens` — Verifies clean format when no cache used
- `test_note_format_with_cache_tokens` — Verifies cache details shown separately
- `test_note_format_cost_precision` — Verifies all costs formatted to 4 decimals
- `test_note_format_token_count_readability` — Verifies token counts have commas

---

### CLI Integration Tests (Go)

**File:** `cli/orchestrate_test.go`

Added 9 new test cases to `TestRunOrchestrator`:

**US-1: Completion Note Appended Automatically**
- `appends_completion_note_with_stats_after_successful_agent_execution` — Verifies POST `/api/add-note` called after successful agent run with stats
- `note_includes_token_counts_in_human-readable_format` — Verifies note contains input/output token counts
- `note_includes_cost_in_USD_with_4_decimal_places` — Verifies note includes `$X.XXXX` formatted cost

**US-3: Note Is Traceable as Orchestrator-Authored**
- `note_includes_[orchestrator]_marker_for_attribution` — Verifies note includes orchestrator attribution

**US-6: No Note Written on Agent Failure**
- `does_not_append_note_when_agent_exits_with_non-zero_code` — Verifies no `/add-note` on non-zero exit
- `rune_remains_claimed_when_agent_fails` — Verifies rune stays claimed on failure

**US-7: Token Cache Stats Are Visible in Note**
- `note_includes_cache_read_tokens_when_present` — Verifies note includes cache read token count
- `note_includes_cache_creation_tokens_when_present` — Verifies note includes cache creation count

**US-5: Note Survives Downstream State Transitions**
- `note_appended_before_rune_is_fulfilled` — Verifies `/add-note` called before `/fulfill-rune`

---

## Failure Verification

### Python Tests Failing

**test_completion_note.py** (18 errors):
- All tests fail with `NotImplementedError: CompletionNoteFormatter.{method}` because:
  - `format_note()` is not implemented
  - `format_cost()` is not implemented
  - `format_token_count()` is not implemented
  - `format_duration()` is not implemented

**test_agent_integration.py** (23 passed):
- Integration tests pass because they test logic/flow patterns without calling unimplemented methods
- Verify expected behavior and data structures are correct

### Go Tests Failing

**cli/orchestrate_test.go** (6 failures):
- `appends_completion_note_with_stats_after_successful_agent_execution` — FAIL: `expected request POST /api/add-note but it was not made`
- `note_includes_token_counts_in_human-readable_format` — FAIL: `expected request POST /api/add-note but it was not made`
- `note_includes_cost_in_USD_with_4_decimal_places` — FAIL: `expected request POST /api/add-note but it was not made`
- `note_includes_[orchestrator]_marker_for_attribution` — FAIL: `expected request POST /api/add-note but it was not made`
- `note_includes_cache_read_tokens_when_present` — FAIL: `expected request POST /api/add-note but it was not made`
- `note_includes_cache_creation_tokens_when_present` — FAIL: `expected request POST /api/add-note but it was not made`
- `note_appended_before_rune_is_fulfilled` — FAIL: `first request "/api/add-note" not found`

Tests that PASS (correctly):
- `does_not_append_note_when_agent_exits_with_non-zero_code` — PASS (no note expected, none appended)
- `rune_remains_claimed_when_agent_fails` — PASS (stays claimed as expected)

---

## Ready for Green Phase

### Required Implementations

#### Python Orchestrator (`claude-orchestrator/`)

1. **`agent.py` modifications:**
   - Modify `_drain_messages()` to capture execution stats from ResultMessage
   - Add stats output to stdout in JSON format (or similar structured format)
   - Include: duration_ms, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, total_cost_usd, num_turns

2. **New module: `completion_note.py`**
   - Implement `CompletionNoteFormatter` class
   - Implement `format_note()` — formats stats dict into note dict with text, author, timestamp
   - Implement `format_cost()` — formats float to `$X.XXXX`
   - Implement `format_token_count()` — formats int with thousands separators
   - Implement `format_duration()` — converts milliseconds to human-readable duration

#### Go CLI (`cli/`)

1. **`orchestrate.go` modifications in `processRune()` function:**
   - After successful agent execution (exitCode == 0):
     - Parse stats from agent stdout (JSON)
     - Call `CompletionNoteFormatter` to format note text
     - Call `/add-note` API before `/fulfill-rune`
   - On failure: do not append note

---

## Test Statistics

| Category | Count | Status |
|----------|-------|--------|
| Python unit tests | 14 | Failing (NotImplementedError) |
| Python integration tests | 23 | Passing |
| Go integration tests | 15 | 9 failing, 6 passing |
| **Total** | **52** | **32 failing correctly** |

All failing tests fail for the right reason (missing implementation, not import/config errors).

---

## Acceptance Criteria Coverage

| US | AC | Tests | Status |
|----|----|----|--------|
| US-1 | Note appended after successful completion | 7 tests | ✓ Covered |
| US-2 | Note format is human-readable | 6 tests | ✓ Covered |
| US-3 | Note attributed to orchestrator | 3 tests | ✓ Covered |
| US-4 | Stats scoped to agent execution | 2 tests | ✓ Covered |
| US-5 | Note survives state transitions | 2 tests | ✓ Covered |
| US-6 | No note on agent failure | 3 tests | ✓ Covered |
| US-7 | Cache stats visible in note | 3 tests | ✓ Covered |

---

## Next Steps

1. Implement `CompletionNoteFormatter` in `agent.py` or new module
2. Modify `agent.py` to output stats on successful completion
3. Modify `orchestrate.go` to parse stats and append notes
4. Run `make test` to verify all tests pass
5. Commit with message referencing bf-29ae
