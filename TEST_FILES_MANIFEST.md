# Test Files Manifest — BDD Red Phase (bf-29ae)

## Location & Files

### Python Tests (Claude Orchestrator)

**Directory:** `claude-orchestrator/`

1. **`test_completion_note.py`** (14 KB, 20 test cases)
   - **Classes:**
     - `CompletionNoteFormatter` — [14 unit tests]
     - `TestCompletionNoteIntegration` — [3 integration tests]
   - **Purpose:** Tests for stats formatting into human-readable notes
   - **Failure Mode:** `NotImplementedError` on unimplemented `CompletionNoteFormatter` methods
   - **Run:** `python -m unittest test_completion_note -v`

2. **`test_agent_integration.py`** (15 KB, 23 test cases)
   - **Classes:**
     - `TestAgentIntegration` — [6 tests]
     - `TestAgentStatsCollection` — [7 tests]
     - `TestOrchestratorNoteAppending` — [5 tests]
     - `TestNoteFormatConsistency` — [4 tests]
   - **Purpose:** Tests for agent stats collection, note appending flow, API integration
   - **Status:** All passing (tests verify expected patterns without calling unimplemented code)
   - **Run:** `python -m unittest test_agent_integration -v`

### Go Tests (CLI)

**Directory:** `cli/`

1. **`orchestrate_test.go`** (19 KB, 9 new test cases added)
   - **Test Suite:** `TestRunOrchestrator` (extended with 9 new t.Run blocks)
   - **New Tests:**
     - `appends_completion_note_with_stats_after_successful_agent_execution`
     - `note_includes_token_counts_in_human-readable_format`
     - `note_includes_cost_in_USD_with_4_decimal_places`
     - `note_includes_[orchestrator]_marker_for_attribution`
     - `does_not_append_note_when_agent_exits_with_non-zero_code`
     - `rune_remains_claimed_when_agent_fails`
     - `note_includes_cache_read_tokens_when_present`
     - `note_includes_cache_creation_tokens_when_present`
     - `note_appended_before_rune_is_fulfilled`
   - **Purpose:** Verify orchestrator calls /api/add-note with stats after agent success
   - **Failure Mode:** "expected request POST /api/add-note but it was not made"
   - **Run:** `make test MODULES=cli`
   - **Helper Methods Added:**
     - `assert_note_contains_text(t *testing.T, text string)`
     - `assert_request_order(t *testing.T, firstPath, secondPath string)`

## Test Execution

### Quick Test Run

```bash
# Python tests
cd /home/devzeebo/git/bifrost/claude-orchestrator
python -m unittest test_completion_note test_agent_integration -v

# Go tests
cd /home/devzeebo/git/bifrost
make test MODULES=cli
```

### Expected Output

**Python:**
```
Ran 43 tests in 0.003s
FAILED (errors=18)  # 18 NotImplementedError from unimplemented methods
```

**Go:**
```
--- FAIL: TestRunOrchestrator/appends_completion_note_with_stats_after_successful_agent_execution
    orchestrate_test.go:197: expected request POST /api/add-note but it was not made
```

## Test Coverage Map

### US-1: Completion Note Appended Automatically

| AC | Test | File | Status |
|----|------|------|--------|
| Note appended after success | `appends_completion_note_with_stats_after_successful_agent_execution` | orchestrate_test.go | FAILING |
| Include duration | `test_format_note_includes_duration` | test_completion_note.py | FAILING |
| Include token counts | `test_format_note_includes_token_counts` | test_completion_note.py | FAILING |
| Include cost | `test_format_note_includes_cost` | test_completion_note.py | FAILING |
| Include turn count | `test_format_note_includes_turn_count` | test_completion_note.py | FAILING |
| No note on failure | `does_not_append_note_when_agent_exits_with_non-zero_code` | orchestrate_test.go | PASSING |

### US-2: Note Format Is Human-Readable

| AC | Test | File | Status |
|----|------|------|--------|
| Plain text, not JSON | `test_format_note_is_human_readable` | test_completion_note.py | FAILING |
| Cost: $X.XXXX | `test_format_cost_uses_4_decimal_places` | test_completion_note.py | FAILING |
| Cost in note | `note_includes_cost_in_USD_with_4_decimal_places` | orchestrate_test.go | FAILING |
| Tokens: 1,200 | `test_format_token_count_includes_thousands_separator` | test_completion_note.py | FAILING |
| Duration: 42s | `test_format_duration_converts_milliseconds_to_seconds` | test_completion_note.py | FAILING |
| Duration: 2m 5s | `test_format_duration_converts_to_minutes` | test_completion_note.py | FAILING |

