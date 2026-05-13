---
name: typescript
description: |
  Use this skill when writing any TypeScript or JavaScript. This
  specifies explicit code style, language features, and guidance
  that WILL be validated after editing files and WILL fail your
  edits if you do not follow this skill precisely
---

# Types

Explicit types are necessary. Always use explicitly defined types and avoid
anonymous types when possible. Only use interfaces when for module augmentation.
Otherwise, use `type` definitions since they can be composed via discriminated
unions. DO NOT write classes, ever. Instead of a class, write a type and export
functions that take an instance of that type as the _last_ argument (fp style).

```typescript
// GOOD
export type MyTypeName = {
  prop: string;
  value: int;

  nestedThings: NestedType[];
};

export type NestedType = {
  id: string;
};
```

```typescript
// BAD
export interface MyTypeName { // interface instead of type
  prop: string;
  value: int;

  nestedThings Array<{ // anonymous type
    id: string;
  }>;
};
```

# Functions

Always use `const fn = () => {}` definitions over `function fn() {}`
definitions unless you use `this` within the function. Always prefer
"fp style" function declarations; args first data last. This is more
composable.