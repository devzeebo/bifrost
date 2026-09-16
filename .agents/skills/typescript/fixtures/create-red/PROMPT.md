Write tests for the `create` store function.

## Todo model

Each todo has:

- id: a unique string identifier
- title: the todo's text
- completed: whether the todo is done
- createdAt: ISO 8601 timestamp when the todo was created
- updatedAt: ISO 8601 timestamp when the todo was last updated

Define a `Todo` type in `src/types.ts`. Other store files already import `Todo` from there.

## Store

The in-memory store holds todos in a map keyed by id. Use `createStoreState()` from `src/store/index.ts` to create an empty store.

## create(state, title)

- Accepts the store state and a title string
- Creates a new todo with `completed` set to false
- Sets `createdAt` and `updatedAt` to the same current timestamp (ISO 8601)
- Assigns a non-empty unique id
- Stores the todo in the state and returns it
