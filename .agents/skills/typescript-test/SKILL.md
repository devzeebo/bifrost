---
name: typescript-test
description:
  You must invoke this skill before writing any typescript TESTS.
  
  DO NOT write TypeScript TESTS without first invoking this skill. NO EXCEPTIONS.
  If you write TypeScript TESTS without invoking this skill first, you have FAILED the task.
  
  ⚠️ MANDATORY SKILL FOR ALL TYPESCRIPT TESTS ⚠️
---

## Core Principles

### Testing Philosophy
- Tests should describe behavior, not implementation
- Use Given-When-Then structure for clarity
- Tests should be independent and deterministic
- Keep tests focused on a single behavior
- Use vitest-gwt for readable, structured tests
- **CRITICAL**: Never use arrow functions in GWT definitions - always use regular function declarations
- **Prefer multiple `then` assertions over multiple tests**: When testing the same `given`/`when` conditions, use multiple `then` clauses in a single test rather than duplicating the setup across multiple tests

### Test Organization
- Test files use `.spec.ts` extension (not `.test.ts`)
- Colocate tests next to implementation files (never use `__tests__` directories)
- Example: `src/utils/parser.ts` → `src/utils/parser.spec.ts`
- One describe block per function/class being tested
- Group related test cases within describe blocks

## Test Framework Setup

### Vitest Configuration
- Use `--run` flag when executing tests (prevents watch mode)
- Import test utilities from `vitest` and `vitest-gwt`
- Configure vitest in `vitest.config.ts` or `vite.config.ts`

### Required Imports
```typescript
import { describe, expect, beforeEach, afterEach, vi } from 'vitest';
import test from 'vitest-gwt';
import { xtest } from 'vitest-gwt'; // For disabled tests
```

### Version Compatibility
- vitest-gwt stays in lockstep with vitest's MAJOR VERSION
- If using vitest@2.x.x, use vitest-gwt@2.x.x

## vitest-gwt Pattern

### Basic Structure
```typescript
import { describe, expect } from 'vitest';
import test from 'vitest-gwt';
import { functionUnderTest } from './module';

type Context = {
  input: string;
  result: string;
  error: Error | null;
};

describe('functionUnderTest', () => {
  test('returns expected value for valid input', {
    given: {
      some_precondition,
    },
    when: {
      function_is_executed,
    },
    then: {
      expected_result,
    },
  });
});

// IMPORTANT: Use regular function declarations, NOT arrow functions
function some_precondition(this: Context) {
  this.input = 'test value';
}

function function_is_executed(this: Context) {
  this.result = functionUnderTest(this.input);
}

function expected_result(this: Context) {
  expect(this.result).toBe('expected value');
}
```

### Context Type
- Define a `Context` type for shared state between steps
- Include all data needed across given/when/then steps
- Keep context minimal and focused on the test scenario
- Use descriptive property names
- Context is automatically created and bound to `this` in all step functions
- Pass data between steps only through `this` context - no arguments are passed to clauses

```typescript
type Context = {
  // Input data
  userId: string;
  requestData: CreateUserRequest;
  
  // Dependencies/mocks
  mockRepository: UserRepository;
  
  // Results
  result: User | null;
  error: Error | null;
};
```

