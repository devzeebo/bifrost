---
name: typescript
description: Use when writing any typescript
---

* package.json changes are not permitted. A separate process will handle installing packages or handling the devops concerns.

## Unit Testing

* Use `vitest-gwt` for writing unit tests
* Declare the `Context` type below the tests (after the `describe` / `test` blocks), then put step functions under it
* Use `withAspect` for shared setup/teardown; pass named hoisted functions (same style as GWT steps)—never inline `function` or arrow arguments
