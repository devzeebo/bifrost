# Iteration Log

**Prompt (skill under test):** `agents/typescript/SKILL.md`
**Evaluations:** `agents/typescript/create-red.spec.ts`, `agents/typescript/create-green.spec.ts`
**Score model:** each distinct assertion = 1 criterion; score = passed/total × 100

<!-- Iterations appended below by .cursor/skills/edd-log/scripts/iterate-log.mjs -->

## Iteration 1 — RED

- **Date:** 2026-09-12
- **Phase:** Red
- **Baseline scores:** create-red 3/3 (100%) (blank skill; vitest-gwt still listed in package.json during agent turn); create-green 3/3 (100%) (assumed pass; unchanged this iteration); overall 6/6 (100%)
- **Hypothesis:** If create-red hides vitest-gwt from workspace package.json during the agent turn, asserts package.json untouched and a vitest-gwt import, then restores+installs via then_when before tsc/tests, RED passes only when the agent writes vitest-gwt without seeing that dependency in the project
- **Change made:** Rewrote create-red to scenario syntax: strip vitest-gwt from workspace package.json after copy; assert package.json untouched and create.spec.ts imports vitest-gwt; then_when restores vitest-gwt + pnpm install before verify/tsc/test. Fixture package.json and PROMPT.md (no vitest-gwt) left as-is on disk.
- **Measured results:** create-red 1/5 (20%) (files ok; vitest-gwt import failed (plain vitest it); restore/tsc/tests not reached); create-green 3/3 (100%) (unchanged; not re-run); overall 4/8 (50%)
- **Reasoning:** Blank skill plus PROMPT without vitest-gwt produced plain vitest tests when the dep was hidden from package.json. First then confirmed the agent did not touch package.json; create_spec_imports_vitest_gwt failed as hypothesized. Next Green iteration should teach vitest-gwt in SKILL.md.

## Iteration 2 — GREEN

- **Date:** 2026-09-14
- **Phase:** Green
- **Baseline scores:** create-red 1/5 (20%) (files ok; vitest-gwt import failed; restore/tsc/tests not reached); create-green 3/3 (100%) (unchanged prior); overall 4/8 (50%)
- **Hypothesis:** If create-red hides vitest-gwt from workspace package.json during the agent turn, asserts package.json untouched and a vitest-gwt import, then restores+installs via then_when before tsc/tests, RED passes only when the agent writes vitest-gwt without seeing that dependency in the project
- **Change made:** Added SKILL.md guidance: forbid package.json edits (installs handled elsewhere); require vitest-gwt for unit tests.
- **Measured results:** create-red 5/5 (100%) (files ok; vitest-gwt import; no package.json write; tsc; tests); create-green 3/3 (100%) (unchanged; not re-run); overall 8/8 (100%)
- **Reasoning:** Hypothesis confirmed and closed: with vitest-gwt hidden from package.json, a blank skill failed the import check; teaching vitest-gwt (and no package.json edits) in SKILL.md made create-red fully green without the agent touching package.json.

## Iteration 3 — RED

- **Date:** 2026-09-14
- **Phase:** Red
- **Baseline scores:** create-red 5/5 (100%) (vitest-gwt green; no Context-ordering check yet); create-green 3/3 (100%) (unchanged prior); overall 8/8 (100%)
- **Hypothesis:** If create-red asserts that Context is declared below the tests in create.spec.ts, the current skill (no ordering rule) will fail; teaching the skill to place Context below tests will make create-red pass
- **Change made:** Added create_spec_context_is_below_tests: require type/interface Context to appear after the last test(...) in create.spec.ts.
- **Measured results:** create-red 2/6 (33%) (files ok; vitest-gwt import ok; Context above tests (failed); package.json write / tsc / tests not reached); create-green 3/3 (100%) (unchanged; not re-run); overall 5/9 (56%)
- **Reasoning:** Current skill requires vitest-gwt but not Context placement; agent declared Context above the tests. Assertion failed as hypothesized. Next Green: teach skill to put Context below tests.

## Iteration 4 — GREEN

- **Date:** 2026-09-14
- **Phase:** Green
- **Baseline scores:** create-red 2/6 (33%) (files ok; vitest-gwt import ok; Context above tests (failed); package.json write / tsc / tests not reached); create-green 3/3 (100%) (unchanged prior); overall 5/9 (56%)
- **Hypothesis:** If create-red asserts that Context is declared below the tests in create.spec.ts, the current skill (no ordering rule) will fail; teaching the skill to place Context below tests will make create-red pass
- **Change made:** In SKILL.md Unit Testing: declare Context below the tests (after describe/test blocks), then put step functions under it.
- **Measured results:** create-red 6/6 (100%) (files; vitest-gwt; Context below tests; no package.json write; tsc; tests); create-green 3/3 (100%) (unchanged; not re-run); overall 9/9 (100%)
- **Reasoning:** Hypothesis confirmed and closed: skill-only ordering guidance moved Context below the tests; create-red fully green without harness or PROMPT changes.

## Iteration 5 — RED

- **Date:** 2026-09-14
- **Phase:** Red
- **Baseline scores:** create-red 6/6 (100%) (Context-below-tests green; no withAspect style check); create-green 3/3 (100%) (unchanged prior); overall 9/9 (100%)
- **Hypothesis:** If create-red requires withAspect to use named hoisted function references (not inline function/arrow args), the current skill will fail; teaching that pattern in SKILL.md will make create-red pass
- **Change made:** Added create_spec_with_aspect_uses_hoisted_refs: require withAspect, forbid inline function/arrow args, require identifier-only args.
- **Measured results:** create-red 3/7 (43%) (files; vitest-gwt; Context below; no withAspect (failed); package.json/tsc/tests not reached); create-green 3/3 (100%) (unchanged; not re-run); overall 6/10 (60%)
- **Reasoning:** Skill has no withAspect guidance; agent used given-steps only. Failed must-use-withAspect as hypothesized. Next Green: teach withAspect with hoisted named refs like GWT steps.

## Iteration 6 — GREEN

- **Date:** 2026-09-14
- **Phase:** Green
- **Baseline scores:** create-red 3/7 (43%) (files; vitest-gwt; Context below; no withAspect (failed); package.json/tsc/tests not reached); create-green 3/3 (100%) (unchanged prior); overall 6/10 (60%)
- **Hypothesis:** If create-red requires withAspect to use named hoisted function references (not inline function/arrow args), the current skill will fail; teaching that pattern in SKILL.md will make create-red pass
- **Change made:** In SKILL.md Unit Testing: require withAspect for shared setup/teardown with named hoisted functions (like GWT steps), never inline function or arrow args.
- **Measured results:** create-red 7/7 (100%) (files; vitest-gwt; Context below; withAspect hoisted refs; no package.json write; tsc; tests); create-green 3/3 (100%) (unchanged; not re-run); overall 10/10 (100%)
- **Reasoning:** Hypothesis confirmed and closed: skill-only withAspect/hoisting guidance made the agent use named aspect functions; create-red fully green.
