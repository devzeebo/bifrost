# Script Stack (ELI5)

A plain-language version of [script-stack.md](./script-stack.md).

## The problem

Right now, figuring out _which code runs_ for a piece of work is messy. Every
layer of the system has its own special rules. Adding a new behavior means
wiring up more one-off plumbing.

## The idea

Give the runner two phone books:

1. **Scripts** — “when someone asks for _write-tests_, run this function.”
2. **Wrappers** — “when someone asks for _typescript-tests_, use this
   decorator.”

A **work item** is just a note that says what to do:

- `kind` — the main job (looked up in **scripts**)
- `flow` — optional extra layers around that job (looked up in **wrappers**)
- `state` — a shared backpack everyone can read and write

## Scripts vs wrappers

A **script** does the job:

> “Here’s the work. Go do it.”

A **wrapper** sits around the job like a coat:

> “Let me get you ready… okay, _you_ go now… okay, let me check your work.”

The wrapper doesn’t replace the job. It gets a button called **`next`**. Press
`next` and the stuff _inside_ runs — more wrappers, then finally the main
script.

```
wrapper1 says:
  "before you go in..."
    wrapper2 says:
      "hold on, one more thing..."
        write-tests actually runs
      "okay, looks good from here"
  "all done, I checked everything"
```

## Why `next` matters

`next` is “continue to the rest of the stack.”

The wrapper is in charge:

- **Never call `next`** — skip the inner work entirely
- **Call `next` once** — normal: do setup, run job, do cleanup
- **Call `next` many times** — retry if something fails

That’s the whole trick. One simple rule, lots of flexibility.

## Retry example

```typescript
const retry = async (workItem, next) => {
  let tries = 0;
  while (true) {
    try {
      return await next(); // try the inner work
    } catch (e) {
      if (++tries >= 3) throw e; // gave up after 3 tries
    }
  }
};
```

In English: “Try the job. If it blows up, try again — up to 3 times.”

## Write-tests example

`write-tests` knows how to write good tests in general.

A workflow wants TypeScript tests specifically. Instead of forking
`write-tests` into `write-typescript-tests-with-vitest-and-check`, it says:

- **kind:** `write-tests` (same script as always)
- **flow:** `typescript-tests` (a wrapper that adds TS-specific behavior)

The wrapper:

1. Prepares the context (vitest, vitest-gwt, etc.)
2. Calls `next()` so `write-tests` runs
3. Checks the result (run vitest, expect failure, etc.)

Same core script. Different “coat” depending on what the workflow needs.

## One sentence summary

**Scripts do the work; wrappers decide how the work gets prepared, run, retried,
and checked — by wrapping `next`.**
