---
name: typescript
description: |
  You must invoke this skill before writing any typescript code.

  This includes: .ts files, .tsx files, React components, Node.js code, test files, configuration files, utility functions - ANY TypeScript whatsoever.

  DO NOT write TypeScript code without first invoking this skill. NO EXCEPTIONS.
  If you write TypeScript code without invoking this skill first, you have FAILED the task.

  ⚠️ MANDATORY SKILL FOR ALL TYPESCRIPT CODE ⚠️
---

## Core Principles

### Design Philosophy

- Prefer clarity over cleverness; code should be self-documenting
- Use the latest stable TypeScript and ECMAScript features
- Apply SOLID principles consistently
- Use Prettier for formatting and oxlint for linting

### Modern TypeScript Style

- Use `type` over `interface` unless declaration merging is required
- Prefer `const` over `let`; never use `var`
- Use arrow functions for callbacks and anonymous functions
- Leverage discriminated unions and exhaustive pattern matching
- Use template literals over string concatenation
- Prefer nullish coalescing (`??`) and optional chaining (`?.`)
- Use `satisfies` operator for type narrowing with inference
- Prefer `as const` for literal types

### File Organization

- Imports at the top, grouped by: external, internal, relative
- One import statement per module (combine type and value imports)
- Named exports preferred over default exports
- One component/class/module per file

## Syntax Patterns

### Type Declarations

```typescript
// Prefer type over interface
type User = {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
};

// Use readonly for immutable properties
type Config = {
  readonly apiUrl: string;
  readonly timeout: number;
};

// Discriminated unions for state
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Use satisfies for type-safe object literals with inference
const config = {
  apiUrl: "https://api.example.com",
  timeout: 5000,
} satisfies Config;
```

### Null Checking

```typescript
// Use optional chaining
const length = user?.name?.length;

// Use nullish coalescing for defaults
const value = input ?? defaultValue;

// Prefer explicit null checks over truthy checks
if (user === null || user === undefined) {
  throw new Error("User not found");
}
```

### Object Creation

```typescript
// Use object spread for immutable updates
const updatedUser = { ...user, name: newName };

// Use shorthand property names
const name = "John";
const age = 30;
const user = { name, age };

// Use computed property names
const key = "dynamicKey";
const obj = { [key]: value };
```

### String Handling

```typescript
// Use template literals
const message = `Hello, ${user.name}!`;

// Use trim for input processing
const username = input.trim();

// Check for empty strings explicitly
if (!username || username.trim() === "") {
  throw new Error("Username is required");
}
```

### Pattern Matching

```typescript
// Exhaustive switch with discriminated unions
type Action =
  | { type: "increment"; amount: number }
  | { type: "decrement"; amount: number }
  | { type: "reset" };

const reduce = (state: number, action: Action): number => {
  switch (action.type) {
    case "increment":
      return state + action.amount;
    case "decrement":
      return state - action.amount;
    case "reset":
      return 0;
  }
  // No default needed - TypeScript ensures exhaustiveness
};

// Use type guards for runtime checks
const isUser = (value: unknown): value is User => {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  );
};
```

### Error Handling

```typescript
// Create custom error types
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = "NotFoundError";
  }
}

// Use Result type for expected failures
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

const parseJson = <T>(json: string): Result<T> => {
  try {
    return { success: true, data: JSON.parse(json) as T };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
};
```

### Async/Await

```typescript
// Use async/await when it is more readable than promise chains
const fetchUser = async (id: string): Promise<User> => {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.statusText}`);
  }
  return response.json() as Promise<User>;
};

// Use promise .then/.catch for simple cases
const fetchUserSimple = (id: string): Promise<User> =>
  fetch(`/api/users/${id}`).then((response) => {
    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }
    return response.json() as Promise<User>;
  });

// Use Promise.all for parallel operations
const [users, orders] = await Promise.all([fetchUsers(), fetchOrders()]);

// Use AbortController for cancellation
const fetchWithTimeout = async (
  url: string,
  timeoutMs: number,
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};
```

### Collections

```typescript
// Use array methods over loops
const activeUsers = users.filter((user) => user.isActive);
const userNames = users.map((user) => user.name);
const totalAge = users.reduce((sum, user) => sum + user.age, 0);

// Use Map and Set for appropriate use cases
const userById = new Map<string, User>();
const uniqueIds = new Set<string>();