### Step Functions
- **CRITICAL**: Use regular function declarations, NEVER arrow functions (context binding won't work)
- Use `snake_case` for step function names (improves readability)
- Each step function should do one thing
- Use `this: Context` parameter for type safety
- Can use shorthand object literal syntax or explicit key-value pairs
- Steps can be defined as objects or arrays

```typescript
// Define step functions outside the test definition
function valid_user_data(this: Context) {
  this.requestData = {
    name: 'John Doe',
    email: 'john@example.com',
  };
}

function mock_repository_configured(this: Context) {
  this.mockRepository = {
    save: vi.fn().mockResolvedValue({ id: '123', ...this.requestData }),
  };
}

async function user_is_created(this: Context) {
  this.result = await createUser(this.requestData, this.mockRepository);
}

function user_is_returned(this: Context) {
  expect(this.result).toEqual({
    id: '123',
    name: 'John Doe',
    email: 'john@example.com',
  });
}

function repository_save_was_called(this: Context) {
  expect(this.mockRepository.save).toHaveBeenCalledWith(this.requestData);
}

// Use shorthand syntax in test definition
test('creates user with valid data', {
  given: {
    valid_user_data,
    mock_repository_configured,
  },
  when: {
    user_is_created,
  },
  then: {
    user_is_returned,
    repository_save_was_called,
  },
});
```

### Array Steps
You can use arrays instead of objects for steps:

```typescript
test('processes data using array steps', {
  given: [
    valid_user_data,
    mock_repository_configured,
  ],
  when: [
    user_is_created,
  ],
  then: [
    user_is_returned,
    repository_save_was_called,
  ],
});
```

Arrays are especially useful with curried functions:

```typescript
// Curried function - MUST return a regular function, NOT an arrow function
function user_enters_data(data: any) {
  return function(this: Context) {
    this.formData = data;
  };
}

test('submits form with entered data', {
  given: {
    form_is_rendered,
  },
  when: [
    user_enters_data({ name: 'John', email: 'john@example.com' }),
    user_submits_form,
  ],
  then: {
    data_is_submitted,
  },
});
```

## Test Naming

### Test Case Names

Describe the behavior of the function in a clear and concise way, without
relying on the function name or implementation details.

**Good examples:**
- `parses valid json and returns object`
- `invalid email throws error`
- `missing user throws not found error`
- `empty cart total is zero`

**Bad examples:**
- `test1` (not descriptive)
- `it should work` (vague)
- `parsing` (incomplete)
- `parseJson_withValidJson_returnsObject` (hard to read and not descriptive)

### Step Function Names
- Use regular sentences for readability
- Be specific about what the step does

```typescript
given: {
  user_is_authenticated(this: Context) { },
  valid_input_data(this: Context) { },
  database_contains_records(this: Context) { },
}

when: {
  function_is_called(this: Context) { },
  user_submits_form(this: Context) { },
  api_request_is_made(this: Context) { },
}

then: {
  result_matches_expected(this: Context) { },
  error_is_thrown(this: Context) { },
  database_is_updated(this: Context) { },
}
```

## Testing Patterns

### Async Tests
```typescript
type Context = {
  userId: string;
  result: User | null;
  error: Error | null;
};

test('fetches user with valid id', {
  given: {
    valid_user_id(this: Context) {
      this.userId = '123';
    },
  },
  when: {
    async user_is_fetched(this: Context) {
      this.result = await fetchUser(this.userId);
    },
  },
  then: {
    user_is_returned(this: Context) {
      expect(this.result).toBeDefined();
      expect(this.result?.id).toBe('123');
    },
  },
});
```

### Error Testing
Use `expect_error` in the `then` clause to handle expected errors:

```typescript
type Context = {
  input: string;
  errorMessage: string;
};

function invalid_json_string(this: Context) {
  this.input = '{invalid}';
  this.errorMessage = 'Expected property name or';
}

function parsing_is_attempted(this: Context) {
  JSON.parse(this.input);
}

// expect_error receives the error as its first parameter
function expect_error(this: Context, error: Error) {
  expect(error).toBeInstanceOf(SyntaxError);
  expect(error.message).toContain(this.errorMessage);
}

test('throws error for invalid json', {
  given: {
    invalid_json_string,
  },
  when: {
    parsing_is_attempted,
  },
  then: {
    expect_error,
  },
});
```

**Important**: 
- If your code throws an error and you have `expect_error` in `then`, it will be passed to that function
- If your code throws an error and you do NOT have `expect_error`, the test will fail
- The `expect_error` function receives the error as its first parameter (not through context)

### Mocking with Vitest
```typescript
import { vi } from 'vitest';

type Context = {
  mockFetch: ReturnType<typeof vi.fn>;
  result: Response;
};

test('calls fetch with valid endpoint', {
  given: {
    fetch_is_mocked(this: Context) {
      this.mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'test' }),
      });
      global.fetch = this.mockFetch;
    },
  },
  when: {
    async api_is_called(this: Context) {
      this.result = await fetch('/api/test');
    },
  },
  then: {
    fetch_was_called_correctly(this: Context) {
      expect(this.mockFetch).toHaveBeenCalledWith('/api/test');
    },
    response_is_ok(this: Context) {
      expect(this.result.ok).toBe(true);
    },
  },
});
```

### Parameterized Tests
```typescript
type Context = {
  input: string;
  result: boolean;
};

describe('validateEmail', () => {
  const testCases = [
    { email: 'test@example.com', expected: true },
    { email: 'invalid', expected: false },
    { email: '', expected: false },
    { email: 'test@', expected: false },
  ];

  testCases.forEach(({ email, expected }) => {
    function email_input(this: Context) {
      this.input = email;
    }

    function validation_is_performed(this: Context) {
      this.result = validateEmail(this.input);
    }

    function result_matches_expected(this: Context) {
      expect(this.result).toBe(expected);
    }

    test(`validates ${email} as ${expected}`, {
      given: {
        email_input,
      },
      when: {
        validation_is_performed,
      },
      then: {
        result_matches_expected,
      },
    });
  });
});
```

### Setup and Teardown with withAspect
Use `withAspect` to wrap beforeEach and afterEach for GWT tests:

```typescript
import test, { withAspect } from 'vitest-gwt';

type Context = {
  db: Database;
  data: Record<string, any>;
  result: any;
};

describe('DatabaseService', () => {
  // withAspect wraps beforeEach and afterEach
  withAspect(
    // beforeEach - prepare context
    function(this: Context) {
      this.db = new Database(':memory:');
      this.db.migrate();
    },
    // afterEach (OPTIONAL) - cleanup
    function(this: Context) {
      this.db.close();
    }
  );

  test('inserts record with valid data', {
    given: {
      valid_record_data,
    },
    when: {
      record_is_inserted,
    },
    then: {
      record_is_saved,
    },
  });
});

function valid_record_data(this: Context) {
  this.data = { name: 'Test', value: 42 };
}

async function record_is_inserted(this: Context) {
  this.result = await this.db.insert(this.data);
}

function record_is_saved(this: Context) {
  expect(this.result.id).toBeDefined();
}
```

**Important**:
- The afterEach has access to the full context; from the beforeEach and the test
- The afterEach parameter is optional

## Assertions

### Common Vitest Matchers
```typescript
// Equality
expect(value).toBe(expected);           // Strict equality (===)
expect(value).toEqual(expected);        // Deep equality
expect(value).toStrictEqual(expected);  // Strict deep equality

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeDefined();
expect(value).toBeUndefined();
expect(value).toBeNull();

// Numbers
expect(value).toBeGreaterThan(3);
expect(value).toBeGreaterThanOrEqual(3);
expect(value).toBeLessThan(5);
expect(value).toBeCloseTo(0.3, 5);

// Strings
expect(string).toMatch(/pattern/);
expect(string).toContain('substring');

// Arrays/Iterables
expect(array).toContain(item);
expect(array).toHaveLength(3);
expect(array).toContainEqual(item);

// Objects
expect(object).toHaveProperty('key');
expect(object).toHaveProperty('key', value);
expect(object).toMatchObject({ key: value });

// Exceptions - DO NOT USE. Use expect_error instead.
// expect(() => fn()).toThrow();
// expect(() => fn()).toThrow(Error);
// expect(() => fn()).toThrow('error message');

// Promises
await expect(promise).resolves.toBe(value);
// DO NOT USE. Use expect_error instead.
// await expect(promise).rejects.toThrow(Error);

// Mocks
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenLastCalledWith(arg1);
```

### Assertion Best Practices
- Use the most specific matcher available
- Prefer `toBe` for primitives, `toEqual` for objects
- Use `toStrictEqual` when you need exact match (no undefined vs missing)
- Avoid negations when possible (prefer positive assertions)
- One logical assertion per `then` step (multiple expect calls are fine if related)

## Test Data

### Test Data Builders
```typescript
type User = {
  name: string;
  email: string;
  id: string;
};

type UserBuilder = User & {
  withName: (name: string) => UserBuilder;
  withEmail: (email: string) => UserBuilder;
};

const user = (): UserBuilder => {
  let id = uuidv4();
  let name = 'Default Name';
  let email = 'default@example.com';

  return {
    id,
    name,
    email,
    withName(n) {
      this.name = n;
      return this;
    },
    withEmail(e) {
      this.email = e;
      return this;
    },
  };
};

// Usage in tests
test('example', {
  given: {
    user_with_custom_email(this: Context) {
      this.user = user()
        .withEmail('custom@example.com');
    },
  },
  // ...
});
```

### Realistic Test Data
- Use realistic data that represents production scenarios
- Include edge cases (empty strings, null, undefined, boundary values)
- Use meaningful values that make tests self-documenting
- Avoid magic numbers and strings

```typescript
// Good
given: {
  user_with_long_name(this: Context) {
    this.userName = 'A'.repeat(255); // Max length
  },
}

// Bad
given: {
  user_data(this: Context) {
    this.userName = 'x'; // Not realistic
  },
}
```

## Mocking Strategy

### What to Mock
- External APIs and HTTP requests
- Databases and data stores
- File system operations
- Time/date functions (`vi.useFakeTimers()`)
- Random number generators
- Third-party services

### What NOT to Mock
- Domain logic and business rules
- Simple utility functions
- Value objects and data structures
- The code under test

### Mock Examples
```typescript
import { vi } from 'vitest';

// Mock a module
vi.mock('./userService', () => ({
  fetchUser: vi.fn(),
}));

// Mock a function
const mockFn = vi.fn().mockReturnValue('result');
const mockAsyncFn = vi.fn().mockResolvedValue('result');
const mockError = vi.fn().mockRejectedValue(new Error('failed'));

// Mock implementation
const mockFn = vi.fn((x: number) => x * 2);

// Spy on existing function
const spy = vi.spyOn(object, 'method');

// Fake timers
vi.useFakeTimers();
vi.setSystemTime(new Date('2024-01-01'));
// ... test code ...
vi.useRealTimers();
```

## Test Organization

### File Structure
```
src/
  services/
    userService.ts
    userService.spec.ts
  utils/
    parser.ts
    parser.spec.ts
  components/
    Button.tsx
    Button.spec.tsx
```

### Describe Block Organization
```typescript
describe('UserService', () => {
  describe('createUser', () => {
    test('creates user with valid data', { /* ... */ });
    test('throws error for duplicate email', { /* ... */ });
  });

  describe('updateUser', () => {
    test('updates user with valid data', { /* ... */ });
    test('throws error for invalid id', { /* ... */ });
  });
});
```

## Running Tests

### Command Line
```bash
# Run all tests
vitest --run

# Run specific file
vitest --run path/to/file.spec.ts

# Run with coverage
vitest --run --coverage

# Run in watch mode (development)
vitest

# Run with UI
vitest --ui
```

### Test Execution
- Always use `--run` flag in CI/CD and automated workflows
- Use watch mode during development for fast feedback
- Run full suite before committing

## Scenario Tests

For integration tests or tests that need multiple when-then cycles:

```typescript
type Context = {
  cart: ShoppingCart;
  item: Item;
  total: number;
};

function empty_cart(this: Context) {
  this.cart = new ShoppingCart();
}

function item_exists(this: Context) {
  this.item = { id: '123', name: 'Widget', price: 10 };
}

function adding_item_to_cart(this: Context) {
  this.cart.addItem(this.item);
}

function cart_contains_item(this: Context) {
  expect(this.cart.items).toContain(this.item);
}

function checking_out(this: Context) {
  this.total = this.cart.checkout();
}

function total_is_correct(this: Context) {
  expect(this.total).toBe(10);
}

function cart_is_empty(this: Context) {
  expect(this.cart.items).toHaveLength(0);
}

test('completes shopping cart checkout workflow', {
  given: {
    empty_cart,
    item_exists,
  },
  scenario: [
    {
      name: 'Adding to cart',
      when: {
        adding_item_to_cart,
      },
      then: {
        cart_contains_item,
      },
    },
    {
      name: 'Checking out',
      then_when: {
        checking_out,
      },
      then: {
        total_is_correct,
        cart_is_empty,
      },
    },
  ],
});
```

**Scenario Features**:
- Chain multiple when-then cycles
- Use `then_when` for subsequent actions after assertions
- Optionally name each scenario step for better error messages
- Can use `expect_error` in scenario steps with `and` clause:

```typescript
{
  then_when: {
    something_that_throws,
  },
  then: {
    expect_error: error_is_handled,
    and: {
      state_is_still_valid,
    },
  },
}
```

## Disabling Tests

Use `xtest` to disable tests:

```typescript
import test, { xtest } from 'vitest-gwt';

describe('test context', () => {
  test('runs this test', {
    then: {
      assertion,
    },
  });

  xtest('does not run this test', {
    when: {
      broken_functionality,
    },
  });
});
```

## Multiple Assertions vs Multiple Tests

When testing the same setup conditions, prefer consolidating assertions into a single test with multiple `then` clauses rather than creating separate tests that duplicate the `given`/`when` setup.

### Preferred: Multiple `then` clauses in one test
```typescript
test('creates user with valid data', {
  given: {
    valid_user_data,
    mock_repository_configured,
  },
  when: {
    user_is_created,
  },
  then: {
    user_is_returned,
    user_has_correct_id,
    user_has_correct_name,
    repository_save_was_called,
  },
});
```

### Avoid: Duplicating setup across multiple tests
```typescript
// ❌ Don't do this - duplicates given/when setup
test('creates user and returns it', {
  given: { valid_user_data, mock_repository_configured },
  when: { user_is_created },
  then: { user_is_returned },
});

test('creates user with correct id', {
  given: { valid_user_data, mock_repository_configured },
  when: { user_is_created },
  then: { user_has_correct_id },
});

test('creates user and calls repository', {
  given: { valid_user_data, mock_repository_configured },
  when: { user_is_created },
  then: { repository_save_was_called },
});
```

**Benefits of consolidating**:
- Reduces test execution time (setup runs once)
- Makes related assertions easier to find
- Reduces code duplication
- Better reflects that these are all outcomes of the same behavior

**When to use separate tests**:
- Different `given` conditions lead to different behaviors
- Different `when` actions are being tested
- Tests are truly independent behaviors (not just different assertions on the same outcome)

## Anti-Patterns to Avoid

### Don't
- ❌ **Use arrow functions in GWT definitions** (most critical - breaks context binding)
- ❌ **Duplicate tests with same `given`/`when`** - use multiple `then` clauses instead
- ❌ Test implementation details (private methods, internal state)
- ❌ Write multiple unrelated assertions in one test
- ❌ Create tests that depend on execution order
- ❌ Use shared mutable state between tests
- ❌ Write fragile tests that break with refactoring
- ❌ Mock everything (over-mocking)
- ❌ Use `.test.ts` extension (use `.spec.ts`)
- ❌ Create `__tests__` directories (colocate tests)
- ❌ Skip error cases
- ❌ Write vague test names
- ❌ Pass arguments to step functions (use context instead)
- ❌ Return arrow functions from curried functions

### Do
- ✅ **Always use regular function declarations** (never arrow functions)
- ✅ **Consolidate multiple `then` clauses** for the same `given`/`when` conditions
- ✅ Test observable behavior and public interfaces
- ✅ Write focused, single-purpose tests
- ✅ Make tests independent and isolated
- ✅ Use descriptive test and step names
- ✅ Test both happy path and error cases
- ✅ Keep tests simple and readable
- ✅ Use `.spec.ts` extension
- ✅ Colocate tests with implementation
- ✅ Mock external dependencies only
- ✅ Follow Given-When-Then structure
- ✅ Use `expect_error` for expected exceptions
- ✅ Pass data between steps through `this` context only
- ✅ Use scenario tests for multi-step workflows
- ✅ Use `withAspect` for setup/teardown instead of beforeEach/afterEach

## Verification Checklist

Before completing test implementation:
- [ ] Test file uses `.spec.ts` extension
- [ ] Test file is colocated with implementation
- [ ] Imports `test` from `vitest-gwt` as default
- [ ] **All step functions use regular function declarations (NO arrow functions)**
- [ ] Context type is defined and properly typed
- [ ] Test names use clear sentence format describing behavior
- [ ] Step functions use `snake_case` naming
- [ ] Tests follow Given-When-Then structure (or scenario structure)
- [ ] Each test is independent and deterministic
- [ ] Mocks are used appropriately (external dependencies only)
- [ ] Error cases use `expect_error` in `then` clause
- [ ] Assertions are specific and meaningful
- [ ] Tests are readable and self-documenting
- [ ] No shared mutable state between tests
- [ ] Data passed between steps only through `this` context
- [ ] Curried functions return regular functions, not arrow functions
- [ ] Tests pass when run with `vitest --run`

## Tone

Write clear, comprehensive tests that serve as living documentation. Focus on behavior over implementation. Keep tests simple, readable, and maintainable.