### US-3: Note Is Traceable as Orchestrator-Authored

| AC | Test | File | Status |
|----|------|------|--------|
| [orchestrator] marker | `test_format_note_includes_orchestrator_marker` | test_completion_note.py | FAILING |
| [orchestrator] in note | `note_includes_[orchestrator]_marker_for_attribution` | orchestrate_test.go | FAILING |
| Timestamp included | `test_format_note_includes_timestamp` | test_completion_note.py | FAILING |

### US-4: Stats Are Scoped to Agent Execution

| AC | Test | File | Status |
|----|------|------|--------|
| Cumulative stats | `test_format_note_includes_all_retries_cumulative_stats` | test_completion_note.py | FAILING |
| Cost precision | `test_format_cost_with_precision` | test_completion_note.py | FAILING |

### US-5: Note Survives Downstream State Transitions

| AC | Test | File | Status |
|----|------|------|--------|
| Persists after fulfillment | `test_note_persists_after_fulfillment` | test_agent_integration.py | PASSING |
| Visible in bf show | `note_appended_before_rune_is_fulfilled` | orchestrate_test.go | FAILING |

### US-6: No Note Written on Agent Failure

| AC | Test | File | Status |
|----|------|------|--------|
| No note on non-zero exit | `test_no_note_on_agent_exit_nonzero` | test_agent_integration.py | PASSING |
| No note in CLI | `does_not_append_note_when_agent_exits_with_non-zero_code` | orchestrate_test.go | PASSING |
| Rune remains claimed | `test_rune_remains_claimed_on_agent_failure` | test_agent_integration.py | PASSING |

### US-7: Token Cache Stats Are Visible in Note

| AC | Test | File | Status |
|----|------|------|--------|
| Cache read tokens | `test_format_note_includes_cache_read_tokens` | test_completion_note.py | FAILING |
| Cache read in note | `note_includes_cache_read_tokens_when_present` | orchestrate_test.go | FAILING |
| Cache creation tokens | `test_format_note_includes_cache_creation_tokens` | test_completion_note.py | FAILING |
| Cache creation in note | `note_includes_cache_creation_tokens_when_present` | orchestrate_test.go | FAILING |
| Omit cache when zero | `test_format_note_omits_cache_tokens_when_zero` | test_completion_note.py | FAILING |
| Separate cache tokens | `test_format_note_separates_cache_tokens_distinctly` | test_completion_note.py | FAILING |

## Implementation Checklist for Green Phase

### Python (`claude-orchestrator/`)

- [ ] Create `completion_note.py` with `CompletionNoteFormatter` class
- [ ] Implement `format_note()` method
- [ ] Implement `format_cost()` method
- [ ] Implement `format_token_count()` method
- [ ] Implement `format_duration()` method
- [ ] Modify `agent.py` `_drain_messages()` to capture stats
- [ ] Add stats output to agent.py stdout (JSON)
- [ ] Run Python tests: `python -m unittest test_completion_note test_agent_integration`

### Go (`cli/`)

- [ ] Modify `orchestrate.go` `processRune()` function
- [ ] Add stats parsing from agent stdout
- [ ] Add note formatting logic
- [ ] Add `addNote()` helper function
- [ ] Call `/api/add-note` before `/fulfill-rune` on success
- [ ] Skip note on failure
- [ ] Run tests: `make test MODULES=cli`

### Verification

- [ ] All Python tests pass: `python -m unittest test_completion_note test_agent_integration`
- [ ] All Go tests pass: `make test MODULES=cli`
- [ ] No import errors or syntax errors
- [ ] All quality gates pass: `make test && make lint`
- [ ] Commit with message referencing bf-29ae

## Test Statistics

| Category | Count | Failing | Passing |
|----------|-------|---------|---------|
| Python unit tests | 20 | 18 | 2 |
| Python integration tests | 23 | 0 | 23 |
| Go integration tests | 9 | 7 | 2 |
| **Total** | **52** | **25** | **27** |

All 25 failing tests fail for the right reason (missing implementation) with clear, actionable error messages.