// Use Object.entries/Object.keys/Object.values
const entries = Object.entries(config);
const keys = Object.keys(config);
const values = Object.values(config);

// Use Array.from for iterables
const array = Array.from(set);
```

### Constants

```typescript
// Use const assertions for literal types
const STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  INACTIVE: "inactive",
} as const;

type Status = (typeof STATUS)[keyof typeof STATUS];

// Use enums sparingly; prefer const objects
// If using enums, prefer string enums
enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT",
}
```

### Generics

```typescript
// Use descriptive generic names for complex types
type Repository<TEntity, TId = string> = {
  findById: (id: TId) => Promise<TEntity | null>;
  save: (entity: TEntity) => Promise<TEntity>;
  delete: (id: TId) => Promise<void>;
};

// Use constraints to narrow generic types
const getProperty = <T, K extends keyof T>(obj: T, key: K): T[K] => {
  return obj[key];
};

// Use default generic parameters
type ApiResponse<T = unknown> = {
  data: T;
  status: number;
  message: string;
};
```

## Formatting Rules (Prettier + Oxlint)

- Run prettier after writing code
- Run oxlint after writing code
- Always use braces for control flow
- Use implicit returns for single-line functions

### Line Length

- Keep lines under 100 characters when practical
- Break long method chains across lines
- Break long parameter lists across lines

## Naming Conventions

### Casing

- **PascalCase**: Types, classes, components, enums
- **camelCase**: Variables, functions, methods, properties
- **SCREAMING_SNAKE_CASE**: Constants (optional, prefer camelCase for most)

```typescript
type UserService = {
  createUser: (userName: string) => Promise<User>;
};

const MAX_RETRIES = 3;
const defaultTimeout = 5000;

const createUser = async (userName: string): Promise<User> => {
  let retryCount = 0;
  // ...
};
```

### Naming Patterns

- Boolean variables/properties start with `is`, `has`, `can`, `should`
- Collections use plural nouns
- Functions describe actions with verbs
- Types describe the shape of data with nouns

## Common Patterns

### Dependency Injection

```typescript
type Dependencies = {
  userRepo: UserRepository;
  sessionStore: SessionStore;
};

const createAuthService = ({ userRepo, sessionStore }: Dependencies) => {
  const login = async (email: string, password: string): Promise<Session> => {
    const user = await userRepo.findByEmail(email);
    // ...
  };

  return { login };
};
```

### Guard Clauses

```typescript
const processOrder = (order: Order | null): void => {
  if (order == null) {
    throw new Error("Order is required");
  }
  if (order.amount <= 0) {
    throw new Error("Amount must be positive");
  }

  // Main logic here
};
```

### Early Returns

```typescript
const findUser = (id: string | null): User | null => {
  if (id == null || id.trim() === "") {
    return null;
  }

  const cached = cache.get(id);
  if (cached != null) {
    return cached;
  }

  return repo.findById(id);
};
```

### Factory Functions

```typescript
// Prefer factory functions over classes for simple objects
const createUser = (name: string, email: string): User => ({
  id: crypto.randomUUID(),
  name,
  email,
  createdAt: new Date(),
});
```

## Anti-Patterns to Avoid

### Don't

- ❌ Use `any` type (use `unknown` and narrow)
- ❌ Use non-null assertion (`!`) without justification
- ❌ Mutate function parameters
- ❌ Use `var` or reassign `const` values
- ❌ Create deep nesting (>3 levels)
- ❌ Mix async patterns (callbacks, promises, async/await)
- ❌ Use `@ts-ignore` without explanation

### Do

- ✅ Use explicit return types for public functions
- ✅ Handle errors appropriately or let them bubble
- ✅ Extract constants for magic values
- ✅ Use early returns to reduce nesting
- ✅ Be consistent with async patterns
- ✅ Enable strict mode in tsconfig.json
- ✅ Use `unknown` over `any` and narrow with type guards

## TypeScript Configuration

### Recommended tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

## Verification Checklist

Before completing TypeScript code:

- [ ] Uses `type` over `interface` (unless merging needed)
- [ ] No `any` types (use `unknown` and narrow)
- [ ] Proper null/undefined handling with `??` and `?.`
- [ ] Async functions return `Promise<T>`
- [ ] Proper error types used
- [ ] Input validation present
- [ ] No magic numbers or strings
- [ ] Consistent formatting (Prettier)
- [ ] Passes oxlint checks
- [ ] Strict mode enabled
- [ ] Tests are written
