# Package.json

1. npm monorepos should ban edits that include 'workspace:*'
2. monorepo'd projects should ban devDependencies in the workspace packages. put them in the root
3. you should not have multiple versions of dependencies across a monorepo. share them
4. must run ncu and use latest versions