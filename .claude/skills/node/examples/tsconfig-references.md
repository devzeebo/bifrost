# TypeScript Project References

Enables cross-package type checking, faster incremental builds.

Root tsconfig.base.json:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "nodenext",
    "lib": ["ESNext"],
    "types": ["node"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true
  },
  "exclude": ["node_modules", "dist"]
}
```

Package tsconfig.json (packages/core/tsconfig.json):

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "references": [
    { "path": "../another-monorepo-package" }
  ],
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts", "**/*.test.ts"]
}
```
