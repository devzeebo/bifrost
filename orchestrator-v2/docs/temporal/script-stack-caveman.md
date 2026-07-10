# Script Stack (Caveman)

Even simpler than [script-stack-eli5.md](./script-stack-eli5.md).  
Big brain version: [script-stack.md](./script-stack.md).

---

## Problem

Runner confused. Many rules. Many wires. New thing = more pain.

Old way:

```
"Which code run?"
"Uh... ask layer three?"
"Layer three say ask layer four."
"Layer four say maybe layer two?"
*everyone scream*
```

New way:

```
"Which code run?"
"Look list."
"Ok."
```

---

## Idea

Runner get **two list**. Not one list. **Two list.**

| List | Caveman name | What it hold |
|------|--------------|--------------|
| `scripts` | **job list** | name → do-thing function |
| `wrappers` | **coat list** | name → boss-around function |

Work note (`WorkItem`) say:

| Field | Caveman name | Meaning |
|-------|--------------|---------|
| `kind` | **main job** | which script run at center |
| `flow` | **coat order** | which wrappers outside-in. can be empty `[]` |
| `state` | **shared bag** | everyone put stuff here for next guy |
| `metadata` | **sticky note** | info about note. less touchy |
| `workItemId` | **note id** | so runner not mix up notes |

```
     flow[0] coat (outside)
        │
     flow[1] coat
        │
      kind job (inside, meat)
```

**Outside coat see world first. Inside job do real work last.**

---

## Script vs wrapper

**Script** = do thing.

> "Job here. Go."

**Wrapper** = coat around job.

> "Wait. Get ready. You go. I look. Good? Good."

Wrapper **not** replace job.

Wrapper get **`next`** button.

Push `next` → inside run → more coats → then meat job at center.

```
coat one: "wait..."
  coat two: "wait more..."
    write-tests DO THING
  coat two: "me look. ok."
coat one: "me look too. ok."
```

Real nesting (big brain whisper):

```typescript
// flow: ["wrapper1", "wrapper2"], kind: "myScript"
wrapper1(item, () => wrapper2(item, () => myScriptFn(item)))
```

Caveman translation:

```
coat1(item, "hey coat2 you go") 
  → coat2(item, "hey job you go") 
    → job(item, "me do thing")
```

---

## Why `next` big deal

`next` = **"go on. rest of stack now."**

Wrapper is **boss** of inside.

| Boss move | Caveman | What happen |
|-----------|---------|-------------|
| Never push `next` | "nah" | inside never run. job skip. |
| Push once | "go" | normal. setup → job → check. |
| Push many | "go again" | retry. stubborn job. |
| Push after change bag | "go but first me fix bag" | prepare then go |
| Look after push | "go... ok me inspect" | check after job |

One button. Many power. Like fire. Respect fire.

---

## Types (caveman read typescript)

```typescript
type ScriptFn = (workItem: WorkItem) => Promise<unknown>;
// job function. one argument: work note. return promise.

type WrapperFn = (workItem: WorkItem, next: () => Promise<unknown>) => Promise<unknown>;
// coat function. two argument: work note + GO button.

type ScriptStack = {
  scripts: Record<string, ScriptFn>;
  wrappers: Record<string, WrapperFn>;
};
// runner pocket. two list. that all.
```

Caveman:

- `ScriptFn` = `(note) => do work`
- `WrapperFn` = `(note, GO) => boss around`
- `ScriptStack` = runner pocket with job list + coat list

---

## Wrapper cookbook (mmm coats)

### 1. Retry — job break? try again

```typescript
const retry = async (workItem, next) => {
  let tries = 0;
  while (true) {
    try {
      return await next();
    } catch (e) {
      if (++tries >= 3) throw e;
    }
  }
};
```

Caveman: "Try. Break? Try. Break? Try. Three time. Still break? **THROW ROCK.**"

---

### 2. Prepare only — fix bag before go

```typescript
const prepare = async (workItem, next) => {
  workItem.state.tools = ["hammer", "rock"];
  return await next();
};
```

Caveman: "Me put hammer in bag. **Now you go.**"

---

### 3. Check only — look after go

```typescript
const check = async (workItem, next) => {
  await next();
  if (!workItem.state.result) throw new Error("no result. bad.");
};
```

Caveman: "You go. ... You back? **Where result?** No result? **ANGRY.**"

---

### 4. Short-circuit — boss say no

```typescript
const skipIfDone = async (workItem, next) => {
  if (workItem.state.alreadyDone) return; // NO PUSH NEXT. job never run.
  return await next();
};
```

Caveman: "Bag say already done? **Me go home.** Inside not run. Save energy. Good caveman."

---

### 5. Log coat — me watch you

```typescript
const log = async (workItem, next) => {
  console.log("coat: before", workItem.kind);
  const result = await next();
  console.log("coat: after", workItem.kind);
  return result;
};
```

