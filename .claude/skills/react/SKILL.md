---
name: react
description: |
  Use this skill when writing any React code. This skill details best practices,
  component design, composition, and hook gotchas.
---

# React

## useRef

The ONLY acceptable use for a useRef is to capture a native component using
`ref={myRef}`. In order to track state between calls, a useState, useMemo, and
useEffect ensures proper rerenders happen. useRef is too brittle for state
management.

## JSX

JSX should be SIMPLE. At most, conditional rendering is allowed with a single
variable comparison. Complex conditionals should be stored in a well-named
variable before the JSX renders and referenced. Ternaries in JSX are allowed,
but they must render only two paths. Nested Ternaries are too complex, and
should instead be broken out into a separate component in the components
directory.

## One Component per File

Only ONE component definition is allowed per file. Components should be reusable
and have their own FOLDER in the `src/components/<ComponentName>` folder with a
barrel file.

Sometimes, you have a tightly coupled component that the Component needs. Instead
of polluting the `src/components` folder with a bunch of really small tightly
coupled components (think: like a row definition component for a specific
table), you can make a "private" component file in the
`src/components/<ComponentName>/_MyPrivateComponent.tsx`. This honors the
One Component per File rule while also keeping the main component file clean and
easy to manage.

## useMemo

ANY new array or object definition that is used in JSX MUST be wrapped in a
useMemo with ALL dependencies in the dependency array.

This ensures there are no rerender loops or stale data references. React has a
very good state management and rerender system. Use it and let React be smart
about ensuring good render performance.

## useCallback

ALL functions used in JSX MUST be wrapped in a useCallback with ALL dependencies
in the dependency array.

This ensures that there are no stale references in the callback (a very difficult
to debug error)