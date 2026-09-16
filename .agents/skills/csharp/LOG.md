# Iteration Log

**Prompt (skill under test):** `agents/csharp/SKILL.md`
**Evaluations:** `agents/csharp/language-preferences.spec.ts`
**Score model:** each distinct assertion = 1 criterion; score = passed/total × 100

<!-- Iterations appended below by .cursor/skills/edd-log/scripts/iterate-log.mjs -->

## Iteration 1 — RED

- **Date:** 2026-09-15
- **Phase:** Red
- **Baseline scores:** language-preferences 1/3 (33%) (blast radius ok; types_omit_internal failed (internal sealed class); members_omit_private not reached (source has private int)); overall 1/3 (33%)
- **Hypothesis:** If language-preferences asserts that agent-written C# omits internal on types and private on members, a blank skill will fail when the agent emits those redundant modifiers
- **Change made:** Added cursor:dotnet image (dotnet-sdk/runtime/aspnet-runtime bins) and language-preferences.spec.ts: inline Counter prompt, assert only Counter.cs written, types omit internal, members omit private. Skill left blank.
- **Measured results:** language-preferences 1/3 (33%) (blast radius ok; types_omit_internal failed; members_omit_private not reached (private field in output)); overall 1/3 (33%)
- **Reasoning:** Blank skill produced internal sealed class Counter with private int _count. Load-bearing style assertions failed as hypothesized; next Green should teach omit-defaults in SKILL.md.

## Iteration 2 — GREEN

- **Date:** 2026-09-15
- **Phase:** Green
- **Baseline scores:** language-preferences 1/3 (33%) (blast radius ok; types_omit_internal failed; members_omit_private not reached (private in source)); overall 1/3 (33%)
- **Hypothesis:** If SKILL.md teaches omitting redundant internal on types and private on members (C# defaults), language-preferences will pass
- **Change made:** Added Access modifiers section to SKILL.md: omit internal on types and private on members when they match C# defaults; use modifiers only when non-default.
- **Measured results:** language-preferences 3/3 (100%); overall 3/3 (100%)
- **Reasoning:** Hypothesis confirmed: teaching omit-defaults closed the Red failures; agent no longer emits redundant internal/private. language-preferences 3/3.

## Iteration 3 — REFACTOR

- **Date:** 2026-09-15
- **Phase:** Refactor
- **Baseline scores:** language-preferences 3/3 (100%); overall 3/3 (100%)
- **Hypothesis:** If SKILL.md is golfed to a single line forbidding writing access modifiers when they are the default, language-preferences will still pass
- **Change made:** Golfed Access modifiers section to one line: Do not write access modifiers when they're the default.
- **Measured results:** language-preferences 3/3 (100%); overall 3/3 (100%)
- **Reasoning:** Hypothesis confirmed: the verbose defaults/examples were unnecessary; a single omit-defaults line kept language-preferences at 3/3.

## Iteration 4 — RED

- **Date:** 2026-09-15
- **Phase:** Red
- **Baseline scores:** language-preferences 3/4 (75%) (blast radius + omit internal/private ok; async_methods_omit_async_suffix failed (GetValueAsync)); overall 3/4 (75%)
- **Hypothesis:** If language-preferences extends Counter to require an async method and asserts no Async suffix, the current skill (access-modifiers only) will fail when the agent emits GetValueAsync/similar
- **Change made:** Extended Counter prompt with an async method that returns Task<int>; added async_methods_omit_async_suffix assertion. SKILL.md unchanged.
- **Measured results:** language-preferences 3/4 (75%) (access modifiers still green; GetValueAsync failed Async-suffix check); overall 3/4 (75%)
- **Reasoning:** Hypothesis confirmed: without Async naming guidance the agent wrote GetValueAsync. Next Green should teach omit Async suffix in SKILL.md.

## Iteration 5 — GREEN

- **Date:** 2026-09-15
- **Phase:** Green
- **Baseline scores:** language-preferences 3/4 (75%) (access modifiers green; GetValueAsync failed Async-suffix check); overall 3/4 (75%)
- **Hypothesis:** If SKILL.md adds a line forbidding Async suffixes on async methods, language-preferences will pass 4/4
- **Change made:** Added skill line: Do not suffix async methods with Async.
- **Measured results:** language-preferences 4/4 (100%); overall 4/4 (100%)
- **Reasoning:** Hypothesis confirmed: teaching omit-Async-suffix closed the Red failure; agent no longer emits GetValueAsync. language-preferences 4/4.

## Iteration 6 — RED

- **Date:** 2026-09-15
- **Phase:** Red
- **Baseline scores:** language-preferences 4/5 (80%) (prior prefs ok; class_members_follow_preferred_order failed (constructor before publicProperty)); overall 4/5 (80%)
- **Hypothesis:** If language-preferences asserts Counter members follow public nested → public props → public methods → nested helpers → fields → ctor, the current skill will fail when the agent uses conventional C# order (e.g. ctor/fields early)
- **Change made:** Extended Counter prompt with nested Snapshot/ResetToken, field, and constructor; added class_members_follow_preferred_order assertion. SKILL.md unchanged.
- **Measured results:** language-preferences 4/5 (80%) (order failed: constructor before publicProperty); overall 4/5 (80%)
- **Reasoning:** Hypothesis confirmed: without ordering guidance the agent put the constructor before public properties. Next Green should teach the preferred member order in SKILL.md.

## Iteration 7 — GREEN

- **Date:** 2026-09-15
- **Phase:** Green
- **Baseline scores:** language-preferences 4/5 (80%) (order failed: constructor before publicProperty); overall 4/5 (80%)
- **Hypothesis:** If SKILL.md teaches preferred class member order (public nested → public props → public methods → nested helpers → fields → ctor), language-preferences will pass 5/5
- **Change made:** Added skill line for class member order: public nested types, public properties, public methods, nested helpers, fields, constructor.
- **Measured results:** language-preferences 5/5 (100%); overall 5/5 (100%)
- **Reasoning:** Hypothesis confirmed: teaching preferred member order closed the Red failure. language-preferences 5/5.