Caveman: "Me yell BEFORE. You go. Me yell AFTER. Tribe happy."

---

### 6. Timeout — too slow? me leave

```typescript
const timeout = async (workItem, next) => {
  const ms = 30_000;
  let timer: NodeJS.Timeout;
  const raced = Promise.race([
    next(),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("too slow")), ms);
    }),
  ]);
  try {
    return await raced;
  } finally {
    clearTimeout(timer!);
  }
};
```

Caveman: "You go. Me count to thirty. Still not back? **ME LEAVE.**"

---

### 7. Many coat — onion

```typescript
const item = {
  kind: "hunt",
  flow: ["retry", "log", "typescript-tests"],
};
```

Order outside → in:

```
retry
  → log
    → typescript-tests
      → hunt (MEAT)
```

Caveman: "Retry outside. Log middle. TS coat inner. **Hunt at bone.**"

---

## Write-tests (full story)

`write-tests` = smart caveman. Know good test. Any language. Good.

Workflow want **typescript** test. Old dumb way:

```
make write-tests-typescript-vitest-gwt-check-v2-final-FINAL.ts
make another one
make another one
tribe cry
```

New way:

```typescript
const typescriptTests = async (workItem, next) => {
  await prepareTsContext(workItem); // bag get vitest words
  await next();                       // write-tests run
  await validateTsTests(workItem);    // vitest run. should fail. good fail.
};

const item = {
  kind: "write-tests",
  flow: ["typescript-tests"],
};

const stack = {
  scripts: { "write-tests": writeTestsFn },
  wrappers: { "typescript-tests": typescriptTests },
};
```

- **kind** = same job always (`write-tests`)
- **flow** = different coat per workflow (typescript, python, whatever)

Same meat. Different fur. **No new job every time.**

---

## Shared bag (`state`)

Script and coat both touch **same bag**.

```typescript
// coat put in bag
workItem.state.prepared = true;

await next();

// job read bag, put more in
workItem.state.testsWritten = 42;

// outer coat read what job did
console.log(workItem.state.testsWritten);
```

Caveman rules for bag:

1. **Put in bag** if next guy need it.
2. **Read from bag** if you need it.
3. **Don't eat other tribe's bag** (wrong work item).
4. **metadata** for labels. **state** for actual stuff.

---

## Good caveman vs bad caveman

### Bad caveman

```
make new script for every tiny difference
copy paste write-tests 47 time
no coat. spaghetti wires everywhere
forget call next(). job never run. wonder why quiet.
call next() but no await. job still running. coat already leave. chaos.
```

### Good caveman

```
one script per real job
coat for "how we run this job here"
flow pick coats at schedule time
await next() when you care about finish
throw rock when check fail
```

---

## FAQ (frequently asked grunts)

**Q: `flow` empty?**  
A: No coat. Just job. `myScriptFn(item)`. Simple. Happy.

**Q: Coat name in `flow` but not in coat list?**  
A: Runner confused. Error. Fix list.

**Q: Job name in `kind` but not in job list?**  
A: Same. Error. Fix list.

**Q: Put job name in `flow`?**  
A: **NO.** `flow` = coat names only. `kind` = job name. Don't mix. Bad hunt.

**Q: Who run first, `flow[0]` or `flow[1]`?**  
A: `flow[0]` **outside**. See world first. Wrap everyone inside.

**Q: Can coat skip job?**  
A: Yes. Don't push `next`. Job never happen. Boss power.

**Q: Can coat run job three time?**  
A: Yes. Push `next` in loop. Retry coat. See cookbook.

**Q: Can job be coat?**  
A: Different list. Different shape. Job no get `next` button. Don't confuse tribe.

**Q: Why not one big list?**  
A: Job = do work. Coat = boss work. Different job. Two list = clear. Caveman like clear.

---

## Runner walk (step by step)

1. Runner get work note.
2. Look up `kind` in **job list**. Find meat function.
3. Look up each name in `flow` in **coat list**. Outermost first.
4. Wrap: outer coat gets `next` that runs rest.
5. Outermost coat start.
6. Eventually `next` chain hit meat job.
7. Job finish. Coats unwrap. Promise settle.
8. Tribe eat.

```
NOTE ARRIVE
  → find job
  → find coats
  → nest like onion
  → outer coat START
  → ... next ... next ... JOB
  → bubble back out
  → DONE
```

---

## One grunt summary

**Script do work. Wrapper boss work — ready, go, check, retry — with `next` button.**

## Two grunt summary

**Two list. One note. Coats outside. Job inside. Shared bag. Push `next` or don't. Caveman strong.**

## Three grunt summary (bonus)

```
scripts = DO
wrappers = BOSS DO
flow     = WHICH BOSS
kind     = WHAT DO
state    = SHARED BAG
next     = GO BUTTON
```

*thunk rock. document done.*
