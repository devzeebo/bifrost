# vitest-gwt

A small library to help Vitest support given-when-then style testing without a
bunch of overhead

## Compatibility Chart

vitest-gwt stays in lockstep with vitest's **MAJOR VERSION**. If you're using
vitest@2.x.x, use vitest-gwt@2.x.x

## Usage

1. Install the package
   ```bash
   npm i --save-dev vitest-gwt
   ```
2. In your test files, import `test`
   ```js
   import test from "vitest-gwt";
   ```
3. Write a test!
   ```js
   describe("test context", () => {
     test("has no expected errors", {
       given: {
         mock_vitest_test_function,
         GOOD_test_case,
       },
       when: {
         executing_test_case,
       },
       then: {
         all_GIVENS_called,
         all_WHENS_called,
         all_THENS_called,
       },
     });
   });
   ```

## [Scenario Test](https://github.com/devzeebo/gwt-runner/blob/main/README.md#scenario-definition)

Sometimes a GWT flow doesn't make sense. You might be writing integration tests.
Or something that needs to assert something, then do another thing, then assert
something else.

In these cases, you can use the scenario definition style which allows chaining
`when` and `then`, followed by `then_when` and `then` blocks.

```ts
{
  given: {
    mock_vitest_test_function,
    GOOD_test_case,
  },
  scenario: [{
    when: {
      executing_test_case,
    },
    then: {
      assert_something,
    },
  }, {
    then_when: {
      user_submits_form,
    },
    then: {
      something_else_happens,
      yet_another_thing_is_true,
    },
  }, {
    then_when: {
      something_happens,
    },
    then: {
      expect_error: some_check,
      and: {
        something_is_still_true,
      },
    }
  }]
}
```

## withAspect

`withAspect` wraps up vitest's `beforeEach` and `afterEach` to allow preparing and
cleaning up the context before running tests.

```js
withAspect(
  // this is the beforeEach. Do your prep work here
  function(this: Context) {
  },
  // this is the afterEach. It is OPTIONAL. If you need to do clean up of
  // external resources you allocated in the beforeEach, do it here
  function(this: Context) {
  }
)
```

The `afterEach` has access to whatever values you put on the Context in the
`beforeEach`. It does NOT have access to the values put on the Context during
the specific test.

To raise the Vitest hook timeout for slow setup, type the before callback as
`AspectFunction` and set `timeout` (ms):

```ts
import { withAspect, type AspectFunction } from "vitest-gwt";

const setup: AspectFunction<Context> = function () {
  // slow prep
};
setup.timeout = 100_000;
withAspect(setup);
```

## withTestOptions

Vitest applies per-test options (like `timeout` and `retry`) when the test is
**registered**, not when it runs — so `withAspect` is too late. Use
`withTestOptions` inside a `describe` to set Vitest `TestOptions` for every GWT
`test` in that suite:

```ts
import { describe } from "vitest";
import test, { withTestOptions } from "vitest-gwt";

describe("slow integration", () => {
  withTestOptions((curr) => curr.timeout = 100_000);

  test("takes a while", {
    when: { slow_operation },
    then: { it_finished },
  });
});
```

The callback receives a shallow copy of the current suite's options (including
any inherited from a parent `describe`). Mutate that object to configure this
suite. Nested describes inherit parent options and can override individual
fields; sibling describes outside the block are unaffected.

Use `AspectFunction.timeout` for **hook** timeouts; use `withTestOptions` for
**test** timeouts and other Vitest options.

## Detailed Usage

Full guides live in [`docs/`](./docs) — writing tests, expecting errors,
scenarios, shared context (`withAspect` / `withTestOptions`), and the API
reference.

For the underlying runner internals, refer to
[gwt-runner](https://github.com/devzeebo/gwt-runner).
